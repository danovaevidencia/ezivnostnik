// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — admin: KAMPANE (spec kap. 132 a 141, ROZHODNUTIA č. 191–196, 243–252)
//
//  Vybraté z admin.html 27. 9. 2026 (spec 141.9) bez zmeny správania: admin ho
//  načíta až pri otvorení sekcie Kampane (alebo štúdia v novom okne). Klasický
//  skript, nie modul — obsluhy v onclick="…" potrebujú globálne funkcie a
//  kód používa globálne sb, esc a ďalšie pomôcky z admin.html.
// ═══════════════════════════════════════════════════════════════════════════
// ═══ KAMPANE (spec kap. 132) ═══════════════════════════════════════════════
// Studená pošta ide cez samostatnú doménu a účet (č. 191); o každej dávke
// rozhoduje človek, kým nie je doména zahriata. Odhlásenia sú trvalé a
// kontrolujú sa aj pri importe, aj tesne pred odoslaním.
let _kampane = [], _kampanOtvorena = null;
const KAMP_STAVY = { rozpisana:"rozpísaná", bezi:"beží", pozastavena:"pozastavená", dokoncena:"dokončená" };
async function nacitajKampane(){
  const body = document.getElementById("kampBody");
  // Výber adresátov zo skupiny, odozva a denný plán sú v admin_kontakty.js (admin_53).
  if(typeof kontKampanBlok !== "function" && typeof adminSkript === "function") await adminSkript("admin_kontakty.js");
  const { data, error } = await sb.rpc("kampan_prehlad");
  if(error){ body.innerHTML = '<div class="loading">Chyba načítania: ' + esc(error.message) + "</div>"; return; }
  _kampane = (data && data.kampane) || [];
  const log = (data && data.log) || [];
  body.innerHTML = (_kampane.length ? _kampane.map(kampanRiadok).join("")
      : '<div style="padding:14px 18px;color:var(--soft);font-size:13px">Zatiaľ žiadna kampaň.</div>')
    + '<div style="padding:10px 18px;border-top:1px solid var(--line);font-size:12px;color:var(--soft)">Trvalých odhlásení celkovo: <b>'
      + ((data && data.odhlasenia) || 0) + "</b>"
    + (log.length ? "<br>" + log.slice(0, 5).map(l => esc(new Date(l.cas).toLocaleString("sk-SK")) + " — " + esc(kampanLogText(l))).join("<br>") : "")
    + "</div>";
  if(_kampanOtvorena && typeof kontKampanDetail === "function") kontKampanDetail(_kampanOtvorena);
}
// Záznam logu kampane ľudskou rečou (spec 154 C2). Dovtedy „priprav
// {"pripravene":18,"vyradene":{"lehota":2}}“. Neznáma akcia ostane surová —
// nová akcia sa tak nestratí, len sa ukáže technicky.
const KAMP_LOG = {
  "priprav":              p => "pripravené " + (p.pripravene || 0) + (typeof kontVyradeneText === "function" ? kontVyradeneText(p.vyradene) : ""),
  "rucne-odoslane":       p => "odoslané ručne (adresát " + p.adresat + ")",
  "rucne-vyradene":       p => "vyradený ručne (adresát " + p.adresat + ")" + (p.dovod ? ": " + p.dovod : ""),
  "lehota-vyradene":      p => "vyradený — oslovený pred menej ako 60 dňami (adresát " + p.adresat + ")",
  "mx-vyradene":          p => "vyradený — doména " + (p.domena || "") + " neprijíma poštu",
  "mx-nezname":           p => "doménu " + (p.domena || "") + " sa nepodarilo overiť — skúsi sa o hodinu",
  "pripomienky-priprav":  p => "pripravené pripomienky " + (p.pripravene || 0),
  "pripomienka-odoslana": p => "pripomienka odoslaná (adresát " + p.adresat + ")",
  "davka":                p => "dávka: odoslané " + (p.odoslane || 0) + (p.chyby ? ", chyby " + p.chyby : "") + " · dnes " + p.dnes + "/" + p.limit
                                 + (typeof kontVyradeneText === "function" ? kontVyradeneText(p.vyradene) : ""),
  "skuska":               p => "skúška na " + (p.komu || "?") + (p.ok ? "" : " — chyba: " + (p.chyba || "?")),
  "import":               p => "import adresátov: pridaných " + (p.pridane || 0) + (p.odhlasene ? ", odhlásených " + p.odhlasene : ""),
  "vyber":                p => "výber zo skupiny " + (p.skupina || "") + ": pridaných " + (p.pridane || 0),
  "odpoved":              p => "odpoveď adresáta " + p.adresat + ": " + (p.odpoved || "—"),
};
function kampanLogText(l){
  const p = l.podrobnosti || {}, f = KAMP_LOG[l.akcia];
  try{ if(f) return f(p); }catch(_){ /* nečakaný tvar — padne na surový zápis nižšie */ }
  return l.akcia + " " + JSON.stringify(p);
}
function kampanRiadok(k){
  const otvorena = _kampanOtvorena === k.id;
  const st = '<span style="font-size:11.5px;color:var(--soft)">' + esc(KAMP_STAVY[k.stav] || k.stav)
    + (k.sposob === "rucne" ? " · ručná" : "") + "</span>";
  // Ručná kampaň sa nemeria — počty otvorení by tam boli vždy nula a klamali by.
  const merane = k.sposob === "rucne" ? " · pripravené " + (k.pripravene || 0)
    : " · otvorili najviac " + k.otvorili + " · klikli " + k.klikli + " · bounce " + k.bounce;
  const cisla = '<div style="font-size:12.5px;color:var(--soft);margin-top:4px">čaká <b>' + k.caka + "</b> · odoslané <b>" + k.odoslane
    + "</b> · dnes " + k.dnes + "/" + k.denny_limit + merane
    + " · odhlásení " + k.odhlaseni + (k.chyby ? " · chyby " + k.chyby : "") + "</div>";
  return '<div style="padding:12px 18px;border-bottom:1px solid var(--line)">'
    + '<div style="display:flex;align-items:center;gap:10px"><b>' + esc(k.nazov) + "</b> " + st + '<div class="sp"></div>'
    + '<button class="btn" onclick="kampanOtvor(' + k.id + ')">' + (otvorena ? "Zavrieť" : "Upraviť") + "</button></div>"
    + cisla + (otvorena ? kampanFormular(k) : "") + "</div>";
}
function kampanFormular(k){
  const p = (id, popis, hodnota, typ) => '<div class="field"><label>' + popis + '</label><input id="' + id + '" type="' + (typ || "text") + '" value="' + esc(hodnota) + '"></div>';
  if(k.sposob === "rucne") return kampanFormularRucne(k, p);
  return '<div style="margin-top:12px;display:grid;gap:10px">'
    + p("kampNazov", "Názov", k.nazov) + p("kampPredmet", "Predmet e-mailu", k.predmet)
    + '<div class="field"><label>Telo (HTML; polia {meno}, {source_url}, {odhlasenie} — bez {odhlasenie} sa poslať nedá)</label>'
      + '<textarea id="kampTelo" rows="8">' + esc(k.telo) + "</textarea></div>"
    + p("kampUtm", "utm_campaign (podľa toho sa kampaň nájde v Návštevnosti)", k.utm_campaign)
    + p("kampLimit", "Denný limit", k.denny_limit, "number")
    // skúška a dávka: polia v stránke, nie vyskakovacie okno prompt (spec 154 C1)
    + p("kampSkuska", "Skúšobný e-mail na adresu", kampGmailUcet(), "email")
    + p("kampDavkaPocet", "Koľko poslať v dávke", Math.max(1, (+k.denny_limit || 0) - (+k.dnes || 0)), "number")
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="btn" onclick="kampanUloz(' + k.id + ')">Uložiť</button>'
      + '<button class="btn" onclick="kampanSkuska(' + k.id + ')">Poslať skúšku sebe</button>'
      + '<button class="btn" onclick="kampanStav(' + k.id + ',\'' + (k.stav === "bezi" ? "pozastavena" : "bezi") + '\')">' + (k.stav === "bezi" ? "Pozastaviť" : "Spustiť") + "</button>"
      + '<button class="btn" onclick="kampanDavka(' + k.id + ')"' + (k.stav === "bezi" ? "" : " disabled") + ">Poslať dávku</button>"
      + kampanStudioTlacidlo(k)
      + "</div>"
    + (typeof kontKampanBlok === "function" ? kontKampanBlok(k) : "")
    + '<div class="field"><label>Import adresátov — CSV s hlavičkou email,meno,ico,source_url,source_seen_at (núdzovo; bežne vyber zo skupiny)</label>'
      + '<textarea id="kampCsv" rows="4" placeholder="email,meno,ico,source_url"></textarea></div>'
    + '<button class="btn" onclick="kampanImport(' + k.id + ')">Importovať</button>'
    + '<div id="kampSprava" style="font-size:13px;min-height:18px"></div></div>';
}
function kampanOtvor(id){ _kampanOtvorena = (_kampanOtvorena === id ? null : id); nacitajKampane(); }
// Štúdio kampane (náhľad desktop/mobil, spôsob, prevzatie šablóny, skúška
// sebe) v novom okne toho istého adminu — jedno prihlásenie (č. 252).
function kampanStudioTlacidlo(k){
  return '<button class="btn" style="width:auto" onclick="window.open(\'admin.html#studio/k' + k.id + '\',\'_blank\')">Štúdio v novom okne ↗</button>';
}
function kampanSprava(text, zle){
  const el = document.getElementById("kampSprava");
  if(el){ el.textContent = text; el.style.color = zle ? "var(--neg)" : "var(--accent2)"; }
}
// Nová kampaň = sprievodca v okne (spec 141.4): názov, cieľová skupina,
// šablóna z knižnice, spôsob odosielania ako prepínač s vysvetlením
// (predvolene ručne — hromadnú studenú poštu podmienky poskytovateľov
// zakazujú, č. 191), denný limit a utm_campaign. Do 27. 9. 2026 to boli
// prompt/confirm („OK = ručná · Zrušiť = hromadná“). Okno žije v
// admin_studio.js — ten istý renderer vyrobí telo kampane zo šablóny.
async function kampanNova(){
  try{
    await adminSkript("admin_studio.js");
    await studioSprievodca();
  }catch(e){
    console.error("sprievodca kampane:", e);
    const el = document.getElementById("kampBody");
    if(el) el.insertAdjacentHTML("afterbegin", '<div class="hint warn">Sprievodca sa nenačítal: ' + esc(e.message) + "</div>");
  }
}

// ═══════════════════════════════════════════════════════════════════
//  KAMPANE — ručné odosielanie (admin_50, kanál „účtovníci“, č. 194)
// ═══════════════════════════════════════════════════════════════════
// Server (kampan-posli, akcia „priprav“) skontroluje odhlásenia a pripraví
// hotový čistý text; človek ho pošle zo svojej schránky a klikne „Odoslané“.
// Nič sa neposiela cez Resend ani iného poskytovateľa a nič sa nemeria.
// Šablóny sú len v knižnici (Šablóny / štúdio, dev/kampane/sablony/*.json);
// vstavaná textová šablóna pre účtovníkov bola stará (bez UCTO3, starý podpis
// a UTM) a vložila sa jedným ťuknutím — odstránená 10. 10. 2026 (spec 154 A6).
let _rucnePripravene = [];
function kampanFormularRucne(k, p){
  return '<div style="margin-top:12px;display:grid;gap:10px">'
    + '<div class="hint">Ručná kampaň: e-maily sa neposielajú cez poskytovateľa. Server skontroluje odhlásenia a pripraví text, '
      + 'ty ho odošleš zo svojej schránky (info@ezivnostnik.eu) a klikneš <b>Odoslané</b>. Nič sa nemeria.</div>'
    + p("kampNazov", "Názov", k.nazov) + p("kampPredmet", "Predmet e-mailu", k.predmet)
    + '<div class="field"><label>Text — čistý text alebo HTML zo šablóny (polia {source_url}, {odhlasenie} — bez {odhlasenie} sa poslať nedá)</label>'
      + '<textarea id="kampTelo" rows="14">' + esc(k.telo) + "</textarea></div>"
    + p("kampUtm", "utm_campaign (podľa toho sa kampaň nájde v Návštevnosti)", k.utm_campaign)
    + p("kampLimit", "Denný limit (odporúčané 20–30)", k.denny_limit, "number")
    + p("kampGmail", "Gmail účet, v ktorom sa otvorí koncept (napr. roman@ezivnostnik.eu)", kampGmailUcet())
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="btn" style="width:auto" onclick="document.getElementById(\'kampSablonaSubor\').click()">Importovať šablónu (HTML)</button>'
      + '<input type="file" id="kampSablonaSubor" accept=".html,.htm,text/html" hidden onchange="kampanSablonaImport(this)">'
      + '<button class="btn" style="width:auto" onclick="kampanUloz(' + k.id + ')">Uložiť</button>'
      + '<button class="btn" style="width:auto" onclick="kampanNahlad(' + k.id + ')">Náhľad</button>'
      + '<button class="btn" style="width:auto" onclick="kampanStav(' + k.id + ',\'' + (k.stav === "bezi" ? "pozastavena" : "bezi") + '\')">' + (k.stav === "bezi" ? "Pozastaviť" : "Spustiť") + "</button>"
      // Počet je pole v stránke, nie vyskakovacie okno prompt (spec 154 C1): to okno blokuje
      // automatizáciu cez CDP a nedá sa doňho dať predvolený zvyšok limitu.
      + '<span style="display:inline-flex;align-items:center;gap:6px"><input id="kampPocet" type="number" min="1" max="30" value="' + kampPocetPredvolene(k)
        + '" aria-label="Koľko e-mailov pripraviť" style="width:64px">'
        + '<button class="btn" style="width:auto" onclick="kampanPriprav(' + k.id + ')"' + (k.stav === "bezi" ? "" : " disabled") + ">Pripraviť e-maily</button></span>"
      + kampanStudioTlacidlo(k)
      + "</div>"
    + '<div id="kampRucne"></div>'
    + (typeof kontKampanBlok === "function" ? kontKampanBlok(k) : "")
    + '<div class="field"><label>Import adresátov — CSV s hlavičkou email,meno,ico,source_url,source_seen_at (núdzovo; bežne vyber zo skupiny)</label>'
      + '<textarea id="kampCsv" rows="4" placeholder="email,meno,ico,source_url"></textarea></div>'
    + '<button class="btn" style="width:auto" onclick="kampanImport(' + k.id + ')">Importovať</button>'
    + '<div id="kampSprava" style="font-size:13px;min-height:18px"></div></div>';
}
// Gmail účet je voľba tohto počítača, nie údaj kampane (localStorage, CLAUDE.md).
function kampGmailUcet(){ try{ return localStorage.getItem("eziv_kamp_gmail") || ""; }catch(_){ return ""; } }
function kampGmailUloz(){
  const el = document.getElementById("kampGmail");
  if(el){ try{ localStorage.setItem("eziv_kamp_gmail", el.value.trim()); }catch(_){} }
}
// ── Šablóna zo súboru (č. 243) ─────────────────────────────────────────
// HTML súbor: <title> = predmet, obsah <body> = telo. Ručná kampaň ho
// posiela vložením do Gmailu (Ctrl+V), preto platí to, čo Gmail pri vložení
// zachová: len inline štýly, obrázky z nášho webu, žiadny skript ani formulár.
// Rozbor je čisto textový (bez DOM), aby ho vedel overiť test v Node.
function kampanSablonaRozober(zdroj){
  // Komentáre preč ešte pred hľadaním značiek — návod v komentári hlavičky
  // spomína „<title>“ aj „<body>“ a regex by sa chytil jeho.
  const s = String(zdroj || "").replace(/<!--[\s\S]*?-->/g, "");
  const dekoduj = t => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const predmet = dekoduj(((s.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim());
  const telo = ((s.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || "").trim();
  const chyby = [];
  if(!predmet) chyby.push("chýba <title> — z neho sa berie predmet e-mailu");
  if(!telo) chyby.push("chýba <body> s obsahom e-mailu");
  if(telo && telo[0] !== "<") chyby.push("telo musí začínať značkou HTML — inak ho server pošle ako čistý text");
  if(!telo.includes("{odhlasenie}")) chyby.push("chýba odkaz {odhlasenie}");
  if(!telo.includes("{source_url}")) chyby.push("chýba {source_url} — adresát musí vidieť, kde sme jeho kontakt našli");
  if(/<script/i.test(telo)) chyby.push("obsahuje <script>");
  if(/<(form|input|iframe|object|embed|video|audio)\b/i.test(telo)) chyby.push("obsahuje formulár, rámec alebo médium — e-mail ich nezobrazí");
  if(/\son[a-z]+\s*=/i.test(telo)) chyby.push("obsahuje obsluhu udalosti (on…=)");
  if(/href\s*=\s*"\s*javascript:/i.test(telo)) chyby.push("obsahuje odkaz javascript:");
  if(/<style/i.test(s)) chyby.push("blok <style> Gmail pri vložení zahodí — štýly patria inline do atribútu style");
  // Obrázky z nášho webu alebo z verejného bucketu kampaní (č. 247, admin_52).
  // Tú istú adresu bucketu drží STUDIO_BUCKET v admin_studio.js.
  const povoleneObrazky = ["https://ezivnostnik.eu/", "https://jriuljhmacgvxyrptbme.supabase.co/storage/v1/object/public/kampane/"];
  if(/\{cena:/.test(telo)) chyby.push("nedoplnená cena {cena:…} — ceny dopĺňa štúdio z podmienok");
  (telo.match(/<img\b[^>]*>/gi) || []).forEach(img => {
    const src = (img.match(/\ssrc\s*=\s*"([^"]*)"/i) || [])[1] || "";
    if(src.includes("..") || !povoleneObrazky.some(p => src.startsWith(p))) chyby.push("obrázok mimo ezivnostnik.eu a bucketu kampaní: " + (src || "(bez src)"));
    if(!/\salt\s*=/i.test(img)) chyby.push("obrázok bez alt: " + src);
  });
  if(telo.length > 100000) chyby.push("telo má " + telo.length + " znakov — Gmail dlhé správy skracuje");
  return { predmet, telo, chyby };
}
async function kampanSablonaImport(vstup){
  const subor = vstup.files && vstup.files[0];
  vstup.value = "";
  if(!subor) return;
  const r = kampanSablonaRozober(await subor.text());
  if(r.chyby.length){ kampanSprava("Šablóna " + subor.name + " sa nedá použiť: " + r.chyby.join(" · "), true); return; }
  const tel = document.getElementById("kampTelo"), pr = document.getElementById("kampPredmet");
  if(tel.value.trim() && !confirm("Prepísať súčasný predmet a text šablónou " + subor.name + "?")) return;
  pr.value = r.predmet;
  tel.value = r.telo;
  kampanHtmlNahlad(r.telo.split("{source_url}").join("www.priklad-uctovnictvo.sk/kontakt").split("{odhlasenie}").join("#"), "Náhľad importovanej šablóny (ešte neuložená)");
  kampanSprava("Šablóna " + subor.name + " načítaná — skontroluj náhľad a ulož.");
}
// Náhľad HTML v izolovanom rámci: sandbox bez skriptov, odkazy nikam nevedú.
function kampanHtmlNahlad(html, nadpis){
  const el = document.getElementById("kampRucne");
  if(!el) return;
  el.innerHTML = '<div class="hint"><b>' + esc(nadpis) + '</b></div>'
    + '<iframe id="kampNahladRam" sandbox="" style="width:100%;height:900px;border:1px solid var(--line);border-radius:10px;background:#fff"></iframe>';
  document.getElementById("kampNahladRam").srcdoc = html;
}
async function kampanVolaj(telo){
  const { data, error } = await sb.functions.invoke("kampan-posli", { body: telo });
  if(error || (data && data.chyba)) throw new Error((data && data.chyba) || error.message);
  return data;
}
async function kampanNahlad(id){
  try{
    const d = await kampanVolaj({ kampan: id, akcia: "nahlad" });
    if(d.nahlad.html){ kampanHtmlNahlad(d.nahlad.html, "Náhľad (uložená verzia, vymyslený adresát) · Predmet: " + d.nahlad.predmet); return; }
    document.getElementById("kampRucne").innerHTML = '<div class="hint"><b>Náhľad</b> (uložená verzia, vymyslený adresát)<br><b>Predmet:</b> '
      + esc(d.nahlad.predmet) + '<pre style="white-space:pre-wrap;font:inherit;margin-top:8px">' + esc(d.nahlad.text) + "</pre></div>";
  }catch(e){ kampanSprava("Chyba: " + e.message, true); }
}
function kampGmailOdkaz(e){
  const ucet = kampGmailUcet();
  return "https://mail.google.com/mail/" + (ucet ? "?authuser=" + encodeURIComponent(ucet) + "&" : "?")
    + "view=cm&fs=1&tf=1&to=" + encodeURIComponent(e.email) + "&su=" + encodeURIComponent(e.predmet) + "&body=" + encodeURIComponent(e.text);
}
// Predvolený počet = zvyšok dnešného limitu (1–30), aby sa jedným ťuknutím
// pripravilo presne to, čo dnes ešte smie odísť.
function kampPocetPredvolene(k){ return Math.max(1, Math.min(30, +k.denny_limit ? (+k.denny_limit) - (+k.dnes || 0) : 10)); }
// `pocet` sa dá podať priamo (vlákno, test); inak z poľa #kampPocet.
async function kampanPriprav(id, pocet){
  kampGmailUloz();
  const n = Math.floor(Number(pocet != null ? pocet : (document.getElementById("kampPocet") || {}).value));
  if(!(n >= 1)){ kampanSprava("Zadajte, koľko e-mailov pripraviť (1–30).", true); return; }
  try{
    const d = await kampanVolaj({ kampan: id, akcia: "priprav", pocet: n });
    _rucnePripravene = (d.emaily || []).map(e => Object.assign({ kampan: id }, e));
    kampanRucneVykresli();
    kampanSprava("Pripravených " + _rucnePripravene.length + " · dnes odoslaných " + d.dnes + "/" + d.limit + (d.dovod ? " (" + d.dovod + ")" : "")
      + (typeof kontVyradeneText === "function" ? kontVyradeneText(d.vyradene) : ""));
  }catch(e){ kampanSprava("Chyba: " + e.message, true); }
}
// Odkaz na hľadanie adresáta v Odoslaných — overenie, či e-mail už neodišiel.
function kampGmailHladaj(email){
  const ucet = kampGmailUcet();
  return "https://mail.google.com/mail/" + (ucet ? "?authuser=" + encodeURIComponent(ucet) : "") + "#search/" + encodeURIComponent("in:sent to:" + email);
}
// Web adresáta zo zdroja kontaktu — len http(s), nič iné sa ako odkaz nevloží.
function kampWebOdkaz(u){
  const s = String(u || "").trim(); if(!s) return "";
  const url = /^https?:\/\//i.test(s) ? s : "https://" + s;
  return /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : "";
}
// Odkaz do RPO podľa IČO (ten istý zdroj, z ktorého appka číta firmy): hlavná
// činnosť (SK NACE 6920 = účtovníctvo) sa overí jedným ťuknutím (spec 154 B4).
function kampRpoOdkaz(ico){ const d = String(ico || "").replace(/\D/g, ""); return d.length >= 6 ? "https://api.statistics.sk/rpo/v1/search?identifier=" + d : ""; }
function kampanOverene(i){ const e = _rucnePripravene[i]; if(e){ e.overene = true; kampanRucneVykresli(); } }
function kampanRucneVykresli(){
  const el = document.getElementById("kampRucne");
  if(!el) return;
  el.innerHTML = _rucnePripravene.map((e, i) => {
    // Pripravený už skôr a nezapísaný ako odoslaný (spec 154 A3): mohol odísť
    // a „Odoslané ✓“ sa nekliklo. Gmail sa otvorí až po overení v Odoslaných.
    const skor = !!e.pripravene_o && !e.overene;
    const web = kampWebOdkaz(e.source_url), rpo = kampRpoOdkaz(e.ico);
    return '<div class="hint" style="display:grid;gap:6px">'
    + '<div><b>' + esc(e.email) + "</b>" + (e.firma ? " · " + esc(e.firma) : "") + (e.ico ? ' <span style="color:var(--soft);font-size:12px">IČO ' + esc(e.ico) + "</span>" : "")
      + '<div style="font-size:12px;color:var(--soft)">zdroj: ' + (web ? '<a href="' + esc(web) + '" target="_blank" rel="noopener">' + esc(e.source_url) + " ↗</a>" : esc(e.source_url || "—"))
      + (rpo ? ' · <a href="' + esc(rpo) + '" target="_blank" rel="noopener">RPO (hlavná činnosť) ↗</a>' : "") + "</div></div>"
    + (skor ? '<div style="background:#fff5e6;border-radius:8px;padding:8px 10px;font-size:12.5px;color:var(--ink)">⚠ Pripravený už '
        + esc(new Date(e.pripravene_o).toLocaleString("sk-SK")) + " a nie je zapísaný ako odoslaný — možno odišiel a „Odoslané ✓“ sa nekliklo. "
        + '<a href="' + esc(kampGmailHladaj(e.email)) + '" target="_blank" rel="noopener">Hľadať v Odoslaných ↗</a>'
        + '<div style="margin-top:6px"><button class="rowbtn" onclick="kampanOverene(' + i + ')">Overil som — neodišiel</button></div></div>' : "")
    + '<div style="font-size:12.5px"><b>Predmet:</b> ' + esc(e.predmet) + "</div>"
    + '<details><summary style="cursor:pointer;font-size:12.5px">Text</summary><pre style="white-space:pre-wrap;font:inherit;font-size:12.5px;margin-top:6px">' + esc(e.text) + "</pre></details>"
    + (e.html ? '<div style="font-size:12.5px;color:var(--soft)">HTML šablóna: tlačidlo skopíruje e-mail a otvorí koncept s adresátom a predmetom — v Gmaile vlož telo cez <b>Ctrl+V</b>. Šablóna má vlastný podpis: ak ho Gmail pridá druhýkrát, zmaž ho (alebo v Gmaile nastav pre nové e-maily z odosielacej adresy „Bez podpisu“).</div>' : "")
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + (skor ? "" : (e.html ? '<button class="rowbtn" onclick="kampanHtmlDoGmailu(' + i + ')">Kopírovať a otvoriť Gmail</button>'
        : '<a class="rowbtn" href="' + esc(kampGmailOdkaz(e)) + '" target="_blank" rel="noopener">Otvoriť v Gmaile</a>')
        + '<button class="rowbtn" onclick="kampanKopiruj(' + i + ')">Kopírovať text</button>')
      + '<button class="rowbtn" onclick="kampanOdoslane(' + i + ')">Odoslané ✓</button>'
      + '<button class="rowbtn" onclick="kampanVyradZacni(' + i + ')">Vyradiť…</button>'
    + '</div><div id="kampVyrad' + i + '"></div></div>';
  }).join("");
}

// ── Vyradenie adresáta (spec 154 B3, admin_71 kampan_vyrad) ─────────────────
// Dovtedy SQL zápisom (spec 151.3) a vyradený neúčtovník sa v ďalšej kampani
// skupiny objavil znova. „Vylúčiť z kampaní“ = príznak na kontakte (aj iné
// adresy s tým istým IČO), skupina ostáva pre štatistiku (č. 154.8 bod 3).
const KAMP_VYRAD = {
  neuctovnik:    { n: "nie je účtovná kancelária", vylucit: true },
  bez_cinnosti:  { n: "web bez zmienky o činnosti", vylucit: true },
  nedorucitelna: { n: "nedoručiteľná adresa", vylucit: false },
  duplicita:     { n: "duplicita (iná adresa tej istej firmy)", vylucit: false },
  ine:           { n: "iné", vylucit: false },
};
function kampVyradDovod(typ, upresnenie){
  const u = String(upresnenie || "").trim();
  if(typ === "ine" || !KAMP_VYRAD[typ]) return u;
  return KAMP_VYRAD[typ].n + (u ? ": " + u : "");
}
let _kampVyrad = null;
// Formulár v mieste `miesto`; stav ≠ čaká = e-mail už odišiel, ostáva len
// vylúčenie z ďalších kampaní (server inak odmietne).
function kampVyradOtvor(miesto, adresat, email, stav, poVyradeni){
  _kampVyrad = { miesto, adresat, email, caka: stav === "caka", poVyradeni };
  const el = document.getElementById(miesto);
  if(!el) return;
  el.innerHTML = '<div class="hint warn" style="display:grid;gap:6px">'
    + "<b>Vyradiť " + esc(email) + "</b>" + (_kampVyrad.caka ? "" : '<span style="font-size:12.5px">E-mail už odišiel — kontakt sa len vylúči z ďalších kampaní.</span>')
    + '<select id="kvTyp" onchange="kampVyradTyp()">' + Object.entries(KAMP_VYRAD).map(([k, v]) => '<option value="' + k + '">' + esc(v.n) + "</option>").join("") + "</select>"
    + '<input id="kvUpr" placeholder="upresnenie, napr. čím sa firma zaoberá" autocomplete="off">'
    + '<label class="chk"><input type="checkbox" id="kvVylucit"' + (_kampVyrad.caka ? "" : " disabled") + "> Vylúčiť z ďalších kampaní (aj iné adresy s tým istým IČO)</label>"
    + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="rowbtn" style="border-color:var(--neg);color:var(--neg)" onclick="kampVyradPotvrd()">Vyradiť</button>'
    + '<button class="rowbtn" onclick="kampVyradZrus()">Zrušiť</button></div><div class="err" id="kvChyba"></div></div>';
  kampVyradTyp();
}
function kampVyradTyp(){
  const typ = (document.getElementById("kvTyp") || {}).value;
  const chk = document.getElementById("kvVylucit");
  if(chk) chk.checked = !_kampVyrad || !_kampVyrad.caka ? true : !!(KAMP_VYRAD[typ] || {}).vylucit;
}
function kampVyradZrus(){
  const el = _kampVyrad && document.getElementById(_kampVyrad.miesto);
  if(el) el.innerHTML = "";
  _kampVyrad = null;
}
async function kampVyradPotvrd(){
  const v = _kampVyrad; if(!v) return;
  const dovod = kampVyradDovod(document.getElementById("kvTyp").value, document.getElementById("kvUpr").value);
  const chyba = document.getElementById("kvChyba");
  if(!dovod){ chyba.textContent = "Napíšte dôvod."; return; }
  const vylucit = !!document.getElementById("kvVylucit").checked;
  const { data, error } = await sb.rpc("kampan_vyrad", { p_adresat: v.adresat, p_dovod: dovod, p_vylucit: vylucit });
  if(error){ chyba.textContent = "Nevyradené: " + error.message; return; }
  kampVyradZrus();
  if(v.poVyradeni) await v.poVyradeni(data || {}, dovod);
}
function kampanVyradZacni(i){
  const e = _rucnePripravene[i]; if(!e) return;
  kampVyradOtvor("kampVyrad" + i, e.id, e.email, "caka", (r, dovod) => {
    const j = _rucnePripravene.indexOf(e);
    if(j >= 0) _rucnePripravene.splice(j, 1);
    kampanRucneVykresli();
    kampanSprava("Vyradený: " + e.email + " — " + dovod + (r.vylucene_kontaktov ? " · vylúčený z ďalších kampaní" : ""));
  });
}
async function kampanKopiruj(i){
  const e = _rucnePripravene[i];
  try{ await navigator.clipboard.writeText("Predmet: " + e.predmet + "\n\n" + e.text); kampanSprava("Skopírované: " + e.email); }
  catch(err){ kampanSprava("Kopírovanie zlyhalo: " + err.message, true); }
}
// HTML e-mail sa do Gmailu nedá poslať odkazom (parameter body nesie len
// čistý text). Schránka dostane HTML aj čistý text naraz a koncept sa otvorí
// bez tela — Ctrl+V doň vloží naformátovaný e-mail. Najprv zápis do schránky
// (vyžaduje zameranú stránku), až potom nová karta — tá by fokus vzala.
async function kampanHtmlDoGmailu(i){
  const e = _rucnePripravene[i];
  if(!e) return;
  // Poistka aj tu, nie len skryté tlačidlo — volá sa aj mimo kliknutia (spec 154 A3).
  if(e.pripravene_o && !e.overene){ kampanSprava("Adresát " + e.email + " bol pripravený už skôr — najprv over v Odoslaných, či e-mail neodišiel.", true); return; }
  try{
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([e.html], { type: "text/html" }),
      "text/plain": new Blob([e.text], { type: "text/plain" }),
    })]);
  }catch(err){ kampanSprava("Kopírovanie zlyhalo: " + err.message, true); return; }
  // S „noopener“ vracia window.open vždy null — zablokované okno sa rozpoznať nedá.
  window.open(kampGmailOdkaz(Object.assign({}, e, { text: "" })), "_blank", "noopener");
  kampanSprava("Skopírované: " + e.email + " — v Gmaile vlož telo cez Ctrl+V (ak sa karta neotvorila, povoľ vyskakovacie okná).");
}
// „Odoslané“ zapisuje až človek — server nevie, či e-mail naozaj odišiel.
async function kampanOdoslane(i){
  const e = _rucnePripravene[i];
  try{
    await kampanVolaj({ kampan: e.kampan, akcia: "odoslane", adresat: e.id });
    _rucnePripravene.splice(i, 1);
    kampanRucneVykresli();
    kampanSprava("Zapísané ako odoslané: " + e.email);
  }catch(err){ kampanSprava("Chyba: " + err.message, true); }
}
async function kampanUloz(id){
  kampGmailUloz();
  const p = { id, nazov: document.getElementById("kampNazov").value, predmet: document.getElementById("kampPredmet").value,
    telo: document.getElementById("kampTelo").value, utm_campaign: document.getElementById("kampUtm").value,
    denny_limit: document.getElementById("kampLimit").value };
  const { error } = await sb.rpc("kampan_uloz", { p });
  if(error) kampanSprava("Chyba: " + error.message, true); else { kampanSprava("Uložené."); nacitajKampane(); }
}
async function kampanStav(id, stav){
  const { error } = await sb.rpc("kampan_uloz", { p: { id, stav } });
  if(error) alert("Chyba: " + error.message); else nacitajKampane();
}
// CSV bez závislostí: hlavička určuje stĺpce, úvodzovky sa rešpektujú.
function kampanCsv(text){
  const riadky = String(text || "").split(/\r?\n/).filter(x => x.trim());
  if(!riadky.length) return [];
  const rozdel = (r) => {
    const out = []; let a = "", v = false;
    for(let i = 0; i < r.length; i++){
      const z = r[i];
      if(z === '"'){ if(v && r[i+1] === '"'){ a += '"'; i++; } else v = !v; }
      else if((z === "," || z === ";") && !v){ out.push(a); a = ""; }
      else a += z;
    }
    out.push(a); return out.map(x => x.trim());
  };
  const hlavicka = rozdel(riadky[0]).map(x => x.toLowerCase());
  return riadky.slice(1).map(r => { const c = rozdel(r), o = {}; hlavicka.forEach((h, i) => o[h] = c[i] || null); return o; });
}
async function kampanImport(id){
  const riadky = kampanCsv(document.getElementById("kampCsv").value);
  if(!riadky.length){ kampanSprava("CSV je prázdne.", true); return; }
  const { data, error } = await sb.rpc("kampan_import", { p_kampan: id, p_riadky: riadky });
  if(error){ kampanSprava("Chyba: " + error.message, true); return; }
  kampanSprava("Pridaných " + data.pridane + " · odhlásených " + data.odhlasene + " · bez zdroja " + data.bez_zdroja
    + " · duplicita " + data.duplicita + " · chybný e-mail " + data.zle + (data.nedavno ? " · nedávno oslovených " + data.nedavno : "") + (data.vylucene ? " · vylúčených z kampaní " + data.vylucene : ""));
  document.getElementById("kampCsv").value = "";
  nacitajKampane();
}
async function kampanSkuska(id){
  const komu = String((document.getElementById("kampSkuska") || {}).value || "").trim();
  if(!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(komu)){ kampanSprava("Zadajte adresu, na ktorú ide skúška.", true); return; }
  const { data, error } = await sb.functions.invoke("kampan-posli", { body: { kampan: id, skuska: komu } });
  if(error || (data && data.chyba)) kampanSprava("Chyba: " + ((data && data.chyba) || error.message), true);
  else kampanSprava("Skúška odoslaná na " + komu + ".");
}
async function kampanDavka(id){
  const k = _kampane.find(x => x.id === id) || {};
  const pocet = Math.floor(Number((document.getElementById("kampDavkaPocet") || {}).value));
  if(!(pocet >= 1)){ kampanSprava("Zadajte, koľko e-mailov poslať.", true); return; }
  if(!confirm("Naozaj odoslať " + pocet + " e-mailov kampane „" + (k.nazov || "") + "“? Odoslané sa nedá vziať späť.")) return;
  const { data, error } = await sb.functions.invoke("kampan-posli", { body: { kampan: id, pocet: +pocet } });
  if(error || (data && data.chyba)) kampanSprava("Chyba: " + ((data && data.chyba) || error.message), true);
  else kampanSprava("Odoslané " + data.odoslane + (data.chyby ? ", chyby " + data.chyby : "") + " · dnes spolu " + data.dnes + "/" + data.limit + (data.dovod ? " (" + data.dovod + ")" : "")
    + (typeof kontVyradeneText === "function" ? kontVyradeneText(data.vyradene) : ""));
  nacitajKampane();
}
