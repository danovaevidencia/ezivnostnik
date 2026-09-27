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
    + (log.length ? "<br>" + log.slice(0, 5).map(l => esc(new Date(l.cas).toLocaleString("sk-SK")) + " — " + esc(l.akcia) + " " + esc(JSON.stringify(l.podrobnosti || {}))).join("<br>") : "")
    + "</div>";
  if(_kampanOtvorena && typeof kontKampanDetail === "function") kontKampanDetail(_kampanOtvorena);
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
// Ceny v šablóne musia sedieť s podmienkami — stráži test_kampane.
const SABLONA_UCTOVNICI = {
  predmet: "E-faktúry od roku 2027 a vaši klienti živnostníci",
  telo: [
    "Dobrý deň,",
    "",
    "volám sa Roman Slivka a vyvíjam eživnostník — aplikáciu na daňovú evidenciu a fakturáciu pre živnostníkov. Píšem vám, pretože na svojej stránke ponúkate vedenie účtovníctva.",
    "",
    "Od 1. 1. 2027 budú všetci vaši klienti prijímať faktúry elektronicky cez sieť Peppol a platitelia DPH ich budú aj vystavovať. Každý si pritom musí na portáli Finančnej správy vybrať poskytovateľa a doklady už nebudú chodiť ako PDF v e-maile.",
    "",
    "Klientom, ktorí vedú daňovú evidenciu, to eživnostník rieši v jednej aplikácii:",
    "– prijímanie e-faktúr zadarmo, aj v bezplatnom pláne; prijatá faktúra sa ponúkne na zaevidovanie do výdavkov a originál sa archivuje,",
    "– odosielanie e-faktúr v pláne Platiteľ DPH za 9,90 € bez DPH mesačne,",
    "– faktúry, výdavky, banka, kniha jázd, DPH aj daňové priznanie typu B.",
    "",
    "Pre vás je určený plán Účtovník: firmy klientov spravujete z jedného účtu (2, 5 alebo 10 firiem, od 19,80 € bez DPH mesačne). Klient vás do svojej firmy pozve sám a podklady za celý rok vám odovzdá v jednom súbore Excel.",
    "",
    "Aplikáciu si môžete hneď pozrieť v ukážke bez registrácie:",
    "https://ezivnostnik.eu/ezivnostnik.html?vstup=demo&utm_source=email&utm_medium=osobne&utm_campaign=uctovnici",
    "",
    "Ak vás to zaujíma, rád vám ju ukážem aj na krátkom online stretnutí — stačí odpísať na tento e-mail.",
    "",
    "S pozdravom",
    "",
    "Ing. Roman Slivka",
    "eživnostník — účtovníctvo a e-faktúry pre živnostníkov",
    "info@ezivnostnik.eu · https://ezivnostnik.eu",
    "",
    "—",
    "Doručovaciu službu e-faktúr poskytuje Ing. Roman Slivka - agile management ako sprostredkovateľ zapísaný v zozname Finančnej správy SR; technicky ju zabezpečuje certifikovaný poskytovateľ Verteco digital services, s. r. o. (EFSK000031).",
    "Váš kontakt som našiel na {source_url}. Ak si neželáte ďalšie správy, odhlásite sa jedným klikom: {odhlasenie}",
  ].join("\n"),
};
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
      + '<button class="btn" style="width:auto" onclick="kampanSablonaUctovnici()">Vložiť šablónu pre účtovníkov</button>'
      + '<button class="btn" style="width:auto" onclick="document.getElementById(\'kampSablonaSubor\').click()">Importovať šablónu (HTML)</button>'
      + '<input type="file" id="kampSablonaSubor" accept=".html,.htm,text/html" hidden onchange="kampanSablonaImport(this)">'
      + '<button class="btn" style="width:auto" onclick="kampanUloz(' + k.id + ')">Uložiť</button>'
      + '<button class="btn" style="width:auto" onclick="kampanNahlad(' + k.id + ')">Náhľad</button>'
      + '<button class="btn" style="width:auto" onclick="kampanStav(' + k.id + ',\'' + (k.stav === "bezi" ? "pozastavena" : "bezi") + '\')">' + (k.stav === "bezi" ? "Pozastaviť" : "Spustiť") + "</button>"
      + '<button class="btn" style="width:auto" onclick="kampanPriprav(' + k.id + ')"' + (k.stav === "bezi" ? "" : " disabled") + ">Pripraviť e-maily</button>"
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
function kampanSablonaUctovnici(){
  const tel = document.getElementById("kampTelo"), pr = document.getElementById("kampPredmet");
  if(tel.value.trim() && !confirm("Prepísať súčasný predmet a text šablónou pre účtovníkov?")) return;
  pr.value = SABLONA_UCTOVNICI.predmet;
  tel.value = SABLONA_UCTOVNICI.telo;
  if(!document.getElementById("kampUtm").value) document.getElementById("kampUtm").value = "uctovnici";
  kampanSprava("Šablóna vložená — skontroluj a ulož.");
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
async function kampanPriprav(id){
  kampGmailUloz();
  const k = _kampane.find(x => x.id === id) || {};
  const pocet = prompt("Koľko e-mailov pripraviť? (čaká " + (k.caka || 0) + ", dnes " + (k.dnes || 0) + "/" + (k.denny_limit || 0) + ")", "10");
  if(!pocet) return;
  try{
    const d = await kampanVolaj({ kampan: id, akcia: "priprav", pocet: +pocet });
    _rucnePripravene = (d.emaily || []).map(e => Object.assign({ kampan: id }, e));
    kampanRucneVykresli();
    kampanSprava("Pripravených " + _rucnePripravene.length + " · dnes odoslaných " + d.dnes + "/" + d.limit + (d.dovod ? " (" + d.dovod + ")" : "")
      + (typeof kontVyradeneText === "function" ? kontVyradeneText(d.vyradene) : ""));
  }catch(e){ kampanSprava("Chyba: " + e.message, true); }
}
function kampanRucneVykresli(){
  const el = document.getElementById("kampRucne");
  if(!el) return;
  el.innerHTML = _rucnePripravene.map((e, i) => '<div class="hint" style="display:grid;gap:6px">'
    + '<div><b>' + esc(e.email) + '</b> <span style="color:var(--soft);font-size:12px">zdroj: ' + esc(e.source_url) + "</span></div>"
    + '<div style="font-size:12.5px"><b>Predmet:</b> ' + esc(e.predmet) + "</div>"
    + '<details><summary style="cursor:pointer;font-size:12.5px">Text</summary><pre style="white-space:pre-wrap;font:inherit;font-size:12.5px;margin-top:6px">' + esc(e.text) + "</pre></details>"
    + (e.html ? '<div style="font-size:12.5px;color:var(--soft)">HTML šablóna: tlačidlo skopíruje e-mail a otvorí koncept s adresátom a predmetom — v Gmaile vlož telo cez <b>Ctrl+V</b>. Šablóna má vlastný podpis: ak ho Gmail pridá druhýkrát, zmaž ho (alebo v Gmaile nastav pre nové e-maily z odosielacej adresy „Bez podpisu“).</div>' : "")
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + (e.html ? '<button class="rowbtn" onclick="kampanHtmlDoGmailu(' + i + ')">Kopírovať a otvoriť Gmail</button>'
        : '<a class="rowbtn" href="' + esc(kampGmailOdkaz(e)) + '" target="_blank" rel="noopener">Otvoriť v Gmaile</a>')
      + '<button class="rowbtn" onclick="kampanKopiruj(' + i + ')">Kopírovať text</button>'
      + '<button class="rowbtn" onclick="kampanOdoslane(' + i + ')">Odoslané ✓</button>'
    + "</div></div>").join("");
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
    + " · duplicita " + data.duplicita + " · chybný e-mail " + data.zle);
  document.getElementById("kampCsv").value = "";
  nacitajKampane();
}
async function kampanSkuska(id){
  const komu = prompt("Skúšobný e-mail poslať na adresu:");
  if(!komu) return;
  const { data, error } = await sb.functions.invoke("kampan-posli", { body: { kampan: id, skuska: komu } });
  if(error || (data && data.chyba)) kampanSprava("Chyba: " + ((data && data.chyba) || error.message), true);
  else kampanSprava("Skúška odoslaná na " + komu + ".");
}
async function kampanDavka(id){
  const k = _kampane.find(x => x.id === id) || {};
  const pocet = prompt("Koľko e-mailov poslať teraz? (čaká " + (k.caka || 0) + ", denný limit " + (k.denny_limit || 0) + ")", "50");
  if(!pocet) return;
  if(!confirm("Naozaj odoslať " + pocet + " e-mailov kampane „" + (k.nazov || "") + "“? Odoslané sa nedá vziať späť.")) return;
  const { data, error } = await sb.functions.invoke("kampan-posli", { body: { kampan: id, pocet: +pocet } });
  if(error || (data && data.chyba)) kampanSprava("Chyba: " + ((data && data.chyba) || error.message), true);
  else kampanSprava("Odoslané " + data.odoslane + (data.chyby ? ", chyby " + data.chyby : "") + " · dnes spolu " + data.dnes + "/" + data.limit + (data.dovod ? " (" + data.dovod + ")" : "")
    + (typeof kontVyradeneText === "function" ? kontVyradeneText(data.vyradene) : ""));
  nacitajKampane();
}
