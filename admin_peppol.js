// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — admin: PEPPOL — ukončenia, výbery z FS, tajomstvo webhooku
//  (OP sprostredkovania Verteco v1.8, spec kap. 149, ROZHODNUTIA č. 271, admin_59)
//
//  Klasický skript s globálnymi funkciami (obsluhy v onclick="…"), načíta ho
//  smerovač adminu pri otvorení sekcie #peppol. Používa globálne sb, esc
//  a adminPocet z admin.html.
//
//  · Ukončenia (bod 7.6): odregistrovať do 3 pracovných dní alebo uvoľniť.
//    Vykonáva sa ručne v konzole Verteca; tu sa len zapíše „Vykonané“
//    (peppol_ukoncenie_vykonane — raz, nedá sa vrátiť).
//  · Výbery z FS (bod 4.6): nepreposlaný výber musíme subjektu oznámiť.
//    Preposlať / Odmietnuť a informovať ide cez edge peppol-portal
//    (admin_vyber) — preposiela vždy peppol-fs-webhook.
//  · W1: tajomstvo webhooku FS sa overí na uložených volaniach skôr, než sa
//    nastaví (peppol_fs_over_tajomstvo — nič neukladá, nič neprepošle).
//  · Čerpanie (spec 149.6, W7): odhad za mesiac z GET /resellers/me/billing
//    cez edge peppol-portal (admin_cerpanie) — až na klik, volá Verteco.
//  Žiadne alert/confirm: nezvratný krok má potvrdenie priamo pod tlačidlom.
// ═══════════════════════════════════════════════════════════════════════════

const PP_DOVOD = { zrusenie_uctu:"zrušenie účtu", bez_uctu:"výber bez účtu (30 dní)", admin:"rozhodnutie admina",
  porusenie:"porušenie podmienok", odchod_subjektu:"subjekt odišiel (k Vertecu priamo / inému)" };
const PP_SPOSOB = { uvolnit:"uvoľniť", odregistrovat:"odregistrovať", ziadny:"—" };
let _ppAdm = { data: null, chyba: "", potvrd: "", tajomstvo: null, tajomstvoChyba: "", sprava: "", cerpanie: null, cerpanieChyba: "", cerpanieBezi: false };

function ppDatum(x){ return x ? new Date(String(x).length === 10 ? x + "T12:00:00" : x).toLocaleDateString("sk-SK") : "–"; }
function ppCas(x){ return x ? new Date(x).toLocaleString("sk-SK", { day:"numeric", month:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "–"; }
function ppDnes(){ return new Intl.DateTimeFormat("sv-SE", { timeZone:"Europe/Bratislava" }).format(new Date()); }
// Čaká na admina: otvorené ukončenia a nepreposlané výbery bez rozhodnutia.
function ppCakajuce(d){
  if(!d) return 0;
  return (d.ukoncenia || []).filter(u => !u.vykonane).length
    + (d.vybery || []).filter(w => w.preposlane_stav === "neposiela_sa" && !w.rozhodnutie).length;
}

async function nacitajPeppolAdmin(){
  const telo = document.getElementById("ppAdmBody");
  if(telo && !_ppAdm.data) telo.innerHTML = '<div class="loading">Načítavam…</div>';
  const { data, error } = await sb.rpc("peppol_admin_prehlad");
  if(error){ console.error("peppol_admin_prehlad:", error); _ppAdm.chyba = error.message || String(error); }
  else { _ppAdm.data = data || {}; _ppAdm.chyba = ""; }
  adminPocet("peppol", ppCakajuce(_ppAdm.data));
  ppKresli();
}

function ppUkonceniaHtml(){
  const u = (_ppAdm.data && _ppAdm.data.ukoncenia) || [];
  if(!u.length) return '<div class="hint">Žiadne ukončenie. Vznikne pri zrušení účtu s firmou v sieti, po 30 dňoch výberu bez účtu alebo odchodom firmy.</div>';
  const dnes = ppDnes();
  return '<table><thead><tr><th>Firma</th><th>Dôvod</th><th>Čo urobiť</th><th>Lehota</th><th>Stav</th></tr></thead><tbody>'
    + u.map(x => {
      const po = !x.vykonane && x.termin < dnes;
      const stav = x.vykonane
        ? '✅ ' + esc(ppCas(x.vykonane)) + '<div style="font-size:12px;color:var(--soft)">' + esc(x.vykonal || "") + (x.poznamka ? " · " + esc(x.poznamka) : "") + "</div>"
        : (_ppAdm.potvrd === "u" + x.id
            ? '<input id="ppPozn' + x.id + '" placeholder="poznámka (napr. uvoľnené v konzole)" style="width:100%;margin-bottom:6px">'
              + '<button class="btn" style="width:auto;padding:8px 14px" onclick="ppVykonane(' + x.id + ')">Potvrdiť: vykonané v konzole Verteca</button> '
              + '<button class="rowbtn" onclick="ppPotvrd(\'\')">Späť</button>'
            : '<button class="btn" style="width:auto;padding:8px 14px" onclick="ppPotvrd(\'u' + x.id + '\')">Vykonané…</button>');
      return "<tr><td><b>" + esc(x.dic) + "</b><div style=\"font-size:12px;color:var(--soft)\">" + esc(x.obchodne_meno || "") + (x.company_id ? " · " + esc(x.company_id) : "") + "</div>"
        + (x.novy_vyber_po && !x.vykonane ? '<div style="font-size:12px;color:var(--warn)">⚠ nový výber z FS po žiadosti — over, či ukončiť</div>' : "") + "</td>"
        + "<td>" + esc(PP_DOVOD[x.dovod] || x.dovod) + '<div style="font-size:12px;color:var(--soft)">' + esc(ppCas(x.ziadane)) + "</div></td>"
        + "<td><b>" + esc(PP_SPOSOB[x.sposob] || x.sposob) + "</b></td>"
        + '<td style="' + (po ? "color:var(--neg);font-weight:700" : "") + '">' + esc(ppDatum(x.termin)) + (po ? " — po lehote" : "") + "</td>"
        + "<td>" + stav + "</td></tr>";
    }).join("") + "</tbody></table>";
}

function ppVyberyHtml(){
  const w = (_ppAdm.data && _ppAdm.data.vybery) || [];
  if(!w.length) return '<div class="hint">Žiadne volanie webhooku FS.</div>';
  return '<table><thead><tr><th>#</th><th>Prijaté</th><th>DIČ</th><th>Podpis</th><th>Vertecu</th><th>Rozhodnutie</th></tr></thead><tbody>'
    + w.map(x => {
      const p = (x.polozky || [])[0] || {};
      const caka = x.preposlane_stav === "neposiela_sa" && !x.rozhodnutie;
      let roz = x.rozhodnutie
        ? esc(x.rozhodnutie === "preposlat" ? "preposlané adminom" : "odmietnuté") + '<div style="font-size:12px;color:var(--soft)">' + esc(x.rozhodnutie_kto || "") + " · " + esc(ppCas(x.rozhodnutie_kedy))
          + (x.subjekt_informovany ? " · subjekt informovaný" : "") + "</div>"
        : "";
      if(caka){
        roz = _ppAdm.potvrd === "p" + x.id
          ? '<button class="btn" style="width:auto;padding:8px 14px" onclick="ppVyber(' + x.id + ',\'preposlat\')">Potvrdiť preposlanie</button> <button class="rowbtn" onclick="ppPotvrd(\'\')">Späť</button>'
          : _ppAdm.potvrd === "o" + x.id
            ? '<button class="btn" style="width:auto;padding:8px 14px" onclick="ppVyber(' + x.id + ',\'odmietnut\')">Potvrdiť: odmietnuť a napísať subjektu</button> <button class="rowbtn" onclick="ppPotvrd(\'\')">Späť</button>'
            : '<button class="btn" style="width:auto;padding:8px 14px" onclick="ppPotvrd(\'p' + x.id + '\')">Preposlať…</button> <button class="rowbtn" onclick="ppPotvrd(\'o' + x.id + '\')">Odmietnuť a informovať…</button>';
      }
      return "<tr><td>" + esc(String(x.id)) + "</td><td>" + esc(ppCas(x.prijate)) + "</td>"
        + "<td>" + esc((x.dic || []).join(", ") || "–") + '<div style="font-size:12px;color:var(--soft)">' + esc(p.legalName || "") + (p.company_email ? " · " + esc(p.company_email) : "") + "</div></td>"
        + "<td>" + esc(x.podpis_stav || "–") + "</td>"
        + '<td style="' + (caka ? "color:var(--neg);font-weight:600" : "") + '">' + esc(x.preposlane_stav || "–") + (x.preposlane_kod ? " (" + esc(String(x.preposlane_kod)) + ")" : "")
        + (x.preposlane_odpoved ? '<div style="font-size:12px;color:var(--soft)">' + esc(String(x.preposlane_odpoved).slice(0, 120)) + "</div>" : "") + "</td>"
        + "<td>" + roz + "</td></tr>";
    }).join("") + "</tbody></table>";
}

function ppNesparovaneHtml(){
  const f = (_ppAdm.data && _ppAdm.data.nesparovane) || [];
  if(!f.length) return '<div class="hint">Každá firma v sieti má účet.</div>';
  return '<table><thead><tr><th>DIČ</th><th>Výber z FS</th><th>Prečo</th><th>Výzvy</th></tr></thead><tbody>'
    + f.map(x => "<tr><td><b>" + esc(x.dic) + "</b><div style=\"font-size:12px;color:var(--soft)\">" + esc(x.obchodne_meno || "") + "</div></td>"
      + "<td>" + esc(ppCas(x.fs_prijate)) + "</td>"
      + "<td>" + (x.kandidat ? "kandidát s účtom — spárovať ručne" : "bez účtu") + '<div style="font-size:12px;color:var(--soft)">' + esc(x.dovod || "") + "</div></td>"
      + "<td>" + (x.ukoncene ? "ukončuje sa" : (x.vyzva1_kedy ? "1. " + esc(ppDatum(x.vyzva1_kedy)) : "–") + (x.vyzva2_kedy ? " · 2. " + esc(ppDatum(x.vyzva2_kedy)) : "")) + "</td></tr>").join("")
    + "</tbody></table>";
}

function ppTajomstvoHtml(){
  const v = _ppAdm.tajomstvo;
  let out = '<div class="hint">Tajomstvo z e-mailu FS (Verteco ho ukáže v konzole). Prepočíta sa podpis uložených volaní — nič sa neuloží ani neprepošle. '
    + 'Nastav ho do <code>PEPPOL_FS_TAJOMSTVO</code> až keď sedí na každom volaní s hlavičkou; nesprávna hodnota by potichu blokovala každý výber (od v1.8 je náš webhook jediná cesta do siete).</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><input type="password" id="ppTaj" autocomplete="off" placeholder="tajomstvo webhooku FS" style="flex:1 1 220px">'
    + '<button class="btn" style="width:auto;padding:8px 14px" onclick="ppOverTajomstvo()">Overiť na uložených volaniach</button></div>';
  if(_ppAdm.tajomstvoChyba) out += '<div class="hint" style="border-left-color:var(--neg)">' + esc(_ppAdm.tajomstvoChyba) + "</div>";
  if(v){
    const sHlav = v.filter(x => x.ma_hlavicku);
    const sedi = sHlav.filter(x => x.zhoda === true).length;
    out += '<div class="hint" style="border-left-color:' + (sHlav.length && sedi === sHlav.length ? "var(--accent2)" : "var(--neg)") + '">'
      + (sHlav.length ? "Sedí na " + sedi + " z " + sHlav.length + " volaní s hlavičkou." : "Žiadne uložené volanie nemá hlavičku x-pds-secret — nie je na čom overiť.")
      + (v.length > sHlav.length ? " Bez hlavičky: " + (v.length - sHlav.length) + "." : "") + "</div>"
      + '<table><thead><tr><th>#</th><th>Prijaté</th><th>Stav podpisu</th><th>Zhoda</th></tr></thead><tbody>'
      + v.map(x => "<tr><td>" + esc(String(x.id)) + "</td><td>" + esc(ppCas(x.prijate)) + "</td><td>" + esc(x.podpis_stav || "–") + "</td><td>"
        + (x.zhoda === true ? "✅" : x.zhoda === false ? "❌" : "bez hlavičky") + "</td></tr>").join("") + "</tbody></table>";
  }
  return out;
}

function ppKresli(){
  const telo = document.getElementById("ppAdmBody");
  if(!telo) return;
  if(_ppAdm.chyba && !_ppAdm.data){ telo.innerHTML = '<div class="hint" style="border-left-color:var(--neg)">Nenačítalo sa: ' + esc(_ppAdm.chyba) + " (beží admin_59?)</div>"; return; }
  telo.innerHTML = (_ppAdm.sprava ? '<div class="hint">' + esc(_ppAdm.sprava) + "</div>" : "")
    + '<h3 style="margin:4px 0 8px">Ukončenia v sieti Peppol</h3>'
    + '<div class="hint">OP Verteco v1.8 bod 7.6: odregistrovať do 3 pracovných dní, alebo uvoľniť spod našej značky. Urob to v partnerskej konzole Verteca a potom označ „Vykonané“.</div>'
    + ppUkonceniaHtml()
    + '<h3 style="margin:22px 0 8px">Výbery z portálu FS</h3>'
    + '<div class="hint">Bod 4.6: nepreposlaný výber musíme subjektu oznámiť. Preposlanie je bezpečné aj pri zlom podpise — verifikačný údaj overuje Verteco.</div>'
    + ppVyberyHtml()
    + '<h3 style="margin:22px 0 8px">Firmy v sieti bez účtu</h3>'
    + ppNesparovaneHtml()
    + '<h3 style="margin:22px 0 8px">Čerpanie u Verteca (odhad za mesiac)</h3>'
    + ppCerpanieHtml()
    + '<h3 style="margin:22px 0 8px">Tajomstvo webhooku FS (W1)</h3>'
    + ppTajomstvoHtml();
}

// Odhad čerpania: platí sa za firmu, ktorá v mesiaci odoslala aspoň 1 doklad
// (2 € bez DPH); príjem je zadarmo. Zostatok kreditu API nevracia — konzola.
const PP_MODEL = { per_company:"za firmu", per_document:"za doklad", per_company_client:"platí klient" };
function ppEur(c){ return (Number(c || 0) / 100).toLocaleString("sk-SK", { style:"currency", currency:"EUR" }); }
function ppCerpanieHtml(){
  const c = _ppAdm.cerpanie;
  const tl = '<button class="rowbtn" onclick="ppNacitajCerpanie()"' + (_ppAdm.cerpanieBezi ? " disabled" : "") + '>' + (_ppAdm.cerpanieBezi ? "Načítavam…" : c ? "Obnoviť" : "Načítať od Verteca") + "</button>";
  if(_ppAdm.cerpanieChyba) return '<div class="hint" style="border-left-color:var(--neg)">Nenačítalo sa: ' + esc(_ppAdm.cerpanieChyba) + "</div>" + tl;
  if(!c) return '<div class="hint">Kredit dobiť do 31. 1. 2027 (K1, spec 149.15). Odhad dáva Verteco za aktuálny mesiac; zostatok kreditu je len v konzole.</div>' + tl;
  const odhad = c.model === "per_document" ? c.perDocumentCents : c.perCompanyCents;
  return '<table><tbody>'
    + "<tr><td>Model</td><td><b>" + esc(PP_MODEL[c.model] || c.model || "–") + "</b>" + (c.pendingModel ? " → " + esc(PP_MODEL[c.pendingModel] || c.pendingModel) + " od " + esc(ppDatum(c.pendingFrom)) : "") + "</td></tr>"
    + "<tr><td>Firmy, ktoré tento mesiac odoslali</td><td><b>" + esc(String(c.activeCompanies ?? "–")) + "</b></td></tr>"
    + "<tr><td>Odoslané / prijaté doklady</td><td>" + esc(String(c.sentDocuments ?? "–")) + " / " + esc(String(c.receivedDocuments ?? "–")) + "</td></tr>"
    + "<tr><td>Odhad za mesiac (bez DPH)</td><td><b>" + esc(ppEur(odhad)) + "</b>" + (c.model !== "per_document" ? ' <span style="color:var(--soft)">(za doklad by bolo ' + esc(ppEur(c.perDocumentCents)) + ")</span>" : "") + "</td></tr>"
    + "</tbody></table>" + tl;
}
async function ppNacitajCerpanie(){
  _ppAdm.cerpanieBezi = true; _ppAdm.cerpanieChyba = ""; ppKresli();
  const { data, error } = await sb.functions.invoke("peppol-portal", { body: { akcia: "admin_cerpanie" } });
  _ppAdm.cerpanieBezi = false;
  if(error || !data || data.error){ const m = (data && data.error) || (error && error.message) || "bez odpovede"; console.error("admin_cerpanie:", m); _ppAdm.cerpanieChyba = m; }
  else _ppAdm.cerpanie = data;
  ppKresli();
}

function ppPotvrd(k){ _ppAdm.potvrd = k; _ppAdm.sprava = ""; ppKresli(); }

async function ppVykonane(id){
  const pozn = (document.getElementById("ppPozn" + id) || {}).value || "";
  const { error } = await sb.rpc("peppol_ukoncenie_vykonane", { p_id: id, p_poznamka: pozn });
  _ppAdm.potvrd = "";
  _ppAdm.sprava = error ? "Nezapísalo sa: " + error.message : "Ukončenie č. " + id + " je zapísané ako vykonané.";
  await nacitajPeppolAdmin();
}

async function ppVyber(id, rozhodnutie){
  _ppAdm.potvrd = "";
  _ppAdm.sprava = "Pracujem…";
  ppKresli();
  const { data, error } = await sb.functions.invoke("peppol-portal", { body: { akcia: "admin_vyber", id, rozhodnutie } });
  if(error){
    let detail = error.message || String(error);
    try { const o = await error.context.json(); detail = o.error || detail; } catch(_) {}
    _ppAdm.sprava = "Nepodarilo sa: " + detail;
  } else {
    _ppAdm.sprava = rozhodnutie === "preposlat"
      ? "Výber č. " + id + " preposlaný Vertecu" + (data && data.kod ? " (" + data.kod + ")" : "") + "."
      : (data && data.informovany ? "Subjekt informovaný e-mailom." : "Rozhodnutie zapísané — " + ((data && data.dovod) || "subjekt bez e-mailu"));
  }
  await nacitajPeppolAdmin();
}

async function ppOverTajomstvo(){
  const el = document.getElementById("ppTaj");
  const taj = el ? el.value : "";
  _ppAdm.tajomstvo = null; _ppAdm.tajomstvoChyba = "";
  const { data, error } = await sb.rpc("peppol_fs_over_tajomstvo", { p_tajomstvo: taj });
  if(el) el.value = "";      // tajomstvo neostáva na obrazovke
  if(error) _ppAdm.tajomstvoChyba = error.message || String(error);
  else _ppAdm.tajomstvo = Array.isArray(data) ? data : [];
  ppKresli();
}
