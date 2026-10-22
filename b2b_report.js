// ═══════════════════════════════════════════════════════════════
//  b2b_report.js — B2B Projektový reporting (dev/docs/NAVRH_B2B_REPORTING.md)
//
//  Klasický skript načítaný lenivo (repNacitaj v appke, ?v=APP_VERZIA),
//  beží v globálnom rozsahu appky — všetky mená majú predponu rep / REP_.
//  Nástroj je anonymný (D12): v kóde nie je názov programu, klienta,
//  dodávateľov ani oblastí; všetko konkrétne je v profile programu.
//
//  Vrstvy (§9.1): import → model → view → layout → zapisovače.
//  Výpočty sú čisté funkcie bez DOM a bez hodín počítača (§6).
// ═══════════════════════════════════════════════════════════════

// ── dátumy (§6.1): len civilné 'YYYY-MM-DD', aritmetika v UTC ───
const REP_DEN = 86400000;
function repDatum(s){
  if (s == null) return null;
  const t = String(s);
  if (t.length < 10 || t.charAt(4) !== "-" || t.charAt(7) !== "-") return null;
  const d = t.slice(0, 10);
  return isNaN(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))) ? null : d;
}
function repMs(s){ return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); }
function repDni(od, po){ return Math.round((repMs(po) - repMs(od)) / REP_DEN); }
function repPlusDni(s, n){ return new Date(repMs(s) + n * REP_DEN).toISOString().slice(0, 10); }
function repDM(s){ return s ? (+s.slice(8, 10)) + "." + (+s.slice(5, 7)) + "." : ""; }
function repDMR(s){ return s ? (+s.slice(8, 10)) + ". " + (+s.slice(5, 7)) + ". " + s.slice(0, 4) : ""; }
function repMax(a, b){ return !a ? b : !b ? a : (a > b ? a : b); }
function repMin(a, b){ return !a ? b : !b ? a : (a < b ? a : b); }

// Bez diakritiky a veľkých písmen — na porovnanie názvov (nález N17).
const REP_DIAKRITIKA = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");
function repNorm(s){ return String(s == null ? "" : s).normalize("NFD").replace(REP_DIAKRITIKA, "").toLowerCase().replace(/\s+/g, " ").trim(); }
// Kanonický kód záväzku: veľké písmená, bez medzier a bodiek; podčiarnik ostáva (N5).
function repKanonKod(s){ return String(s == null ? "" : s).toUpperCase().replace(/[\s.]/g, ""); }
function repTokeny(s){ return String(s == null ? "" : s).split(/[;,\n]/).map(x => x.trim()).filter(Boolean); }
function repKratky(nazov){
  let s = String(nazov || "");
  const i = s.indexOf(" - "); if (i > 0) s = s.slice(0, i);
  const j = s.indexOf("("); if (j > 0) s = s.slice(0, j);
  s = s.trim();
  return s.length > 24 ? s.slice(0, 23) + "…" : s;
}

// ── 1. Import plánu: MS Project XML (MSPDI), §4.1 ───────────────
// Vystrihne bloky <tag>…</tag> bez regexu: TimephasedData je 99 % súboru.
function repVystrihni(text, tag){
  const otv = "<" + tag + ">", zat = "</" + tag + ">", kusy = [];
  let i = 0, pocet = 0;
  for (;;) {
    const a = text.indexOf(otv, i);
    if (a < 0) { kusy.push(text.slice(i)); break; }
    const b = text.indexOf(zat, a);
    if (b < 0) { kusy.push(text.slice(i)); break; }
    kusy.push(text.slice(i, a)); i = b + zat.length; pocet++;
  }
  return { text: kusy.join(""), pocet };
}

function repPlanZXml(text, Parser){
  const P = Parser || (typeof DOMParser !== "undefined" ? DOMParser : null);
  if (!P) throw new Error("Prehliadač nevie čítať XML.");
  const zac = String(text).slice(0, 400).toLowerCase();
  if (zac.indexOf("<project") < 0 && zac.indexOf("<?xml") < 0) throw new Error("Súbor nie je MS Project XML. V MS Project ho uložte cez Súbor → Uložiť ako → XML.");
  const v = repVystrihni(String(text), "TimephasedData");
  const doc = new P().parseFromString(v.text, "application/xml");
  const err = doc.getElementsByTagName("parsererror");
  if (err && err.length) throw new Error("XML sa nedá prečítať: " + String(err[0].textContent || "").slice(0, 160));
  const root = doc.documentElement;
  if (!root || root.localName !== "Project") throw new Error("Súbor nie je MS Project XML (chýba koreň Project). V MS Project ho uložte cez Súbor → Uložiť ako → XML.");
  const deti = el => { const o = []; const n = el.childNodes || []; for (let i = 0; i < n.length; i++) if (n[i].nodeType === 1) o.push(n[i]); return o; };
  const dieta = (el, meno) => deti(el).find(c => c.localName === meno) || null;
  const hod = (el, meno) => { const c = dieta(el, meno); return c ? String(c.textContent) : null; };
  const cislo = (el, meno) => { const x = hod(el, meno); return x == null || x === "" ? null : +x; };

  const projekt = {
    nazov: hod(root, "Name") || "", title: hod(root, "Title") || "",
    lastSaved: repDatum(hod(root, "LastSaved")), statusDate: repDatum(hod(root, "StatusDate")),
    currentDate: repDatum(hod(root, "CurrentDate")), start: repDatum(hod(root, "StartDate")),
    finish: repDatum(hod(root, "FinishDate")), minutesPerDay: cislo(root, "MinutesPerDay") || 480 };

  const polia = [];
  const ea = dieta(root, "ExtendedAttributes");
  if (ea) for (const a of deti(ea)) if (a.localName === "ExtendedAttribute")
    polia.push({ fieldId: hod(a, "FieldID") || "", nazov: hod(a, "FieldName") || "", alias: hod(a, "Alias") || null, vyplnene: 0 });

  const ulohy = [];
  const tasks = dieta(root, "Tasks");
  for (const t of tasks ? deti(tasks) : []) {
    if (t.localName !== "Task" || hod(t, "IsNull") === "1") continue;
    const u = {
      uid: cislo(t, "UID"), id: cislo(t, "ID"), nazov: hod(t, "Name") || "",
      uroven: cislo(t, "OutlineLevel") || 0, outline: hod(t, "OutlineNumber") || "", wbs: hod(t, "WBS"),
      start: repDatum(hod(t, "Start")), finish: repDatum(hod(t, "Finish")),
      pct: Math.max(0, Math.min(100, cislo(t, "PercentComplete") || 0)),
      milnik: hod(t, "Milestone") === "1", suhrn: hod(t, "Summary") === "1",
      aktivna: hod(t, "Active") !== "0", kriticka: hod(t, "Critical") === "1",
      rezervaDni: null, baseline: null, polia: {}, predchodcovia: [] };
    const slack = cislo(t, "TotalSlack");
    if (slack != null) u.rezervaDni = Math.round(slack / 10 / projekt.minutesPerDay * 10) / 10;
    for (const c of deti(t)) {
      if (c.localName === "ExtendedAttribute") { const f = hod(c, "FieldID"), val = hod(c, "Value"); if (f && val != null && val !== "") u.polia[f] = val; }
      else if (c.localName === "PredecessorLink") u.predchodcovia.push({ uid: cislo(c, "PredecessorUID"), typ: cislo(c, "Type"), lag: cislo(c, "LinkLag") || 0 });
      else if (c.localName === "Baseline" && (hod(c, "Number") || "0") === "0") u.baseline = { start: repDatum(hod(c, "Start")), finish: repDatum(hod(c, "Finish")) };
    }
    if (u.uid == null) continue;
    ulohy.push(u);
  }
  for (const p of polia) p.vyplnene = ulohy.filter(u => u.polia[p.fieldId] != null).length;
  const pocetEl = meno => doc.getElementsByTagNameNS ? doc.getElementsByTagNameNS("*", meno).length : doc.getElementsByTagName(meno).length;
  const pocty = { ulohy: ulohy.length, milniky: ulohy.filter(u => u.milnik).length, suhrny: ulohy.filter(u => u.suhrn).length,
    zdroje: pocetEl("Resource"), priradenia: pocetEl("Assignment"), kalendare: pocetEl("Calendar"),
    timephased: v.pocet, velkostZnaky: String(text).length };
  return { verzia: 1, projekt, polia, ulohy, pocty };
}

// Protokol importu: len počty a kódy, bez obsahu (ide do DB nešifrovaný, §4.1).
function repPlanProtokol(plan, predosly){
  const p = { ulohy: plan.pocty.ulohy, milniky: plan.pocty.milniky, suhrny: plan.pocty.suhrny,
    zdroje: plan.pocty.zdroje, priradenia: plan.pocty.priradenia, timephased: plan.pocty.timephased,
    maxUroven: plan.ulohy.reduce((m, u) => Math.max(m, u.uroven), 0),
    polia: plan.polia.filter(f => f.vyplnene > 0).map(f => ({ fieldId: f.fieldId, nazov: f.nazov, alias: f.alias, vyplnene: f.vyplnene })),
    bezDatumu: plan.ulohy.filter(u => !u.start || !u.finish).length,
    duplicitneNazvy: 0, odobrate: 0, pridane: 0, premenovane: 0 };
  const cnt = {};
  for (const u of plan.ulohy) cnt[u.nazov] = (cnt[u.nazov] || 0) + 1;
  p.duplicitneNazvy = Object.values(cnt).filter(n => n > 1).length;
  if (predosly) {
    const a = new Map(predosly.ulohy.map(u => [u.uid, u])), b = new Map(plan.ulohy.map(u => [u.uid, u]));
    for (const [uid, u] of a) { if (!b.has(uid)) p.odobrate++; else if (b.get(uid).nazov !== u.nazov) p.premenovane++; }
    for (const uid of b.keys()) if (!a.has(uid)) p.pridane++;
  }
  return p;
}

// ── 2. Strom úloh (bez zápisu do vstupných objektov — N: extract mutoval) ──
function repStrom(plan){
  const index = new Map(), rodic = new Map(), deti = new Map(), poradie = new Map();
  const zasobnik = [];
  plan.ulohy.forEach((u, i) => {
    index.set(u.uid, u); poradie.set(u.uid, i); deti.set(u.uid, []);
    while (zasobnik.length && zasobnik[zasobnik.length - 1].uroven >= u.uroven) zasobnik.pop();
    const r = zasobnik.length ? zasobnik[zasobnik.length - 1] : null;
    rodic.set(u.uid, r ? r.uid : null);
    if (r) deti.get(r.uid).push(u.uid);
    zasobnik.push(u);
  });
  const potomkovia = uid => {
    const o = [], z = [...(deti.get(uid) || [])];
    while (z.length) { const x = z.shift(); o.push(index.get(x)); z.unshift(...(deti.get(x) || [])); }
    return o;
  };
  return { index, rodic, deti, poradie, potomkovia };
}

// ── 3. Návrh profilu z plánu (§5) — človek ho potvrdí ───────────
const REP_FAZY_VZORY = [
  { kluc: "FT",   legenda: "FT (funkčné testy)", znacka: "kruh",        slova: ["funkcn", "functional"] },
  { kluc: "E2E",  legenda: "E2E pripravené",     znacka: "stvorec",     slova: ["e2e", "end-to-end"] },
  { kluc: "PROD", legenda: "PROD nasadenie",     znacka: "kosostvorec", slova: ["produkc", " prod", "go-live", "golive"] } ];

function repKmenMilnika(nazov){
  const s = String(nazov || "");
  const i = s.indexOf(": ");
  return (i > 0 && i < 20 ? s.slice(i + 2) : s).trim();
}

function repProfilNavrh(plan){
  const strom = repStrom(plan);
  // úroveň oblastí: najplytšia s ≥ 4 súhrnmi, inak tá s najviac súhrnmi
  const suhrnyNaUrovni = {};
  for (const u of plan.ulohy) if (u.suhrn && u.uroven >= 1) suhrnyNaUrovni[u.uroven] = (suhrnyNaUrovni[u.uroven] || 0) + 1;
  const urovne = Object.keys(suhrnyNaUrovni).map(Number).sort((a, b) => a - b);
  let uroven = urovne.find(l => suhrnyNaUrovni[l] >= 4);
  if (uroven == null) uroven = urovne.sort((a, b) => suhrnyNaUrovni[b] - suhrnyNaUrovni[a])[0] || 1;

  // skupiny = rodičia oblastí (nie regex nad názvami)
  const skupiny = [], oblasti = [];
  const skupinaPre = new Map();
  for (const u of plan.ulohy) {
    if (!(u.suhrn && u.uroven === uroven)) continue;
    let r = strom.rodic.get(u.uid), rod = r != null ? strom.index.get(r) : null;
    const kluc = rod && rod.uroven >= 1 ? "g" + rod.uid : "g0";
    if (!skupinaPre.has(kluc)) { skupinaPre.set(kluc, true); skupiny.push({ kluc, nazov: rod && rod.uroven >= 1 ? rod.nazov : "Program" }); }
    oblasti.push({ kluc: "o" + u.uid, nazov: u.nazov, kratky: repKratky(u.nazov), skupina: kluc, uids: [u.uid], aliasy: [repKratky(u.nazov)], zobrazit: true });
  }

  // fázy z inventára míľnikov
  const kmene = new Map();
  for (const u of plan.ulohy) {
    if (!u.milnik) continue;
    const k = repKmenMilnika(u.nazov), n = repNorm(k);
    if (!kmene.has(n)) kmene.set(n, { text: k, pocet: 0, datumy: [] });
    const z = kmene.get(n); z.pocet++; if (u.finish) z.datumy.push(u.finish);
  }
  const fazy = [];
  for (const vz of REP_FAZY_VZORY) {
    const kand = [...kmene.entries()].filter(([n]) => vz.slova.some(s => (" " + n).indexOf(s) >= 0)).sort((a, b) => b[1].pocet - a[1].pocet);
    if (kand.length && kand[0][1].pocet >= 2) fazy.push({ kluc: vz.kluc, legenda: vz.legenda, znacka: vz.znacka, pravidlo: { obsahuje: [kand[0][1].text], lenMilniky: false } });
  }
  if (fazy.length < 2) {
    // neznáma rodina: tri najčastejšie kmene zoradené podľa priemerného dátumu
    fazy.length = 0;
    const top = [...kmene.values()].filter(z => z.pocet >= 2).sort((a, b) => b.pocet - a.pocet).slice(0, 3);
    const priem = z => z.datumy.length ? z.datumy.reduce((s, d) => s + repMs(d), 0) / z.datumy.length : 0;
    top.sort((a, b) => priem(a) - priem(b)).forEach((z, i) => fazy.push({ kluc: "F" + (i + 1), legenda: z.text, znacka: ["kruh", "stvorec", "kosostvorec"][i], pravidlo: { obsahuje: [z.text], lenMilniky: false } }));
  }
  fazy.forEach((f, i) => { f.reprezentant = i === fazy.length - 1 ? "najneskorsi" : "najskorsi"; });

  // vlastné polia podľa obsahu (alias je zriedkavý)
  const polia = repPoliaNavrh(plan);

  const prvaSkupina = skupiny[0] ? skupiny[0].kluc : null;
  const karty = oblasti.filter(o => o.skupina === prvaSkupina).slice(0, 5).map(o => ({ oblast: o.kluc, popis: o.kratky, prierez: !!polia.stitokOblasti }));
  const kpi = [{ typ: "postupProgramu", popis: "Postup programu" }];
  for (const s of skupiny.slice(0, 3)) kpi.push({ typ: "postupSkupiny", skupina: s.kluc, popis: s.nazov });
  kpi.push({ typ: "oneskoreneOblasti", popis: "Oneskorené oblasti" });
  kpi.push({ typ: "dniDoKonca", popis: "Dní do konca" });

  return {
    schema: 1, nazov: plan.projekt.title || plan.projekt.nazov.replace(/\.xml$/i, ""), kod: "", jazyk: "sk",
    cielovyTermin: plan.projekt.finish, polia, urovenOblasti: uroven, fazy, skupiny, oblasti,
    metriky: { postupProgramu: "suhrn", farby: { zelena: 70, modra: 40, jantarova: 10 }, pomalyPostup: 40,
      podstatnyPosunDni: 7, regresiaBodov: 10, nesuladCtDni: 14, nizkyPostupUlohy: 50, oknoNajblizsieTyzdne: 6 },
    kpi: kpi.slice(0, 6), karty, tema: "clean", tokeny: {},
    os: null };
}

// Polia MS Projectu podľa obsahu: kód záväzku (na míľnikoch, tvar písmená+číslice),
// štítok oblasti (málo krátkych hodnôt na mnohých úlohách), BP kód (veľa hodnôt na súhrnoch).
function repPoliaNavrh(plan){
  const stat = new Map();
  for (const u of plan.ulohy) for (const [f, v] of Object.entries(u.polia)) {
    if (!stat.has(f)) stat.set(f, { f, n: 0, naMilniku: 0, naSuhrne: 0, hodnoty: new Map(), dlzka: 0, kodovy: 0, ano: 0 });
    const s = stat.get(f); s.n++; if (u.milnik) s.naMilniku++; if (u.suhrn) s.naSuhrne++;
    s.hodnoty.set(v, (s.hodnoty.get(v) || 0) + 1); s.dlzka += v.length;
    if (/^[A-Za-z]{1,3}\d{1,3}[A-Za-z_\d]*([;,]\s*[A-Za-z]{1,3}\d.*)?$/.test(v.trim())) s.kodovy++;
    if (/^(áno|ano|nie|yes|no)$/i.test(v.trim())) s.ano++;
  }
  const vsetky = [...stat.values()];
  const n = plan.ulohy.length || 1;
  const vyber = (filter, skore) => { const k = vsetky.filter(filter).sort((a, b) => skore(b) - skore(a)); return k.length ? k[0].f : null; };
  const kodZavazku = vyber(s => s.naMilniku / s.n >= 0.6 && s.kodovy / s.n >= 0.6, s => s.n);
  const mmp = vyber(s => s.ano / s.n >= 0.9, s => s.n);
  const stitokOblasti = vyber(s => s.f !== kodZavazku && s.f !== mmp && s.hodnoty.size <= 40 && s.dlzka / s.n <= 12 && s.n / n >= 0.2, s => s.n);
  const bpKod = vyber(s => ![kodZavazku, mmp, stitokOblasti].includes(s.f) && s.hodnoty.size >= 10 && s.naSuhrne / s.n >= 0.5, s => s.hodnoty.size);
  const alias = f => { const p = plan.polia.find(x => x.fieldId === f); return p ? (p.alias || p.nazov) : f; };
  const o = { kodZavazku, stitokOblasti, bpKod, mmp };
  o.popis = {};
  for (const k of Object.keys(o)) if (k !== "popis" && o[k]) o.popis[k] = alias(o[k]);
  return o;
}

// ── 4. Model (§6) ───────────────────────────────────────────────
function repFazaZhoda(u, faza){
  const pr = faza.pravidlo || {};
  if (pr.lenMilniky && !u.milnik) return false;
  if (pr.pole && pr.hodnota != null) {
    const v = u.polia && u.polia[pr.pole];
    if (v == null || !repTokeny(v).map(repNorm).includes(repNorm(pr.hodnota))) return false;
    if (!pr.obsahuje || !pr.obsahuje.length) return true;
  }
  const n = repNorm(u.nazov);
  return (pr.obsahuje || []).some(t => t && n.indexOf(repNorm(t)) >= 0);
}

// Reprezentant fázy: prvé fázy najskorší NEhotový (inak najskorší), posledná najneskorší.
function repReprezentant(milniky, sposob, stavKuDnu){
  const s = milniky.filter(m => m.datum);
  if (!s.length) return null;
  const hotove = s.every(m => m.pct >= 100);
  let rep;
  if (sposob === "najneskorsi") rep = s.reduce((a, b) => (b.datum > a.datum ? b : a));
  else {
    const nehot = s.filter(m => m.pct < 100);
    rep = (nehot.length ? nehot : s).reduce((a, b) => (b.datum < a.datum ? b : a));
  }
  // Oneskorené (§6.4): nehotové a dátum < stav ku dňu. Okno osi sem nevstupuje (N7).
  const oneskorene = !hotove && !!stavKuDnu && rep.datum < stavKuDnu;
  return { datum: rep.datum, uid: rep.uid, pct: rep.pct, hotove, oneskorene, pocet: s.length,
    dniPoTermine: oneskorene ? repDni(rep.datum, stavKuDnu) : 0 };
}

function repFazyZUloh(ulohy, profil, stavKuDnu){
  const o = {};
  for (const f of profil.fazy) {
    const ms = ulohy.filter(u => repFazaZhoda(u, f)).map(u => ({ uid: u.uid, nazov: u.nazov, datum: u.finish, pct: u.pct, milnik: u.milnik }));
    o[f.kluc] = ms.length ? Object.assign(repReprezentant(ms, f.reprezentant, stavKuDnu) || {}, { milniky: ms }) : null;
  }
  return o;
}

function repModel(plan, profil, stavKuDnu){
  if (!stavKuDnu) throw new Error("Chýba stav ku dňu.");
  const strom = repStrom(plan);
  const m = profil.metriky || {};
  const drahy = [];
  for (const ob of profil.oblasti || []) {
    if (ob.zobrazit === false) continue;
    const korene = (ob.uids || []).map(uid => strom.index.get(uid)).filter(Boolean);
    const d = { kluc: ob.kluc, nazov: ob.nazov, kratky: ob.kratky || repKratky(ob.nazov), skupina: ob.skupina,
      uids: ob.uids || [], chyba: null, pct: null, pctMetoda: null, start: null, finish: null, fazy: {}, balicky: [],
      oneskorena: false, poslednaHotova: false, poznamka: ob.poznamka || "" };
    if (!korene.length) { d.chyba = "Oblasť sa v pláne nenašla (UID " + (ob.uids || []).join(", ") + ")."; drahy.push(d); continue; }
    d.pct = korene.length === 1 ? korene[0].pct : Math.round(korene.reduce((s, u) => s + u.pct, 0) / korene.length);
    d.pctMetoda = korene.length === 1 ? "súhrnná úloha" : "priemer " + korene.length + " oblastí";
    for (const k of korene) { d.start = repMin(d.start, k.start); d.finish = repMax(d.finish, k.finish); }
    const vsetkyPotomkovia = korene.flatMap(k => strom.potomkovia(k.uid));
    d.fazy = repFazyZUloh(vsetkyPotomkovia, profil, stavKuDnu);
    // balíčky = deti oblasti, ktoré sú súhrnné
    for (const k of korene) for (const uid of strom.deti.get(k.uid) || []) {
      const b = strom.index.get(uid);
      if (!b.suhrn) continue;
      const pot = strom.potomkovia(uid);
      d.balicky.push({ uid, nazov: b.nazov, pct: b.pct, start: b.start, finish: b.finish, fazy: repFazyZUloh(pot, profil, stavKuDnu),
        ulohy: pot.map(u => ({ uid: u.uid, nazov: u.nazov, uroven: u.uroven - b.uroven, pct: u.pct, finish: u.finish, milnik: u.milnik, suhrn: u.suhrn })) });
    }
    const fz = profil.fazy.map(f => d.fazy[f.kluc]).filter(Boolean);
    d.oneskorena = fz.some(r => r.oneskorene);
    const posl = profil.fazy.length ? d.fazy[profil.fazy[profil.fazy.length - 1].kluc] : null;
    d.poslednaHotova = !!(posl && posl.hotove);
    drahy.push(d);
  }
  const platne = drahy.filter(d => !d.chyba);
  const koren = plan.ulohy.find(u => u.uroven === 0);
  let program;
  if ((m.postupProgramu || "suhrn") === "suhrn" && koren) program = { pct: koren.pct, metoda: "súhrnná úloha programu (MS Project, vážené trvaním)" };
  else program = { pct: platne.length ? Math.round(platne.reduce((s, d) => s + d.pct, 0) / platne.length) : 0, metoda: "priemer " + platne.length + " oblastí" };
  const skupiny = (profil.skupiny || []).map(s => {
    const ds = platne.filter(d => d.skupina === s.kluc);
    return Object.assign({}, s, { pct: ds.length ? Math.round(ds.reduce((x, d) => x + d.pct, 0) / ds.length) : null, pocet: ds.length });
  });
  const prah = m.pomalyPostup != null ? m.pomalyPostup : 40;
  return {
    stavKuDnu, cielovyTermin: profil.cielovyTermin || plan.projekt.finish, program, skupiny, drahy,
    fazy: profil.fazy.map(f => ({ kluc: f.kluc, legenda: f.legenda, znacka: f.znacka })),
    pocty: { ulohy: plan.pocty.ulohy, drahy: platne.length, hotove: platne.filter(d => d.pct >= 100).length,
      nasadene: platne.filter(d => d.poslednaHotova).length, oneskorene: platne.filter(d => d.oneskorena).length,
      pomale: platne.filter(d => d.pct < prah).length, prahPomaly: prah },
    dniDoKonca: profil.cielovyTermin ? repDni(stavKuDnu, profil.cielovyTermin) : null,
    prierez: repPrierez(plan, profil) };
}

// Prierezový postup karty (§6.3): priemer % úloh so štítkom oblasti v poli
// štítku; ak je pole BP kódu, len úlohy s BP kódom (súhrnné požiadavky).
function repPrierez(plan, profil){
  const p = profil.polia || {};
  if (!p.stitokOblasti) return {};
  const o = {};
  for (const k of profil.karty || []) {
    if (!k.prierez) continue;
    const ob = (profil.oblasti || []).find(x => x.kluc === k.oblast);
    if (!ob) continue;
    const aliasy = (ob.aliasy && ob.aliasy.length ? ob.aliasy : [ob.kratky]).map(repNorm);
    const ul = plan.ulohy.filter(u => {
      const v = u.polia[p.stitokOblasti];
      if (v == null || !repTokeny(v).map(repNorm).some(t => aliasy.includes(t))) return false;
      return p.bpKod ? u.polia[p.bpKod] != null : u.suhrn;
    });
    if (ul.length) o[k.oblast] = { pct: Math.round(ul.reduce((s, u) => s + u.pct, 0) / ul.length), pocet: ul.length };
  }
  return o;
}

// ── 5. Kontrola dát (§6.5): zviditeľniť, neopravovať ────────────
function repKontroly(model, plan, profil){
  const o = [];
  const fazy = profil.fazy || [];
  const prva = fazy[0], posl = fazy[fazy.length - 1];
  for (const d of model.drahy) {
    if (d.chyba) { o.push({ kod: "nenajdena", uroven: "chyba", draha: d.kluc, text: d.kratky + ": " + d.chyba }); continue; }
    const maNiektoru = fazy.some(f => d.fazy[f.kluc]);
    if (!maNiektoru && fazy.length) { o.push({ kod: "bez-milnikov", uroven: "info", draha: d.kluc, text: d.kratky + ": oblasť nemá ani jeden fázový míľnik." }); continue; }
    if (prva && !d.fazy[prva.kluc] && fazy.slice(1).some(f => d.fazy[f.kluc]))
      o.push({ kod: "chyba-faza", uroven: "upozornenie", draha: d.kluc, text: d.kratky + ": chýba míľnik fázy " + prva.kluc + ", neskoršie fázy sú naplánované." });
    // poradie fáz po balíčkoch (alebo za oblasť, keď balíčky fázy nemajú)
    const celky = d.balicky.filter(b => fazy.some(f => b.fazy[f.kluc]));
    const kontroluj = celky.length ? celky.map(b => ({ meno: b.nazov, fazy: b.fazy })) : [{ meno: d.kratky, fazy: d.fazy }];
    for (const c of kontroluj) for (let i = 1; i < fazy.length; i++) {
      const a = c.fazy[fazy[i - 1].kluc], b = c.fazy[fazy[i].kluc];
      if (a && b && a.datum && b.datum && b.datum < a.datum)
        o.push({ kod: "poradie", uroven: "upozornenie", draha: d.kluc, text: repKratky(c.meno) + ": " + fazy[i].kluc + " (" + repDMR(b.datum) + ") je pred " + fazy[i - 1].kluc + " (" + repDMR(a.datum) + ")." });
    }
    for (const f of fazy) {
      const r = d.fazy[f.kluc];
      if (!r) continue;
      for (const mi of r.milniky) {
        if (mi.pct < 100 && mi.datum && d.finish && +mi.datum.slice(0, 4) < +d.finish.slice(0, 4))
          o.push({ kod: "stary-rok", uroven: "upozornenie", draha: d.kluc, text: d.kratky + ": nehotový míľnik " + f.kluc + " má dátum " + repDMR(mi.datum) + " (rok pred koncom oblasti)." });
        if (!mi.milnik && !(f.pravidlo && f.pravidlo.lenMilniky))
          o.push({ kod: "nie-milnik", uroven: "info", draha: d.kluc, text: d.kratky + ": úloha fázy " + f.kluc + " nie je v pláne označená ako míľnik („" + mi.nazov + "“)." });
      }
    }
  }
  if (posl && model.cielovyTermin) for (const d of model.drahy) {
    const r = d.fazy && d.fazy[posl.kluc];
    if (r && r.datum && r.datum > model.cielovyTermin)
      o.push({ kod: "po-cieli", uroven: "upozornenie", draha: d.kluc, text: d.kratky + ": " + posl.kluc + " " + repDMR(r.datum) + " je po cieľovom termíne programu (" + repDMR(model.cielovyTermin) + ")." });
  }
  return o;
}

// ── 6. Registre z Excelu (§4.2–4.5) ─────────────────────────────
// Definície stĺpcov a číselníkov sú JEDINÉ — z nich sa skladá import aj
// šablóny na stiahnutie (§4.6).
const REP_CISELNIKY = {
  stavIssue: [
    { kluc: "nove", nazov: "Nové", aktivny: true, slova: ["new", "nove", "open", "otvoren"] },
    { kluc: "riesi", nazov: "V riešení", aktivny: true, slova: ["in progress", "progress", "v riesen", "riesi sa"] },
    { kluc: "eskalovane", nazov: "Eskalované", aktivny: true, slova: ["escalat", "eskal"] },
    { kluc: "vratene", nazov: "Vrátené", aktivny: false, slova: ["return", "vraten"] },
    { kluc: "vyriesene", nazov: "Vyriešené", aktivny: false, slova: ["resolved", "vyriesen", "done"] },
    { kluc: "uzavrete", nazov: "Uzavreté", aktivny: false, slova: ["closed", "uzavret", "zatvoren"] } ],
  priorita: [
    { kluc: "critical", nazov: "Critical", slova: ["crit", "kritick"] },
    { kluc: "high", nazov: "High", slova: ["high", "vysok"] },
    { kluc: "medium", nazov: "Medium", slova: ["med", "stredn"] },
    { kluc: "low", nazov: "Low", slova: ["low", "nizk"] } ],
  stavZistenia: [
    { kluc: "otvorene", nazov: "Otvorené", aktivny: true, slova: ["otvoren", "open", "nove"] },
    { kluc: "riesi", nazov: "V riešení", aktivny: true, slova: ["v riesen", "progress"] },
    { kluc: "uzavrete", nazov: "Uzavreté", aktivny: false, slova: ["uzavret", "closed", "splnen"] },
    { kluc: "zrusene", nazov: "Zrušené", aktivny: false, slova: ["zrusen", "cancel"] } ],
  sulad: [
    { kluc: "nesulad", nazov: "Nesúlad", slova: ["nesulad"] },
    { kluc: "ciastocny", nazov: "Čiastočný súlad", slova: ["ciastocn"] },
    { kluc: "nedefinovane", nazov: "Nie je definované v metodike", slova: ["nie je definovan", "nedefinovan"] },
    { kluc: "sulad", nazov: "Súlad", slova: ["sulad"] } ],
  stavDep: [
    { kluc: "identifikovana", nazov: "Identifikovaná", aktivny: true, slova: ["identifik"] },
    { kluc: "dohodnuta", nazov: "Dohodnutá", aktivny: true, slova: ["dohodnut"] },
    { kluc: "riesi", nazov: "V riešení", aktivny: true, slova: ["v riesen", "progress"] },
    { kluc: "ohrozena", nazov: "Ohrozená", aktivny: true, slova: ["ohrozen", "at risk"] },
    { kluc: "blokuje", nazov: "Blokuje", aktivny: true, slova: ["blokuj", "block"] },
    { kluc: "splnena", nazov: "Splnená", aktivny: false, slova: ["splnen", "done", "closed"] },
    { kluc: "zrusena", nazov: "Zrušená", aktivny: false, slova: ["zrusen", "cancel"] } ],
  typDep: [
    { kluc: "dodavka", nazov: "Dodávka", slova: ["dodavk", "deliver"] },
    { kluc: "rozhodnutie", nazov: "Rozhodnutie", slova: ["rozhodnut", "decision"] },
    { kluc: "data", nazov: "Dáta / integrácia", slova: ["data", "integrac"] },
    { kluc: "prostredie", nazov: "Prostredie / infraštruktúra", slova: ["prostred", "infra"] },
    { kluc: "kapacita", nazov: "Kapacita / zdroj", slova: ["kapacit", "zdroj", "resource"] },
    { kluc: "externa", nazov: "Legislatíva / externá", slova: ["legisl", "extern"] },
    { kluc: "ine", nazov: "Iné", slova: ["ine", "other"] } ] };

function repCiselnik(meno, hodnota){
  const n = repNorm(hodnota);
  if (!n) return null;
  for (const p of REP_CISELNIKY[meno] || []) if (repNorm(p.nazov) === n) return p;
  // dlhšie slová prvé („nesulad“ pred „sulad“, „in progress“ pred „progress“)
  const vsetky = [];
  for (const p of REP_CISELNIKY[meno] || []) for (const s of p.slova) vsetky.push([s, p]);
  vsetky.sort((a, b) => b[0].length - a[0].length);
  for (const [s, p] of vsetky) if (n === s || n.indexOf(s) >= 0) return p;
  return null;
}

const REP_REGISTRE = {
  issue: { nazov: "Issue Log", harok: ["issue log", "issue"], stlpce: [
    { kluc: "id", nazov: "Issue ID", hladaj: ["issue id", "id"], povinny: true },
    { kluc: "zavislosti", nazov: "Dependency ID", hladaj: ["dependency id", "dependency", "zavislost"], viac: true },
    { kluc: "oblast", nazov: "Oblasť", hladaj: ["field", "oblast"], viac: true },
    { kluc: "ct", nazov: "Commitment tracker", hladaj: ["commitment tracker", "commitnmetnt tracker", "commitment", "zavazok"], viac: true },
    { kluc: "vznik", nazov: "Dátum vzniku", hladaj: ["datum vzniku", "vznik", "created"], typ: "datum" },
    { kluc: "kategoria", nazov: "Kategória", hladaj: ["kategoria", "category"] },
    { kluc: "popis", nazov: "Popis", hladaj: ["popis", "description"], povinny: true },
    { kluc: "dopad", nazov: "Dopad", hladaj: ["impact", "dopad"] },
    { kluc: "priorita", nazov: "Priorita", hladaj: ["priority", "priorita"], ciselnik: "priorita" },
    { kluc: "zadavatel", nazov: "Zadávateľ", hladaj: ["zadavatel", "reporter"], osoba: true, predvolene: false },
    { kluc: "riesitel", nazov: "Riešiteľ", hladaj: ["riesitel", "resolver", "owner"], osoba: true },
    { kluc: "termin", nazov: "Cieľový dátum", hladaj: ["cielovy datum", "cielovy", "target date", "due"], typ: "datum" },
    { kluc: "riesenie", nazov: "Riešenie / akcia", hladaj: ["riesenie", "akcia", "action"] },
    { kluc: "rozhodnutie", nazov: "Požadované rozhodnutie", hladaj: ["pozadovane rozhodnutie", "decision"] },
    { kluc: "stav", nazov: "Stav", hladaj: ["status", "stav"], ciselnik: "stavIssue", povinny: true },
    { kluc: "qa", nazov: "QA", hladaj: ["qa"], presne: true, osoba: true, predvolene: false },
    { kluc: "eskalacia", nazov: "Eskalované na", hladaj: ["eskalovane na", "eskalovane", "escalated to", "escalat"] },
    { kluc: "poznamka", nazov: "Poznámka", hladaj: ["poznamka", "note"] },
    { kluc: "dalsieKroky", nazov: "Ďalšie kroky", hladaj: ["next steps", "dalsie kroky"] } ] },
  ct: { nazov: "Commitment Tracker", harok: ["commitments", "commit", "zavaz"], siroky: true, stlpce: [
    { kluc: "id", nazov: "ID", hladaj: ["id"], presne: true, povinny: true },
    { kluc: "wbs", nazov: "WBS", hladaj: ["mpp wbs", "wbs"] },
    { kluc: "oblast", nazov: "Oblasť", hladaj: ["oblast", "area"] },
    { kluc: "dodavka", nazov: "Dodávka", hladaj: ["modul / dodavka", "dodavka", "modul", "deliverable"] },
    { kluc: "brana", nazov: "Míľnik", hladaj: ["milnik", "milestone", "brana"], povinny: true },
    { kluc: "dod", nazov: "Definícia hotového", hladaj: ["definicia hotoveho", "dod"] },
    { kluc: "vlastnik", nazov: "Vlastník", hladaj: ["vlastnik", "owner"], osoba: true, predvolene: false },
    { kluc: "baseline", nazov: "Baseline", hladaj: ["baseline"], typ: "datum" },
    { kluc: "krit", nazov: "Kritická cesta", hladaj: ["krit. cesta", "kriticka cesta", "critical"] },
    { kluc: "poznamka", nazov: "Poznámka", hladaj: ["poznamka", "note"] },
    { kluc: "zavislosti", nazov: "Závislosti", hladaj: ["zavislosti", "prerekvizity", "dependenc"], viac: true } ] },
  dep: { nazov: "Dependency Log", harok: ["dependency", "zavislost"], stlpce: [
    { kluc: "id", nazov: "DEP ID", hladaj: ["dep id", "id"], povinny: true },
    { kluc: "nazov", nazov: "Názov", hladaj: ["nazov", "title"], povinny: true },
    { kluc: "popis", nazov: "Popis", hladaj: ["popis", "description"] },
    { kluc: "typ", nazov: "Typ", hladaj: ["typ", "type"], ciselnik: "typDep", povinny: true },
    { kluc: "poskytovatel", nazov: "Poskytovateľ", hladaj: ["poskytovatel", "provider", "od"], povinny: true },
    { kluc: "prijemca", nazov: "Príjemca", hladaj: ["prijemca", "receiver", "pre"], povinny: true },
    { kluc: "oblast", nazov: "Oblasť", hladaj: ["oblast", "area"], viac: true },
    { kluc: "vazba", nazov: "Väzba na plán", hladaj: ["vazba na plan", "vazba", "milestone"], viac: true },
    { kluc: "potrebne", nazov: "Potrebné do", hladaj: ["potrebne do", "needed by"], typ: "datum", povinny: true },
    { kluc: "prislub", nazov: "Prisľúbené k", hladaj: ["prislubene k", "prislub", "committed"], typ: "datum" },
    { kluc: "stav", nazov: "Stav", hladaj: ["stav", "status"], ciselnik: "stavDep", povinny: true },
    { kluc: "dopad", nazov: "Dopad pri nesplnení", hladaj: ["dopad pri nesplneni", "dopad", "impact"], ciselnik: "priorita", povinny: true },
    { kluc: "vlastnik", nazov: "Vlastník", hladaj: ["vlastnik", "owner"] },
    { kluc: "issue", nazov: "Súvisiace issue", hladaj: ["suvisiace issue", "issue"], viac: true },
    { kluc: "aktualizacia", nazov: "Posledná aktualizácia", hladaj: ["posledna aktualizacia", "aktualizac", "updated"], typ: "datum" },
    { kluc: "poznamka", nazov: "Ďalší krok / poznámka", hladaj: ["dalsi krok", "poznamka", "next"] } ] },
  zistenia: { nazov: "Register zistení", harok: ["register", "zisten", "finding"], stlpce: [
    { kluc: "id", nazov: "ID", hladaj: ["id"], presne: true, povinny: true },
    { kluc: "oblast", nazov: "Oblasť", hladaj: ["oblast", "area"] },
    { kluc: "zistenie", nazov: "Zistenie (QA)", hladaj: ["zistenie", "finding"], povinny: true },
    { kluc: "zavaznost", nazov: "Závažnosť", hladaj: ["zavaznost", "severity"], ciselnik: "priorita" },
    { kluc: "odporucanie", nazov: "Odporúčanie / nápravné opatrenie", hladaj: ["napravne", "odporucanie / napravne", "opatrenie"] },
    { kluc: "zodpovednost", nazov: "Zodpovednosť", hladaj: ["zodpovednost", "responsib"] },
    { kluc: "termin", nazov: "Termín", hladaj: ["termin", "due"], typ: "datum" },
    { kluc: "stav", nazov: "Stav", hladaj: ["stav", "status"], ciselnik: "stavZistenia" },
    { kluc: "sulad", nazov: "Súlad s metodikou", hladaj: ["sulad", "metodik"], ciselnik: "sulad" },
    { kluc: "buduce", nazov: "Odporúčanie pre budúce projekty", hladaj: ["buduc", "lessons"] } ] } };

// Dátum z bunky Excelu: sériové číslo, ISO, d.m.rrrr; „6/30/26“ = americký M/D/RR
// (tak ho vracia Excel uložený s US formátom). Text ostane textom (§4.2).
function repDatumZBunky(v){
  if (v == null || v === "") return { datum: null, text: "", problem: null };
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) return { datum: new Date(Math.round((v - 25569) * REP_DEN)).toISOString().slice(0, 10), text: "", problem: null };
    return { datum: null, text: String(v), problem: "číslo nie je dátum" };
  }
  if (v instanceof Date) return { datum: new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())).toISOString().slice(0, 10), text: "", problem: null };
  const s = String(v).trim();
  const iso = repDatum(s); if (iso) return { datum: iso, text: "", problem: null };
  const over = (r, mes, den) => {
    const d = new Date(Date.UTC(r, mes - 1, den));
    return d.getUTCFullYear() === r && d.getUTCMonth() === mes - 1 && d.getUTCDate() === den ? d.toISOString().slice(0, 10) : null;
  };
  let m = s.match(/^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{2,4})$/);
  if (m) { const r = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const d = over(r, +m[2], +m[1]); return d ? { datum: d, text: "", problem: null } : { datum: null, text: s, problem: "neplatný dátum" }; }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { const r = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const d = over(r, +m[1], +m[2]); return d ? { datum: d, text: "", problem: "americký tvar M/D/RR" } : { datum: null, text: s, problem: "neplatný dátum" }; }
  if (/^\d{1,2}\s*\.\s*\d{1,2}\s*\.?$/.test(s)) return { datum: null, text: s, problem: "dátum bez roka" };
  return { datum: null, text: s, problem: null };
}

// Mapovanie hlavičky: presná zhoda > začiatok > podreťazec; každý stĺpec raz.
function repMapujHlavicku(hlavicka, def){
  const h = hlavicka.map(x => repNorm(x));
  const kand = [];
  for (const s of def.stlpce) s.hladaj.forEach((t, poradie) => {
    const tn = repNorm(t);
    h.forEach((x, i) => {
      if (!x) return;
      let skore = x === tn ? 3 : s.presne ? 0 : x.startsWith(tn) ? 2 : x.indexOf(tn) >= 0 ? 1 : 0;
      if (skore) kand.push({ kluc: s.kluc, i, skore, dlzka: tn.length, poradie });
    });
  });
  kand.sort((a, b) => b.skore - a.skore || b.dlzka - a.dlzka || a.poradie - b.poradie || a.i - b.i);
  const mapa = {}, pouzite = new Set();
  for (const k of kand) if (mapa[k.kluc] == null && !pouzite.has(k.i)) { mapa[k.kluc] = k.i; pouzite.add(k.i); }
  return mapa;
}

// Načíta hárok registra (XLSX = SheetJS). Hlavičku nehádame počtom buniek:
// vyhrá riadok s najviac rozpoznanými stĺpcami medzi prvými 15.
function repRegisterZXlsx(XLSX, data, druh, volby){
  const def = REP_REGISTRE[druh];
  if (!def) throw new Error("Neznámy register: " + druh);
  volby = volby || {};
  const wb = XLSX.read(data, { type: data instanceof ArrayBuffer ? "array" : "buffer", cellDates: false });
  const mena = wb.SheetNames;
  const harok = volby.harok && mena.includes(volby.harok) ? volby.harok
    : (def.harok.map(h => mena.find(m => repNorm(m) === h)).find(Boolean) || def.harok.map(h => mena.find(m => repNorm(m).indexOf(h) >= 0)).find(Boolean) || mena[0]);
  const ws = wb.Sheets[harok];
  const posun = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).s.r : 0;   // hárok nemusí začínať riadkom 1
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "", blankrows: true });
  let najlepsi = -1, mapa = null, skore = -1;
  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const mp = repMapujHlavicku(rows[r].map(String), def);
    const n = Object.keys(mp).length + def.stlpce.filter(s => s.povinny && mp[s.kluc] != null).length;
    if (n > skore) { skore = n; najlepsi = r; mapa = mp; }
  }
  const protokol = { register: druh, harok, preskoceneHarky: mena.filter(m => m !== harok), riadokHlavicky: najlepsi + 1 + posun,
    rozpoznane: [], chybajucePovinne: [], nerozpoznane: [], riadky: 0, bezId: 0, duplicitneId: [], datumy: { americke: 0, bezRoka: 0, neplatne: 0, text: 0 },
    nezname: {}, osobneVynechane: [] };
  if (najlepsi < 0) return { riadky: [], protokol };
  const hl = rows[najlepsi].map(String);
  const osobneVypnute = volby.osoby || {}, vynechane = new Set();
  for (const s of def.stlpce) {
    if (mapa[s.kluc] == null) { if (s.povinny) protokol.chybajucePovinne.push(s.nazov); continue; }
    if (s.osoba && (osobneVypnute[s.kluc] != null ? !osobneVypnute[s.kluc] : s.predvolene === false)) { protokol.osobneVynechane.push(hl[mapa[s.kluc]]); vynechane.add(mapa[s.kluc]); delete mapa[s.kluc]; continue; }
    protokol.rozpoznane.push({ pole: s.kluc, stlpec: hl[mapa[s.kluc]] });
  }
  // CT: stĺpce záväzkov podľa dodávateľov (široký formát → dlhý, §4.2)
  const commity = def.siroky ? hl.map((x, i) => ({ x, i })).filter(o => /^commit/i.test(repNorm(o.x))).map(o => ({ i: o.i, dodavatel: o.x.replace(/^\s*commit\s*/i, "").replace(/\s+/g, " ").trim() || o.x })) : [];
  if (def.siroky) protokol.dodavatelia = commity.map(c => c.dodavatel);
  const pouzite = new Set([...Object.values(mapa), ...vynechane, ...commity.map(c => c.i)]);
  protokol.nerozpoznane = hl.map((x, i) => ({ x, i })).filter(o => o.x && !pouzite.has(o.i)).map(o => o.x);
  const videne = new Map(), riadky = [];
  let dodavkaKontext = {};
  for (let r = najlepsi + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row.some(x => String(x).trim() !== "")) continue;
    const surId = mapa.id != null ? String(row[mapa.id]).trim() : "";
    if (/^[■►▪●]/.test(surId)) { if (def.siroky) dodavkaKontext = { sekcia: surId.replace(/^[■►▪●]\s*/, "") }; continue; }
    const z = { riadok: r + 1 + posun };
    for (const s of def.stlpce) {
      if (mapa[s.kluc] == null) continue;
      const v = row[mapa[s.kluc]];
      if (s.typ === "datum") {
        const d = repDatumZBunky(v);
        z[s.kluc] = d.datum; if (d.text) z[s.kluc + "Text"] = d.text;
        if (d.problem === "americký tvar M/D/RR") protokol.datumy.americke++;
        else if (d.problem === "dátum bez roka") protokol.datumy.bezRoka++;
        else if (d.problem === "neplatný dátum") protokol.datumy.neplatne++;
        else if (d.text) protokol.datumy.text++;
      } else if (s.viac) z[s.kluc] = repTokeny(v);
      else z[s.kluc] = typeof v === "number" ? String(v) : String(v == null ? "" : v).trim();
      if (s.ciselnik && z[s.kluc]) {
        const p = repCiselnik(s.ciselnik, z[s.kluc]);
        if (p) { z[s.kluc + "Kluc"] = p.kluc; if (p.aktivny != null && s.kluc === "stav") z.aktivny = p.aktivny; }
        else (protokol.nezname[s.kluc] = protokol.nezname[s.kluc] || []).includes(z[s.kluc]) || protokol.nezname[s.kluc].push(z[s.kluc]);
      }
    }
    if (druh === "issue" || druh === "dep" || druh === "zistenia") {
      // prázdny stav = neznámy, počíta sa ako aktívny s upozornením (N14)
      if (!z.stav) { z.aktivny = true; z.stavNeznamy = true; protokol.prazdnyStav = (protokol.prazdnyStav || 0) + 1; }
      else if (z.aktivny == null) z.aktivny = true;
    }
    if (druh === "zistenia" && z.sulad) { const i = z.sulad.indexOf("—"); z.suladKomentar = i >= 0 ? z.sulad.slice(i + 1).trim() : ""; }
    if (druh === "dep" && z.id) z.id = repDepKanon(z.id);
    if (def.siroky) {
      // dodávka: polia z prvého riadka platia pre ďalšie dve brány
      const zakl = repKanonKod(surId).replace(/[TEP]$/, "");
      if (z.oblast || z.dodavka || z.wbs) dodavkaKontext = Object.assign({ sekcia: dodavkaKontext.sekcia }, { kod: zakl, oblast: z.oblast, dodavka: z.dodavka, wbs: z.wbs });
      if (dodavkaKontext.kod === zakl) { z.oblast = z.oblast || dodavkaKontext.oblast; z.dodavka = z.dodavka || dodavkaKontext.dodavka; z.wbs = z.wbs || dodavkaKontext.wbs; }
      z.sekcia = dodavkaKontext.sekcia || "";
      if (typeof row[mapa.wbs] === "number" && row[mapa.wbs] > 20000) (protokol.wbsAkoDatum = protokol.wbsAkoDatum || []).push(surId);
      z.kod = repKanonKod(surId); z.zakladnyKod = zakl;
      z.commity = commity.map(c => {
        const v = row[c.i], n = repNorm(v);
        if (v === "" || v == null) return null;
        if (n === "x") return { dodavatel: c.dodavatel, stav: "x" };
        if (/^n\/?a\b|^na\b/.test(n)) return { dodavatel: c.dodavatel, stav: "na", text: String(v) };
        if (n.indexOf("dodan") >= 0) return { dodavatel: c.dodavatel, stav: "dodane" };
        const d = repDatumZBunky(v);
        if (d.datum) return { dodavatel: c.dodavatel, stav: "datum", datum: d.datum };
        protokol.datumy.neplatne += d.problem === "neplatný dátum" ? 1 : 0;
        return { dodavatel: c.dodavatel, stav: "text", text: d.text };
      }).filter(Boolean);
      const datumy = z.commity.filter(c => c.stav === "datum").map(c => c.datum).sort();
      z.commit = datumy.length ? datumy[datumy.length - 1] : null;      // najneskorší commit, BEZ baseline (N15)
      z.dodane = z.commity.some(c => c.stav === "dodane");
    }
    if (!z.id) { protokol.bezId++; z.id = ""; }
    const kl = druh === "ct" ? z.kod : repNorm(z.id);
    if (kl) { const n = (videne.get(kl) || 0) + 1; videne.set(kl, n); if (n > 1) { protokol.duplicitneId.push(z.id); z.kluc = kl + "#" + n; } else z.kluc = kl; }
    else z.kluc = "riadok" + (r + 1 + posun);
    riadky.push(z);
  }
  protokol.riadky = riadky.length;
  return { riadky, protokol };
}
function repDepKanon(id){
  const m = String(id).toUpperCase().replace(/\s/g, "").match(/^DEP-?(\d+)$/);
  return m ? "DEP-" + m[1].padStart(3, "0") : String(id).trim();
}

// ── 7. Issue Log — KPI (§6.8; definícia eskalácie v profile, N13) ─
function repIssueKpi(riadky, profil, stavKuDnu){
  const urovne = ((profil && profil.eskalaciaUrovne) || []).map(repNorm);
  const bez = ["", "n/a", "na", "nie", "-", "none", "bez eskalacie"];
  const jeEsk = z => { const n = repNorm(z.eskalacia); if (bez.includes(n)) return false; return urovne.length ? urovne.includes(n) : true; };
  const akt = riadky.filter(z => z.aktivny && !(z.anotacia && z.anotacia.nezapocitat));
  return { aktivne: akt.length, kriticke: akt.filter(z => z.prioritaKluc === "critical").length, vysoke: akt.filter(z => z.prioritaKluc === "high").length,
    eskalovane: akt.filter(jeEsk).length, eskalovaneStav: akt.filter(z => z.stavKluc === "eskalovane").length,
    poTermine: akt.filter(z => z.termin && stavKuDnu && z.termin < stavKuDnu).length, bezTerminu: akt.filter(z => !z.termin).length,
    neznamyStav: riadky.filter(z => z.stavNeznamy).length, spolu: riadky.length };
}

// ── 8. Súlad záväzkov s plánom (§6.6) ───────────────────────────
const REP_CT_PORADIE = ["SPLNENE", "CHYBA_V_PLANE", "PO_TERMINE", "PLAN_NESKOR", "DATUM_NESULAD", "BEZ_DATUMU", "V_SULADE"];
const REP_CT_POPIS = { SPLNENE: "Splnené", CHYBA_V_PLANE: "Chýba v pláne", PO_TERMINE: "Po termíne", PLAN_NESKOR: "Plán neskôr ako záväzok",
  DATUM_NESULAD: "Nesúlad dátumov", BEZ_DATUMU: "Bez dátumu záväzku", V_SULADE: "V súlade" };
function repCtSulad(plan, profil, ctRiadky, stavKuDnu, anotacie){
  const pole = profil.polia && profil.polia.kodZavazku;
  const strom = repStrom(plan);
  const podlaKodu = new Map();
  if (pole) for (const u of plan.ulohy) for (const t of repTokeny(u.polia[pole])) {
    const k = repKanonKod(t); if (!k || /^N\/?A$/.test(k)) continue;
    if (!podlaKodu.has(k) || (u.finish || "") > (podlaKodu.get(k).finish || "")) podlaKodu.set(k, u);   // najneskorší koniec
  }
  const drahaPre = uid => {
    let x = uid;
    while (x != null) { const ob = (profil.oblasti || []).find(o => (o.uids || []).includes(x)); if (ob) return ob.kluc; x = strom.rodic.get(x); }
    return null;
  };
  const anot = anotacie || {};
  const nesulad = (profil.metriky && profil.metriky.nesuladCtDni) || 14;
  const vysl = [];
  const pouzite = new Set();
  for (const z of ctRiadky) {
    if (!z.kod) continue;
    const a = anot[z.kluc] || {};
    const u = a.uid != null ? strom.index.get(a.uid) : podlaKodu.get(z.kod);
    if (u) pouzite.add(z.kod);
    const priz = [];
    const hotove = u && u.pct >= 100;
    if (hotove || z.dodane) priz.push("SPLNENE");
    if (!u) priz.push("CHYBA_V_PLANE");
    if (!z.commit) priz.push("BEZ_DATUMU");
    if (z.commit && !hotove && stavKuDnu && z.commit < stavKuDnu) priz.push("PO_TERMINE");
    if (u && z.commit && u.finish && u.finish > z.commit) priz.push("PLAN_NESKOR");
    const delta = u && z.commit && u.finish ? repDni(z.commit, u.finish) : null;
    if (delta != null && Math.abs(delta) > nesulad) priz.push("DATUM_NESULAD");
    if (!priz.length) priz.push("V_SULADE");
    let hlavny = REP_CT_PORADIE.find(p => priz.includes(p));
    if (a.stav && REP_CT_POPIS[a.stav]) hlavny = a.stav;            // ručný prepis s dôvodom má prednosť
    vysl.push({ kluc: z.kluc, id: z.id, kod: z.kod, brana: z.brana, dodavka: z.dodavka, oblastCt: z.oblast, sekcia: z.sekcia,
      commit: z.commit, baseline: z.baseline, posunOprotiBaseline: z.commit && z.baseline ? repDni(z.baseline, z.commit) : null,
      uloha: u ? { uid: u.uid, nazov: u.nazov, finish: u.finish, pct: u.pct } : null, draha: u ? drahaPre(u.uid) : null,
      deltaDni: delta, priznaky: priz, hlavny, prepis: a.stav ? { stav: a.stav, dovod: a.dovod || "" } : null, rucnaVazba: a.uid != null });
  }
  const planBezZavazku = [...podlaKodu.keys()].filter(k => !pouzite.has(k));
  const pocty = {};
  for (const p of REP_CT_PORADIE) pocty[p] = vysl.filter(v => v.hlavny === p).length;
  const vNesulade = vysl.filter(v => ["CHYBA_V_PLANE", "PO_TERMINE", "PLAN_NESKOR", "DATUM_NESULAD"].includes(v.hlavny)).length;
  return { zavazky: vysl, pocty, vNesulade, sparovane: vysl.filter(v => v.uloha).length, planBezZavazku };
}

// ── 9. Dependency log — príznaky (§4.5) ─────────────────────────
function repDepVyhodnot(depRiadky, plan, profil, ct, stavKuDnu, issueRiadky){
  const pole = profil.polia && profil.polia.kodZavazku;
  const ulohaPodlaKodu = new Map(), ulohaPodlaWbs = new Map();
  if (pole) for (const u of plan.ulohy) for (const t of repTokeny(u.polia[pole])) {
    const k = repKanonKod(t); if (!ulohaPodlaKodu.has(k) || (u.finish || "") > (ulohaPodlaKodu.get(k).finish || "")) ulohaPodlaKodu.set(k, u);
  }
  for (const u of plan.ulohy) { if (u.wbs) ulohaPodlaWbs.set(String(u.wbs), u); if (u.outline) ulohaPodlaWbs.set(String(u.outline), u); }
  const ctKody = new Set(((ct && ct.zavazky) || []).map(z => z.kod));
  const issueIds = new Set((issueRiadky || []).map(z => repNorm(z.id)));
  const vysl = depRiadky.map(z => {
    const priz = [];
    const akt = z.aktivny !== false;
    const milniky = [], osirele = [];
    for (const t of z.vazba || []) {
      const k = repKanonKod(t);
      const u = ulohaPodlaKodu.get(k) || ulohaPodlaWbs.get(String(t).trim());
      if (u) milniky.push({ kod: t, uid: u.uid, nazov: u.nazov, finish: u.finish, pct: u.pct });
      else if (!ctKody.has(k)) osirele.push(t);
    }
    const kedy = z.prislub || z.potrebne;
    if (akt && z.potrebne && stavKuDnu && z.potrebne < stavKuDnu) priz.push("PO_TERMINE");
    if (z.prislub && z.potrebne && z.prislub > z.potrebne) priz.push("RIZIKO_SKLZU");
    if (akt && !z.prislub) priz.push("BEZ_PRISLUBU");
    // blokuje: aktívna, naviazaný míľnik nie je hotový a závislosť je stavom
    // „Blokuje“ alebo príde (prísľub, inak potreba) až po termíne míľnika
    if (akt && milniky.some(mi => mi.pct < 100 && (z.stavKluc === "blokuje" || (kedy && mi.finish && kedy > mi.finish)))) priz.push("BLOKUJE_MILNIK");
    if (!(z.vazba || []).length && !(z.issue || []).length) priz.push("BEZ_VAZBY");
    if (osirele.length) priz.push("OSIRELA_VAZBA");
    const zleIssue = (z.issue || []).filter(i => !issueIds.has(repNorm(i)));
    return Object.assign({}, z, { priznaky: priz, milniky, osireleVazby: osirele, neznameIssue: zleIssue,
      dniDoPotreby: z.potrebne && stavKuDnu ? repDni(stavKuDnu, z.potrebne) : null });
  });
  const akt = vysl.filter(v => v.aktivny !== false);
  // odkazy DEP-nnn z Issue Logu, ktoré v logu nie sú
  const depIds = new Set(vysl.map(v => v.id));
  const osireleZIssue = [];
  for (const i of issueRiadky || []) for (const d of i.zavislosti || []) { const k = repDepKanon(d); if (/^DEP-/.test(k) && !depIds.has(k)) osireleZIssue.push({ issue: i.id, dep: k }); }
  return { zavislosti: vysl, kpi: { aktivne: akt.length, blokujuce: akt.filter(v => v.priznaky.includes("BLOKUJE_MILNIK")).length,
    poTermine: akt.filter(v => v.priznaky.includes("PO_TERMINE")).length, bezPrislubu: akt.filter(v => v.priznaky.includes("BEZ_PRISLUBU")).length },
    osireleZIssue };
}

// ── 10. Témy (§9.6): sady tokenov; layout ich len číta ──────────
// Prevzaté z generátora 4.0 (palety), téma „sp“ sa v kóde volá podľa
// vzhľadu — meno klienta ani logo v kóde nie sú (D10, D12).
const REP_TEMA_ZAKLAD = {
  bg: "FFFFFF", text: "2C2C2A", textSec: "5F5E5A", textTer: "888780", border: "D3D1C7", bgSec: "F1EFE8",
  panel: "F1EFE8", card: "FFFFFF", cardBorder: "D3D1C7", rowTint: "FAF9F5", tableHead: "F1EFE8", tableHeadText: "5F5E5A",
  green: "1D9E75", greenLt: "C0DD97", blue: "378ADD", blueLt: "B5D4F4", amber: "BA7517", amberLt: "FAC775",
  red: "E24B4A", redLt: "F7C1C1", redBg: "FCEBEB", redDark: "791F1F", white: "FFFFFF", conn: "9C9A92",
  accent: "0C447C", accent2: "378ADD", band: null, banner: null, headText: "FFFFFF", titleAccent: false,
  kpiBar: false, cardTop: false, rounded: false, leftRail: null, font: "Calibri" };
const REP_TEMY = {
  clean: { nazov: "Čistá" },
  subtle: { nazov: "Jemná grafika", band: { color: "0C447C", accent: "378ADD" }, titleAccent: true, kpiBar: true, cardTop: true },
  corporate: { nazov: "Korporátna (farebná hlavička)", banner: { color: "0C447C" }, kpiBar: true, cardTop: true,
    panel: "EDF2F9", tableHead: "0C447C", tableHeadText: "FFFFFF", accent: "0C447C", accent2: "2C7BE5", border: "C9D4E2" },
  institucionalna: { nazov: "Inštitucionálna (modrá + červená, Arial)", banner: { color: "014584" }, kpiBar: true, cardTop: true,
    panel: "E7E7E8", card: "FFFFFF", cardBorder: "D9D9DA", rowTint: "F2F2F3", bgSec: "E7E7E8", border: "D9D9DA",
    tableHead: "014584", tableHeadText: "FFFFFF", text: "1A1A1A", textSec: "4A4A4A", textTer: "7A7A7A",
    accent: "EC1B23", accent2: "014584", red: "EC1B23", font: "Arial" },
  dark: { nazov: "Tmavá", bg: "1F232B", text: "F3F3F0", textSec: "BFC2CA", textTer: "8B8F99", border: "3A404B", bgSec: "2A2F39",
    panel: "2A2F39", card: "2A2F39", cardBorder: "3A404B", rowTint: "262B34", tableHead: "2A2F39", tableHeadText: "BFC2CA",
    conn: "6B7280", band: { color: "3D7DFF", accent: "7FB0FF" }, titleAccent: true, kpiBar: true, cardTop: true,
    green: "35C28E", greenLt: "1E4D3E", blue: "4C8DFF", blueLt: "1E3A5C", amber: "E2A33C", amberLt: "4A3A1C",
    red: "F2685F", redLt: "4A2420", redBg: "332323", redDark: "F2A6A0", accent: "4C8DFF", accent2: "7FB0FF" },
  soft: { nazov: "Kartová (mäkká)", bg: "F7F5EF", panel: "FFFFFF", card: "FFFFFF", cardBorder: "E6E2D6", rowTint: "F2EFE6",
    tableHead: "EDE9DE", border: "E0DCCF", rounded: true, titleAccent: true, kpiBar: true, cardTop: true,
    accent: "1F7A6B", accent2: "2FA58F", band: { color: "1F7A6B", accent: "2FA58F" } },
  midnight: { nazov: "Polnočná (modrá + zlatá)", bg: "10203A", text: "F4F1E9", textSec: "C3C8D4", textTer: "8893A6", border: "2A3A57",
    bgSec: "1A2C49", panel: "17273F", card: "17273F", cardBorder: "2A3A57", rowTint: "15243B", tableHead: "17273F", tableHeadText: "D9B36A",
    conn: "5E6B82", band: { color: "D9B36A", accent: "B6924E" }, titleAccent: true, kpiBar: true, cardTop: true,
    green: "4FC59A", greenLt: "18402F", blue: "5B9BE8", blueLt: "17314F", amber: "E0B05A", amberLt: "3E3119",
    red: "EC7368", redLt: "45211E", redBg: "2E1C1A", redDark: "F0AFA8", accent: "D9B36A", accent2: "B6924E", rounded: true },
  editorial: { nazov: "Editorial (bočná lišta)", bg: "FCFBF8", text: "24201B", textSec: "5C564C", textTer: "928B7E", border: "E2DCCF",
    bgSec: "F2EEE4", panel: "F4F0E7", card: "FFFFFF", cardBorder: "E2DCCF", rowTint: "F7F3EA", tableHead: "2B2620", tableHeadText: "F7F1E4",
    titleAccent: true, kpiBar: true, cardTop: true, leftRail: "C7613A", green: "4E8E5B", greenLt: "D7E6C8", blue: "3E7CB1",
    blueLt: "CBDDEE", amber: "C7613A", amberLt: "F3D6BE", red: "B23A2E", redLt: "F2C9C2", redBg: "F7E7E2", redDark: "7A241B",
    accent: "C7613A", accent2: "2B2620" } };
function repTema(kluc, tokeny){
  const k = kluc === "sp" ? "institucionalna" : kluc;              // profil z generátora 4.0
  return Object.assign({}, REP_TEMA_ZAKLAD, REP_TEMY[k] || REP_TEMY.clean, tokeny || {});
}
function repFarbaStavu(pct, farby, T){
  const f = farby || { zelena: 70, modra: 40, jantarova: 10 };
  return pct >= f.zelena ? T.green : pct >= f.modra ? T.blue : pct >= f.jantarova ? T.amber : T.red;
}

// ── 11. Meranie textu (§9.1): jedno pravidlo pre náhľad, PPTX aj PDF ─
// Šírky znakov v em pre Calibri/Carlito (Arial je o ~7 % širší).
function repSirkaZnaku(c){
  if (c === " ") return 0.226;
  if ("il.,:;|!'ľĺíIj()[]·".indexOf(c) >= 0) return 0.25;
  if ("frtťJ-/".indexOf(c) >= 0) return 0.34;
  if ("0123456789".indexOf(c) >= 0) return 0.507;
  if ("mwMW%@".indexOf(c) >= 0) return 0.8;
  if ((c >= "A" && c <= "Z") || "ÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽÄ".indexOf(c) >= 0) return 0.6;
  if ("→←↑↓⚠✓◆○□◇▾".indexOf(c) >= 0) return 0.8;
  return 0.48;
}
function repSirkaTextu(t, pt, bold, font){
  let s = 0; for (const c of String(t == null ? "" : t)) s += repSirkaZnaku(c);
  return s * pt / 72 * (bold ? 1.06 : 1) * (font === "Arial" ? 1.07 : 1);
}
function repSkrat(t, maxW, pt, bold, font){
  t = String(t == null ? "" : t);
  if (repSirkaTextu(t, pt, bold, font) <= maxW) return t;
  let a = 0, b = t.length;
  while (a < b) { const m = Math.ceil((a + b) / 2); if (repSirkaTextu(t.slice(0, m) + "…", pt, bold, font) <= maxW) a = m; else b = m - 1; }
  return a > 0 ? t.slice(0, a).trimEnd() + "…" : "…";
}
function repZalom(t, maxW, pt, bold, font, maxRiadkov){
  const slova = String(t == null ? "" : t).split(/\s+/).filter(Boolean), riadky = [];
  let r = "";
  for (const s of slova) {
    const skus = r ? r + " " + s : s;
    if (repSirkaTextu(skus, pt, bold, font) <= maxW || !r) r = skus; else { riadky.push(r); r = s; }
  }
  if (r) riadky.push(r);
  if (maxRiadkov && riadky.length > maxRiadkov) { const z = riadky.slice(0, maxRiadkov); z[maxRiadkov - 1] = repSkrat(riadky.slice(maxRiadkov - 1).join(" "), maxW, pt, bold, font); return z.map(x => repSkrat(x, maxW, pt, bold, font)); }
  return riadky.map(x => repSkrat(x, maxW, pt, bold, font));
}

// ── 12. View-model (§9.1): VŠETKY snímky vrátane výberu ─────────
// Výber je súčasť view-modelu — žiadny zapisovač si nevyberá sám (§3.4).
const REP_KPI_KATALOG = {
  postupProgramu: "Postup programu", postupSkupiny: "Postup skupiny", postupOblasti: "Postup oblasti",
  oneskoreneOblasti: "Oneskorené oblasti", nasadene: "Nasadené", dokoncene: "Dokončené",
  pomalyPostup: "Pomalý postup", pocetOblasti: "Počet oblastí", dniDoKonca: "Dní do konca", datumKonca: "Cieľový termín" };

function repKpiHodnota(k, model, profil){
  const posl = profil.fazy.length ? profil.fazy[profil.fazy.length - 1].kluc : "";
  const z = { typ: k.typ, popis: k.popis || REP_KPI_KATALOG[k.typ] || k.typ, hodnota: "—", sub: "", pct: null, akcent: "blue" };
  if (k.typ === "postupProgramu") { z.pct = model.program.pct; z.hodnota = z.pct + " %"; z.sub = model.program.metoda.split(" (")[0]; }
  else if (k.typ === "postupSkupiny") { const s = model.skupiny.find(x => x.kluc === k.skupina); z.pct = s ? s.pct : null; z.hodnota = z.pct == null ? "—" : z.pct + " %"; z.sub = s ? "priemer " + s.pocet + " oblastí" : "skupina sa nenašla"; }
  else if (k.typ === "postupOblasti") { const d = model.drahy.find(x => x.kluc === k.oblast); z.pct = d && !d.chyba ? d.pct : null; z.hodnota = z.pct == null ? "—" : z.pct + " %"; z.sub = d ? d.pctMetoda || "" : "oblasť sa nenašla"; }
  else if (k.typ === "oneskoreneOblasti") { z.hodnota = String(model.pocty.oneskorene); z.sub = "s oneskoreným míľnikom"; z.akcent = model.pocty.oneskorene ? "red" : "green"; }
  else if (k.typ === "nasadene") { z.hodnota = model.pocty.nasadene + " / " + model.pocty.drahy; z.sub = "oblastí s " + posl + " hotovým"; z.akcent = "green"; }
  else if (k.typ === "dokoncene") { z.hodnota = String(model.pocty.hotove); z.sub = "oblastí na 100 %"; z.akcent = "green"; }
  else if (k.typ === "pomalyPostup") { z.hodnota = String(model.pocty.pomale); z.sub = "oblastí pod " + model.pocty.prahPomaly + " %"; z.akcent = model.pocty.pomale ? "amber" : "green"; }
  else if (k.typ === "pocetOblasti") { z.hodnota = String(model.pocty.drahy); z.sub = "sledovaných oblastí"; z.akcent = "textSec"; }
  else if (k.typ === "dniDoKonca") { z.hodnota = model.dniDoKonca == null ? "—" : String(model.dniDoKonca); z.sub = model.cielovyTermin ? "cieľ " + repDMR(model.cielovyTermin) : "cieľový termín chýba"; z.akcent = "textSec"; }
  else if (k.typ === "datumKonca") { z.hodnota = model.cielovyTermin ? repDM(model.cielovyTermin) : "—"; z.sub = model.cielovyTermin ? model.cielovyTermin.slice(0, 4) : ""; z.akcent = "textSec"; }
  return z;
}

function repAutoPoznamka(d, fazy){
  for (const f of fazy) { const r = d.fazy[f.kluc]; if (r && r.oneskorene) return { text: f.kluc + " oneskorené (" + repDM(r.datum) + ")", zdroj: "auto" }; }
  const vsetky = fazy.map(f => d.fazy[f.kluc]).filter(Boolean);
  if (vsetky.length && vsetky.every(r => r.hotove)) return { text: "Dokončené", zdroj: "auto" };
  for (const f of fazy) { const r = d.fazy[f.kluc]; if (r && !r.hotove) return { text: "→ " + f.kluc + " " + repDM(r.datum), zdroj: "auto" }; }
  return { text: "", zdroj: "auto" };
}

function repNaratiV(model, profil){
  const posl = profil.fazy.length ? profil.fazy[profil.fazy.length - 1].kluc : "poslednej fáze";
  const p = model.pocty;
  let t = "K " + repDMR(model.stavKuDnu) + " je postup programu " + model.program.pct + " %. Z " + p.drahy + " sledovaných oblastí sú " +
    p.nasadene + " nasadené v " + posl + " a " + p.hotove + " dokončené (100 %). ";
  t += p.oneskorene ? (p.oneskorene === 1 ? "1 oblasť má oneskorený míľnik." : p.oneskorene + " oblastí má oneskorený míľnik.") : "Žiadna oblasť nemá oneskorený míľnik.";
  if (model.dniDoKonca != null) t += model.dniDoKonca >= 0 ? " Do cieľového termínu (" + repDMR(model.cielovyTermin) + ") zostáva " + model.dniDoKonca + " dní." : " Cieľový termín (" + repDMR(model.cielovyTermin) + ") uplynul pred " + (-model.dniDoKonca) + " dňami.";
  return t;
}

function repView(model, kontext){
  const p = kontext.profil, c = kontext.cyklus || {}, us = c.usudok || {}, vy = c.vyber || {};
  const fazy = p.fazy || [];
  const skryte = new Set(vy.skryteOblasti || []);
  const drahy = model.drahy.filter(d => !d.chyba && !skryte.has(d.kluc));
  const skupinyMena = {}; for (const s of p.skupiny || []) skupinyMena[s.kluc] = s.nazov;
  const poznamky = us.poznamky || {};
  const drahaView = d => {
    const ruc = poznamky[d.kluc] != null && poznamky[d.kluc] !== "" ? { text: poznamky[d.kluc], zdroj: "rucne" } : d.poznamka ? { text: d.poznamka, zdroj: "profil" } : repAutoPoznamka(d, fazy);
    return { kluc: d.kluc, kratky: d.kratky, nazov: d.nazov, skupina: d.skupina, pct: d.pct, oneskorena: d.oneskorena, poznamka: ruc,
      fazy: fazy.map(f => { const r = d.fazy[f.kluc]; return { kluc: f.kluc, znacka: f.znacka, datum: r ? r.datum : null, hotove: !!(r && r.hotove), oneskorene: !!(r && r.oneskorene) }; }) };
  };
  const snimky = [];
  const vybrane = k => !(vy.snimky && vy.snimky[k] === false);
  // 1. Prehľad + kritická cesta
  const kpiDef = (vy.kpi && vy.kpi.length ? vy.kpi : p.kpi || []).filter(k => k && k.zap !== false).slice(0, 6);
  snimky.push({ kluc: "prehlad", typ: "prehlad", nazov: "Prehľad a kritická cesta", zahrnuta: vybrane("prehlad"),
    kpi: kpiDef.map(k => repKpiHodnota(k, model, p)),
    karty: (p.karty || []).filter(k => !skryte.has(k.oblast)).slice(0, 6).map(k => {
      const d = model.drahy.find(x => x.kluc === k.oblast);
      const pr = model.prierez[k.oblast];
      return { popis: k.popis || (d ? d.kratky : "?"), pct: d && !d.chyba ? d.pct : null, prierez: k.prierez && pr ? pr.pct : null, prierezPopis: (k.popis || (d ? d.kratky : "")) + " + prierez" };
    }),
    skupiny: (p.skupiny || []).map(s => ({ kluc: s.kluc, nazov: s.nazov, drahy: drahy.filter(d => d.skupina === s.kluc).map(drahaView) })).filter(s => s.drahy.length),
    os: repOs(model, p), fazy: fazy.map(f => ({ kluc: f.kluc, legenda: f.legenda, znacka: f.znacka })) });
  // 2. Exekutívny súhrn
  const pozornost = [];
  for (const d of drahy) {
    const posl = fazy[fazy.length - 1];
    const one = [...fazy].reverse().map(f => ({ f, r: d.fazy[f.kluc] })).find(x => x.r && x.r.oneskorene);
    if (!one) continue;
    pozornost.push({ kratky: d.kratky, dovod: one.f.kluc + (one.f === posl ? " termín prekročený (" : " oneskorené (") + repDM(one.r.datum) + ")",
      zavaznost: one.f === posl ? "vysoka" : "stredna", dni: one.r.dniPoTermine });
  }
  pozornost.sort((a, b) => (a.zavaznost === b.zavaznost ? 0 : a.zavaznost === "vysoka" ? -1 : 1) || b.dni - a.dni);
  snimky.push({ kluc: "exec", typ: "exec", nazov: "Exekutívny súhrn", zahrnuta: vybrane("exec"),
    kpi: ["postupProgramu", "nasadene", "dokoncene", "oneskoreneOblasti", "pomalyPostup", "dniDoKonca"].map(t => repKpiHodnota({ typ: t }, model, p)),
    naratiV: us.naratiV && us.naratiV.text ? us.naratiV.text : repNaratiV(model, p), naratiVZdroj: us.naratiV && us.naratiV.text ? (us.naratiV.zdroj || "rucne") : "auto",
    metoda: "Postup programu: " + model.program.metoda + ".", pozornost });
  // 3. Najbližšie míľniky
  const tyzdne = (vy.najblizsieTyzdne || (p.metriky && p.metriky.oknoNajblizsieTyzdne) || 6);
  const doDna = repPlusDni(model.stavKuDnu, tyzdne * 7);
  const polozky = [];
  for (const d of drahy) for (const f of fazy) {
    const r = d.fazy[f.kluc]; if (!r) continue;
    for (const mi of r.milniky) if (mi.datum && mi.pct < 100 && mi.datum > model.stavKuDnu && mi.datum <= doDna)
      polozky.push({ datum: mi.datum, dni: repDni(model.stavKuDnu, mi.datum), kratky: d.kratky, faza: f.legenda || f.kluc, pct: mi.pct });
  }
  polozky.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.kratky.localeCompare(b.kratky)));
  snimky.push({ kluc: "najblizsie", typ: "najblizsie", nazov: "Najbližšie míľniky (" + tyzdne + " týždňov)", zahrnuta: vybrane("najblizsie"), tyzdne, polozky });
  // 4. Detaily oneskorených oblastí
  const prah = (p.metriky && p.metriky.nizkyPostupUlohy) || 50;
  const skrytePod = vy.skrytePodsekcie || {};
  for (const d of drahy.filter(x => x.oneskorena)) {
    const odznaky = fazy.map(f => ({ f, r: d.fazy[f.kluc] })).filter(x => x.r && x.r.oneskorene).map(x => ({ legenda: x.f.legenda || x.f.kluc, kluc: x.f.kluc, datum: x.r.datum, pct: x.r.pct }));
    const sekcie = d.balicky.map(b => {
      // pod prahom = nehotová úloha pod prahom, ktorej termín už uplynul (meškajúca)
      const riadky = b.ulohy.map(u => ({ uid: u.uid, nazov: u.nazov, hlbka: u.uroven, pct: u.pct, finish: u.finish, milnik: u.milnik,
        podPrahom: u.pct < prah && !!u.finish && u.finish <= model.stavKuDnu }));
      const faz = fazy.some(f => b.fazy[f.kluc] && b.fazy[f.kluc].oneskorene);
      return { uid: b.uid, nazov: b.nazov, pct: b.pct, finish: b.finish, pocetPodPrahom: riadky.filter(r => r.podPrahom).length, oneskorena: faz,
        zahrnuta: !(skrytePod[d.kluc] || []).includes(b.uid), riadky };
    }).filter(s => s.oneskorena || s.pocetPodPrahom > 0).sort((a, b) => b.pocetPodPrahom - a.pocetPodPrahom || (a.oneskorena === b.oneskorena ? 0 : a.oneskorena ? -1 : 1));
    snimky.push({ kluc: "oneskorenie:" + d.kluc, typ: "oneskorenie", nazov: "Oneskorenie: " + d.kratky, zahrnuta: vybrane("oneskorenie:" + d.kluc),
      draha: { kluc: d.kluc, nazov: d.nazov, kratky: d.kratky, pct: d.pct, skupina: skupinyMena[d.skupina] || "" }, odznaky, sekcie, prah });
  }
  return { nazov: p.nazov || "", kod: p.kod || "", stavKuDnu: model.stavKuDnu, cielovyTermin: model.cielovyTermin, pocetUloh: model.pocty.ulohy,
    farby: (p.metriky && p.metriky.farby) || null, snimky,
    manifest: snimky.map(s => ({ kluc: s.kluc, nazov: s.nazov, zahrnuta: s.zahrnuta })) };
}

// Os Ganttu: len zobrazenie (N7) — od mesiaca pred ~2,5 mesiacmi po cieľ.
function repOs(model, profil){
  if (profil.os && profil.os.od && profil.os.do) return { od: profil.os.od, do: profil.os.do };
  const od = repPlusDni(model.stavKuDnu, -75).slice(0, 8) + "01";
  let doD = repMax(model.cielovyTermin, repPlusDni(model.stavKuDnu, 90));
  for (const d of model.drahy) if (!d.chyba) for (const f of profil.fazy) { const r = d.fazy[f.kluc]; if (r && r.datum && r.datum > doD && repDni(model.stavKuDnu, r.datum) < 400) doD = r.datum; }
  const m = new Date(repMs(doD)); const koniec = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { od, do: repDni(od, koniec) > 730 ? repPlusDni(od, 730) : koniec };
}

// ── 13. Layout (§9.1): strany z primitív v palcoch; stránkuje sa TU ─
const REP_W = 13.333, REP_H = 7.5, REP_L = 0.4, REP_CW = REP_W - 2 * REP_L;
const REP_MESIACE = ["Jan", "Feb", "Mar", "Apr", "Máj", "Jún", "Júl", "Aug", "Sep", "Okt", "Nov", "Dec"];

function repLayout(view, temaKluc, tokeny, volby){
  const T = repTema(temaKluc, tokeny);
  volby = volby || {};
  const strany = [];
  for (const s of view.snimky) {
    if (volby.lenZahrnute !== false && !s.zahrnuta) continue;
    const fn = REP_LAYOUTY[s.typ];
    if (!fn) continue;
    for (const st of fn(s, view, T)) strany.push(Object.assign({ kluc: s.kluc, typ: s.typ }, st));
  }
  const problemy = repOverLayout(strany);
  return { sirka: REP_W, vyska: REP_H, tema: temaKluc, font: T.font, bg: T.bg, strany, problemy };
}

// Kontrola rozloženia: nič mimo strany, žiadne NaN (PowerPoint by súbor neotvoril).
function repOverLayout(strany){
  const o = [];
  strany.forEach((st, i) => st.prvky.forEach((p, j) => {
    for (const k of ["x", "y", "w", "h", "x1", "y1", "x2", "y2", "pt"].concat(p.t === "mark" ? ["s"] : [])) if (k in p && !Number.isFinite(p[k])) o.push("strana " + (i + 1) + ", prvok " + j + " (" + p.t + "): " + k + " = " + p[k]);
    if ("x" in p && "w" in p && (p.x < -0.01 || p.x + p.w > REP_W + 0.01)) o.push("strana " + (i + 1) + ", prvok " + j + " (" + p.t + ") presahuje šírku strany");
    if ("y" in p && "h" in p && (p.y < -0.01 || p.y + p.h > REP_H + 0.01)) o.push("strana " + (i + 1) + ", prvok " + j + " (" + p.t + ") presahuje výšku strany");
  }));
  return o;
}

// Spoločné kúsky (jediné definície, §9.1)
function repPrvky(T){
  const P = [];
  const api = {
    prvky: P,
    rect: (x, y, w, h, o) => P.push(Object.assign({ t: "rect", x, y, w, h }, o)),
    text: (x, y, w, h, s, o) => P.push(Object.assign({ t: "text", x, y, w, h, s, pt: 10, color: T.text, align: "l", valign: "m", font: T.font }, o)),
    line: (x1, y1, x2, y2, o) => P.push(Object.assign({ t: "line", x1, y1, x2, y2, color: T.border, lw: 0.75 }, o)),
    mark: (tvar, x, y, s, o) => P.push(Object.assign({ t: "mark", tvar, x, y, s }, o)) };
  return api;
}

function repHlavicka(A, T, kicker, nadpis, vpravo, volby){
  volby = volby || {};
  if (T.leftRail) A.rect(0, 0, 0.16, REP_H, { fill: T.leftRail });
  if (volby.cervena) {
    A.rect(0, 0, REP_W, 1.1, { fill: T.red });
    A.text(REP_L, 0.18, 9, 0.24, String(kicker).toUpperCase(), { pt: 10, bold: true, color: T.white });
    A.text(REP_L, 0.44, 9.6, 0.5, repSkrat(nadpis, 9.6, 22, true, T.font), { pt: 22, bold: true, color: T.white });
    if (vpravo) A.text(9.6, 0.44, REP_W - 9.6 - REP_L + 0.15, 0.5, vpravo, { pt: 11, bold: true, color: T.white, align: "r" });
    return 1.25;
  }
  if (T.banner) {
    A.rect(0, 0, REP_W, 0.98, { fill: T.banner.color });
    A.text(REP_L, 0.16, 9, 0.24, String(kicker).toUpperCase(), { pt: 9, color: T.headText });
    A.text(REP_L, 0.4, 9.6, 0.46, repSkrat(nadpis, 9.6, 22, true, T.font), { pt: 22, bold: true, color: T.headText });
    if (vpravo) A.text(9.6, 0.4, REP_W - 9.6 - REP_L, 0.46, vpravo, { pt: 12, bold: true, color: T.headText, align: "r" });
    return 1.1;
  }
  if (T.band) { A.rect(0, 0, REP_W, 0.1, { fill: T.band.color }); A.rect(0, 0.1, REP_W, 0.022, { fill: T.band.accent }); }
  A.text(REP_L, 0.2, 9, 0.22, String(kicker).toUpperCase(), { pt: 9, color: T.textTer });
  A.text(REP_L, 0.42, 9.6, 0.42, repSkrat(nadpis, 9.6, 21, true, T.font), { pt: 21, bold: true, color: T.text });
  if (vpravo) A.text(9.6, 0.42, REP_W - 9.6 - REP_L, 0.42, vpravo, { pt: 13, bold: true, color: T.text, align: "r" });
  A.line(REP_L, 0.94, REP_W - REP_L, 0.94, { color: T.border, lw: 0.75 });
  if (T.titleAccent) A.rect(REP_L, 0.925, 1.7, 0.03, { fill: T.accent });
  return 1.05;
}

function repDlazdice(A, T, kpi, y, h, farby){
  const n = Math.max(1, kpi.length), medzera = 0.17;
  const w = (REP_CW - (n - 1) * medzera) / n;
  const ptH = n <= 4 ? 24 : n === 5 ? 21 : 19;
  kpi.forEach((k, i) => {
    const x = REP_L + i * (w + medzera);
    const ak = k.akcent === "red" ? T.red : k.akcent === "green" ? T.green : k.akcent === "amber" ? T.amber : k.akcent === "textSec" ? T.textSec : (k.pct != null ? repFarbaStavu(k.pct, farby, T) : T.blue);
    A.rect(x, y, w, h, { fill: T.panel, r: T.rounded ? 0.08 : 0 });
    A.rect(x, y, 0.06, h, { fill: ak });
    A.text(x + 0.17, y + 0.07, w - 0.25, 0.22, repSkrat(k.popis, w - 0.25, 10, false, T.font), { pt: 10, color: T.textSec });
    A.text(x + 0.17, y + 0.28, w - 0.25, 0.36, repSkrat(k.hodnota, w - 0.25, ptH, true, T.font), { pt: ptH, bold: true, color: T.text });
    if (T.kpiBar && k.pct != null) {
      A.rect(x + 0.17, y + h - 0.13, w - 0.34, 0.05, { fill: T.border });
      A.rect(x + 0.17, y + h - 0.13, Math.max(0.01, (w - 0.34) * Math.min(100, k.pct) / 100), 0.05, { fill: ak });
    } else if (k.sub) A.text(x + 0.17, y + h - 0.2, w - 0.25, 0.15, repSkrat(k.sub, w - 0.25, 8, false, T.font), { pt: 8, color: T.textTer });
  });
}

function repZnacka(A, T, f, x, y, s){
  const tvar = f.znacka || "kruh";
  if (f.hotove) A.mark(tvar, x, y, s, { fill: T.green, line: T.green, lw: 1 });
  else if (f.oneskorene) A.mark(tvar, x, y, s, { fill: T.bg, line: T.red, lw: 1.5 });
  else A.mark(tvar, x, y, s, { fill: T.bg, line: T.accent2, lw: 1.25 });
}

function repLegenda(A, T, fazy, y, farby, zdroj){
  let x = REP_L;
  A.text(x, y, 0.8, 0.2, "Míľniky:", { pt: 9, bold: true, color: T.text }); x += 0.8;
  for (const f of fazy) {
    A.mark(f.znacka || "kruh", x + 0.07, y + 0.1, 0.12, { fill: T.textSec, line: T.textSec, lw: 1 });
    const t = f.legenda || f.kluc, w = repSirkaTextu(t, 9, false, T.font) + 0.1;
    A.text(x + 0.2, y, w, 0.2, t, { pt: 9, color: T.textSec }); x += 0.3 + w;
  }
  A.mark("kruh", x + 0.07, y + 0.1, 0.12, { fill: T.textSec, line: T.textSec, lw: 1 }); A.text(x + 0.2, y, 0.55, 0.2, "hotové", { pt: 9, color: T.textSec }); x += 0.8;
  A.mark("kruh", x + 0.07, y + 0.1, 0.12, { fill: T.bg, line: T.textSec, lw: 1 }); A.text(x + 0.2, y, 0.75, 0.2, "plánované", { pt: 9, color: T.textSec }); x += 1.0;
  A.mark("kruh", x + 0.07, y + 0.1, 0.12, { fill: T.bg, line: T.red, lw: 1.5 }); A.text(x + 0.2, y, 0.95, 0.2, "po termíne", { pt: 9, color: T.textSec }); x += 1.2;
  const f = farby || { zelena: 70, modra: 40, jantarova: 10 };
  for (const [c, t] of [[T.green, "≥" + f.zelena + " %"], [T.blue, f.modra + "–" + (f.zelena - 1) + " %"], [T.amber, f.jantarova + "–" + (f.modra - 1) + " %"], [T.red, "<" + f.jantarova + " %"]]) {
    if (x > REP_W - 3.2) break;
    A.rect(x, y + 0.05, 0.18, 0.1, { fill: c }); A.text(x + 0.23, y, 0.6, 0.2, t, { pt: 8, color: T.textSec }); x += 0.85;
  }
  if (zdroj) A.text(REP_W - REP_L - 3, y + 0.2, 3, 0.18, zdroj, { pt: 7.5, italic: true, color: T.textTer, align: "r" });
}

const REP_LAYOUTY = {
  prehlad(s, view, T){
    const strany = [];
    const vpravo = "Stav ku dňu " + repDMR(view.stavKuDnu);
    // riadky Ganttu (skupina = riadok nadpisu)
    const riadky = [];
    for (const g of s.skupiny) { riadky.push({ skupina: g.nazov }); for (const d of g.drahy) riadky.push({ draha: d }); }
    const zdroj = "Zdroj: MS Project · " + view.pocetUloh + " úloh";
    let i = 0, prva = true;
    while (prva || i < riadky.length) {
      const A = repPrvky(T);
      let y = repHlavicka(A, T, prva ? "Roadmapa programu" : "Kritická cesta — pokračovanie", view.nazov || "Stav programu", vpravo);
      if (prva) {
        if (s.kpi.length) { repDlazdice(A, T, s.kpi, y, 0.78, view.farby); y += 0.78 + 0.14; }
        if (s.karty.length) {
          const n = s.karty.length, med = 0.17, w = (REP_CW - (n - 1) * med) / n;
          const sPrierezom = s.karty.some(k => k.prierez != null), h = sPrierezom ? 0.98 : 0.78;
          s.karty.forEach((k, j) => {
            const x = REP_L + j * (w + med);
            A.rect(x, y, w, h, { fill: T.card, line: T.cardBorder, lw: 0.75, r: T.rounded ? 0.08 : 0 });
            if (T.cardTop) A.rect(x, y, w, 0.05, { fill: T.accent2 });
            A.text(x + 0.15, y + 0.08, w - 0.3, 0.22, repSkrat(k.popis, w - 0.3, 11, true, T.font), { pt: 11, bold: true });
            A.text(x + 0.15, y + 0.3, w - 0.3, 0.3, k.pct == null ? "—" : k.pct + " %", { pt: 18, bold: true });
            if (k.pct != null) { A.rect(x + 0.15, y + 0.63, w - 0.3, 0.06, { fill: T.bgSec }); A.rect(x + 0.15, y + 0.63, Math.max(0.01, (w - 0.3) * Math.min(100, k.pct) / 100), 0.06, { fill: repFarbaStavu(k.pct, view.farby, T) }); }
            if (k.prierez != null) A.text(x + 0.15, y + 0.74, w - 0.3, 0.2, repSkrat(k.prierezPopis + ": " + k.prierez + " %", w - 0.3, 9, true, T.font), { pt: 9, bold: true, color: repFarbaStavu(k.prierez, view.farby, T) });
          });
          y += h + 0.14;                                   // nadpis kritickej cesty až POD kartami (prekryv v 4.0)
        }
      }
      const kluce = s.fazy.map(f => f.kluc).join(" → ");
      A.text(REP_L, y, REP_CW, 0.22, "KRITICKÁ CESTA · MÍĽNIKY " + kluce + " PO OBLASTIACH", { pt: 9, bold: true, color: T.textSec });
      y += 0.26;
      // os
      const x0 = REP_L + 3.12, x1 = REP_W - REP_L - 0.05, os = s.os;
      const dniOs = Math.max(1, repDni(os.od, os.do));
      const xOf = d => x0 + (x1 - x0) * Math.max(0, Math.min(1, repDni(os.od, d) / dniOs));
      const vOkne = d => d && d >= os.od && d <= os.do;
      const hMes = 0.2;
      const dnesT = "DNES " + repDM(view.stavKuDnu), dnesW = repSirkaTextu(dnesT, 7.5, true, T.font) + 0.12;
      const dnesX = vOkne(view.stavKuDnu) ? Math.min(x1 - dnesW, Math.max(x0, xOf(view.stavKuDnu) - dnesW / 2)) : -10;
      for (let m = os.od; m <= os.do;) {
        const dt = new Date(repMs(m)); const dalsi = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
        const xa = xOf(m), xb = xOf(repMin(dalsi, os.do));
        const mW = repSirkaTextu(REP_MESIACE[dt.getUTCMonth()], 8, false, T.font), mX = (xa + xb) / 2 - mW / 2;
        if (xb - xa > 0.35 && (mX + mW < dnesX - 0.04 || mX > dnesX + dnesW + 0.04)) A.text(xa, y, xb - xa, hMes, REP_MESIACE[dt.getUTCMonth()], { pt: 8, color: T.textTer, align: "c" });
        m = dalsi;
      }
      const yRad = y + hMes + 0.04, yKon = 6.78;
      // stránkovanie: koľko riadkov sa zmestí pri minimálnej výške 0,17
      const zostava = riadky.length - i;
      const minH = 0.17, maxH = 0.3;
      const kapacita = Math.max(1, Math.floor((yKon - yRad) / minH));
      const naStranu = Math.min(zostava, kapacita);
      const rh = Math.max(minH, Math.min(maxH, (yKon - yRad) / Math.max(1, naStranu)));
      // mriežka mesiacov a čiary DNES / KONIEC
      for (let m = os.od; m <= os.do;) {
        const dt = new Date(repMs(m)); const dalsi = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
        if (m > os.od) A.line(xOf(m), yRad, xOf(m), yRad + naStranu * rh, { color: T.border, lw: 0.5 });
        m = dalsi;
      }
      for (let k = 0; k < naStranu; k++) {
        const r = riadky[i + k], yy = yRad + k * rh;
        if (r.skupina) { A.text(REP_L, yy, 2.9, rh, repSkrat(r.skupina, 2.9, 8, true, T.font), { pt: 8, bold: true, color: T.textTer }); A.line(REP_L, yy + 0.01, x1, yy + 0.01, { color: T.border, lw: 0.5 }); continue; }
        const d = r.draha, ym = yy + rh / 2, pt = rh >= 0.22 ? 10 : 9;
        A.text(REP_L, yy, 2.4, rh, repSkrat(d.kratky, 2.4, pt, true, T.font), { pt, bold: true });
        A.text(REP_L + 2.4, yy, 0.5, rh, d.pct + " %", { pt: pt - 1, bold: true, color: repFarbaStavu(d.pct, view.farby, T), align: "r" });
        const body = d.fazy.filter(f => vOkne(f.datum)).map(f => ({ f, x: xOf(f.datum) }));
        if (body.length > 1) { const xs = body.map(b => b.x); A.line(Math.min(...xs), ym, Math.max(...xs), ym, { color: T.conn, lw: 1 }); }
        const sz = Math.min(0.14, rh * 0.62);
        for (const b of body) repZnacka(A, T, b.f, b.x, ym, sz);
        let xKoniec = body.length ? Math.max(...body.map(b => b.x)) + sz / 2 + 0.04 : x0;
        const posl = d.fazy[d.fazy.length - 1];
        if (posl && vOkne(posl.datum)) {
          const t = posl.hotove ? "✓" : repDM(posl.datum) + (posl.oneskorene ? " ⚠" : "");
          const w = repSirkaTextu(t, 7.5, posl.oneskorene, T.font) + 0.05;
          if (xKoniec + w <= x1) { A.text(xKoniec, yy, w, rh, t, { pt: 7.5, bold: posl.oneskorene, color: posl.oneskorene ? T.red : T.textSec }); xKoniec += w + 0.1; }
        }
        const pz = d.poznamka && d.poznamka.text;
        if (pz) {
          const xPz = vOkne(view.cielovyTermin) && xOf(view.cielovyTermin) > xKoniec + 0.9 ? Math.min(x1, xOf(view.cielovyTermin) - 0.08) : x1;
          const volne = xPz - Math.max(xKoniec, x0 + 0.1);
          const wPz = Math.min(volne, repSirkaTextu(pz, 7.5, false, T.font) + 0.05);
          if (wPz >= 0.8) A.text(xPz - wPz, yy, wPz, rh, repSkrat(pz, wPz, 7.5, false, T.font), { pt: 7.5, italic: true, color: T.textTer, align: "r" });
        }
      }
      const yS = Math.max(yRad, Math.min(yKon, yRad + naStranu * rh));
      if (vOkne(view.stavKuDnu)) {
        const xd = xOf(view.stavKuDnu);
        A.line(xd, yRad - 0.02, xd, yS, { color: T.red, lw: 1.25, dash: true });
        A.rect(dnesX, y - 0.02, dnesW, 0.19, { fill: T.red });
        A.text(dnesX, y - 0.02, dnesW, 0.19, dnesT, { pt: 7.5, bold: true, color: T.white, align: "c" });
      }
      if (vOkne(view.cielovyTermin)) {
        const xc = xOf(view.cielovyTermin);
        A.line(xc, yRad - 0.02, xc, yS, { color: T.textTer, lw: 1, dash: true });
        A.text(Math.min(x1 - 0.6, xc - 0.3), yS + 0.01, 0.6, 0.16, "KONIEC", { pt: 7, bold: true, color: T.textTer, align: "c" });
      }
      repLegenda(A, T, s.fazy, 6.9, view.farby, zdroj);
      strany.push({ prvky: A.prvky, nadpis: prva ? "Prehľad a kritická cesta" : "Kritická cesta — pokračovanie" });
      i += naStranu; prva = false;
      if (strany.length > 20) break;
    }
    return strany;
  },

  exec(s, view, T){
    const A = repPrvky(T);
    let y = repHlavicka(A, T, "Exekutívny súhrn", "Kde sme a čo vyžaduje pozornosť", "Stav " + repDMR(view.stavKuDnu));
    repDlazdice(A, T, s.kpi, y, 0.85, view.farby); y += 0.85 + 0.3;
    const wL = 6.55;
    A.text(REP_L, y, wL, 0.24, "SÚHRN", { pt: 10, bold: true, color: T.textSec });
    A.text(REP_L + wL + 0.3, y, REP_CW - wL - 0.3, 0.24, "VYŽADUJE POZORNOSŤ", { pt: 10, bold: true, color: T.textSec });
    y += 0.3;
    const hP = 6.85 - y;
    A.rect(REP_L, y, wL, hP, { fill: T.panel, r: T.rounded ? 0.08 : 0 });
    const riadky = repZalom(s.naratiV, wL - 0.5, 13, false, T.font, Math.floor((hP - 0.6) / (13 * 1.25 / 72)));
    A.text(REP_L + 0.25, y + 0.2, wL - 0.5, riadky.length * 13 * 1.25 / 72 + 0.05, riadky, { pt: 13, valign: "t", lh: 1.25 });
    A.text(REP_L + 0.25, y + hP - 0.32, wL - 0.5, 0.22, repSkrat(s.metoda, wL - 0.5, 8, false, T.font), { pt: 8, italic: true, color: T.textTer });
    const xR = REP_L + wL + 0.3, wR = REP_CW - wL - 0.3, rh = 0.38;
    const kolko = Math.min(s.pozornost.length, Math.floor(hP / rh));
    if (!s.pozornost.length) A.text(xR, y, wR, 0.3, "Žiadna oblasť nemá oneskorený míľnik.", { pt: 11, color: T.textSec });
    for (let k = 0; k < kolko; k++) {
      const p = s.pozornost[k], yy = y + k * rh, c = p.zavaznost === "vysoka" ? T.red : T.amber;
      A.rect(xR, yy + 0.02, 0.07, rh - 0.06, { fill: c });
      A.text(xR + 0.2, yy, wR * 0.45, rh, repSkrat(p.kratky, wR * 0.45, 11, true, T.font), { pt: 11, bold: true });
      A.text(xR + wR * 0.45, yy, wR * 0.55, rh, repSkrat(p.dovod, wR * 0.55, 10, false, T.font), { pt: 10, color: c, align: "r" });
    }
    if (s.pozornost.length > kolko) A.text(xR, y + kolko * rh, wR, 0.22, "+ " + (s.pozornost.length - kolko) + " ďalších", { pt: 9, italic: true, color: T.textTer });
    A.text(REP_W - REP_L - 3, 6.95, 3, 0.18, "Zdroj: MS Project · stav " + repDMR(view.stavKuDnu), { pt: 7.5, italic: true, color: T.textTer, align: "r" });
    return [{ prvky: A.prvky, nadpis: "Exekutívny súhrn" }];
  },

  najblizsie(s, view, T){
    const A = repPrvky(T);
    let y = repHlavicka(A, T, "Najbližšie míľniky", "Čo nás čaká v najbližších " + s.tyzdne + " týždňoch", "Stav " + repDMR(view.stavKuDnu));
    y += 0.1;
    const skup = [["Do 7 dní", 0, 7], ["1–2 týždne", 8, 14], ["2–4 týždne", 15, 28], ["Neskôr", 29, 10000]];
    const stlpce = [REP_L, REP_L + REP_CW / 2 + 0.15], wS = REP_CW / 2 - 0.15, rh = 0.25;
    let st = 0, yy = y, kolko = 0;
    const maxY = 6.95;
    if (!s.polozky.length) A.text(REP_L, y, REP_CW, 0.3, "V tomto období nie je naplánovaný žiadny nehotový míľnik.", { pt: 12, color: T.textSec });
    outer: for (const [nazov, od, po] of skup) {
      const pol = s.polozky.filter(p => p.dni >= od && p.dni <= po);
      if (!pol.length) continue;
      if (yy + 0.3 + rh > maxY) { if (++st > 1) break; yy = y; }
      A.text(stlpce[st], yy, wS, 0.26, nazov.toUpperCase() + " · " + pol.length, { pt: 9, bold: true, color: T.textSec });
      A.line(stlpce[st], yy + 0.27, stlpce[st] + wS, yy + 0.27, { color: T.border, lw: 0.5 });
      yy += 0.32;
      for (const p of pol) {
        if (yy + rh > maxY) { if (++st > 1) break outer; yy = y; }
        const x = stlpce[st];
        A.text(x, yy, 0.75, rh, repDM(p.datum), { pt: 10, bold: true, color: p.dni <= 7 ? T.red : T.text });
        A.text(x + 0.78, yy, 1.9, rh, repSkrat(p.kratky, 1.9, 10, true, T.font), { pt: 10, bold: true });
        A.text(x + 2.72, yy, wS - 3.4, rh, repSkrat(p.faza, wS - 3.4, 9, false, T.font), { pt: 9, color: T.textSec });
        A.text(x + wS - 0.6, yy, 0.6, rh, p.pct + " %", { pt: 9, color: T.textTer, align: "r" });
        yy += rh; kolko++;
      }
      yy += 0.12;
    }
    if (kolko < s.polozky.length) A.text(REP_L, 7.0, REP_CW, 0.2, "+ " + (s.polozky.length - kolko) + " ďalších míľnikov sa nezmestilo", { pt: 8, italic: true, color: T.textTer });
    return [{ prvky: A.prvky, nadpis: s.nazov }];
  },

  oneskorenie(s, view, T){
    const strany = [];
    const sekcie = s.sekcie.filter(x => x.zahrnuta);
    const vsetky = [];
    for (const sk of sekcie) { vsetky.push({ sekcia: sk }); for (const r of sk.riadky.slice(0, 40)) vsetky.push({ riadok: r }); }
    const maxStran = 2, rh = 0.245, yKon = 7.15;
    let i = 0;
    for (let n = 0; n < maxStran && (n === 0 || i < vsetky.length); n++) {
      const A = repPrvky(T);
      let y = repHlavicka(A, T, "Oblasť v oneskorení — detail" + (n ? " (pokračovanie)" : ""), s.draha.nazov, (s.draha.skupina ? s.draha.skupina + " · " : "") + "oblasť " + s.draha.pct + " %", { cervena: true });
      if (n === 0 && s.odznaky.length) {
        let x = REP_L;
        for (const o of s.odznaky) {
          const t = "⚠ " + o.legenda + " po termíne " + repDM(o.datum) + " · " + o.pct + " %", w = Math.min(4.2, repSirkaTextu(t, 10, true, T.font) + 0.3);
          if (x + w > REP_W - REP_L) break;
          A.rect(x, y, w, 0.34, { fill: T.redBg, line: T.red, lw: 1, r: 0.06 });
          A.text(x + 0.12, y, w - 0.2, 0.34, repSkrat(t, w - 0.2, 10, true, T.font), { pt: 10, bold: true, color: T.redDark });
          x += w + 0.2;
        }
        y += 0.48;
      }
      const xP = REP_W - REP_L - 1.6, xD = REP_W - REP_L - 0.75;
      while (i < vsetky.length && y + rh <= yKon) {
        const e = vsetky[i];
        if (e.sekcia) {
          if (y + rh * 2.6 > yKon) break;                      // nadpis sekcie nie osamote na konci strany
          const sk = e.sekcia;
          A.rect(REP_L, y, REP_CW, 0.36, { fill: T.panel });
          A.text(REP_L + 0.15, y, REP_CW - 3.6, 0.36, repSkrat("▾ " + sk.nazov, REP_CW - 3.6, 11, true, T.font), { pt: 11, bold: true, color: T.textSec });
          const meta = sk.pocetPodPrahom + " pod prahom · " + sk.pct + " % · " + repDMR(sk.finish);
          A.text(REP_W - REP_L - 3.3, y, 3.2, 0.36, repSkrat(meta, 3.2, 9, true, T.font), { pt: 9, bold: true, color: T.textSec, align: "r" });
          y += 0.4;
        } else {
          const r = e.riadok;
          if (r.podPrahom) { A.rect(REP_L, y, REP_CW, rh, { fill: T.redBg }); A.rect(REP_L, y, 0.05, rh, { fill: T.red }); }
          const odsad = Math.min(4, Math.max(1, r.hlbka)) * 0.24;
          const meno = (r.milnik ? "◆ " : "") + r.nazov;
          const wM = xP - REP_L - 0.1 - odsad;
          A.text(REP_L + 0.1 + odsad, y, wM, rh, repSkrat(meno, wM, 9, r.hlbka <= 1 && !r.milnik, T.font),
            { pt: 9, bold: r.hlbka <= 1 && !r.milnik, italic: r.milnik, color: r.podPrahom ? T.redDark : (r.hlbka > 1 ? T.textSec : T.text) });
          A.text(xP, y, 0.6, rh, r.pct + " %", { pt: 9, bold: true, color: r.podPrahom ? T.red : repFarbaStavu(r.pct, view.farby, T), align: "r" });
          A.text(xD, y, 0.75, rh, repDMR(r.finish), { pt: 8, color: T.textTer, align: "r" });
          y += rh;
        }
        i++;
      }
      strany.push({ prvky: A.prvky, nadpis: "Oneskorenie: " + s.draha.kratky + (n ? " (2)" : "") });
      if (i >= vsetky.length) break;
    }
    if (i < vsetky.length) {
      const zost = vsetky.slice(i).filter(e => e.sekcia).length;
      const posl = strany[strany.length - 1];
      posl.prvky.push({ t: "text", x: REP_L, y: 7.18, w: REP_CW, h: 0.18, s: "Nezobrazené: " + (vsetky.length - i) + " riadkov" + (zost ? " (" + zost + " pod-sekcií)" : "") + " — celý zoznam je v XLSX.", pt: 8, italic: true, color: T.textTer, align: "l", valign: "m", font: T.font });
    }
    if (!sekcie.length) strany[0].prvky.push({ t: "text", x: REP_L, y: 2.0, w: REP_CW, h: 0.3, s: "Žiadna pod-sekcia nie je vybraná do výstupu.", pt: 11, color: T.textSec, align: "l", valign: "m", font: T.font });
    return strany;
  } };

// ── 14. Zapisovač SVG (náhľad 1:1 z layoutu) ────────────────────
function repEsc(s){ return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function repSvgStrana(layout, strana, volby){
  const k = 96, f = n => Math.round(n * k * 100) / 100;
  volby = volby || {};
  const fontSvg = layout.font === "Arial" ? "Arial, 'Liberation Sans', Helvetica, sans-serif" : "Calibri, Carlito, 'Segoe UI', Arial, sans-serif";
  const o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + f(layout.sirka) + " " + f(layout.vyska) + '"' + (volby.trieda ? ' class="' + repEsc(volby.trieda) + '"' : "") + ' font-family="' + fontSvg + '">'];
  o.push('<rect x="0" y="0" width="' + f(layout.sirka) + '" height="' + f(layout.vyska) + '" fill="#' + layout.bg + '"/>');
  for (const p of strana.prvky) {
    if (p.t === "rect") o.push('<rect x="' + f(p.x) + '" y="' + f(p.y) + '" width="' + f(p.w) + '" height="' + f(p.h) + '"' + (p.r ? ' rx="' + f(p.r) + '"' : "") +
      ' fill="' + (p.fill ? "#" + p.fill : "none") + '"' + (p.line ? ' stroke="#' + p.line + '" stroke-width="' + (p.lw || 0.75) * 96 / 72 + '"' : "") + "/>");
    else if (p.t === "line") o.push('<line x1="' + f(p.x1) + '" y1="' + f(p.y1) + '" x2="' + f(p.x2) + '" y2="' + f(p.y2) + '" stroke="#' + p.color + '" stroke-width="' + (p.lw || 0.75) * 96 / 72 + '"' + (p.dash ? ' stroke-dasharray="4 3"' : "") + "/>");
    else if (p.t === "mark") {
      const x = p.x, y = p.y, r = p.s / 2, st = ' fill="#' + p.fill + '" stroke="#' + p.line + '" stroke-width="' + (p.lw || 1) * 96 / 72 + '"';
      if (p.tvar === "stvorec") o.push('<rect x="' + f(x - r) + '" y="' + f(y - r) + '" width="' + f(p.s) + '" height="' + f(p.s) + '"' + st + "/>");
      else if (p.tvar === "kosostvorec") o.push('<polygon points="' + [[x, y - r * 1.15], [x + r * 1.15, y], [x, y + r * 1.15], [x - r * 1.15, y]].map(q => f(q[0]) + "," + f(q[1])).join(" ") + '"' + st + "/>");
      else o.push('<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '"' + st + "/>");
    } else if (p.t === "text") {
      const riadky = Array.isArray(p.s) ? p.s : [String(p.s)];
      const lh = (p.lh || 1.2) * p.pt / 72;
      const blok = riadky.length * lh;
      const top = p.valign === "t" ? p.y : p.valign === "b" ? p.y + p.h - blok : p.y + (p.h - blok) / 2;
      const x = p.align === "c" ? p.x + p.w / 2 : p.align === "r" ? p.x + p.w : p.x;
      const anchor = p.align === "c" ? "middle" : p.align === "r" ? "end" : "start";
      const atr = ' font-size="' + Math.round(p.pt * 96 / 72 * 100) / 100 + '" fill="#' + p.color + '" text-anchor="' + anchor + '"' + (p.bold ? ' font-weight="bold"' : "") + (p.italic ? ' font-style="italic"' : "");
      riadky.forEach((r, i) => o.push('<text x="' + f(x) + '" y="' + f(top + i * lh + (lh - p.pt / 72) / 2 + 0.8 * p.pt / 72) + '"' + atr + ">" + repEsc(r) + "</text>"));
    }
  }
  o.push("</svg>");
  return o.join("");
}

// ── 15. Zapisovač PPTX (PptxGenJS) — ten istý layout ────────────
function repPptx(PptxGenJS, layout, meta){
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  meta = meta || {};
  if (meta.nazov) pres.title = meta.nazov;
  pres.company = ""; pres.author = meta.autor || "";
  const S = pres.shapes || pres.ShapeType;
  for (const st of layout.strany) {
    const s = pres.addSlide();
    s.background = { color: layout.bg };
    for (const p of st.prvky) {
      if (p.t === "rect") {
        const o = { x: p.x, y: p.y, w: p.w, h: p.h, fill: p.fill ? { color: p.fill } : { type: "none" }, line: p.line ? { color: p.line, width: p.lw || 0.75 } : { type: "none" } };
        if (p.r) { o.rectRadius = Math.min(0.5, p.r / Math.min(p.w, p.h)); s.addShape(S.ROUNDED_RECTANGLE || S.roundRect, o); }
        else s.addShape(S.RECTANGLE || S.rect, o);
      } else if (p.t === "line") {
        const x = Math.min(p.x1, p.x2), y = Math.min(p.y1, p.y2), w = Math.abs(p.x2 - p.x1), h = Math.abs(p.y2 - p.y1);
        s.addShape(S.LINE || S.line, { x, y, w, h, flipV: (p.y2 - p.y1) * (p.x2 - p.x1) < 0, line: { color: p.color, width: p.lw || 0.75, dashType: p.dash ? "dash" : "solid" } });
      } else if (p.t === "mark") {
        const r = p.s / 2, sh = p.tvar === "stvorec" ? (S.RECTANGLE || S.rect) : p.tvar === "kosostvorec" ? (S.DIAMOND || S.diamond) : (S.OVAL || S.ellipse);
        const k = p.tvar === "kosostvorec" ? 1.15 : 1;
        s.addShape(sh, { x: p.x - r * k, y: p.y - r * k, w: p.s * k, h: p.s * k, fill: { color: p.fill }, line: { color: p.line, width: p.lw || 1 } });
      } else if (p.t === "text") {
        const riadky = Array.isArray(p.s) ? p.s : [String(p.s)];
        s.addText(riadky.join("\n"), { x: p.x, y: p.y, w: p.w, h: p.h, fontSize: p.pt, bold: !!p.bold, italic: !!p.italic, color: p.color,
          fontFace: p.font || layout.font, align: p.align === "c" ? "center" : p.align === "r" ? "right" : "left",
          valign: p.valign === "t" ? "top" : p.valign === "b" ? "bottom" : "middle", margin: 0, wrap: false, fit: "none",
          lineSpacingMultiple: p.lh ? p.lh / 1.2 : undefined });
      }
    }
  }
  return pres;
}

// ── 16. Protokol pred odoslaním: len počty a kódy, reťazce do 100 znakov ─
function repProtokolOrez(x, hlbka){
  hlbka = hlbka || 0;
  if (x == null || typeof x === "number" || typeof x === "boolean") return x;
  if (typeof x === "string") return x.length > 100 ? x.slice(0, 99) + "…" : x;
  if (hlbka >= 4) return null;
  if (Array.isArray(x)) return x.slice(0, 200).map(v => repProtokolOrez(v, hlbka + 1));
  const o = {}; for (const [k, v] of Object.entries(x)) o[k] = repProtokolOrez(v, hlbka + 1); return o;
}

// Vodoznak konceptu (§9.2): výstupy neuzavretého cyklu ho nesú na každej strane.
function repVodoznak(layout){
  const T = repTema(layout.tema);
  for (const st of layout.strany) st.prvky.push({ t: "text", x: REP_L, y: 7.24, w: 4.5, h: 0.18, s: "PRACOVNÁ VERZIA — cyklus nie je uzavretý", pt: 8, bold: true, color: T.red, align: "l", valign: "m", font: T.font });
  return layout;
}

// ── 17. Appka: záložka Reporting v B2B projekte (§10) ───────────
const REP = { pid: null, pohlad: "programy", programy: null, program: null, profil: null, profilVerzia: 0, profilNavrh: null,
  vstupy: [], cykly: [], cyklus: null, cyklusObsah: null, krok: "vstupy", plany: {}, registre: {}, chyba: "", pracuje: "",
  verziaSnimka: null };

function repJeUzky(){ return (window.innerWidth || 1280) < 900; }
function repMozemPisat(){ const o = b2bMojaOsoba(); return !!(o && (o.spravca || o.rola !== "management")); }
function repPrekresli(){ if (typeof appB2bVykaz === "function") appB2bVykaz(); }
function repChyba(e, co){ console.error("Reporting " + co, e); REP.pracuje = ""; alert(co + ": " + ((e && e.message) || e)); repPrekresli(); }
const REP_DRUHY = { plan: "Plán (MS Project XML)", issue: "Issue Log", ct: "Commitment Tracker", dep: "Dependency Log", zistenia: "Register zistení" };

function repZalozkaHtml(){
  if (REP.pid !== B2B.pid) { Object.assign(REP, { pid: B2B.pid, pohlad: "programy", programy: null, program: null, cyklus: null, plany: {}, registre: {} }); repNacitajProgramy(); }
  if (REP.programy == null) return '<div class="aempty">Načítavam programy…</div>';
  if (REP.chyba) return '<div class="card" style="padding:12px 14px;border-color:var(--neg)"><b style="color:var(--neg)">Reporting sa nepodarilo načítať</b><div class="csub">' + esc(REP.chyba) + '</div><button class="aabtn" onclick="repNacitajProgramy()">Skúsiť znova</button></div>';
  const prac = REP.pracuje ? '<div class="card" style="padding:8px 12px;margin-bottom:10px"><span class="csub" style="margin:0">⏳ ' + esc(REP.pracuje) + '</span></div>' : "";
  if (REP.pohlad === "program" && REP.program) return prac + repProgramHtml();
  if (REP.pohlad === "profil" && REP.program) return prac + repProfilHtml();
  if (REP.pohlad === "cyklus" && REP.cyklus) return prac + repCyklusHtml();
  return prac + repProgramyHtml();
}

async function repNacitajProgramy(){
  try {
    REP.chyba = "";
    const { data, error } = await sb.from("b2b_programy").select("id, projekt_id, nazov, kod, stav, profil_verzia, vytvoril, vytvorene, upravil, upravene").eq("projekt_id", REP.pid).order("vytvorene");
    if (error) throw error;
    REP.programy = data || [];
    const ids = REP.programy.map(p => p.id);
    REP.posledne = {};
    if (ids.length) {
      const { data: cy } = await sb.from("b2b_rep_cykly").select("id, program_id, stav_ku_dnu, nazov, stav, verzia, upravene").in("program_id", ids).order("stav_ku_dnu", { ascending: false });
      for (const c of cy || []) if (!REP.posledne[c.program_id]) REP.posledne[c.program_id] = c;
    }
  } catch (e) { REP.programy = REP.programy || []; REP.chyba = (e && e.message) || String(e); console.error("Reporting programy", e); }
  repPrekresli();
}

function repProgramyHtml(){
  const sprav = b2bSomSpravca();
  const zoz = REP.programy.filter(p => p.stav !== "archiv").map(p => {
    const c = REP.posledne && REP.posledne[p.id];
    return '<div class="card" style="padding:10px 14px;margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<div><b>' + esc(p.nazov) + '</b> <span class="csub" style="margin:0 0 0 4px">' + esc(p.kod) + '</span><div class="csub" style="margin:2px 0 0">' +
      (c ? "posledný cyklus " + esc(repDMR(c.stav_ku_dnu)) + " · " + esc({ koncept: "koncept", uzavrety: "uzavretý", odoslany: "odoslaný" }[c.stav] || c.stav) : "zatiaľ bez cyklu") +
      (p.profil_verzia ? "" : " · profil nie je nastavený") + '</div></div>' +
      '<button class="aabtn pri" onclick="repOtvorProgram(\'' + esc(p.id) + '\')">Otvoriť</button></div>';
  }).join("");
  return '<div class="card" style="padding:12px 14px;margin-bottom:10px"><b>Projektový reporting</b><div class="csub" style="margin:4px 0 0">Z plánu MS Project a registrov (Issue Log, záväzky, závislosti, zistenia) zostaví report s rovnakými pravidlami v každom cykle. ' +
    'Vstupy sú v cloude projektu šifrované a vidí ich len tím projektu.</div></div>' +
    (zoz || '<div class="aempty">Projekt zatiaľ nesleduje žiadny program.</div>') +
    (sprav && !repJeUzky() ? '<div class="card" style="padding:10px 14px"><b>Nový program</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
      '<input id="repNovyNazov" placeholder="Názov programu" maxlength="200" style="flex:2;min-width:180px">' +
      '<input id="repNovyKod" placeholder="Kód (A–Z, 0–9)" maxlength="10" style="flex:1;min-width:110px;text-transform:uppercase">' +
      '<button class="aabtn pri" onclick="repZalozProgram()">Založiť</button></div><div class="csub">Kód ide do názvov súborov (napr. <code>ALFA_Roadmapa_2026-06-25.pptx</code>).</div></div>' : "");
}

async function repZalozProgram(){
  const nazov = (document.getElementById("repNovyNazov").value || "").trim(), kod = (document.getElementById("repNovyKod").value || "").trim().toUpperCase();
  if (!nazov) return alert("Zadajte názov programu.");
  if (!/^[A-Z0-9]{2,10}$/.test(kod)) return alert("Kód má 2–10 znakov A–Z a 0–9.");
  try { const { error } = await sb.rpc("b2b_program_zaloz", { p_projekt: REP.pid, p_nazov: nazov, p_kod: kod }); if (error) throw error; await repNacitajProgramy(); }
  catch (e) { repChyba(e, "Program sa nepodarilo založiť"); }
}

async function repOtvorProgram(id){
  REP.program = REP.programy.find(p => p.id === id) || null;
  if (!REP.program) return;
  REP.pohlad = "program"; REP.pracuje = "Načítavam program…"; repPrekresli();
  try {
    const [pr, vs, cy] = await Promise.all([
      b2bEdge("rep_profil_nacitaj", { program: id }),
      sb.from("b2b_rep_vstupy").select("id, program_id, druh, nazov_suboru, sha256, velkost, datum_suboru, povodny_velkost, protokol, nahral, nahrane").eq("program_id", id).order("nahrane", { ascending: false }),
      sb.from("b2b_rep_cykly").select("id, program_id, stav_ku_dnu, nazov, stav, verzia, vytvoril, vytvorene, upravil, upravene").eq("program_id", id).order("stav_ku_dnu", { ascending: false }) ]);
    if (vs.error) throw vs.error; if (cy.error) throw cy.error;
    REP.profil = pr.obsah || null; REP.profilVerzia = pr.verzia || 0;
    REP.vstupy = vs.data || []; REP.cykly = cy.data || [];
    REP.pracuje = "";
  } catch (e) { return repChyba(e, "Program sa nepodarilo načítať"); }
  repPrekresli();
}

function repPosledny(druh){ return REP.vstupy.find(v => v.druh === druh) || null; }
async function repNacitajVstup(id){
  if (REP.plany[id]) return REP.plany[id];
  const d = await b2bEdge("rep_vstup_nacitaj", { vstup: id });
  REP.plany[id] = d.obsah;
  return d.obsah;
}
function repProtokolText(v){
  const p = v.protokol || {};
  if (v.druh === "plan") return (p.ulohy || 0) + " úloh · " + (p.milniky || 0) + " míľnikov" + (p.pridane || p.odobrate ? " · +" + (p.pridane || 0) + " / −" + (p.odobrate || 0) + " oproti minulému" : "") + (p.premenovane ? " · " + p.premenovane + " premenovaných" : "");
  const k = [];
  k.push((p.riadky || 0) + " záznamov");
  if (p.duplicitneId && p.duplicitneId.length) k.push(p.duplicitneId.length + " duplicitných ID");
  if (p.chybajucePovinne && p.chybajucePovinne.length) k.push("chýba: " + p.chybajucePovinne.join(", "));
  const dt = p.datumy || {}; if (dt.americke || dt.bezRoka || dt.neplatne) k.push("dátumy: " + [dt.americke ? dt.americke + "× M/D/RR" : "", dt.bezRoka ? dt.bezRoka + "× bez roka" : "", dt.neplatne ? dt.neplatne + "× neplatné" : ""].filter(Boolean).join(", "));
  if (p.prazdnyStav) k.push(p.prazdnyStav + "× prázdny stav");
  return k.join(" · ");
}

function repProgramHtml(){
  const p = REP.program, pis = repMozemPisat() && p.stav !== "archiv", uzky = repJeUzky();
  const hlav = '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;margin:0 2px 10px">' +
    '<div><button class="aabtn" onclick="REP.pohlad=\'programy\';repPrekresli()">‹ Programy</button> <b style="font-size:15px;margin-left:6px">' + esc(p.nazov) + '</b> <span class="csub" style="margin:0">' + esc(p.kod) + '</span></div>' +
    (uzky ? "" : '<div style="display:flex;gap:6px">' + (REP.profil ? '<button class="aabtn" onclick="repOtvorProfil()">Profil programu</button>' : "") +
      (pis && REP.profil && repPosledny("plan") ? '<button class="aabtn pri" onclick="repNovyCyklus()">+ Nový cyklus</button>' : "") + '</div>') + '</div>';
  if (uzky) return hlav + repMobilPrehladHtml();
  let navod = "";
  if (!repPosledny("plan")) navod = '<div class="card" style="padding:12px 14px;margin-bottom:10px;border-color:var(--acc)"><b>1. Nahrajte plán z MS Project</b><div class="csub" style="margin:4px 0 0">V MS Project: Súbor → Uložiť ako → typ <b>XML</b>. Súbor .mpp sa načítať nedá. Plán sa prečíta v prehliadači; na server ide len potrebný výťah (úlohy, míľniky, % a vlastné polia), šifrovane, a pôvodný súbor zbalený na kontrolu.</div></div>';
  else if (!REP.profil) navod = '<div class="card" style="padding:12px 14px;margin-bottom:10px;border-color:var(--acc)"><b>2. Nastavte profil programu</b><div class="csub" style="margin:4px 0 6px">Nástroj navrhne oblasti, fázy a dlaždice z plánu; vy ich potvrdíte.</div><button class="aabtn pri" onclick="repOtvorProfil()">Navrhnúť profil z plánu</button></div>';
  const cykly = REP.cykly.map(c => '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--line);align-items:center;flex-wrap:wrap">' +
    '<div><b>' + esc(c.nazov || ("Report k " + repDMR(c.stav_ku_dnu))) + '</b><div class="csub" style="margin:0">' + esc({ koncept: "koncept", uzavrety: "uzavretý", odoslany: "odoslaný" }[c.stav] || c.stav) + " · verzia " + c.verzia + " · " + esc(String(c.upravene || "").slice(0, 10)) + '</div></div>' +
    '<button class="aabtn" onclick="repOtvorCyklus(\'' + esc(c.id) + '\')">Otvoriť</button></div>').join("");
  const vstupy = Object.keys(REP_DRUHY).map(d => {
    const v = repPosledny(d);
    return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--line);align-items:center;flex-wrap:wrap">' +
      '<div style="min-width:220px;flex:1"><b>' + esc(REP_DRUHY[d]) + '</b><div class="csub" style="margin:0">' + (v ? esc(v.nazov_suboru) + " · " + esc(String(v.nahrane || "").slice(0, 10)) + " · " + esc(repProtokolText(v)) : "zatiaľ nenahraté") + '</div></div>' +
      (pis ? '<label class="aabtn" style="cursor:pointer">' + (v ? "Nahrať novší" : "Nahrať") + '<input type="file" accept="' + (d === "plan" ? ".xml" : ".xlsx,.xlsm") + '" style="display:none" onchange="repImport(\'' + d + '\', this)"></label>' : "") + '</div>';
  }).join("");
  return hlav + navod +
    '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Cykly reportu</b>' + (cykly || '<div class="csub">Zatiaľ žiadny cyklus.</div>') + '</div>' +
    '<div class="card" style="padding:10px 14px"><b>Vstupy</b><div class="csub" style="margin:2px 0 4px">Excel zostáva zdrojom pravdy PMO; každý import je nová snímka, staré ostávajú pre porovnanie.</div>' + vstupy + '</div>';
}

async function repImport(druh, input){
  const f = input.files && input.files[0]; input.value = "";
  if (!f) return;
  if (druh === "plan" && /\.mpp$/i.test(f.name)) return alert("Súbor .mpp sa načítať nedá. V MS Project ho uložte cez Súbor → Uložiť ako → XML.");
  REP.pracuje = "Čítam " + f.name + "…"; repPrekresli();
  try {
    const u8 = new Uint8Array(await f.arrayBuffer());
    const sha = await b2bSha256(u8);
    let obsah, protokol, datumSuboru = null;
    if (druh === "plan") {
      const plan = repPlanZXml(new TextDecoder("utf-8").decode(u8));
      const pred = repPosledny("plan") ? await repNacitajVstup(repPosledny("plan").id) : null;
      protokol = repPlanProtokol(plan, pred);
      obsah = plan; datumSuboru = plan.projekt.statusDate || plan.projekt.lastSaved || null;
    } else {
      const X = await ensureXLSX();
      const r = repRegisterZXlsx(X, u8.buffer, druh);
      if (r.protokol.chybajucePovinne.length && !confirm("V súbore chýbajú povinné stĺpce: " + r.protokol.chybajucePovinne.join(", ") + ".\nNahrať aj tak (neúplný import)?")) { REP.pracuje = ""; return repPrekresli(); }
      protokol = r.protokol; obsah = { riadky: r.riadky, protokol: r.protokol };
      datumSuboru = f.lastModified ? new Date(f.lastModified).toISOString().slice(0, 10) : null;
    }
    REP.pracuje = "Ukladám šifrovane…"; repPrekresli();
    const d = await b2bEdge("rep_vstup_nahraj", { program: REP.program.id, druh, nazov: f.name, sha256: sha, velkost: u8.length, datum_suboru: datumSuboru, protokol: repProtokolOrez(protokol), obsah });
    REP.plany[d.id] = obsah;
    try { const F = await ensureFflate(); await b2bEdgeSubor({ akcia: "rep_vstup_povodny", vstup: d.id }, F.gzipSync(u8)); }
    catch (e) { console.error("Reporting: pôvodný súbor sa neuložil", e); alert("Výťah sa uložil, pôvodný súbor nie (" + ((e && e.message) || e) + "). Report sa dá zostaviť; originál nahrajte znova neskôr."); }
    await repOtvorProgram(REP.program.id);
    if (druh === "plan" && !REP.profil) repOtvorProfil();
  } catch (e) { repChyba(e, "Import sa nepodaril"); }
}

// ── Profil programu (§5) ─────────────────────────────────────
async function repOtvorProfil(){
  const v = repPosledny("plan");
  if (!v) return alert("Najprv nahrajte plán.");
  try {
    REP.pracuje = "Načítavam plán…"; repPrekresli();
    const plan = await repNacitajVstup(v.id);
    REP.profilNavrh = JSON.parse(JSON.stringify(REP.profil || Object.assign(repProfilNavrh(plan), { nazov: REP.program.nazov, kod: REP.program.kod })));
    REP.profilPlan = plan;
    REP.pohlad = "profil"; REP.pracuje = "";
  } catch (e) { return repChyba(e, "Plán sa nepodarilo načítať"); }
  repPrekresli();
}
function repProfilHtml(){
  const P = REP.profilNavrh, pis = repMozemPisat();
  const skupOpt = k => P.skupiny.map(s => '<option value="' + esc(s.kluc) + '"' + (s.kluc === k ? " selected" : "") + ">" + esc(s.nazov) + "</option>").join("");
  const fazy = P.fazy.map((f, i) => '<tr><td><input value="' + esc(f.kluc) + '" maxlength="8" style="width:70px" onchange="REP.profilNavrh.fazy[' + i + '].kluc=this.value.trim()"></td>' +
    '<td><input value="' + esc(f.legenda || "") + '" style="width:160px" onchange="REP.profilNavrh.fazy[' + i + '].legenda=this.value"></td>' +
    '<td><input value="' + esc((f.pravidlo.obsahuje || []).join("; ")) + '" style="width:100%" onchange="REP.profilNavrh.fazy[' + i + '].pravidlo.obsahuje=this.value.split(\';\').map(x=>x.trim()).filter(Boolean)"></td>' +
    '<td style="text-align:center"><input type="checkbox"' + (f.pravidlo.lenMilniky ? " checked" : "") + ' onchange="REP.profilNavrh.fazy[' + i + '].pravidlo.lenMilniky=this.checked"></td></tr>').join("");
  const oblasti = P.oblasti.map((o, i) => '<tr><td style="text-align:center"><input type="checkbox"' + (o.zobrazit !== false ? " checked" : "") + ' onchange="REP.profilNavrh.oblasti[' + i + '].zobrazit=this.checked"></td>' +
    '<td><input value="' + esc(o.kratky) + '" maxlength="40" style="width:140px" onchange="REP.profilNavrh.oblasti[' + i + '].kratky=this.value;REP.profilNavrh.oblasti[' + i + '].aliasy=[this.value]"></td>' +
    '<td class="csub" style="margin:0">' + esc(o.nazov) + '</td><td><select onchange="REP.profilNavrh.oblasti[' + i + '].skupina=this.value">' + skupOpt(o.skupina) + '</select></td></tr>').join("");
  const temy = Object.keys(REP_TEMY).map(k => '<option value="' + k + '"' + (P.tema === k ? " selected" : "") + ">" + esc(REP_TEMY[k].nazov) + "</option>").join("");
  const polia = Object.entries(P.polia.popis || {}).map(([k, v]) => esc({ kodZavazku: "kód záväzku", stitokOblasti: "štítok oblasti", bpKod: "BP kód", mmp: "príznak" }[k] || k) + " = " + esc(v)).join(" · ");
  return '<div style="margin:0 2px 10px"><button class="aabtn" onclick="REP.pohlad=\'program\';repPrekresli()">‹ ' + esc(REP.program.nazov) + '</button> <b style="margin-left:6px">Profil programu</b> ' +
    (REP.profil ? '<span class="csub" style="margin:0">verzia ' + REP.profilVerzia + '</span>' : '<span class="csub" style="margin:0">návrh z plánu — skontrolujte a uložte</span>') + '</div>' +
    '<div class="card" style="padding:10px 14px;margin-bottom:10px"><div style="display:flex;gap:10px;flex-wrap:wrap">' +
    '<div class="mfield" style="flex:2;min-width:200px"><label>Názov v reporte</label><input value="' + esc(P.nazov) + '" onchange="REP.profilNavrh.nazov=this.value"></div>' +
    '<div class="mfield" style="flex:1;min-width:150px"><label>Cieľový termín programu</label><input type="date" value="' + esc(P.cielovyTermin || "") + '" onchange="REP.profilNavrh.cielovyTermin=this.value||null"></div>' +
    '<div class="mfield" style="flex:1;min-width:180px"><label>Téma výstupov</label><select onchange="REP.profilNavrh.tema=this.value">' + temy + '</select></div></div>' +
    '<div class="csub" style="margin:4px 0 0">Cieľový termín je biznisové rozhodnutie, nie najneskorší dátum plánu — dlaždica „Dní do konca“ stojí na ňom. Polia plánu: ' + (polia || "nenašli sa") + '.</div></div>' +
    '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Fázy (brány) kritickej cesty</b><div class="csub" style="margin:2px 0 6px">Míľnik patrí fáze, keď jeho názov obsahuje text (bez ohľadu na veľkosť písmen a diakritiku). Viac textov oddeľte bodkočiarkou.</div>' +
    '<table style="width:100%"><tr class="csub"><th>Kľúč</th><th>Legenda</th><th>Názov obsahuje</th><th>Len míľniky</th></tr>' + fazy + '</table></div>' +
    '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Oblasti (dráhy)</b><div class="csub" style="margin:2px 0 6px">Oblasť je naviazaná na úlohu plánu cez jej UID — premenovanie v pláne ju neodpojí.</div>' +
    '<table style="width:100%"><tr class="csub"><th>Zobraziť</th><th>Krátky názov</th><th>Úloha v pláne</th><th>Skupina</th></tr>' + oblasti + '</table></div>' +
    (pis ? '<button class="aabtn pri" onclick="repUlozProfil()">Uložiť profil</button>' : '<div class="csub">Profil môže meniť člen tímu, nie rola Management a support.</div>');
}
async function repUlozProfil(){
  const P = REP.profilNavrh;
  const kluce = P.fazy.map(f => f.kluc);
  if (!kluce.length || kluce.some(k => !k) || new Set(kluce).size !== kluce.length) return alert("Každá fáza musí mať jedinečný kľúč.");
  if (P.fazy.some(f => !(f.pravidlo.obsahuje || []).length)) return alert("Každá fáza potrebuje text, podľa ktorého sa jej míľniky nájdu.");
  try {
    REP.pracuje = "Ukladám profil…"; repPrekresli();
    const d = await b2bEdge("rep_profil_uloz", { program: REP.program.id, verzia: REP.profilVerzia, obsah: P });
    REP.profil = JSON.parse(JSON.stringify(P)); REP.profilVerzia = d.verzia; REP.pracuje = ""; REP.pohlad = "program";
  } catch (e) {
    if (e.stav === 409) { REP.pracuje = ""; alert("Profil medzitým uložil niekto iný. Otvorte ho znova — vaše úpravy treba zopakovať."); return repOtvorProgram(REP.program.id); }
    return repChyba(e, "Profil sa nepodarilo uložiť");
  }
  repPrekresli();
}

// ── Cyklus (§10.3) ────────────────────────────────────────────
async function repNovyCyklus(){
  try {
    const v = repPosledny("plan"), plan = await repNacitajVstup(v.id);
    const navrh = plan.projekt.statusDate || plan.projekt.currentDate || plan.projekt.lastSaved || "";
    const stav = prompt("Stav ku dňu (RRRR-MM-DD). Návrh je zo súboru plánu, nie z hodín počítača:", navrh);
    if (!stav) return;
    if (!repDatum(stav)) return alert("Dátum musí byť v tvare RRRR-MM-DD.");
    if (REP.cykly.some(c => c.stav_ku_dnu === stav)) return alert("Cyklus k " + repDMR(stav) + " už existuje.");
    const vstupy = {}; for (const d of Object.keys(REP_DRUHY)) { const x = repPosledny(d); if (x) vstupy[d] = x.id; }
    const obsah = { vstupy, usudok: {}, vyber: {}, tema: REP.profil.tema || "clean" };
    REP.pracuje = "Zakladám cyklus…"; repPrekresli();
    const d = await b2bEdge("rep_cyklus_uloz", { program: REP.program.id, stav_ku_dnu: stav, nazov: "Report k " + repDMR(stav), obsah });
    await repOtvorProgram(REP.program.id);
    await repOtvorCyklus(d.id);
  } catch (e) { repChyba(e, "Cyklus sa nepodarilo založiť"); }
}

async function repOtvorCyklus(id){
  try {
    REP.pracuje = "Načítavam cyklus…"; repPrekresli();
    const d = await b2bEdge("rep_cyklus_nacitaj", { cyklus: id });
    REP.cyklus = d.cyklus; REP.cyklusObsah = d.obsah || { vstupy: {}, usudok: {}, vyber: {} };
    REP.verziaSnimka = null;
    if (REP.cyklus.stav !== "koncept") {
      const { data } = await sb.from("b2b_rep_cykly_verzie").select("cislo").eq("cyklus_id", id).order("cislo", { ascending: false }).limit(1);
      if (data && data[0]) REP.verziaSnimka = (await b2bEdge("rep_cyklus_verzia_nacitaj", { cyklus: id, cislo: data[0].cislo })).obsah;
    }
    for (const vid of Object.values(REP.cyklusObsah.vstupy || {})) await repNacitajVstup(vid);
    REP.krok = REP.cyklus.stav === "koncept" ? (REP.krok || "vstupy") : "nahlad";
    REP.pohlad = "cyklus"; REP.pracuje = "";
  } catch (e) { return repChyba(e, "Cyklus sa nepodarilo načítať"); }
  repPrekresli();
}

// Kontext reportu z obsahu cyklu (jeden zdroj pre náhľad aj súbor).
function repKontextCyklu(){
  if (REP.verziaSnimka) return REP.verziaSnimka;                // uzavretý cyklus = nemenná snímka
  const O = REP.cyklusObsah, P = REP.profil, V = O.vstupy || {};
  const plan = V.plan ? REP.plany[V.plan] : null;
  if (!plan || !P) return null;
  const model = repModel(plan, P, REP.cyklus.stav_ku_dnu);
  const reg = d => (V[d] && REP.plany[V[d]]) ? REP.plany[V[d]].riadky : null;
  const kontroly = repKontroly(model, plan, P);
  const ct = reg("ct") ? repCtSulad(plan, P, reg("ct"), REP.cyklus.stav_ku_dnu, (O.anotacie || {}).ct) : null;
  const dep = reg("dep") ? repDepVyhodnot(reg("dep"), plan, P, ct, REP.cyklus.stav_ku_dnu, reg("issue")) : null;
  const il = reg("issue") ? repIssueKpi(reg("issue"), P, REP.cyklus.stav_ku_dnu) : null;
  const view = repView(model, { profil: P, cyklus: O });
  return { model, view, kontroly, ct, dep, il, tema: O.tema || P.tema || "clean" };
}

function repCyklusHtml(){
  const c = REP.cyklus, kon = c.stav === "koncept", pis = kon && repMozemPisat();
  const krok = (k, n) => '<button class="aabtn' + (REP.krok === k ? " pri" : "") + '" onclick="REP.krok=\'' + k + '\';repPrekresli()">' + n + '</button>';
  const hlav = '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;margin:0 2px 10px">' +
    '<div><button class="aabtn" onclick="REP.pohlad=\'program\';repPrekresli()">‹ ' + esc(REP.program.nazov) + '</button> <b style="margin-left:6px">' + esc(c.nazov || ("Report k " + repDMR(c.stav_ku_dnu))) + '</b> <span class="csub" style="margin:0">' +
    esc({ koncept: "koncept", uzavrety: "uzavretý", odoslany: "odoslaný" }[c.stav] || c.stav) + " · verzia " + c.verzia + '</span></div>' +
    '<div style="display:flex;gap:6px">' + (pis ? '<button class="aabtn" onclick="repUlozCyklus()">Uložiť</button>' : "") +
    (!kon && repMozemPisat() ? '<button class="aabtn" onclick="repOtvorZnova()">Znova otvoriť</button>' : "") + '</div></div>';
  if (repJeUzky()) return hlav + repMobilPrehladHtml();
  const kroky = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 2px 10px">' + (kon ? krok("vstupy", "1 Vstupy") + krok("kontrola", "2 Kontrola dát") + krok("usudok", "3 Úsudok") : "") + krok("nahlad", (kon ? "4 " : "") + "Náhľad a výber") + krok("export", (kon ? "5 " : "") + "Export") + '</div>';
  let K;
  try { K = repKontextCyklu(); } catch (e) { console.error(e); return hlav + '<div class="card" style="padding:12px;border-color:var(--neg)">Report sa nedá zostaviť: ' + esc(e.message) + '</div>'; }
  if (!K) return hlav + kroky + '<div class="aempty">Cyklus nemá plán alebo program nemá profil.</div>';
  const telo = REP.krok === "vstupy" ? repKrokVstupy() : REP.krok === "kontrola" ? repKrokKontrola(K) : REP.krok === "usudok" ? repKrokUsudok(K) : REP.krok === "export" ? repKrokExport(K) : repKrokNahlad(K);
  return hlav + kroky + telo;
}

function repKrokVstupy(){
  const O = REP.cyklusObsah;
  return '<div class="card" style="padding:10px 14px"><b>Vstupy cyklu</b><div class="csub" style="margin:2px 0 6px">Každý druh vstupu je konkrétny import. Nový import nahrajte v programe a tu ho vyberte.</div>' +
    Object.keys(REP_DRUHY).map(d => {
      const moz = REP.vstupy.filter(v => v.druh === d);
      return '<div class="mfield"><label>' + esc(REP_DRUHY[d]) + '</label><select onchange="repVyberVstup(\'' + d + '\', this.value)"><option value="">— bez —</option>' +
        moz.map(v => '<option value="' + esc(v.id) + '"' + ((O.vstupy || {})[d] === v.id ? " selected" : "") + ">" + esc(v.nazov_suboru + " · " + String(v.nahrane || "").slice(0, 10)) + "</option>").join("") + '</select></div>';
    }).join("") + '</div>';
}
async function repVyberVstup(druh, id){
  const O = REP.cyklusObsah; O.vstupy = O.vstupy || {};
  if (id) { O.vstupy[druh] = id; try { await repNacitajVstup(id); } catch (e) { return repChyba(e, "Vstup sa nepodarilo načítať"); } }
  else delete O.vstupy[druh];
  repPrekresli();
}

function repKrokKontrola(K){
  const riadok = (u, t) => '<div style="padding:4px 0;border-top:1px solid var(--line)"><span style="color:' + (u === "chyba" ? "var(--neg)" : u === "upozornenie" ? "var(--warn,#b7791f)" : "var(--muted)") + '">' + (u === "chyba" ? "✗" : u === "upozornenie" ? "!" : "i") + '</span> ' + esc(t) + '</div>';
  let h = '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Plán — ' + K.kontroly.length + ' upozornení</b><div class="csub" style="margin:2px 0 4px">Nástroj chyby v pláne zviditeľní, neopravuje ich. Opravuje ich PMO v zdrojovom pláne.</div>' +
    (K.kontroly.map(k => riadok(k.uroven, k.text)).join("") || '<div class="csub">Bez nálezov.</div>') + '</div>';
  if (K.il) h += '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Issue Log</b><div class="csub" style="margin:2px 0">' +
    K.il.aktivne + " aktívnych · " + K.il.kriticke + " kritických · " + K.il.eskalovane + " eskalovaných podľa úrovne (stav Escalated: " + K.il.eskalovaneStav + ") · " + K.il.poTermine + " po termíne · " + K.il.bezTerminu + " bez dátumu" + (K.il.neznamyStav ? " · " + K.il.neznamyStav + " s prázdnym stavom (rátané ako aktívne)" : "") + '</div></div>';
  if (K.ct) h += '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Záväzky vs. plán</b><div class="csub" style="margin:2px 0">' +
    Object.entries(K.ct.pocty).filter(([, n]) => n).map(([k, n]) => n + "× " + esc(REP_CT_POPIS[k])).join(" · ") + (K.ct.planBezZavazku.length ? " · v pláne bez záväzku: " + esc(K.ct.planBezZavazku.slice(0, 10).join(", ")) : "") + '</div></div>';
  if (K.dep) h += '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Závislosti</b><div class="csub" style="margin:2px 0">' +
    K.dep.kpi.aktivne + " aktívnych · " + K.dep.kpi.blokujuce + " blokuje míľnik · " + K.dep.kpi.poTermine + " po termíne · " + K.dep.kpi.bezPrislubu + " bez prísľubu" +
    (K.dep.osireleZIssue.length ? " · Issue Log odkazuje na neexistujúce: " + esc([...new Set(K.dep.osireleZIssue.map(o => o.dep))].join(", ")) : "") + '</div></div>';
  return h;
}

function repKrokUsudok(K){
  const O = REP.cyklusObsah, us = O.usudok || {}, pz = us.poznamky || {};
  const auto = repNaratiV(K.model, REP.profil);
  const nar = us.naratiV && us.naratiV.text ? us.naratiV.text : "";
  const drahy = K.model.drahy.filter(d => !d.chyba).map(d => {
    const a = repAutoPoznamka(d, REP.profil.fazy).text;
    return '<tr><td><b>' + esc(d.kratky) + '</b></td><td style="width:70%"><input value="' + esc(pz[d.kluc] || "") + '" placeholder="' + esc(a ? "auto: " + a : "") + '" style="width:100%" onchange="repPoznamka(\'' + esc(d.kluc) + '\', this.value)"></td></tr>';
  }).join("");
  return '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Exekutívny súhrn</b><div class="csub" style="margin:2px 0 6px">Prázdne pole = automatický text z dát. Napísaný text má prednosť a vo výstupe je označený ako ručný.</div>' +
    '<textarea rows="5" style="width:100%" placeholder="' + esc(auto) + '" onchange="repNastavNaratiV(this.value)">' + esc(nar) + '</textarea></div>' +
    '<div class="card" style="padding:10px 14px"><b>Poznámka k oblasti</b><div class="csub" style="margin:2px 0 6px">Jedna veta o skutočnom stave (čo je hotové, čo beží, čo blokuje). Prázdne = automatická poznámka z míľnikov.</div><table style="width:100%">' + drahy + '</table></div>';
}
function repPoznamka(kluc, text){ const u = REP.cyklusObsah.usudok = REP.cyklusObsah.usudok || {}; u.poznamky = u.poznamky || {}; if (text.trim()) u.poznamky[kluc] = text.trim(); else delete u.poznamky[kluc]; }
function repNastavNaratiV(text){ const u = REP.cyklusObsah.usudok = REP.cyklusObsah.usudok || {}; u.naratiV = text.trim() ? { text: text.trim(), zdroj: "rucne" } : null; }

function repKrokNahlad(K){
  const O = REP.cyklusObsah, vy = O.vyber = O.vyber || {}, kon = REP.cyklus.stav === "koncept" && !REP.verziaSnimka;
  const L = repLayout(K.view, K.tema, null, { lenZahrnute: false });
  const manif = K.view.manifest;
  const vyberHtml = kon ? '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Čo pôjde do výstupu</b><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">' +
    manif.map(m => '<label style="display:flex;gap:4px;align-items:center"><input type="checkbox"' + (m.zahrnuta ? " checked" : "") + ' onchange="repVyberSnimky(\'' + esc(m.kluc) + '\', this.checked)"> ' + esc(m.nazov) + '</label>').join("") + '</div>' +
    '<div class="csub" style="margin:8px 0 4px">Oblasti v Gantte a v detailoch oneskorení (KPI sa skrytím nemenia):</div><div style="display:flex;gap:10px;flex-wrap:wrap">' +
    K.model.drahy.filter(d => !d.chyba).map(d => '<label style="display:flex;gap:4px;align-items:center"><input type="checkbox"' + ((vy.skryteOblasti || []).includes(d.kluc) ? "" : " checked") + ' onchange="repSkryOblast(\'' + esc(d.kluc) + '\', !this.checked)"> ' + esc(d.kratky) + '</label>').join("") + '</div>' +
    '<div class="mfield" style="max-width:320px;margin-top:8px"><label>Téma</label><select onchange="REP.cyklusObsah.tema=this.value;repPrekresli()">' + Object.keys(REP_TEMY).map(k => '<option value="' + k + '"' + (K.tema === k ? " selected" : "") + ">" + esc(REP_TEMY[k].nazov) + "</option>").join("") + '</select></div></div>' : "";
  const zahrnute = L.strany.filter(st => (manif.find(m => m.kluc === st.kluc) || {}).zahrnuta).length;
  const strany = L.strany.map(st => {
    const zahr = (manif.find(m => m.kluc === st.kluc) || {}).zahrnuta;
    return '<div style="margin:0 0 12px;opacity:' + (zahr ? 1 : 0.35) + '"><div class="csub" style="margin:0 0 4px">' + esc(st.nadpis || st.kluc) + (zahr ? "" : " — nejde do výstupu") + '</div>' +
      '<div style="border:1px solid var(--line);border-radius:6px;overflow:hidden">' + repSvgStrana(L, st).replace("<svg ", '<svg style="display:block;width:100%;height:auto" ') + '</div></div>';
  }).join("");
  return vyberHtml + '<div class="csub" style="margin:0 2px 8px">Výstup: <b>' + zahrnute + '</b> strán. Náhľad je ten istý obraz, z ktorého sa skladá PPTX aj PDF.</div>' + strany;
}
function repVyberSnimky(kluc, zap){ const v = REP.cyklusObsah.vyber = REP.cyklusObsah.vyber || {}; v.snimky = v.snimky || {}; if (zap) delete v.snimky[kluc]; else v.snimky[kluc] = false; repPrekresli(); }
function repSkryOblast(kluc, skryt){ const v = REP.cyklusObsah.vyber = REP.cyklusObsah.vyber || {}; const s = new Set(v.skryteOblasti || []); if (skryt) s.add(kluc); else s.delete(kluc); v.skryteOblasti = [...s]; repPrekresli(); }

function repKrokExport(K){
  const kon = REP.cyklus.stav === "koncept";
  const L = repLayout(K.view, K.tema);
  const chyby = L.problemy;
  return '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Kontrola pred exportom</b><div class="csub" style="margin:2px 0">' +
    (chyby.length ? '<span style="color:var(--neg)">' + chyby.length + " problémov rozloženia — export je zablokovaný.</span> " + esc(chyby.slice(0, 3).join("; ")) : L.strany.length + " strán bez problémov rozloženia.") + '</div></div>' +
    '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Výstupy</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
    '<button class="aabtn pri"' + (chyby.length ? " disabled" : "") + ' onclick="repStiahniPptx()">⬇ Roadmapa (PPTX)</button>' +
    '<button class="aabtn" disabled title="Kolo R2">QA report (PPTX)</button><button class="aabtn" disabled title="Kolo R2">XLSX</button><button class="aabtn" disabled title="Kolo R2">PDF</button><button class="aabtn" disabled title="Kolo R2">E-mail (.eml)</button><button class="aabtn" disabled title="Kolo R2">HTML report</button></div>' +
    '<div class="csub" style="margin:6px 0 0">' + (kon ? "Koncept nesie na každej strane vodoznak „PRACOVNÁ VERZIA“. Po uzavretí cyklu sa výstupy skladajú z nemennej snímky." : "Výstupy sa skladajú z uzavretej snímky cyklu.") + '</div></div>' +
    (kon && repMozemPisat() ? '<div class="card" style="padding:10px 14px"><b>Uzavrieť cyklus</b><div class="csub" style="margin:2px 0 6px">Uzavretím sa vstupy, úsudok a výber zamknú do snímky. Zmena potom znamená znova otvoriť a novú verziu.</div><button class="aabtn"' + (chyby.length ? " disabled" : "") + ' onclick="repUzavri()">Uzavrieť cyklus</button></div>' : "");
}

function ensurePptx(){
  return nacitajKniznicu("https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js", () => window.PptxGenJS, "Knižnica pre PowerPoint");
}
async function repStiahniPptx(){
  try {
    REP.pracuje = "Skladám PowerPoint…"; repPrekresli();
    const K = repKontextCyklu(), P = await ensurePptx();
    const L = repLayout(K.view, K.tema);
    if (L.problemy.length) throw new Error("rozloženie má problémy: " + L.problemy[0]);
    if (REP.cyklus.stav === "koncept" && !REP.verziaSnimka) repVodoznak(L);
    const blob = await repPptx(P, L, { nazov: K.view.nazov }).write({ outputType: "blob" });
    downloadBlob(blob, (REP.program.kod || "report") + "_Roadmapa_" + REP.cyklus.stav_ku_dnu + (REP.cyklus.stav === "koncept" ? "_koncept" : "") + ".pptx");
    REP.pracuje = "";
  } catch (e) { return repChyba(e, "PowerPoint sa nepodarilo zostaviť"); }
  repPrekresli();
}

async function repUlozCyklus(){
  try {
    REP.pracuje = "Ukladám cyklus…"; repPrekresli();
    const d = await b2bEdge("rep_cyklus_uloz", { cyklus: REP.cyklus.id, verzia: REP.cyklus.verzia, obsah: REP.cyklusObsah });
    REP.cyklus.verzia = d.verzia; REP.pracuje = "";
  } catch (e) {
    if (e.stav === 409) { REP.pracuje = ""; alert("Cyklus medzitým zmenil niekto iný. Načítam aktuálny stav — vaše posledné úpravy treba zopakovať."); return repOtvorCyklus(REP.cyklus.id); }
    return repChyba(e, "Cyklus sa nepodarilo uložiť");
  }
  repPrekresli();
}
async function repUzavri(){
  if (!confirm("Uzavrieť cyklus " + repDMR(REP.cyklus.stav_ku_dnu) + "? Vstupy, úsudok a výber sa zamknú do snímky.")) return;
  try {
    await repUlozCyklus();
    const K = repKontextCyklu();
    const snimka = { schema: 1, model: K.model, view: K.view, kontroly: K.kontroly, ct: K.ct, dep: K.dep, il: K.il, tema: K.tema,
      profilVerzia: REP.profilVerzia, vstupy: Object.assign({}, REP.cyklusObsah.vstupy), obsah: REP.cyklusObsah };
    REP.pracuje = "Uzatváram…"; repPrekresli();
    await b2bEdge("rep_cyklus_uzavri", { cyklus: REP.cyklus.id, verzia: REP.cyklus.verzia, obsah: snimka });
    await repOtvorProgram(REP.program.id); await repOtvorCyklus(REP.cyklus.id);
  } catch (e) { repChyba(e, "Cyklus sa nepodarilo uzavrieť"); }
}
async function repOtvorZnova(){
  if (!confirm("Znova otvoriť cyklus? Vznikne nová verzia konceptu; uzavretá snímka ostáva v histórii.")) return;
  try { await b2bEdge("rep_cyklus_otvor", { cyklus: REP.cyklus.id, verzia: REP.cyklus.verzia }); await repOtvorProgram(REP.program.id); await repOtvorCyklus(REP.cyklus.id); }
  catch (e) { repChyba(e, "Cyklus sa nepodarilo otvoriť"); }
}

// Mobil (D11): len čítanie — posledný uzavretý cyklus.
function repMobilPrehladHtml(){
  const K = REP.pohlad === "cyklus" ? (function(){ try { return repKontextCyklu(); } catch (e) { return null; } })() : null;
  if (!K) return '<div class="aempty">Report sa tvorí a upravuje na počítači. Na mobile uvidíte prehľad uzavretého cyklu — otvorte cyklus zo zoznamu.</div>' +
    (REP.pohlad === "program" ? REP.cykly.map(c => '<div class="card" style="padding:8px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center"><span>' + esc(c.nazov || repDMR(c.stav_ku_dnu)) + '</span><button class="aabtn" onclick="repOtvorCyklus(\'' + esc(c.id) + '\')">Prehľad</button></div>').join("") : "");
  const ex = K.view.snimky.find(x => x.typ === "exec");
  const kpi = ex ? ex.kpi : [], poz = ex ? ex.pozornost : [];
  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">' + kpi.map(k => '<div class="card" style="padding:8px 10px"><div class="csub" style="margin:0">' + esc(k.popis) + '</div><b style="font-size:20px">' + esc(k.hodnota) + '</b></div>').join("") + '</div>' +
    '<div class="card" style="padding:10px 12px"><b>Vyžaduje pozornosť</b>' + (poz.map(p => '<div style="padding:4px 0;border-top:1px solid var(--line)"><b>' + esc(p.kratky) + '</b> <span class="csub" style="margin:0">' + esc(p.dovod) + '</span></div>').join("") || '<div class="csub">Nič.</div>') + '</div>';
}
