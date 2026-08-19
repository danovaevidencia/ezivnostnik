// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — odborné články, spoločný modul
//
//  Používajú ho ŠTYRIA:
//    · admin.html            — čistí pri ukladaní, vykresľuje náhľad
//    · ezivnostnik.html      — čítačka v appke
//    · index.html            — perexy na úvodnej stránke
//    · edge funkcia clanok-publikuj — generuje statickú stránku
//
//  Preto je to samostatný súbor a nie kópia na štyroch miestach. Zoznam
//  povoleného HTML je jediné miesto pravdy; keby existoval dvakrát, rozišiel
//  by sa a jedna z kópií by bola tá deravá.
//
//  ESM zámerne: appka aj admin si ho ťahajú cez import() až keď treba (nikdy
//  nie v <head> — štart appky sa nesmie zdržať), edge funkcia statickým
//  importom cez esm.sh/gh (z vlastnej domény bundler neimportuje).
//
//  ČISTÍ SA PRI UKLADANÍ AJ PRI VYKRESĽOVANÍ. Len pri ukladaní nestačí:
//  čo raz je v databáze, sa raz vykreslí, a databáza nie je jediná cesta dnu
//  navždy.
// ═══════════════════════════════════════════════════════════════════════════

// Edge funkcia si ju overuje. Keby esm.sh podal starú kópiu súboru, nasadenie
// spadne s hláškou namiesto toho, aby ticho generovalo stránky starou čističkou.
export const VERZIA = "1";

// ── Čo smie prejsť ─────────────────────────────────────────────────────────
// Kľúč = tag, hodnota = povolené atribúty. Čo tu nie je, vypadne.
export const POVOLENE = {
  p:[], h2:[], h3:[], h4:[],
  ul:[], ol:[], li:[],
  strong:[], em:[], u:[], s:[],
  a:["href","title"],
  img:["src","alt","title"],
  blockquote:[], hr:[], br:[],
  table:[], thead:[], tbody:[], tr:[],
  th:["colspan","rowspan"], td:["colspan","rowspan"],
  code:[], pre:[],
};

// Obsah týchto tagov sa NEZACHOVÁVA. Pri ostatných nepovolených sa obal zahodí
// a text vnútri ostane — prilepený odsek zo stránky nemá zmiznúť len preto,
// že bol zabalený v <div>.
const ZAHODIT_AJ_S_OBSAHOM = new Set([
  "script","style","iframe","object","embed","template","noscript",
  "form","input","button","select","textarea","svg","math","link","meta","head",
]);

// Tagy bez zatváracej značky.
const PRAZDNE = new Set(["br","hr","img"]);

// ── Escapovanie ────────────────────────────────────────────────────────────
export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Odkazy a obrázky ───────────────────────────────────────────────────────
// `javascript:` je ten dôvod, prečo sa href nedá prepustiť tak, ako prišiel.
// Povolené je http(s), mailto a cesta v rámci vlastnej stránky.
export function bezpecnyOdkaz(url) {
  const v = String(url || "").trim();
  if (!v) return null;
  if (/^(https?:\/\/|mailto:)/i.test(v)) return v;
  if (/^\/(?!\/)/.test(v)) return v;          // "/clanky/…" áno, "//cudzia.sk" nie
  if (/^#/.test(v)) return v;
  return null;
}

// Obrázok smie byť buď súbor z nášho repozitára, alebo data: URI (koncept,
// kým sa článok nezverejní a obrázky sa nevytiahnu do súborov).
export function bezpecnyObrazok(url) {
  const v = String(url || "").trim();
  if (!v) return null;
  if (/^\/clanky\/obrazky\/[A-Za-z0-9._-]+$/.test(v)) return v;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(v)) return v;
  return null;
}

// ── Čistička ───────────────────────────────────────────────────────────────
// Výstup sa NESKLADÁ z pôvodného HTML — skladá sa nanovo z toho, čo prešlo.
// Preto nezáleží na tom, čím sa útočník pokúsi parser zmiasť: čo sa nedostane
// do stromu ako povolený uzol, do výstupu sa nedostane vôbec.
//
// `parser` je DOMParser. V prehliadači sa doplní sám, v Dene (edge funkcia)
// sa podáva z deno-dom — zoznam povoleného ostáva jeden pre oboch.
export function cistiHtml(html, parser) {
  const P = parser || (typeof DOMParser !== "undefined" ? new DOMParser() : null);
  if (!P) throw new Error("cistiHtml: chýba DOMParser");

  const doc = P.parseFromString(
    "<!doctype html><html><body>" + String(html == null ? "" : html) + "</body></html>",
    "text/html"
  );
  const telo = doc && doc.body;
  if (!telo) return "";
  return deti(telo);

  function deti(uzol) {
    let out = "";
    const zoznam = uzol.childNodes || [];
    for (let i = 0; i < zoznam.length; i++) out += uzolNaText(zoznam[i]);
    return out;
  }

  function uzolNaText(n) {
    // 3 = text, 1 = element. Komentáre (8) a všetko ostatné ticho vypadnú.
    if (n.nodeType === 3) return esc(n.nodeValue || "");
    if (n.nodeType !== 1) return "";

    const tag = String(n.nodeName || "").toLowerCase();
    if (ZAHODIT_AJ_S_OBSAHOM.has(tag)) return "";
    if (!Object.prototype.hasOwnProperty.call(POVOLENE, tag)) return deti(n);

    let atr = "";
    for (const meno of POVOLENE[tag]) {
      let v = n.getAttribute ? n.getAttribute(meno) : null;
      if (v == null || v === "") continue;

      if (meno === "href") { v = bezpecnyOdkaz(v); if (!v) continue; }
      else if (meno === "src") { v = bezpecnyObrazok(v); if (!v) continue; }
      else if (meno === "colspan" || meno === "rowspan") {
        const c = parseInt(v, 10);
        if (!(c > 1 && c <= 20)) continue;
        v = String(c);
      }
      atr += ` ${meno}="${esc(v)}"`;
    }

    // Externý odkaz nesmie otvoriť appku v tom istom okne — používateľ by
    // prišiel o rozrobenú prácu. rel je proti window.opener.
    if (tag === "a") {
      const h = n.getAttribute ? n.getAttribute("href") : null;
      if (h && /^https?:\/\//i.test(h)) atr += ' target="_blank" rel="noopener noreferrer"';
      if (!atr) return deti(n);              // odkaz bez platného href je len text
    }
    if (tag === "img") {
      if (!/\ssrc="/.test(atr)) return "";   // obrázok bez platného zdroja nemá čo robiť
      atr += ' loading="lazy"';
    }

    if (PRAZDNE.has(tag)) return `<${tag}${atr}>`;
    return `<${tag}${atr}>${deti(n)}</${tag}>`;
  }
}

// Atribúty, ktoré cistiHtml dopĺňa sama. Validátor nižšie ich musí poznať,
// inak by odmietol vlastný výstup.
const PRIDAVANE = { a: ["target", "rel"], img: ["loading"] };

// ── Validátor ──────────────────────────────────────────────────────────────
// Čistička potrebuje DOMParser, ktorý je len v prehliadači. Toto je opačná
// úloha: nič neopravuje, len povie, či reťazec JE výstupom čističky. Preto
// vystačí s reťazcovými operáciami — a preto ju vie použiť edge funkcia
// v Dene aj test v Node bez jedinej závislosti.
//
// Zlyháva zatvorená: čo nevie prečítať, odmietne. Vracia null (v poriadku),
// alebo vetu, čo je zle — publikovanie sa zastaví a v logu je dôvod.
export function overSubset(html) {
  const s = String(html == null ? "" : html);
  const odesc = v => String(v).replace(/&quot;/g, '"').replace(/&gt;/g, ">")
                              .replace(/&lt;/g, "<").replace(/&amp;/g, "&");

  for (const t of s.match(/<[^>]*>/g) || []) {
    const m = /^<(\/?)([a-zA-Z0-9]+)((?:\s[^>]*)?)>$/.exec(t);
    if (!m) return "nečitateľná značka: " + t.slice(0, 40);

    const zatvara = m[1] === "/", tag = m[2].toLowerCase(), zvysok = m[3] || "";
    if (!Object.prototype.hasOwnProperty.call(POVOLENE, tag)) return "nepovolený tag: " + tag;
    if (zatvara) {
      if (zvysok.trim()) return "zatvárajúca značka s atribútmi: " + t.slice(0, 40);
      continue;
    }

    const povolene = POVOLENE[tag].concat(PRIDAVANE[tag] || []);
    const re = /\s+([a-zA-Z-]+)(?:="([^"]*)")?/g;
    let r, koniec = 0;
    while ((r = re.exec(zvysok))) {
      koniec = re.lastIndex;
      const meno = r[1].toLowerCase(), hod = r[2];
      if (!povolene.includes(meno)) return `atribút ${meno} nepatrí do <${tag}>`;
      if (hod === undefined) return `atribút ${meno} bez hodnoty v úvodzovkách`;
      if (meno === "href" && !bezpecnyOdkaz(odesc(hod))) return "nebezpečný href: " + hod.slice(0, 40);
      if (meno === "src" && !bezpecnyObrazok(odesc(hod))) return "nebezpečný src: " + hod.slice(0, 40);
    }
    if (zvysok && koniec !== zvysok.length) return `nečitateľné atribúty v <${tag}>`;
  }

  // Text mimo značiek musí byť escapovaný. Zvyšné "<" znamená, že reťazec
  // neprešiel čističkou — alebo ho po nej niekto upravil.
  if (s.replace(/<[^>]*>/g, "").includes("<")) return "neescapované < v texte";
  return null;
}

// ── Drobnosti spoločné pre všetkých ────────────────────────────────────────

// Slug je kľúč v databáze aj názov súboru na webe. Diakritika v oboch prekáža.
export function slugify(text) {
  return String(text || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function formatDatum(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${+m[3]}. ${+m[2]}. ${m[1]}`;
}

// Perex sa dá vyrobiť z tela, keď ho autor nevyplnil. Značky von, text ostáva.
export function textZHtml(html, dlzka) {
  const t = String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
  if (!dlzka || t.length <= dlzka) return t;
  return t.slice(0, t.lastIndexOf(" ", dlzka) > 0 ? t.lastIndexOf(" ", dlzka) : dlzka) + "…";
}

// ── Pätka článku ───────────────────────────────────────────────────────────
// Dátum, zdroj a disclaimer sú na statickej stránke aj v čítačke v appke.
// Jedna funkcia preto, že sa to inak rozíde — a rozišlo by sa práve na
// disclaimeri, ktorý si nikto nevšimne, kým ho nebude treba.
export function patkaHtml(c) {
  const datum = formatDatum(c && (c.zmenene || c.publikovane));
  const zdroj = c && c.zdroj_url && bezpecnyOdkaz(c.zdroj_url);
  return `<div class="cl-patka">
${datum ? `<div class="cl-datum">Aktualizované ${esc(datum)}</div>` : ""}
${zdroj ? `<div class="cl-zdroj">Zdroj: <a href="${esc(zdroj)}" target="_blank" rel="noopener noreferrer">${esc(c.zdroj_nazov || c.zdroj_url)}</a></div>` : ""}
<div class="cl-disclaimer">Informatívny text. Nenahrádza daňové poradenstvo — o konkrétnej situácii rozhoduje jej znenie a platné predpisy.</div>
</div>`;
}

// ── Výber článku pre modul ─────────────────────────────────────────────────
// Kontextové pole sa kreslí len vtedy, keď je čo ukázať. Trvalý prvok, ktorý
// väčšinou hlási „nič", miesto nezaberá — preto táto funkcia vracia null
// a nie prázdny zoznam s hláškou.
//
// `skryte` sú id článkov, ktoré si používateľ odklikol natrvalo,
// `docasne` tie, čo skryl len do zatvorenia appky.
export function vyberPreModul(clanky, modul, skryte, docasne) {
  if (!Array.isArray(clanky) || !modul) return null;
  const s = new Set(skryte || []), d = new Set(docasne || []);
  const vhodne = clanky.filter(c =>
    Array.isArray(c.moduly) && c.moduly.includes(modul) && !s.has(c.id) && !d.has(c.id)
  );
  if (!vhodne.length) return null;
  vhodne.sort((a, b) => String(b.publikovane || "").localeCompare(String(a.publikovane || "")));
  return vhodne[0];
}
