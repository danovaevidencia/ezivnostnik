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
  // 2b. Zmeny od minula, podstatné zmeny a trend (R3a, §6.7) — z porovnania snímok plánu
  for (const z of repZmenySnimky(kontext, vybrane)) snimky.push(z);
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
  // 3b. Finančný report (R3a, D8) — len keď ho úsudok cyklu má
  const fin = repFinancie(us.financie);
  if (fin) snimky.push({ kluc: "financie", typ: "financie", nazov: "Finančný report", zahrnuta: vybrane("financie"), fin });
  // 3c. Detail oblastí po skupinách (R4, §9.2) — tabuľka s balíkmi alebo karty
  for (const z of repDetailSnimky(p, drahy, drahaView, vybrane, vy.detailTvar)) snimky.push(z);
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
  for (const s of snimky) s.balik = "roadmapa";
  // QA report (R2): snímky dohľadu kvality idú do vlastného balíka (QA PPTX/PDF)
  if (kontext.qa) for (const s of repQaSnimky(kontext.qa, vybrane)) { s.balik = "qa"; snimky.push(s); }
  if (kontext.qa && kontext.zmenyRegistrov) snimky.push(Object.assign(repQaZmenyRegistrovSnimka(kontext.zmenyRegistrov, vybrane), { balik: "qa" }));
  return { nazov: p.nazov || "", kod: p.kod || "", stavKuDnu: model.stavKuDnu, cielovyTermin: model.cielovyTermin, pocetUloh: model.pocty.ulohy,
    farby: (p.metriky && p.metriky.farby) || null, snimky,
    manifest: snimky.map(s => ({ kluc: s.kluc, nazov: s.nazov, zahrnuta: s.zahrnuta, balik: s.balik })) };
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
    if (volby.balik && s.balik !== volby.balik) continue;
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
    for (const k of ["x", "y", "w", "h", "x1", "y1", "x2", "y2", "pt", "cx", "cy", "r"].concat(p.t === "mark" ? ["s"] : [])) if (k in p && !Number.isFinite(p[k])) o.push("strana " + (i + 1) + ", prvok " + j + " (" + p.t + "): " + k + " = " + p[k]);
    if (p.t === "kolac" && (p.cx - p.r < -0.01 || p.cx + p.r > REP_W + 0.01 || p.cy - p.r < -0.01 || p.cy + p.r > REP_H + 0.01)) o.push("strana " + (i + 1) + ", prvok " + j + " (kolac) presahuje stranu");
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
    const ak = k.farba ? k.farba : k.akcent === "red" ? T.red : k.akcent === "green" ? T.green : k.akcent === "amber" ? T.amber : k.akcent === "textSec" ? T.textSec : (k.pct != null ? repFarbaStavu(k.pct, farby, T) : T.blue);
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
    } else if (p.t === "kolac") {
      const sum = p.diely.reduce((s, d) => s + d.v, 0);
      let a = -Math.PI / 2;
      for (const d of p.diely) {
        if (!(d.v > 0)) continue;
        const da = d.v / sum * 2 * Math.PI, st = ' fill="#' + d.farba + '" stroke="#' + (p.okraj || layout.bg) + '" stroke-width="1.5"';
        if (da >= 2 * Math.PI - 1e-6) { o.push('<circle cx="' + f(p.cx) + '" cy="' + f(p.cy) + '" r="' + f(p.r) + '"' + st + "/>"); break; }
        const x0 = p.cx + p.r * Math.cos(a), y0 = p.cy + p.r * Math.sin(a), x1 = p.cx + p.r * Math.cos(a + da), y1 = p.cy + p.r * Math.sin(a + da);
        o.push('<path d="M' + f(p.cx) + " " + f(p.cy) + " L" + f(x0) + " " + f(y0) + " A" + f(p.r) + " " + f(p.r) + " 0 " + (da > Math.PI ? 1 : 0) + " 1 " + f(x1) + " " + f(y1) + ' Z"' + st + "/>");
        a += da;
      }
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
      } else if (p.t === "kolac") {
        // natívny graf PowerPointu, nie obrázok (koláč generátora bol natiahnutá elipsa, §3.4)
        const D = p.diely.filter(d => d.v > 0);
        s.addChart((pres.charts && pres.charts.PIE) || "pie", [{ name: "Zložky", labels: D.map(d => d.nazov), values: D.map(d => d.v) }],
          { x: p.cx - p.r, y: p.cy - p.r, w: 2 * p.r, h: 2 * p.r, chartColors: D.map(d => d.farba), showLegend: false, showValue: false, showPercent: false,
            showLabel: false, showTitle: false, firstSliceAng: 0, layout: { x: 0, y: 0, w: 1, h: 1 }, dataBorder: { pt: 1, color: p.okraj || layout.bg } });
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

// Textové polia ako vstupy .mfield (CSS appky textarea neštýluje).
const REP_TEXTAREA = "width:100%;box-sizing:border-box;border:1.5px solid var(--line);background:var(--bg);color:inherit;border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;line-height:1.45;resize:vertical";
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
  if (REP.pohlad === "zistenia" && REP.program) return prac + repZisteniaHtml();
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
    const [pr, vs, cy, rz] = await Promise.all([
      b2bEdge("rep_profil_nacitaj", { program: id }),
      sb.from("b2b_rep_vstupy").select("id, program_id, druh, nazov_suboru, sha256, velkost, datum_suboru, povodny_velkost, protokol, nahral, nahrane").eq("program_id", id).order("nahrane", { ascending: false }),
      sb.from("b2b_rep_cykly").select("id, program_id, stav_ku_dnu, nazov, stav, verzia, vytvoril, vytvorene, upravil, upravene").eq("program_id", id).order("stav_ku_dnu", { ascending: false }),
      b2bEdge("rep_register_nacitaj", { program: id, druh: "zistenia" }) ]);
    if (vs.error) throw vs.error; if (cy.error) throw cy.error;
    REP.registre = { zistenia: { verzia: rz.verzia || 0, obsah: rz.obsah || repZisteniaPrazdny(), zmenene: false } };
    await Promise.all(REP_REGISTRE_PROGRAMU.map(repNacitajRegisterDruh));
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
  const sablona = d => d === "plan" ? "" : '<button class="aabtn" title="Prázdna šablóna so zoznamami hodnôt a pokynmi" onclick="repStiahniSablonu(\'' + d + '\')">Šablóna</button>';
  const vstupy = Object.keys(REP_DRUHY).filter(d => d !== "zistenia").map(d => {
    const v = repPosledny(d);
    return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--line);align-items:center;flex-wrap:wrap">' +
      '<div style="min-width:220px;flex:1"><b>' + esc(REP_DRUHY[d]) + '</b><div class="csub" style="margin:0">' + (v ? esc(v.nazov_suboru) + " · " + esc(String(v.nahrane || "").slice(0, 10)) + " · " + esc(repProtokolText(v)) : "zatiaľ nenahraté") + '</div></div>' +
      '<div style="display:flex;gap:6px">' + sablona(d) + (pis ? '<label class="aabtn" style="cursor:pointer">' + (v ? "Nahrať novší" : "Nahrať") + '<input type="file" accept="' + (d === "plan" ? ".xml" : ".xlsx,.xlsm") + '" style="display:none" onchange="repImport(\'' + d + '\', this)"></label>' : "") + '</div></div>';
  }).join("");
  const rz = REP.registre.zistenia, zr = rz ? rz.obsah.riadky.filter(z => z.stav !== "zrusene") : [];
  const registerHtml = '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--line);align-items:center;flex-wrap:wrap">' +
    '<div style="min-width:220px;flex:1"><b>Register zistení</b><div class="csub" style="margin:0">vedie sa v portáli · ' + zr.length + " zistení, " + zr.filter(z => z.stav === "otvorene" || z.stav === "riesi").length + " otvorených" +
    (rz && rz.verzia ? " · verzia " + rz.verzia : "") + '</div></div><div style="display:flex;gap:6px">' + sablona("zistenia") +
    '<button class="aabtn pri" onclick="REP.pohlad=\'zistenia\';repPrekresli()">Otvoriť register</button></div></div>';
  return hlav + navod +
    '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Cykly reportu</b>' + (cykly || '<div class="csub">Zatiaľ žiadny cyklus.</div>') + '</div>' +
    '<div class="card" style="padding:10px 14px"><b>Vstupy</b><div class="csub" style="margin:2px 0 4px">Excel zostáva zdrojom pravdy PMO; každý import je nová snímka, staré ostávajú pre porovnanie. Šablóna má hlavičku, zoznamy povolených hodnôt a pokyny — súbor z nej sa načíta bez úprav.</div>' + vstupy + registerHtml + '</div>';
}

// Šablóny vstupov (§4.6): CT so stĺpcami dodávateľov z posledného importu a bránami z profilu.
async function repStiahniSablonu(druh){
  try {
    const X = await ensureXlsxStyle(), F = await ensureFflate();
    const ct = repPosledny("ct"), volby = druh === "ct" ? { dodavatelia: ct && ct.protokol && ct.protokol.dodavatelia, brany: REP.profil ? REP.profil.fazy.map(f => f.kluc) : null } : null;
    downloadBlob(new Blob([repSablonaXlsx(X, F, druh, volby)], { type: REP_MIME.xlsx }), (REP.program.kod || "program") + "_Sablona_" + { issue: "IssueLog", ct: "Commitments", dep: "DependencyLog", zistenia: "RegisterZisteni" }[druh] + ".xlsx");
  } catch (e) { repChyba(e, "Šablónu sa nepodarilo pripraviť"); }
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
      if (druh === "zistenia") return await repZisteniaZXlsx(r);
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
    '<label style="display:flex;gap:6px;align-items:flex-start;margin:6px 0 0"><input type="checkbox"' + (P.aiNavrhy ? " checked" : "") + ' onchange="REP.profilNavrh.aiNavrhy=this.checked">' +
    '<span>Povoliť <b>✨ návrh textov</b> jazykovým modelom (Anthropic) — <span class="csub" style="margin:0">model dostane len čísla a termíny reportu s názvami oblastí z profilu, nie texty registrov, mená ani financie. Zapnite, len keď s tým objednávateľ súhlasí.</span></span></label>' +
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
    const vstupy = {}; for (const d of Object.keys(REP_DRUHY)) { const x = d !== "zistenia" && repPosledny(d); if (x) vstupy[d] = x.id; }
    const obsah = { vstupy, usudok: {}, vyber: {}, tema: REP.profil.tema || "clean" };
    REP.pracuje = "Zakladám cyklus…"; repPrekresli();
    // Z predošlého cyklu prejde úsudok, ktorý trvá (★ otázky, RAG, poznámky, výber),
    // s príznakom „prenesené — overiť“; čísla a naratívy sa píšu nanovo.
    const pred = REP.cykly.filter(c => c.stav_ku_dnu < stav).sort((a, b) => (a.stav_ku_dnu < b.stav_ku_dnu ? 1 : -1))[0];
    if (pred) {
      const po = ((await b2bEdge("rep_cyklus_nacitaj", { cyklus: pred.id })).obsah) || {};
      Object.assign(obsah, repPrenesUsudok(po, pred.stav_ku_dnu), repPrenesPorovnanie(po, pred));
    }
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
    REP.verziaSnimka = null; REP.verziaCislo = null; REP.verziaId = null;
    if (REP.cyklus.stav !== "koncept") {
      const { data } = await sb.from("b2b_rep_cykly_verzie").select("id, cislo").eq("cyklus_id", id).order("cislo", { ascending: false }).limit(1);
      if (data && data[0]) { REP.verziaSnimka = (await b2bEdge("rep_cyklus_verzia_nacitaj", { cyklus: id, cislo: data[0].cislo })).obsah; REP.verziaCislo = data[0].cislo; REP.verziaId = data[0].id; }
    }
    const VS = repVstupyCyklu(REP.cyklusObsah);
    for (const vid of VS.vlastne) await repNacitajVstup(vid);
    // vstup porovnania, ktorý sa nedá načítať, cyklus nezhodí — v karte Porovnanie svieti
    REP.porovnanieChyba = "";
    for (const vid of VS.porovnanie) {
      try { await repNacitajVstup(vid); }
      catch (e) { console.error("Reporting: vstup porovnania " + vid, e); REP.porovnanieChyba = (e && e.message) || String(e); }
    }
    REP.krok = REP.cyklus.stav === "koncept" ? (REP.krok || "vstupy") : "nahlad";
    REP.pohlad = "cyklus"; REP.pracuje = "";
  } catch (e) { return repChyba(e, "Cyklus sa nepodarilo načítať"); }
  repPrekresli();
}

// Kontext reportu z obsahu cyklu (jeden zdroj pre náhľad aj súbor).
// QA kontext vzniká, keď je z čoho hodnotiť (register alebo zistenie); inak
// report nemá QA balík a nič nečaká na úsudok, ktorý nemá oporu v dátach.
function repKontextCyklu(){
  if (REP.verziaSnimka) {                                         // uzavretý cyklus = nemenná snímka
    const S = REP.verziaSnimka;
    return Object.assign({ usudok: ((S.obsah || {}).usudok) || {}, protokoly: S.protokoly || {}, qa: null, zmeny: null, trend: null, zmenyRegistrov: null }, S);
  }
  const O = REP.cyklusObsah, P = REP.profil, V = O.vstupy || {};
  const plan = V.plan ? REP.plany[V.plan] : null;
  if (!plan || !P) return null;
  const model = repModel(plan, P, REP.cyklus.stav_ku_dnu);
  const reg = d => (V[d] && REP.plany[V[d]]) ? REP.plany[V[d]].riadky : null;
  const kontroly = repKontroly(model, plan, P);
  // anotácie a číselník oblastí žijú v programe (R4) — platia pre každý cyklus a import
  const issueR = repIssueSAnotaciami(reg("issue"), repAnotPolozky("anotacie_issue"));
  const cis = REP.registre && REP.registre.ciselnik_oblasti, mapa = (cis && cis.obsah && cis.obsah.mapa) || {};
  const ct = reg("ct") ? repCtSulad(plan, P, reg("ct"), REP.cyklus.stav_ku_dnu, repAnotPolozky("anotacie_ct")) : null;
  const dep = reg("dep") ? repDepVyhodnot(reg("dep"), plan, P, ct, REP.cyklus.stav_ku_dnu, issueR) : null;
  const il = issueR ? repIssueKpi(issueR, P, REP.cyklus.stav_ku_dnu) : null;
  const rz = REP.registre && REP.registre.zistenia;
  const zistenia = rz && rz.obsah ? rz.obsah : null;
  const qa = (il || ct || dep || (zistenia && zistenia.riadky.length))
    ? repQa({ model, profil: P, il, ilRiadky: issueR, ct, dep, zistenia, usudok: O.usudok, oblastIssue: repOblastIssueFn(P, mapa), oblastPopis: repOblastIssuePopis(P, mapa) }) : null;
  const { zmeny, trend, zmenyRegistrov } = repKontextZmien(O, P, plan, model, reg);
  const view = repView(model, { profil: P, cyklus: O, qa, zmeny, trend, zmenyRegistrov });
  const protokoly = {};
  for (const d of ["issue", "ct", "dep"]) { const v = V[d] && REP.vstupy.find(x => x.id === V[d]); if (v) protokoly[d] = v.protokol; }
  return { model, view, kontroly, ct, dep, il, qa, zmeny, trend, zmenyRegistrov, usudok: O.usudok || {}, protokoly, registreVerzie: Object.fromEntries(["zistenia"].concat(REP_REGISTRE_PROGRAMU).map(d => [d, ((REP.registre || {})[d] || {}).verzia || 0])), tema: O.tema || P.tema || "clean" };
}

// Model staršej snímky plánu k jej vlastnému stavu ku dňu (N24: nie k dnešnému).
// Pamäť podľa vstupu, stavu a verzie profilu — prekreslenie ho nepočíta znova.
function repModelBodu(vstupId, stav){
  const plan = REP.plany[vstupId];
  if (!plan || !stav) return null;
  const k = vstupId + "|" + stav + "|" + REP.profilVerzia;
  REP.modelCache = REP.modelCache || {};
  return REP.modelCache[k] || (REP.modelCache[k] = repModel(plan, REP.profil, stav));
}
// Porovnanie (O.porovnanie) a body trendu (O.trend.body) cyklu; len snímky so
// stavom ku dňu PRED týmto cyklom.
function repKontextZmien(O, P, plan, model, reg){
  const por = O.porovnanie || {}, stav = REP.cyklus.stav_ku_dnu;
  let zmeny = null, trend = null, zmenyRegistrov = null;
  if (por.plan && REP.plany[por.plan] && por.stavKuDnu && por.stavKuDnu < stav)
    zmeny = repZmeny({ plan: REP.plany[por.plan], stavKuDnu: por.stavKuDnu, model: repModelBodu(por.plan, por.stavKuDnu), popis: por.popis }, { plan, stavKuDnu: stav, model }, P);
  // ten istý import na oboch stranách nie je porovnanie — strana by tvrdila „nič sa nezmenilo“
  const regP = d => (por[d] && por[d] !== (O.vstupy || {})[d] && REP.plany[por[d]] ? REP.plany[por[d]].riadky : null);
  if (["issue", "ct", "dep"].some(d => regP(d) && reg(d)))
    zmenyRegistrov = repZmenyRegistrov({ issue: regP("issue"), ct: regP("ct"), dep: regP("dep") }, { issue: reg("issue"), ct: reg("ct"), dep: reg("dep") });
  const body = ((O.trend || {}).body || []).filter(b => b.plan && REP.plany[b.plan] && b.stavKuDnu && b.stavKuDnu < stav)
    .map(b => ({ stavKuDnu: b.stavKuDnu, popis: b.popis || "", model: repModelBodu(b.plan, b.stavKuDnu) }));
  if (body.length) trend = repTrend(body.concat([{ stavKuDnu: stav, popis: "tento cyklus", model }]), P);
  return { zmeny, trend, zmenyRegistrov };
}
// Všetky vstupy, ktoré cyklus potrebuje načítať (vlastné, porovnanie, trend).
function repVstupyCyklu(O){
  const por = O.porovnanie || {}, s = new Set(Object.values(O.vstupy || {}));
  const dalsie = new Set([por.plan, por.issue, por.ct, por.dep].concat(((O.trend || {}).body || []).map(b => b.plan)).filter(Boolean));
  return { vlastne: [...s], porovnanie: [...dalsie].filter(id => !s.has(id)) };
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
  return '<div class="card" style="padding:10px 14px"><b>Vstupy cyklu</b><div class="csub" style="margin:2px 0 6px">Každý druh vstupu je konkrétny import. Nový import nahrajte v programe a tu ho vyberte. ' +
    'Register zistení sa vedie v portáli — cyklus berie jeho aktuálny stav a uzavretie ho zamkne do snímky.</div>' +
    Object.keys(REP_DRUHY).filter(d => d !== "zistenia").map(d => {
      const moz = REP.vstupy.filter(v => v.druh === d);
      return '<div class="mfield"><label>' + esc(REP_DRUHY[d]) + '</label><select onchange="repVyberVstup(\'' + d + '\', this.value)"><option value="">— bez —</option>' +
        moz.map(v => '<option value="' + esc(v.id) + '"' + ((O.vstupy || {})[d] === v.id ? " selected" : "") + ">" + esc(v.nazov_suboru + " · " + String(v.nahrane || "").slice(0, 10)) + "</option>").join("") + '</select></div>';
    }).join("") + '</div>' + repPorovnanieHtml();
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
  return h + repKontrolaR4Html(K);
}

function repKrokUsudok(K){
  const O = REP.cyklusObsah, us = O.usudok || {}, pz = us.poznamky || {};
  const auto = repNaratiV(K.model, REP.profil);
  const nar = us.naratiV && us.naratiV.text ? us.naratiV.text : "";
  const drahy = K.model.drahy.filter(d => !d.chyba).map(d => {
    const a = repAutoPoznamka(d, REP.profil.fazy).text;
    return '<tr><td><b>' + esc(d.kratky) + '</b></td><td style="width:70%"><input value="' + esc(pz[d.kluc] || "") + '" placeholder="' + esc(a ? "auto: " + a : "") + '" style="width:100%" onchange="repPoznamka(\'' + esc(d.kluc) + '\', this.value)"></td></tr>';
  }).join("");
  const pren = us.prenesene ? '<div class="card" style="padding:10px 14px;margin-bottom:10px;border-color:var(--acc)"><b>Prenesené z cyklu k ' + esc(repDMR(us.prenesene.z)) + ' — overte</b>' +
    '<div class="csub" style="margin:2px 0 6px">Kľúčové otázky (★), hodnotenie RAG, poznámky k oblastiam, finančný report a výber strán sú z minulého cyklu — sumy financií prepíšte na aktuálne. Čísla z plánu a súhrny sa počítajú nanovo.</div>' +
    '<button class="aabtn" onclick="repPreneseneOverene()">Overené</button></div>' : "";
  const zdroj = us.naratiV && REP_ZDROJ_TXT[us.naratiV.zdroj] && us.naratiV.zdroj !== "rucne" ? ' <span class="csub" style="margin:0">· ' + esc(REP_ZDROJ_TXT[us.naratiV.zdroj]) + "</span>" : "";
  return pren + repAiNavrhHtml(K) + '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Exekutívny súhrn</b>' + zdroj + '<div class="csub" style="margin:2px 0 6px">Prázdne pole = automatický text z dát. Napísaný text má prednosť a vo výstupe je označený ako ručný.</div>' +
    '<textarea rows="5" style="' + REP_TEXTAREA + '" placeholder="' + esc(auto) + '" onchange="repNastavNaratiV(this.value)">' + esc(nar) + '</textarea></div>' +
    '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Poznámka k oblasti</b><div class="csub" style="margin:2px 0 6px">Jedna veta o skutočnom stave (čo je hotové, čo beží, čo blokuje). Prázdne = automatická poznámka z míľnikov.</div><table style="width:100%">' + drahy + '</table></div>' +
    repFinancieHtml() + repKrokUsudokQa(K);
}
function repPoznamka(kluc, text){ const u = REP.cyklusObsah.usudok = REP.cyklusObsah.usudok || {}; u.poznamky = u.poznamky || {}; if (text.trim()) u.poznamky[kluc] = text.trim(); else delete u.poznamky[kluc]; }
function repNastavNaratiV(text){ const u = REP.cyklusObsah.usudok = REP.cyklusObsah.usudok || {}; u.naratiV = text.trim() ? { text: text.trim(), zdroj: repZdrojPoUprave(u.naratiV && u.naratiV.zdroj) } : null; }

function repKrokNahlad(K){
  const O = REP.cyklusObsah, vy = O.vyber = O.vyber || {}, kon = REP.cyklus.stav === "koncept" && !REP.verziaSnimka;
  const L = repLayout(K.view, K.tema, null, { lenZahrnute: false });
  const manif = K.view.manifest;
  const vyberHtml = kon ? '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Čo pôjde do výstupu</b><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">' +
    manif.map(m => '<label style="display:flex;gap:4px;align-items:center"><input type="checkbox"' + (m.zahrnuta ? " checked" : "") + ' onchange="repVyberSnimky(\'' + esc(m.kluc) + '\', this.checked)"> ' + esc(m.nazov) + '</label>').join("") + '</div>' +
    '<div class="csub" style="margin:8px 0 4px">Oblasti v Gantte a v detailoch oneskorení (KPI sa skrytím nemenia):</div><div style="display:flex;gap:10px;flex-wrap:wrap">' +
    K.model.drahy.filter(d => !d.chyba).map(d => '<label style="display:flex;gap:4px;align-items:center"><input type="checkbox"' + ((vy.skryteOblasti || []).includes(d.kluc) ? "" : " checked") + ' onchange="repSkryOblast(\'' + esc(d.kluc) + '\', !this.checked)"> ' + esc(d.kratky) + '</label>').join("") + '</div>' +
    '<div style="display:flex;gap:12px;flex-wrap:wrap"><div class="mfield" style="max-width:320px;margin-top:8px"><label>Detail oblastí</label><select onchange="REP.cyklusObsah.vyber.detailTvar=this.value;repPrekresli()">' +
    [["tabulka", "tabuľka s balíkmi"], ["karty", "karty oblastí"]].map(([k, t]) => '<option value="' + k + '"' + ((vy.detailTvar || "tabulka") === k ? " selected" : "") + ">" + t + "</option>").join("") + '</select></div>' +
    '<div class="mfield" style="max-width:320px;margin-top:8px"><label>Téma</label><select onchange="REP.cyklusObsah.tema=this.value;repPrekresli()">' + Object.keys(REP_TEMY).map(k => '<option value="' + k + '"' + (K.tema === k ? " selected" : "") + ">" + esc(REP_TEMY[k].nazov) + "</option>").join("") + '</select></div></div></div>' : "";
  const zahrnute = L.strany.filter(st => (manif.find(m => m.kluc === st.kluc) || {}).zahrnuta).length;
  const strany = L.strany.map(st => {
    const zahr = (manif.find(m => m.kluc === st.kluc) || {}).zahrnuta;
    return '<div style="margin:0 0 12px;opacity:' + (zahr ? 1 : 0.35) + '"><div class="csub" style="margin:0 0 4px">' + esc(st.nadpis || st.kluc) + (zahr ? "" : " — nejde do výstupu") + '</div>' +
      '<div style="border:1px solid var(--line);border-radius:6px;overflow:hidden">' + repSvgStrana(L, st).replace("<svg ", '<svg style="display:block;width:100%;height:auto" ') + '</div></div>';
  }).join("");
  return vyberHtml + '<div class="csub" style="margin:0 2px 8px">Výstup: <b>' + zahrnute + '</b> strán. Náhľad je ten istý obraz, z ktorého sa skladá PowerPoint.</div>' + strany;
}
function repVyberSnimky(kluc, zap){ const v = REP.cyklusObsah.vyber = REP.cyklusObsah.vyber || {}; v.snimky = v.snimky || {}; if (zap) delete v.snimky[kluc]; else v.snimky[kluc] = false; repPrekresli(); }
function repSkryOblast(kluc, skryt){ const v = REP.cyklusObsah.vyber = REP.cyklusObsah.vyber || {}; const s = new Set(v.skryteOblasti || []); if (skryt) s.add(kluc); else s.delete(kluc); v.skryteOblasti = [...s]; repPrekresli(); }

// Výstupy (§9.5): všetky z toho istého view-modelu; PPTX, PDF a HTML z toho
// istého layoutu ako náhľad. Problém rozloženia blokuje obrazové výstupy, nie XLSX.
function repKrokExport(K){
  const kon = REP.cyklus.stav === "koncept" && !REP.verziaSnimka;
  const Lr = repLayout(K.view, K.tema, null, { balik: "roadmapa" }), Lq = repLayout(K.view, K.tema, null, { balik: "qa" });
  const chyby = Lr.problemy.concat(Lq.problemy), zam = chyby.length ? " disabled" : "";
  const E = REP.emlPrilohy = REP.emlPrilohy || { roadmapa: true, qa: true, pdf: false, xlsx: false };
  const btn = (druh, text, pri, dis) => '<button class="aabtn' + (pri ? " pri" : "") + '"' + (dis ? " disabled" : "") + ' onclick="repStiahni(\'' + druh + '\')">' + text + '</button>';
  const chk = (druh, text) => '<label style="display:flex;gap:4px;align-items:center"><input type="checkbox"' + (E[druh] ? " checked" : "") + ' onchange="REP.emlPrilohy.' + druh + '=this.checked"> ' + text + '</label>';
  const qa = Lq.strany.length > 0;
  return '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Kontrola pred exportom</b><div class="csub" style="margin:2px 0">' +
    (chyby.length ? '<span style="color:var(--neg)">' + chyby.length + " problémov rozloženia — PowerPoint, PDF a HTML sú zablokované.</span> " + esc(chyby.slice(0, 3).join("; "))
      : "Roadmapa " + Lr.strany.length + " strán" + (qa ? ", QA report " + Lq.strany.length + " strán" : "") + " — bez problémov rozloženia.") + '</div></div>' +
    '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Výstupy</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">' +
    btn("roadmapa", "⬇ Roadmapa (PPTX)", true, chyby.length || !Lr.strany.length) + btn("qa", "⬇ QA report (PPTX)", false, chyby.length || !qa) +
    btn("pdf", "⬇ PDF (celý report)", false, chyby.length) + btn("html", "⬇ HTML report", false, chyby.length) + btn("xlsx", "⬇ Dáta (XLSX)", false, false) + '</div>' +
    '<div class="csub" style="margin:6px 0 0">' + (qa ? "" : "QA report vznikne, keď cyklus má Issue Log, záväzky alebo závislosti, alebo register zistení nie je prázdny. ") +
    "XLSX nesie oblasti, míľniky, registre s výsledkom vyhodnotenia a hárok „Na opravu pre PMO“. HTML report obsahuje len strany reportu, nie vstupy.</div>" +
    '<div class="csub" style="margin:6px 0 0">' + (kon ? "Koncept nesie na každej strane vodoznak „PRACOVNÁ VERZIA“. Po uzavretí cyklu sa výstupy skladajú z nemennej snímky." : "Výstupy sa skladajú z uzavretej snímky cyklu.") + '</div></div>' +
    '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>E-mail pre Outlook</b><div class="csub" style="margin:2px 0 6px">Koncept .eml so súhrnom reportu v tele (stav, čo vyžaduje pozornosť, najbližšie míľniky' + (qa ? ", dohľad kvality" : "") + ') a s prílohami. Adresáta doplníte v Outlooku.</div>' +
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px">' + chk("roadmapa", "Roadmapa (PPTX)") + (qa ? chk("qa", "QA report (PPTX)") : "") + chk("pdf", "PDF") + chk("xlsx", "XLSX") + '</div>' +
    '<button class="aabtn"' + zam + ' onclick="repStiahniEml()">✉ Stiahnuť e-mail (.eml)</button></div>' + repVystupyProjektuHtml(K) +
    (kon && repMozemPisat() ? '<div class="card" style="padding:10px 14px"><b>Uzavrieť cyklus</b><div class="csub" style="margin:2px 0 6px">Uzavretím sa vstupy, úsudok, register zistení a výber zamknú do snímky. Zmena potom znamená znova otvoriť a novú verziu.</div><button class="aabtn"' + zam + ' onclick="repUzavri()">Uzavrieť cyklus</button></div>' : "");
}

function ensurePptx(){
  return nacitajKniznicu("https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js", () => window.PptxGenJS, "Knižnica pre PowerPoint");
}
// Jeden výstup ako súbor {blob, nazov} — to isté pre stiahnutie aj prílohu e-mailu.
async function repSubor(druh, K){
  const kon = REP.cyklus.stav === "koncept" && !REP.verziaSnimka;
  const meno = (REP.program.kod || "report") + "_" + { roadmapa: "Roadmapa", qa: "QA", pdf: "Report", xlsx: "Data", html: "Report" }[druh] + "_" + REP.cyklus.stav_ku_dnu + (kon ? "_koncept" : "");
  const lay = balik => {
    const L = repLayout(K.view, K.tema, null, balik ? { balik } : {});
    if (L.problemy.length) throw new Error("rozloženie má problémy: " + L.problemy[0]);
    return kon ? repVodoznak(L) : L;
  };
  if (druh === "roadmapa" || druh === "qa") {
    const P = await ensurePptx(), L = lay(druh);
    if (!L.strany.length) throw new Error("vo výbere nie je žiadna strana");
    return { blob: await repPptx(P, L, { nazov: K.view.nazov }).write({ outputType: "blob" }), nazov: meno + ".pptx" };
  }
  if (druh === "pdf") {
    const J = await ensureJsPDF(), FP = await fakturaPdfModul();
    return { blob: repPdf(J.jsPDF, lay(null), FP).output("blob"), nazov: meno + ".pdf" };
  }
  if (druh === "html") return { blob: new Blob([repHtmlReport([{ nazov: "Roadmapa", layout: lay("roadmapa") }, { nazov: "QA report", layout: lay("qa") }],
    { nazov: K.view.nazov, stavKuDnu: K.view.stavKuDnu, koncept: kon })], { type: REP_MIME.html }), nazov: meno + ".html" };
  if (druh === "xlsx") {
    const X = await ensureXlsxStyle(), F = await ensureFflate();
    return { blob: new Blob([repXlsxDopln(F, new Uint8Array(X.write(repXlsxBalik(X, K), { type: "array", bookType: "xlsx" })))], { type: REP_MIME.xlsx }), nazov: meno + ".xlsx" };
  }
  throw new Error("neznámy výstup " + druh);
}
async function repStiahni(druh){
  try {
    REP.pracuje = "Skladám výstup…"; repPrekresli();
    const s = await repSubor(druh, repKontextCyklu());
    downloadBlob(s.blob, s.nazov);
    await repLogExport({ roadmapa: "roadmapa_pptx", qa: "qa_pptx" }[druh] || druh, s.blob);
    REP.pracuje = "";
  } catch (e) { return repChyba(e, "Výstup sa nepodarilo zostaviť"); }
  repPrekresli();
}
async function repStiahniEml(){
  try {
    REP.pracuje = "Skladám e-mail…"; repPrekresli();
    const K = repKontextCyklu(), E = REP.emlPrilohy || {}, qa = repLayout(K.view, K.tema, null, { balik: "qa" }).strany.length > 0;
    const prilohy = [];
    for (const d of ["roadmapa", "qa", "pdf", "xlsx"]) if (E[d] && (d !== "qa" || qa)) prilohy.push(await repSubor(d, K));
    const sp = repEmlSprava(K);
    const eml = await vykazEml("", sp.predmet, sp.text, prilohy, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + sp.html + "</body></html>");
    downloadBlob(eml, (REP.program.kod || "report") + "_Email_" + REP.cyklus.stav_ku_dnu + ".eml");
    await repLogExport("eml", eml);
    REP.pracuje = "";
  } catch (e) { return repChyba(e, "E-mail sa nepodarilo zostaviť"); }
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
  if (REP.registre.zistenia && REP.registre.zistenia.zmenene) return alert("Register zistení má neuložené zmeny — uložte ho, potom cyklus uzavrite.");
  if (!confirm("Uzavrieť cyklus " + repDMR(REP.cyklus.stav_ku_dnu) + "? Vstupy, úsudok, register zistení a výber sa zamknú do snímky.")) return;
  try {
    await repUlozCyklus();
    const K = repKontextCyklu();
    // QA kontext bez modelu a registrov — tie sú v snímke raz
    const qa = K.qa ? Object.assign({}, K.qa, { model: undefined, ct: undefined, dep: undefined, il: undefined }) : null;
    const snimka = { schema: 3, model: K.model, view: K.view, kontroly: K.kontroly, ct: K.ct, dep: K.dep, il: K.il, qa, tema: K.tema,
      zmeny: K.zmeny, trend: K.trend, zmenyRegistrov: K.zmenyRegistrov,
      protokoly: K.protokoly, registreVerzie: K.registreVerzie,
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
    '<div class="card" style="padding:10px 12px"><b>Vyžaduje pozornosť</b>' + (poz.map(p => '<div style="padding:4px 0;border-top:1px solid var(--line)"><b>' + esc(p.kratky) + '</b> <span class="csub" style="margin:0">' + esc(p.dovod) + '</span></div>').join("") || '<div class="csub">Nič.</div>') + '</div>' +
    (K.qa ? '<div class="card" style="padding:10px 12px;margin-top:10px"><b>Dohľad kvality</b>' + K.qa.rag.map(d => '<div style="padding:4px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:8px"><span>' +
      esc(d.nazov) + (d.komentar ? '<span class="csub" style="display:block;margin:0">' + esc(d.komentar) + "</span>" : "") + "</span>" + (repRagCip(d.farba) || '<span class="csub" style="margin:0">—</span>') + "</div>").join("") + "</div>" : "");
}

// ═══ 18. QA report (kolo R2, NAVRH §6.8, §9.3) ═══════════════════
// Dimenzie RAG: návrh z dát tam, kde dáta hovoria (s dôvodom), inak len úsudok.
// Žiadna dimenzia nemá farbu natvrdo (generátor 4.0 mal Akceptáciu vždy oranžovú
// a Governance vždy červenú, G:2341).
const REP_QA_DIMENZIE = [
  { kluc: "rozsah", nazov: "Rozsah (súlad záväzkov s plánom)" },
  { kluc: "harmonogram", nazov: "Harmonogram" },
  { kluc: "rizika", nazov: "Riziká a závislosti" },
  { kluc: "akceptacia", nazov: "Akceptácia a dokumentácia" },
  { kluc: "governance", nazov: "Riadenie a zodpovednosti" } ];
const REP_RAG = { zelena: "Zelená", oranzova: "Oranžová", cervena: "Červená" };
const REP_RAG_PRAHY = { rozsahCervena: 20, rozsahOranzova: 8, harmCervenaPodiel: 0.3, harmOranzovaPodiel: 0.1, harmCervenaPct: 70, harmOranzovaPct: 85,
  rizikaCervena: 30, rizikaOranzova: 10, blokujuceOranzova: 3 };

function repRagNavrh(kluc, Q, prahy){
  const P = Object.assign({}, REP_RAG_PRAHY, prahy || {});
  if (kluc === "rozsah" && Q.ct) {
    const n = Q.ct.vNesulade;
    return { farba: n >= P.rozsahCervena ? "cervena" : n >= P.rozsahOranzova ? "oranzova" : "zelena",
      dovod: n + " záväzkov v nesúlade s plánom (spárovaných " + Q.ct.sparovane + " z " + Q.ct.zavazky.length + ")" };
  }
  if (kluc === "harmonogram" && Q.model) {
    const p = Q.model.pocty, podiel = p.drahy ? p.oneskorene / p.drahy : 0, pct = Q.model.program.pct;
    const farba = (podiel >= P.harmCervenaPodiel || pct < P.harmCervenaPct) ? "cervena" : (podiel >= P.harmOranzovaPodiel || pct < P.harmOranzovaPct) ? "oranzova" : "zelena";
    return { farba, dovod: p.oneskorene + " z " + p.drahy + " oblastí má oneskorený míľnik, postup programu " + pct + " %" };
  }
  if (kluc === "rizika" && (Q.il || Q.dep)) {
    const k = Q.il ? Q.il.kriticke : 0, b = Q.dep ? Q.dep.kpi.blokujuce : 0;
    let farba = k >= P.rizikaCervena ? "cervena" : k >= P.rizikaOranzova ? "oranzova" : "zelena";
    if (farba === "zelena" && b >= P.blokujuceOranzova) farba = "oranzova";
    return { farba, dovod: (Q.il ? k + " kritických aktívnych problémov" : "Issue Log nie je nahraný") + (Q.dep ? ", " + b + " závislostí blokuje míľnik" : "") };
  }
  return null;
}

// Čísla naratívu = výsledné hodnoty dlaždíc (aj s prepisom QA), nie druhý výpočet.
function repQaNaratiV(Q, kv){
  const m = Q.model, t = [], h = (k, v) => (kv && kv[k] != null ? kv[k] : v);
  if (Q.il) t.push("K " + repDMR(m.stavKuDnu) + " eviduje Issue Log " + h("aktivne", Q.il.aktivne) + " aktívnych problémov, z toho " + h("kriticke", Q.il.kriticke) + " kritických a " + h("eskalovane", Q.il.eskalovane) + " eskalovaných.");
  t.push(m.pocty.oneskorene + " z " + m.pocty.drahy + " oblastí má oneskorený míľnik; postup programu je " + m.program.pct + " %.");
  if (Q.ct) t.push("Z " + Q.ct.sparovane + " spárovaných záväzkov dodávateľov je " + Q.ct.vNesulade + " v nesúlade s plánom" + (Q.ct.pocty.CHYBA_V_PLANE ? " a " + Q.ct.pocty.CHYBA_V_PLANE + " v pláne chýba" : "") + ".");
  if (Q.dep && Q.dep.kpi.aktivne) t.push(Q.dep.kpi.blokujuce + " z " + Q.dep.kpi.aktivne + " aktívnych závislostí blokuje míľnik, " + Q.dep.kpi.poTermine + " je po termíne.");
  return t.join(" ");
}

// Kontext QA: všetko, z čoho sa skladajú QA snímky, XLSX aj e-mail (jedno miesto).
function repQa(vstup){
  const { model, profil, il, ilRiadky, ct, dep, zistenia, usudok, oblastIssue, oblastPopis } = vstup;
  const us = usudok || {}, prepisy = us.kpiPrepisy || {}, ragUs = us.rag || {};
  const Q = { model, il, ct, dep };
  const kpiVyp = [
    { kluc: "aktivne", popis: "Otvorené problémy", hodnota: il ? il.aktivne : null, sub: "aktívne v Issue Logu", akcent: "blue" },
    { kluc: "kriticke", popis: "Kritické", hodnota: il ? il.kriticke : null, sub: "priorita Critical", akcent: "red" },
    { kluc: "vysoke", popis: "Vysoké", hodnota: il ? il.vysoke : null, sub: "priorita High", akcent: "amber" },
    { kluc: "eskalovane", popis: "Eskalované", hodnota: il ? il.eskalovane : null, sub: il ? "stav Escalated: " + il.eskalovaneStav : "", akcent: "textSec" },
    { kluc: "oneskorene", popis: "Oneskorené oblasti", hodnota: model.pocty.oneskorene, sub: "z " + model.pocty.drahy + " s oneskoreným míľnikom", akcent: model.pocty.oneskorene ? "red" : "green" } ];
  const kpi = kpiVyp.filter(k => k.hodnota != null).map(k => {
    const p = prepisy[k.kluc];
    return p && p.hodnota !== "" && p.hodnota != null
      ? Object.assign({}, k, { hodnota: String(p.hodnota), vypocitane: k.hodnota, sub: "vypočítané " + k.hodnota + (p.dovod ? " · " + p.dovod : ""), prepis: true })
      : Object.assign({}, k, { hodnota: String(k.hodnota), vypocitane: k.hodnota, prepis: false });
  });
  const rag = (profil.qaDimenzie || REP_QA_DIMENZIE).map(d => {
    const navrh = repRagNavrh(d.kluc, Q, profil.metriky && profil.metriky.rag);
    const u = ragUs[d.kluc] || {};
    const farba = u.farba || (navrh && navrh.farba) || null;
    return { kluc: d.kluc, nazov: d.nazov, navrh, farba, komentar: u.komentar || (navrh && !u.farba ? navrh.dovod : ""),
      prebite: !!(u.farba && navrh && u.farba !== navrh.farba), zdroj: u.farba ? "usudok" : navrh ? "navrh" : "ziadny" };
  });
  const hviezdy = new Set(us.kluceOtazky || []);
  const pri = { critical: 0, high: 1, medium: 2, low: 3 };
  const zoradIssue = (a, b) => (b.aktivny === a.aktivny ? 0 : a.aktivny ? -1 : 1) || ((pri[a.prioritaKluc] ?? 9) - (pri[b.prioritaKluc] ?? 9)) || String(a.id).localeCompare(String(b.id));
  const issue = (ilRiadky || []).map(z => (oblastPopis ? Object.assign({}, z, { oblastProfil: oblastPopis(z) }) : z)).sort(zoradIssue);
  const kluceOtazky = issue.filter(z => hviezdy.has(z.kluc));
  const zist = ((zistenia && zistenia.riadky) || []).filter(z => z.stav !== "zrusene");
  const kv = Object.fromEntries(kpi.map(k => [k.kluc, k.hodnota]));
  return { kpi, rag, naratiV: us.qaNaratiV && us.qaNaratiV.text ? us.qaNaratiV.text : repQaNaratiV(Q, kv), naratiVZdroj: us.qaNaratiV && us.qaNaratiV.text ? "rucne" : "auto",
    kluceOtazky, issue, zistenia: zist, ct, dep, il, model,
    postup: model.drahy.filter(d => !d.chyba).map(d => ({ kratky: d.kratky, skupina: ((profil.skupiny || []).find(s => s.kluc === d.skupina) || {}).nazov || "",
      pct: d.pct, fazy: profil.fazy.map(f => ({ kluc: f.kluc, r: d.fazy[f.kluc] })), oneskorena: d.oneskorena,
      problemy: ilRiadky && oblastIssue ? repProblemyOblasti(ilRiadky, oblastIssue, d.kluc) : null })) };
}

function repQaSnimky(Q, vybrane){
  const s = [];
  // snímka nesie len to, čo kreslí — model je v snímke cyklu už raz
  s.push({ kluc: "qa-dashboard", typ: "qaDashboard", nazov: "QA: dohľad kvality", zahrnuta: vybrane("qa-dashboard"), qa: { kpi: Q.kpi, rag: Q.rag, naratiV: Q.naratiV } });
  if (Q.kluceOtazky.length) s.push({ kluc: "qa-otazky", typ: "qaTabulka", nazov: "QA: kľúčové otvorené otázky", zahrnuta: vybrane("qa-otazky"),
    kicker: "Dohľad kvality", nadpis: "Kľúčové otvorené otázky", tabulka: repQaTabOtazky(Q.kluceOtazky) });
  if (Q.zistenia.length) s.push({ kluc: "qa-zistenia", typ: "qaTabulka", nazov: "QA: register zistení", zahrnuta: vybrane("qa-zistenia"),
    kicker: "Dohľad kvality", nadpis: "Register zistení a odporúčaní", tabulka: repQaTabZistenia(Q.zistenia) });
  if (Q.ct) s.push({ kluc: "qa-zavazky", typ: "qaTabulka", nazov: "QA: záväzky vs. plán", zahrnuta: vybrane("qa-zavazky"),
    kicker: "Dohľad kvality", nadpis: "Záväzky dodávateľov vs. plán", sumar: ["V_SULADE", "PLAN_NESKOR", "PO_TERMINE", "DATUM_NESULAD", "CHYBA_V_PLANE"].map(k => ({ popis: REP_CT_POPIS[k], hodnota: String(Q.ct.pocty[k] || 0), akcent: k === "V_SULADE" ? "green" : k === "PO_TERMINE" ? "red" : "amber" })),
    tabulka: repQaTabZavazky(Q.ct) });
  if (Q.dep && Q.dep.kpi.aktivne) s.push({ kluc: "qa-zavislosti", typ: "qaTabulka", nazov: "QA: závislosti", zahrnuta: vybrane("qa-zavislosti"),
    kicker: "Dohľad kvality", nadpis: "Závislosti, ktoré blokujú alebo meškajú",
    sumar: [{ popis: "Aktívne", hodnota: String(Q.dep.kpi.aktivne), akcent: "blue" }, { popis: "Blokuje míľnik", hodnota: String(Q.dep.kpi.blokujuce), akcent: "red" },
      { popis: "Po termíne", hodnota: String(Q.dep.kpi.poTermine), akcent: "amber" }, { popis: "Bez prísľubu", hodnota: String(Q.dep.kpi.bezPrislubu), akcent: "textSec" }],
    tabulka: repQaTabZavislosti(Q.dep) });
  s.push({ kluc: "qa-postup", typ: "qaTabulka", nazov: "QA: postup po oblastiach", zahrnuta: vybrane("qa-postup"),
    kicker: "Dohľad kvality", nadpis: "Postup programu po oblastiach", tabulka: repQaTabPostup(Q.postup) });
  return s;
}

// Tabuľky: stĺpce s podielom šírky, bunky ako text; farba bunky voliteľne.
const REP_PRIORITA_TXT = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
function repTerminTxt(d, t){ return d ? repDMR(d) : (t || "—"); }
function repQaTabOtazky(rows){
  return { stlpce: [{ n: "ID", w: 0.1 }, { n: "Oblasť", w: 0.12 }, { n: "Popis", w: 0.42 }, { n: "Priorita", w: 0.08 }, { n: "Termín", w: 0.1 }, { n: "Stav", w: 0.1 }, { n: "Eskalované na", w: 0.08 }],
    riadky: rows.map(z => ({ b: [z.id || "—", (z.oblast || []).join(", "), z.popis || "", REP_PRIORITA_TXT[z.prioritaKluc] || z.priorita || "", repTerminTxt(z.termin, z.terminText), z.stav || "—", z.eskalacia || ""],
      farby: { 3: z.prioritaKluc === "critical" ? "red" : z.prioritaKluc === "high" ? "amber" : null } })) };
}
function repQaTabZistenia(rows){
  const sul = { nesulad: "Nesúlad", ciastocny: "Čiastočný", nedefinovane: "Nedefinované", sulad: "Súlad" };
  return { stlpce: [{ n: "ID", w: 0.06 }, { n: "Oblasť", w: 0.11 }, { n: "Zistenie", w: 0.28 }, { n: "Závažnosť", w: 0.08 }, { n: "Odporúčanie", w: 0.24 }, { n: "Termín", w: 0.08 }, { n: "Stav", w: 0.07 }, { n: "Súlad", w: 0.08 }],
    riadky: rows.map(z => ({ b: [z.id, z.oblast || "", z.zistenie || "", REP_PRIORITA_TXT[z.zavaznost] || z.zavaznost || "", z.odporucanie || "", repTerminTxt(z.termin, z.terminText),
      ({ otvorene: "Otvorené", riesi: "V riešení", uzavrete: "Uzavreté" })[z.stav] || z.stav || "", sul[z.sulad] || ""],
      farby: { 3: z.zavaznost === "critical" ? "red" : z.zavaznost === "high" ? "amber" : null, 7: z.sulad === "nesulad" ? "red" : z.sulad === "ciastocny" ? "amber" : null } })) };
}
function repQaTabZavazky(ct){
  const rows = ct.zavazky.filter(z => ["PO_TERMINE", "PLAN_NESKOR", "DATUM_NESULAD", "CHYBA_V_PLANE"].includes(z.hlavny))
    .sort((a, b) => REP_CT_PORADIE.indexOf(a.hlavny) - REP_CT_PORADIE.indexOf(b.hlavny) || String(a.kod).localeCompare(String(b.kod)));
  return { stlpce: [{ n: "Kód", w: 0.08 }, { n: "Dodávka", w: 0.2 }, { n: "Míľnik v pláne", w: 0.26 }, { n: "Záväzok", w: 0.09 }, { n: "Plán", w: 0.09 }, { n: "%", w: 0.05 }, { n: "Δ dní", w: 0.06 }, { n: "Stav", w: 0.17 }],
    riadky: rows.map(z => ({ b: [z.id, z.dodavka || z.oblastCt || "", z.uloha ? z.uloha.nazov : "—", z.commit ? repDMR(z.commit) : "—", z.uloha && z.uloha.finish ? repDMR(z.uloha.finish) : "—",
      z.uloha ? z.uloha.pct + " %" : "", z.deltaDni == null ? "" : (z.deltaDni > 0 ? "+" : "") + z.deltaDni, REP_CT_POPIS[z.hlavny] + (z.prepis ? " (ručne)" : "")],
      farby: { 7: z.hlavny === "PO_TERMINE" ? "red" : "amber" } })),
    prazdne: "Žiadny záväzok nie je v nesúlade s plánom." };
}
function repQaTabZavislosti(dep){
  const vaha = z => (z.priznaky.includes("BLOKUJE_MILNIK") ? 0 : 10) + (z.priznaky.includes("PO_TERMINE") ? 0 : 5) + ({ critical: 0, high: 1, medium: 2, low: 3 }[z.dopadKluc] ?? 4);
  const rows = dep.zavislosti.filter(z => z.aktivny !== false && (z.priznaky.includes("BLOKUJE_MILNIK") || z.priznaky.includes("PO_TERMINE") || z.priznaky.includes("RIZIKO_SKLZU"))).sort((a, b) => vaha(a) - vaha(b));
  const P = { BLOKUJE_MILNIK: "blokuje míľnik", PO_TERMINE: "po termíne", RIZIKO_SKLZU: "riziko sklzu", BEZ_PRISLUBU: "bez prísľubu", BEZ_VAZBY: "bez väzby", OSIRELA_VAZBA: "osirelá väzba" };
  return { stlpce: [{ n: "ID", w: 0.07 }, { n: "Názov", w: 0.25 }, { n: "Od → pre", w: 0.17 }, { n: "Potrebné do", w: 0.09 }, { n: "Prísľub", w: 0.09 }, { n: "Stav", w: 0.09 }, { n: "Príznaky", w: 0.24 }],
    riadky: rows.map(z => ({ b: [z.id, z.nazov || "", (z.poskytovatel || "?") + " → " + (z.prijemca || "?"), repTerminTxt(z.potrebne), repTerminTxt(z.prislub), z.stav || "", z.priznaky.map(p => P[p] || p).join(", ")],
      farby: { 6: z.priznaky.includes("BLOKUJE_MILNIK") ? "red" : "amber" } })),
    prazdne: "Žiadna aktívna závislosť neblokuje ani nemešká." };
}
// Problémy (krit.) = aktívne a započítané problémy Issue Logu priradené k oblasti
// číselníkom; stĺpec je len vtedy, keď cyklus Issue Log má.
function repProblemyOblasti(riadky, oblastIssue, kluc){
  const akt = riadky.filter(z => z.aktivny && !(z.anotacia && z.anotacia.nezapocitat) && oblastIssue(z).includes(kluc));
  return { spolu: akt.length, krit: akt.filter(z => z.prioritaKluc === "critical").length };
}
function repQaTabPostup(postup){
  const fz = postup.length ? postup[0].fazy.map(f => f.kluc) : [];
  const pr = postup.some(p => p.problemy), wPr = pr ? 0.1 : 0;
  const wF = fz.length ? Math.min(0.14, (0.5 - wPr) / fz.length) : 0;
  const iSt = 3 + fz.length + (pr ? 1 : 0);
  return { stlpce: [{ n: "Oblasť", w: 0.2 }, { n: "Skupina", w: 0.18 }, { n: "%", w: 0.07 }].concat(fz.map(k => ({ n: k, w: wF }))).concat(pr ? [{ n: "Problémy (krit.)", w: wPr }] : []).concat([{ n: "Stav", w: 1 - 0.45 - wPr - wF * fz.length }]),
    riadky: postup.map(p => ({ b: [p.kratky, p.skupina, p.pct + " %"].concat(p.fazy.map(f => !f.r ? "—" : f.r.hotove ? "✓ " + repDM(f.r.datum) : repDM(f.r.datum) + (f.r.oneskorene ? " !" : "")))
        .concat(pr ? [p.problemy ? p.problemy.spolu + " (" + p.problemy.krit + ")" : "—"] : []).concat([p.oneskorena ? "oneskorená" : p.pct >= 100 ? "dokončená" : "v pláne"]),
      farby: Object.assign({ 2: p.pct >= 70 ? "green" : p.pct >= 40 ? "blue" : "amber", [iSt]: p.oneskorena ? "red" : null },
        pr && p.problemy && p.problemy.krit ? { [3 + fz.length]: "red" } : {},
        Object.fromEntries(p.fazy.map((f, i) => [3 + i, f.r && f.r.oneskorene ? "red" : f.r && f.r.hotove ? "green" : null]))) })) };
}

// Kreslenie tabuľky: vráti index prvého nenakresleného riadku. Bunka najviac
// 3 riadky textu; výška riadku podľa najdlhšej bunky. Hlavička na každej strane.
function repKresliTabulku(A, T, x, y, w, tab, od, maxY, pt){
  pt = pt || 9;
  const lh = pt * 1.2 / 72, pad = 0.05;
  const sirky = tab.stlpce.map(s => s.w * w);
  const farba = k => k === "red" ? T.red : k === "amber" ? T.amber : k === "green" ? T.green : k === "blue" ? T.blue : null;
  const hH = lh + 2 * pad;
  A.rect(x, y, w, hH, { fill: T.tableHead });
  let cx = x;
  tab.stlpce.forEach((s, i) => { A.text(cx + 0.06, y, sirky[i] - 0.1, hH, repSkrat(s.n, sirky[i] - 0.1, pt, true, T.font), { pt, bold: true, color: T.tableHeadText }); cx += sirky[i]; });
  y += hH;
  let i = od;
  for (; i < tab.riadky.length; i++) {
    const r = tab.riadky[i];
    const bunky = r.b.map((t, j) => repZalom(String(t == null ? "" : t), sirky[j] - 0.1, pt, false, T.font, 3));
    const n = Math.max(1, ...bunky.map(b => b.length));
    const h = n * lh + 2 * pad;
    if (y + h > maxY) break;
    if ((i - od) % 2 === 1) A.rect(x, y, w, h, { fill: T.rowTint });
    cx = x;
    bunky.forEach((b, j) => {
      const c = farba((r.farby || {})[j]);
      if (b.length && b.some(Boolean)) A.text(cx + 0.06, y + pad, sirky[j] - 0.1, n * lh, b, { pt, valign: "t", color: c || T.text, bold: !!c || !!r.tucne });
      cx += sirky[j];
    });
    A.line(x, y + h, x + w, y + h, { color: T.border, lw: 0.5 });
    y += h;
  }
  if (!tab.riadky.length) A.text(x, y + 0.05, w, 0.3, tab.prazdne || "Bez záznamov.", { pt: 10, color: T.textSec });
  return i;
}

function repRagFarba(T, f){ return f === "zelena" ? T.green : f === "oranzova" ? T.amber : f === "cervena" ? T.red : T.border; }

REP_LAYOUTY.qaDashboard = function(s, view, T){
  const A = repPrvky(T), Q = s.qa;
  let y = repHlavicka(A, T, "QA report — dohľad kvality", view.nazov || "Dohľad kvality", "Stav " + repDMR(view.stavKuDnu));
  repDlazdice(A, T, Q.kpi.map(k => ({ popis: k.popis + (k.prepis ? " *" : ""), hodnota: k.hodnota, sub: k.sub, akcent: k.akcent })), y, 0.85, view.farby);
  y += 0.85 + 0.25;
  const wL = 4.6, xR = REP_L + wL + 0.3, wR = REP_CW - wL - 0.3;
  A.text(REP_L, y, wL, 0.24, "CELKOVÝ STAV", { pt: 10, bold: true, color: T.textSec });
  A.text(xR, y, wR, 0.24, "HODNOTENIE PO DIMENZIÁCH (RAG)", { pt: 10, bold: true, color: T.textSec });
  y += 0.3;
  const hP = 6.85 - y;
  A.rect(REP_L, y, wL, hP, { fill: T.panel, r: T.rounded ? 0.08 : 0 });
  const riadky = repZalom(Q.naratiV, wL - 0.4, 12, false, T.font, Math.floor((hP - 0.6) / (12 * 1.25 / 72)));
  A.text(REP_L + 0.2, y + 0.18, wL - 0.4, riadky.length * 12 * 1.25 / 72 + 0.05, riadky, { pt: 12, valign: "t", lh: 1.25 });
  if (Q.kpi.some(k => k.prepis)) A.text(REP_L + 0.2, y + hP - 0.3, wL - 0.4, 0.2, "* hodnota upravená úsudkom QA (vypočítaná je pod ňou)", { pt: 8, italic: true, color: T.textTer });
  const rh = hP / Math.max(5, Q.rag.length);
  Q.rag.forEach((d, i) => {
    const yy = y + i * rh;
    A.line(xR, yy + rh, xR + wR, yy + rh, { color: T.border, lw: 0.5 });
    A.text(xR, yy + 0.08, 2.1, 0.4, repZalom(d.nazov, 2.1, 11, true, T.font, 2), { pt: 11, bold: true, valign: "t" });
    const t = d.farba ? REP_RAG[d.farba] : "—";
    A.rect(xR + 2.2, yy + 0.1, 1.05, 0.3, { fill: repRagFarba(T, d.farba), r: 0.05 });
    A.text(xR + 2.2, yy + 0.1, 1.05, 0.3, t, { pt: 10, bold: true, color: d.farba ? T.white : T.textSec, align: "c" });
    if (d.prebite) A.text(xR + 2.2, yy + 0.42, 1.05, 0.16, "úsudok QA", { pt: 7, italic: true, color: T.textTer, align: "c" });
    const kom = repZalom(d.komentar || (d.navrh ? d.navrh.dovod : "—"), wR - 3.45, 9.5, false, T.font, Math.max(1, Math.floor((rh - 0.12) / (9.5 * 1.2 / 72))));
    A.text(xR + 3.4, yy + 0.08, wR - 3.45, rh - 0.1, kom, { pt: 9.5, valign: "t", color: T.textSec });
  });
  A.text(REP_W - REP_L - 4, 6.95, 4, 0.18, "Návrh RAG z dát; farbu a komentár potvrdzuje QA.", { pt: 7.5, italic: true, color: T.textTer, align: "r" });
  return [{ prvky: A.prvky, nadpis: s.nazov }];
};

REP_LAYOUTY.qaTabulka = function(s, view, T){
  const strany = [];
  let i = 0, n = 0;
  do {
    const A = repPrvky(T);
    let y = repHlavicka(A, T, s.kicker + (n ? " — pokračovanie" : ""), s.nadpis, "Stav " + repDMR(view.stavKuDnu));
    if (n === 0 && s.sumar) { repDlazdice(A, T, s.sumar, y, 0.7, view.farby); y += 0.7 + 0.2; }
    const dalsi = repKresliTabulku(A, T, REP_L, y, REP_CW, s.tabulka, i, 7.15, 9);
    if (dalsi === i && i < s.tabulka.riadky.length) { A.text(REP_L, y + 0.5, REP_CW, 0.3, "Riadok sa nezmestí na stranu.", { pt: 10, color: T.red }); i++; }
    else i = dalsi;
    strany.push({ prvky: A.prvky, nadpis: s.nazov + (n ? " (" + (n + 1) + ")" : "") });
    n++;
  } while (i < s.tabulka.riadky.length && n < 8);
  if (i < s.tabulka.riadky.length) strany[strany.length - 1].prvky.push({ t: "text", x: REP_L, y: 7.2, w: REP_CW, h: 0.18, s: "Nezobrazené: " + (s.tabulka.riadky.length - i) + " riadkov — celý zoznam je v XLSX.", pt: 8, italic: true, color: T.textTer, align: "l", valign: "m", font: T.font });
  return strany;
};

// ── 19. Register zistení vedený v portáli (§4.3) ──────────────────
// Dokument registra: { riadky:[…], dalsieCislo }. ID QA-nn generuje systém
// a nepoužije sa znova; zmazanie = stav „zrusene“ s dôvodom.
function repZisteniaPrazdny(){ return { schema: 1, riadky: [], dalsieCislo: 1 }; }
function repZisteniaDalsieId(doc){
  const max = doc.riadky.reduce((m, z) => { const c = String(z.id || "").match(/(\d+)\s*$/); return c ? Math.max(m, +c[1]) : m; }, 0);
  const n = Math.max(doc.dalsieCislo || 1, max + 1);
  return { id: "QA-" + String(n).padStart(2, "0"), dalsieCislo: n + 1 };
}
// Import z XLSX: pridá len zistenia s ID, ktoré register nemá. Existujúce ostanú
// tak, ako sú v portáli — import nikdy neprepíše ručnú prácu (N22).
function repZisteniaImport(doc, riadkyXlsx, kto, kedy){
  const d = JSON.parse(JSON.stringify(doc || repZisteniaPrazdny()));
  const ma = new Set(d.riadky.map(z => repNorm(z.id)));
  let pridane = 0, preskocene = 0;
  for (const r of riadkyXlsx) {
    if (!r.id || ma.has(repNorm(r.id))) { preskocene++; continue; }
    d.riadky.push({ id: r.id, oblast: r.oblast || "", zistenie: r.zistenie || "", zavaznost: r.zavaznostKluc || "", odporucanie: r.odporucanie || "",
      zodpovednost: r.zodpovednost || "", termin: r.termin || null, terminText: r.terminText || "", stav: r.stavKluc || "otvorene",
      sulad: r.suladKluc || "", suladKomentar: r.suladKomentar || "", buduce: r.buduce || "", upravil: kto || null, upravene: kedy || null, zdroj: "import" });
    ma.add(repNorm(r.id)); pridane++;
  }
  const dalsie = repZisteniaDalsieId(d); d.dalsieCislo = dalsie.dalsieCislo - 1;
  return { doc: d, pridane, preskocene };
}

// ── 20. XLSX (§9.4): dáta reportu z view-modelu a QA kontextu ─────
// Dátum ako sériové číslo Excelu (bez časového pásma, N10). Zapisovač nič
// nepočíta — číta model, view a QA kontext, z ktorých sa skladá aj PPTX.
const REP_MIME = { pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf", html: "text/html;charset=utf-8" };
function repXlsxDatum(iso){ return iso ? { t: "n", v: Math.round(repMs(iso) / REP_DEN) + 25569, z: "d.m.yyyy" } : ""; }
function repXlsxPct(p){ return p == null ? "" : { t: "n", v: p / 100, z: "0 %" }; }
const REP_XLSX_HLAVA = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1F3864" } }, alignment: { wrapText: true, vertical: "top" } };
function repXlsxHarok(X, hlavicka, riadky, sirky){
  const ws = X.utils.aoa_to_sheet([hlavicka].concat(riadky));
  hlavicka.forEach((_, c) => { const a = X.utils.encode_cell({ r: 0, c }); if (ws[a]) ws[a].s = REP_XLSX_HLAVA; });
  for (let r = 1; r <= riadky.length; r++) for (let c = 0; c < hlavicka.length; c++) {
    const a = X.utils.encode_cell({ r, c });
    if (ws[a] && ws[a].t === "s") ws[a].s = { alignment: { wrapText: true, vertical: "top" } };
  }
  ws["!cols"] = hlavicka.map((h, i) => ({ wch: (sirky && sirky[i]) || Math.min(40, Math.max(10, String(h).length + 2)) }));
  if (riadky.length) ws["!autofilter"] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: riadky.length, c: hlavicka.length - 1 } }) };
  ws["!margins"] = { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };
  return ws;
}
const REP_SULAD_TXT = { nesulad: "Nesúlad", ciastocny: "Čiastočný súlad", nedefinovane: "Nie je definované v metodike", sulad: "Súlad" };
const REP_STAV_ZIST_TXT = { otvorene: "Otvorené", riesi: "V riešení", uzavrete: "Uzavreté", zrusene: "Zrušené" };

// Hárok registra zistení v stĺpcoch šablóny — import ho prečíta späť bez úprav.
// Súlad ide ako „Nesúlad — komentár“; import ho rozdelí rovnako (§4.3).
function repZisteniaHarok(X, riadky, sDovodom){
  const hl = REP_REGISTRE.zistenia.stlpce.map(s => s.nazov).concat(sDovodom ? ["Dôvod zrušenia"] : []);
  return repXlsxHarok(X, hl, riadky.map(z => [z.id, z.oblast || "", z.zistenie || "", REP_PRIORITA_TXT[z.zavaznost] || "", z.odporucanie || "", z.zodpovednost || "",
    z.termin ? repXlsxDatum(z.termin) : (z.terminText || ""), REP_STAV_ZIST_TXT[z.stav] || "", (REP_SULAD_TXT[z.sulad] || "") + (z.suladKomentar ? " — " + z.suladKomentar : ""),
    z.buduce || ""].concat(sDovodom ? [z.dovodZrusenia || ""] : [])), [8, 20, 50, 10, 50, 20, 12, 12, 40, 40, 30]);
}

// „Na opravu pre PMO“ (§6.5, §17): chyby zdrojov zviditeľnené, nie opravené.
function repNaOpravu(K, protokoly){
  const op = (K.kontroly || []).map(k => ["Plán", k.kod, k.text]);
  for (const [d, pr] of Object.entries(protokoly || {})) {
    if (!pr) continue;
    const nm = REP_DRUHY[d] || d, dt = pr.datumy || {};
    if ((pr.duplicitneId || []).length) op.push([nm, "duplicitne-id", "Duplicitné ID: " + pr.duplicitneId.join(", ")]);
    if ((pr.chybajucePovinne || []).length) op.push([nm, "chyba-stlpec", "Chýbajú povinné stĺpce: " + pr.chybajucePovinne.join(", ")]);
    if (dt.bezRoka) op.push([nm, "datum-bez-roka", dt.bezRoka + " dátumov bez roka"]);
    if (dt.neplatne) op.push([nm, "datum-neplatny", dt.neplatne + " neplatných dátumov"]);
    if (dt.americke) op.push([nm, "datum-americky", dt.americke + " dátumov v americkom tvare M/D/RR (prečítané)"]);
    if (pr.prazdnyStav) op.push([nm, "prazdny-stav", pr.prazdnyStav + " záznamov bez stavu (rátané ako aktívne)"]);
    if ((pr.wbsAkoDatum || []).length) op.push([nm, "wbs-datum", "WBS prevedené Excelom na dátum: " + pr.wbsAkoDatum.join(", ")]);
    for (const [pole, hod] of Object.entries(pr.nezname || {})) if (hod && hod.length) op.push([nm, "nezname-hodnoty", pole + ": " + hod.join(", ")]);
  }
  if (K.ct) {
    for (const z of K.ct.zavazky.filter(z => z.hlavny === "CHYBA_V_PLANE")) op.push(["Záväzky", "chyba-v-plane", z.id + " nemá úlohu v pláne"]);
    if (K.ct.planBezZavazku.length) op.push(["Plán", "bez-zavazku", "Kód v pláne bez záväzku: " + K.ct.planBezZavazku.join(", ")]);
  }
  if (K.dep) {
    for (const o of K.dep.osireleZIssue) op.push(["Issue Log", "osirely-dep", o.issue + " odkazuje na " + o.dep + ", ktorá v Dependency Logu nie je"]);
    for (const z of K.dep.zavislosti) if ((z.osireleVazby || []).length) op.push(["Dependency Log", "osirela-vazba", z.id + ": väzba " + z.osireleVazby.join(", ") + " nie je v pláne ani v záväzkoch"]);
  }
  return op;
}

// Fázy a skupiny z modelu (nie z aktuálneho profilu) — uzavretá snímka ostane sama sebou.
function repXlsxBalik(X, K){
  const wb = X.utils.book_new(), m = K.model, Q = K.qa, fazy = m.fazy || [], view = K.view, us = K.usudok || {}, protokoly = K.protokoly || {};
  const profil = { skupiny: m.skupiny || [] };
  const pridaj = (meno, ws) => X.utils.book_append_sheet(wb, ws, meno);
  const p = [["Program", view.nazov || ""], ["Stav ku dňu", repXlsxDatum(m.stavKuDnu)], ["Cieľový termín", repXlsxDatum(m.cielovyTermin)],
    ["Postup programu", repXlsxPct(m.program.pct), m.program.metoda], ["Oblasti s oneskoreným míľnikom", m.pocty.oneskorene, "z " + m.pocty.drahy + " oblastí"]];
  if (Q) {
    p.push([], ["KPI dohľadu kvality", "Hodnota", "Poznámka"]);
    for (const k of Q.kpi) p.push([k.popis, k.prepis ? k.hodnota : +k.hodnota, k.prepis ? "vypočítané " + k.vypocitane + " — upravené úsudkom QA" : k.sub]);
    p.push([], ["Dimenzia", "RAG", "Komentár", "Návrh z dát", "Úsudok QA prebil návrh"]);
    for (const d of Q.rag) p.push([d.nazov, d.farba ? REP_RAG[d.farba] : "—", d.komentar || "", d.navrh ? REP_RAG[d.navrh.farba] + " — " + d.navrh.dovod : "len úsudok", d.prebite ? "áno" : ""]);
    p.push([], ["Celkový stav (QA)", Q.naratiV]);
  }
  pridaj("Prehľad", repXlsxHarok(X, ["Údaj", "Hodnota", "Poznámka", "", ""], p, [34, 22, 70, 50, 14]));
  const pz = (us && us.poznamky) || {};
  pridaj("Oblasti", repXlsxHarok(X, ["Skupina", "Oblasť", "Úloha v pláne", "%", "Metóda %"].concat(fazy.flatMap(f => [f.kluc + " dátum", f.kluc + " stav"])).concat(["Poznámka", "Zdroj poznámky"]),
    m.drahy.filter(d => !d.chyba).map(d => {
      const r = [((profil.skupiny || []).find(s => s.kluc === d.skupina) || {}).nazov || "", d.kratky, d.nazov, repXlsxPct(d.pct), d.pctMetoda || ""];
      for (const f of fazy) { const x = d.fazy[f.kluc]; r.push(x ? repXlsxDatum(x.datum) : "", !x ? "—" : x.hotove ? "hotové" : x.oneskorene ? "oneskorené (" + x.dniPoTermine + " d)" : "plánované"); }
      r.push(pz[d.kluc] || d.poznamka || repAutoPoznamka(d, fazy).text, pz[d.kluc] ? "ručne" : d.poznamka ? "profil" : "auto");
      return r;
    })));
  const mil = [];
  for (const d of m.drahy) if (!d.chyba) for (const f of fazy) { const x = d.fazy[f.kluc]; if (x) for (const mi of x.milniky)
    mil.push([d.kratky, f.kluc, mi.uid, mi.nazov, repXlsxDatum(mi.datum), repXlsxPct(mi.pct), mi.milnik ? "áno" : "nie", mi.pct >= 100 ? "áno" : "",
      mi.pct < 100 && mi.datum && mi.datum < m.stavKuDnu ? repDni(mi.datum, m.stavKuDnu) : ""]); }
  pridaj("Míľniky", repXlsxHarok(X, ["Oblasť", "Fáza", "UID", "Úloha", "Dátum", "%", "Míľnik v pláne", "Hotové", "Dní po termíne"], mil, [16, 8, 8, 50, 12, 8, 10, 8, 10]));
  if (Q && Q.issue.length) {
    const hv = new Set(Q.kluceOtazky.map(z => z.kluc));
    pridaj("Issue Log", repXlsxHarok(X, ["★", "ID", "Oblasť", "Kategória", "Popis", "Dopad", "Priorita", "Riešiteľ", "Cieľový dátum", "Cieľový dátum (text)", "Stav", "Aktívny", "Eskalované na", "Riešenie / akcia", "Ďalšie kroky", "Oblasť v profile", "Nezapočítané do KPI"],
      Q.issue.map(z => [hv.has(z.kluc) ? "★" : "", z.id, (z.oblast || []).join(", "), z.kategoria || "", z.popis || "", z.dopad || "", REP_PRIORITA_TXT[z.prioritaKluc] || z.priorita || "",
        z.riesitel || "", repXlsxDatum(z.termin), z.terminText || "", z.stav || "", z.aktivny ? "áno" : "nie", z.eskalacia || "", z.riesenie || "", z.dalsieKroky || "",
        z.oblastProfil || "", z.anotacia && z.anotacia.nezapocitat ? "áno — " + (z.anotacia.nezapocitat.dovod || "") : ""]),
      [4, 14, 16, 14, 60, 30, 10, 18, 12, 16, 12, 8, 16, 40, 50, 22, 30]));
  }
  if (Q) pridaj("Register zistení", repZisteniaHarok(X, Q.zistenia, false));
  if (K.ct) pridaj("Záväzky", repXlsxHarok(X, ["ID", "Dodávka", "Oblasť (tracker)", "Brána", "Záväzok", "Baseline", "Posun oproti baseline (d)", "Úloha v pláne", "UID", "Koniec v pláne", "%", "Δ dní", "Stav", "Príznaky", "Ručný prepis / dôvod"],
    K.ct.zavazky.map(z => [z.id, z.dodavka || "", z.oblastCt || "", z.brana || "", repXlsxDatum(z.commit), repXlsxDatum(z.baseline), z.posunOprotiBaseline == null ? "" : z.posunOprotiBaseline,
      z.uloha ? z.uloha.nazov : "", z.uloha ? z.uloha.uid : "", z.uloha ? repXlsxDatum(z.uloha.finish) : "", z.uloha ? repXlsxPct(z.uloha.pct) : "", z.deltaDni == null ? "" : z.deltaDni,
      REP_CT_POPIS[z.hlavny], z.priznaky.map(x => REP_CT_POPIS[x]).join(", "), z.prepis ? REP_CT_POPIS[z.prepis.stav] + " — " + z.prepis.dovod : ""]),
    [10, 30, 16, 8, 12, 12, 10, 40, 8, 12, 8, 8, 22, 30, 30]));
  if (K.dep) pridaj("Závislosti", repXlsxHarok(X, ["DEP ID", "Názov", "Typ", "Poskytovateľ", "Príjemca", "Väzba na plán", "Potrebné do", "Prisľúbené k", "Stav", "Dopad", "Príznaky", "Míľniky v pláne", "Dní do potreby"],
    K.dep.zavislosti.map(z => [z.id, z.nazov || "", z.typ || "", z.poskytovatel || "", z.prijemca || "", (z.vazba || []).join("; "), repXlsxDatum(z.potrebne), repXlsxDatum(z.prislub),
      z.stav || "", z.dopad || "", z.priznaky.join(", "), z.milniky.map(x => x.nazov + " (" + repDMR(x.finish) + ")").join("; "), z.dniDoPotreby == null ? "" : z.dniDoPotreby]),
    [10, 36, 14, 18, 18, 18, 12, 12, 12, 10, 30, 40, 10]));
  if (K.zmeny) {
    const Z = K.zmeny, rz = [];
    const riadok = (typ, x, pred, ter, dni) => rz.push([typ, x.oblast || "", x.faza || "", x.uid, x.nazov, pred, ter, dni == null ? "" : dni, x.pct == null ? "" : repXlsxPct(x.pct)]);
    for (const x of Z.novoOneskorene) riadok("Novo oneskorené", x, repXlsxDatum(x.predtym), repXlsxDatum(x.teraz), x.dni);
    for (const x of Z.posuny) riadok(x.dni > 0 ? "Posun" : "Uvoľnenie", x, repXlsxDatum(x.predtym), repXlsxDatum(x.teraz), x.dni);
    for (const x of Z.regresie) riadok("Regresia (−" + x.pokles + " b.)", x, repXlsxPct(x.pctPred), repXlsxPct(x.pct), null);
    for (const x of Z.dokoncene) riadok("Dokončené", x, "", repXlsxDatum(x.teraz), null);
    for (const x of Z.noveMilniky) riadok("Nový míľnik", x, "", repXlsxDatum(x.teraz), null);
    for (const x of Z.odobrateMilniky) riadok("Odobratý míľnik", x, repXlsxDatum(x.predtym), "", null);
    rz.push([], ["Porovnanie", "predtým k " + repDMR(Z.pred.stavKuDnu), "teraz k " + repDMR(Z.teraz.stavKuDnu), "", "Prahy: posun ≥ " + Z.prahy.posunDni + " dní, pokles ≥ " + Z.prahy.poklesBodov + " b."]);
    rz.push(["Rozsah", "úlohy " + Z.rozsah.ulohyPred + " → " + Z.rozsah.ulohyTeraz, "míľniky " + Z.rozsah.milnikyPred + " → " + Z.rozsah.milnikyTeraz, "",
      "Nové kódy: " + (Z.rozsah.kodyPridane.join(", ") || "—") + " · odobraté: " + (Z.rozsah.kodyOdobrate.join(", ") || "—")]);
    pridaj("Zmeny", repXlsxHarok(X, ["Zmena", "Oblasť", "Fáza", "UID", "Úloha", "Predtým", "Teraz", "Δ dní", "%"], rz, [18, 16, 8, 8, 50, 14, 14, 8, 8]));
  }
  if (K.trend) pridaj("Trend", repXlsxHarok(X, ["Oblasť", "Fáza"].concat(K.trend.body.map(b => "k " + repDMR(b.stavKuDnu))).concat(["Posun spolu (dni)"]),
    K.trend.riadky.map(r => [r.kratky, r.faza].concat(r.seria.map(repXlsxDatum)).concat([r.spolu]))));
  const finX = repFinancie(us.financie);
  if (finX) pridaj("Financie", repXlsxHarok(X, ["Zložka", "Suma (" + finX.mena + ")", "Podiel"],
    finX.polozky.map(p => [p.popis, p.suma, finX.sucet > 0 ? { t: "n", v: p.suma / finX.sucet, z: "0.0 %" } : ""])
      .concat([[], ["Súčet zložiek", finX.sucet, ""], [finX.popisCelku + (finX.rucny ? " (zadané ručne)" : ""), finX.celok, ""], ["Rozdiel", finX.rozdiel, ""]]), [40, 16, 10]));
  if (K.zmenyRegistrov) {
    const nm = { issue: "Issue Log", ct: "Záväzky", dep: "Závislosti" };
    pridaj("Zmeny v registroch", repXlsxHarok(X, ["Register", "ID", "Zmena", "Predtým", "Teraz", "Popis"],
      K.zmenyRegistrov.zmeny.map(z => [nm[z.reg], z.id, z.zmena, z.predtym, z.teraz, z.popis]), [12, 14, 22, 14, 14, 70]));
  }
  pridaj("Na opravu pre PMO", repXlsxHarok(X, ["Zdroj", "Kód", "Popis"], repNaOpravu(K, protokoly), [16, 18, 100]));
  return wb;
}

// Čo SheetJS nezapíše: ukotvená hlavička, tlač na šírku strany, overenie
// údajov (šablóny). Doplní sa do XML hárkov cez fflate.
function repXlsxDopln(F, u8, overenia){
  const files = F.unzipSync(u8), dec = new TextDecoder(), enc = new TextEncoder();
  for (const p of Object.keys(files).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))) {
    let sx = dec.decode(files[p]);
    sx = sx.includes("<sheetPr") ? sx.replace(/<sheetPr([^>]*)\/>/, '<sheetPr$1><pageSetUpPr fitToPage="1"/></sheetPr>') : sx.replace(/(<worksheet[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
    sx = sx.replace(/<sheetView workbookViewId="0"\/>/, '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView>');
    const dv = overenia && overenia[+p.match(/sheet(\d+)\.xml$/)[1] - 1];
    if (dv && dv.length) sx = sx.replace("<pageMargins", '<dataValidations count="' + dv.length + '">' + dv.join("") + "</dataValidations><pageMargins");
    sx = sx.replace(/(<pageMargins[^>]*\/>)/, '$1<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>');
    files[p] = enc.encode(sx);
  }
  return F.zipSync(files);
}
function repXlsxStlpec(c){ let s = ""; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }

// ── 21. Šablóny vstupov (§4.6) — z tých istých definícií ako import ─
// Stĺpce s osobnými údajmi, ktoré import predvolene vynecháva, šablóna nemá.
function repSablonaStlpce(druh, volby){
  const st = REP_REGISTRE[druh].stlpce.filter(s => !(s.osoba && s.predvolene === false));
  if (druh !== "ct") return st;
  const dod = (volby && volby.dodavatelia && volby.dodavatelia.length) ? volby.dodavatelia : ["Dodávateľ 1", "Dodávateľ 2", "Dodávateľ 3"];
  const i = st.findIndex(s => s.kluc === "baseline") + 1;
  return st.slice(0, i).concat(dod.map(d => ({ kluc: "commit", nazov: "Commit " + d, typ: "datum" }))).concat(st.slice(i));
}
const REP_SABLONA_HAROK = { issue: "Issue Log", ct: "Commitments", dep: "Dependency Log", zistenia: "Register zistení" };
function repSablonaXlsx(X, F, druh, volby){
  const def = REP_REGISTRE[druh], st = repSablonaStlpce(druh, volby);
  const brany = (volby && volby.brany && volby.brany.length) ? volby.brany : ["TEST", "E2E", "PROD"];
  const wb = X.utils.book_new();
  const ws = X.utils.aoa_to_sheet([st.map(s => s.nazov)]);
  st.forEach((s, c) => { ws[X.utils.encode_cell({ r: 0, c })].s = REP_XLSX_HLAVA; });
  ws["!cols"] = st.map(s => ({ wch: s.typ === "datum" ? 13 : /popis|zistenie|odporucanie|nazov|poznamka|dalsie|riesenie|dopad|buduce|dod$/.test(s.kluc) ? 40 : 16 }));
  ws["!margins"] = { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };
  X.utils.book_append_sheet(wb, ws, REP_SABLONA_HAROK[druh]);
  const xe = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const dv = [];
  st.forEach((s, c) => {
    const rng = repXlsxStlpec(c) + "2:" + repXlsxStlpec(c) + "2000";
    const hodnoty = s.ciselnik ? REP_CISELNIKY[s.ciselnik].map(p => p.nazov) : s.kluc === "brana" ? brany : s.kluc === "krit" ? ["Áno", "Nie"] : null;
    if (hodnoty) dv.push('<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Hodnota mimo zoznamu" error="' +
      xe(("Vyberte zo zoznamu: " + hodnoty.join(", ")).slice(0, 225)) + '" sqref="' + rng + '"><formula1>"' + xe(hodnoty.join(",")) + '"</formula1></dataValidation>');
    else if (s.typ === "datum") dv.push('<dataValidation type="date" operator="greaterThan" allowBlank="1" showErrorMessage="1" errorTitle="Dátum" error="Zadajte dátum, napríklad 30.6.2026. Text ako ASAP alebo TBD patrí do poznámky." sqref="' + rng + '"><formula1>36526</formula1></dataValidation>');
  });
  const pokyny = [[def.nazov + " — pokyny k šablóne"], [""],
    ["Hlavička je v 1. riadku. Stĺpce nepremenúvajte — import ich hľadá podľa názvu."],
    ["Povinné stĺpce: " + st.filter(s => s.povinny).map(s => s.nazov).join(", ") + "."],
    ["Stĺpce s rozbaľovacím zoznamom prijmú len hodnotu zo zoznamu. Dátumy píšte ako dátum (30.6.2026); text ako ASAP alebo TBD patrí do poznámky."],
    ["Viac hodnôt v jednej bunke (oblasti, väzby, ID) oddeľte bodkočiarkou (;)."],
    ["ID je jedinečné a po zrušení záznamu sa znova nepoužije."]];
  if (druh === "ct") pokyny.push(["Každá dodávka má jeden riadok na bránu (" + brany.join(" / ") + "). Jeden dodávateľ = jeden stĺpec Commit; prázdna bunka = dodávateľ za bránu nezodpovedá, „x“ = nedodáva, „dodané“ = splnené."]);
  if (druh === "dep") pokyny.push(["Stavy: Identifikovaná → Dohodnutá → V riešení → (Ohrozená | Blokuje) → Splnená | Zrušená. Poskytovateľ vypĺňa Prisľúbené k a Stav, PMO ostatné stĺpce; aktualizácia týždenne."]);
  if (druh === "zistenia") pokyny.push(["Register zistení sa vedie v portáli. Import pridá len zistenia s ID, ktoré register ešte nemá; existujúce záznamy neprepíše."]);
  const wp = X.utils.aoa_to_sheet(pokyny); wp["!cols"] = [{ wch: 120 }];
  X.utils.book_append_sheet(wb, wp, "Pokyny");
  return repXlsxDopln(F, new Uint8Array(X.write(wb, { type: "array", bookType: "xlsx" })), { 0: dv });
}

// ── 22. PDF z layoutu (§9.5) — ten istý obraz ako náhľad a PPTX ──
// Písmo Liberation Sans z faktura_pdf.js (metricky = Arial); pri témach
// s Calibri sa text zúži, aby sedel do rámov počítaných pre Calibri.
// Písmo je podmnožina (143 znakov: latinka, slovenská a česká diakritika, § ° € ‰)
// — nemá ani pomlčku „—“, tri bodky, typografické úvodzovky, šípky či ✓. Znak,
// ktorý písmo nemá, by v PDF ticho zmizol; preto náhrada podľa tabuľky, potom
// základné písmeno bez diakritiky, inak „?“ (vidno, že tam niečo bolo).
const REP_PDF_ZNAKY = { "—": "-", "–": "-", "…": "...", "“": "\"", "„": "\"", "”": "\"", "‘": "'", "’": "'", "‚": "'", "•": "-", "·": "-", "×": "x",
  "→": "->", "←": "<-", "↑": "^", "↓": "v", "−": "-", "≥": ">=", "≤": "<=", "⚠": "!", "✓": "OK", "√": "OK", "◆": "*", "◇": "*", "♦": "*", "○": "o", "□": "o", "▾": "-", "▼": "-", "★": "*", "Δ": "+/-",
  "\u00a0": " ", "\u202f": " ", "\u2009": " " };
function repPdfText(s, ma){
  let o = "";
  for (const c of String(s)) {
    if (!ma || ma(c)) { o += c; continue; }
    const n = REP_PDF_ZNAKY[c];
    if (n != null) { o += n; continue; }
    const z = c.normalize("NFD")[0];
    o += z !== c && ma(z) ? z : "?";
  }
  return o;
}
function repPdf(jsPDF, layout, fp){
  const doc = new jsPDF({ unit: "in", format: [layout.vyska, layout.sirka], orientation: "landscape", compress: true });
  if (!fp || !fp.registrujFont(doc)) throw new Error("písmo pre PDF sa nenačítalo — PDF by nemalo diakritiku");
  doc.setFont("LibSans", "normal");
  const cm = (((doc.internal.getFont() || {}).metadata || {}).cmap || {}).unicode;
  const ma = cm && cm.codeMap ? c => c.codePointAt(0) < 127 || !!cm.codeMap[c.codePointAt(0)] : null;
  const hs = layout.font === "Arial" ? 1 : 0.93;
  const rgb = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  layout.strany.forEach((st, i) => {
    if (i) doc.addPage([layout.vyska, layout.sirka], "landscape");
    doc.setFillColor(...rgb(layout.bg)); doc.rect(0, 0, layout.sirka, layout.vyska, "F");
    for (const p of st.prvky) {
      if (p.t === "rect") {
        if (!p.fill && !p.line) continue;
        const styl = p.fill && p.line ? "FD" : p.fill ? "F" : "S";
        if (p.fill) doc.setFillColor(...rgb(p.fill));
        if (p.line) { doc.setDrawColor(...rgb(p.line)); doc.setLineWidth((p.lw || 0.75) / 72); }
        if (p.r) doc.roundedRect(p.x, p.y, p.w, p.h, p.r, p.r, styl); else doc.rect(p.x, p.y, p.w, p.h, styl);
      } else if (p.t === "line") {
        doc.setDrawColor(...rgb(p.color)); doc.setLineWidth((p.lw || 0.75) / 72);
        if (p.dash) doc.setLineDashPattern([0.042, 0.031], 0);
        doc.line(p.x1, p.y1, p.x2, p.y2);
        if (p.dash) doc.setLineDashPattern([], 0);
      } else if (p.t === "mark") {
        doc.setFillColor(...rgb(p.fill)); doc.setDrawColor(...rgb(p.line)); doc.setLineWidth((p.lw || 1) / 72);
        const r = p.s / 2;
        if (p.tvar === "stvorec") doc.rect(p.x - r, p.y - r, p.s, p.s, "FD");
        else if (p.tvar === "kosostvorec") { const k = r * 1.15; doc.lines([[k, k], [-k, k], [-k, -k]], p.x, p.y - k, [1, 1], "FD", true); }
        else doc.circle(p.x, p.y, r, "FD");
      } else if (p.t === "kolac") {
        // výseč ako mnohouholník (oblúk po ≤ 4°), rovnaký začiatok a smer ako SVG a PPTX
        const sum = p.diely.reduce((s, d) => s + d.v, 0);
        let a = -Math.PI / 2;
        for (const d of p.diely) {
          if (!(d.v > 0)) continue;
          const da = d.v / sum * 2 * Math.PI, n = Math.max(2, Math.ceil(da / (Math.PI / 45)));
          const body = [[p.cx, p.cy]];
          for (let k = 0; k <= n; k++) body.push([p.cx + p.r * Math.cos(a + da * k / n), p.cy + p.r * Math.sin(a + da * k / n)]);
          const rel = body.slice(1).map((b, k) => [b[0] - body[k][0], b[1] - body[k][1]]);
          doc.setFillColor(...rgb(d.farba)); doc.setDrawColor(...rgb(p.okraj || layout.bg)); doc.setLineWidth(1 / 72);
          doc.lines(rel, p.cx, p.cy, [1, 1], "FD", true);
          a += da;
        }
      } else if (p.t === "text") {
        doc.setFont("LibSans", p.bold ? "bold" : "normal");
        doc.setFontSize(p.pt); doc.setTextColor(...rgb(p.color));
        const riadky = Array.isArray(p.s) ? p.s : [String(p.s)];
        const lh = (p.lh || 1.2) * p.pt / 72, blok = riadky.length * lh;
        const top = p.valign === "t" ? p.y : p.valign === "b" ? p.y + p.h - blok : p.y + (p.h - blok) / 2;
        riadky.forEach((r0, j) => {
          const r = repPdfText(r0, ma), w = doc.getTextWidth(r) * hs;
          const x = p.align === "c" ? p.x + (p.w - w) / 2 : p.align === "r" ? p.x + p.w - w : p.x;
          doc.text(r, x, top + j * lh + (lh - p.pt / 72) / 2 + 0.8 * p.pt / 72, { baseline: "alphabetic", horizontalScale: hs });
        });
      }
    }
  });
  return doc;
}

// ── 23. E-mail (§9.5): telo zo súhrnu reportu, nie vlastný výpočet ─
function repEmlSprava(K){
  const view = K.view, ex = view.snimky.find(s => s.typ === "exec"), na = view.snimky.find(s => s.typ === "najblizsie"), Q = K.qa;
  const predmet = (view.nazov || "Program") + " — stav k " + repDMR(view.stavKuDnu);
  const body = [];
  if (ex) body.push(["Stav programu", [ex.naratiV]]);
  if (K.zmeny) {
    const S = K.zmeny.sumar;
    body.push(["Od minulého reportu (" + repDMR(K.zmeny.pred.stavKuDnu) + ")", ["Postup programu: " + S.postupPred + " % → " + S.postupTeraz + " %",
      "Posunuté míľniky: " + S.posunute + (S.uvolnene ? " (uvoľnené " + S.uvolnene + ")" : ""), "Novo oneskorené: " + S.novoOneskorene, "Dokončené míľniky: " + S.dokoncene]
      .concat(K.zmeny.posuny.filter(p => p.dni > 0).slice(0, 3).map(p => p.oblast + (p.faza ? " " + p.faza : "") + ": +" + p.dni + " dní (" + repDMR(p.teraz) + ")"))]);
  }
  if (ex && ex.pozornost.length) body.push(["Vyžaduje pozornosť", ex.pozornost.slice(0, 10).map(p => p.kratky + ": " + p.dovod)]);
  if (na && na.polozky && na.polozky.length) body.push(["Najbližšie míľniky", na.polozky.slice(0, 8).map(p => repDM(p.datum) + " " + p.kratky + " — " + p.faza)]);
  if (Q) {
    body.push(["Dohľad kvality", Q.kpi.map(k => k.popis + ": " + k.hodnota + (k.prepis ? " (upravené QA)" : ""))]);
    body.push(["Hodnotenie RAG", Q.rag.map(d => d.nazov + ": " + (d.farba ? REP_RAG[d.farba] : "—") + (d.komentar ? " — " + d.komentar : ""))]);
  }
  const text = body.map(([n, r]) => n + "\n" + r.map(x => (r.length > 1 ? "• " : "") + x).join("\n")).join("\n\n") + "\n";
  const html = '<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">' + body.map(([n, r]) => "<p><b>" + repEsc(n) + "</b></p>" +
    (r.length > 1 ? "<ul>" + r.map(x => "<li>" + repEsc(x) + "</li>").join("") + "</ul>" : "<p>" + repEsc(r[0] || "") + "</p>")).join("") + "</div>";
  return { predmet, text, html };
}

// ── 24. HTML report (§9.5): strany SVG a obsah, nič viac ──────────
// Nenesie appku, registre ani plán — len to, čo je v reporte (minimalizácia).
function repHtmlReport(casti, meta){
  const css = "body{margin:0;font-family:Calibri,Carlito,Arial,sans-serif;background:#e8e6e1;color:#222}" +
    "nav{position:fixed;top:0;left:0;bottom:0;width:240px;overflow:auto;background:#fff;border-right:1px solid #ccc;padding:12px;box-sizing:border-box;font-size:13px}" +
    "nav h1{font-size:15px;margin:0 0 4px}nav p{margin:0 0 10px;color:#666}nav b{display:block;margin:10px 0 4px;color:#444}nav a{display:block;color:#1f3864;text-decoration:none;padding:2px 0}" +
    "main{margin-left:240px;padding:16px}section{max-width:1280px;margin:0 auto 18px;background:#fff;box-shadow:0 1px 4px #0003}section svg{display:block;width:100%;height:auto}" +
    "@media (max-width:800px){nav{position:static;width:auto;border:0}main{margin:0;padding:8px}}" +
    "@media print{@page{size:13.333in 7.5in;margin:0}nav{display:none}main{margin:0;padding:0}section{box-shadow:none;margin:0;break-after:page}body{background:#fff}}";
  let nav = "", telo = "", n = 0;
  for (const c of casti) {
    if (!c.layout.strany.length) continue;
    nav += "<b>" + repEsc(c.nazov) + "</b>";
    for (const st of c.layout.strany) {
      n++;
      nav += '<a href="#s' + n + '">' + repEsc(st.nadpis || st.kluc) + "</a>";
      telo += '<section id="s' + n + '">' + repSvgStrana(c.layout, st) + "</section>";
    }
  }
  return "<!doctype html><html lang=\"sk\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + repEsc((meta.nazov || "Report") + " — " + repDMR(meta.stavKuDnu)) + "</title><style>" + css + "</style></head><body>" +
    "<nav><h1>" + repEsc(meta.nazov || "Report") + "</h1><p>Stav k " + repEsc(repDMR(meta.stavKuDnu)) + (meta.koncept ? " · PRACOVNÁ VERZIA" : "") + "</p>" + nav + "</nav><main>" + telo + "</main></body></html>";
}

// ═══ 25. UI kola R2: register zistení, úsudok QA ═════════════════
function repDnes(){ return new Date().toISOString().slice(0, 10); }
function repOsobaMeno(id){ const o = ((typeof B2B !== "undefined" && B2B.d && B2B.d.osoby) || []).find(x => x.id === id); return o ? o.meno || "" : ""; }
function repMojeId(){ const o = b2bMojaOsoba(); return o ? o.id : null; }
const REP_RAG_HEX = { zelena: "1D9E75", oranzova: "BA7517", cervena: "E24B4A" };
function repRagCip(f){ return f ? '<span style="display:inline-block;padding:1px 8px;border-radius:9px;background:#' + REP_RAG_HEX[f] + ';color:#fff;font-size:12px;font-weight:600">' + esc(REP_RAG[f]) + "</span>" : ""; }

// ── Register zistení (§4.3): vedie sa v portáli, ID dáva systém, zmazanie = zrušenie s dôvodom
async function repNacitajRegister(){
  const rz = await b2bEdge("rep_register_nacitaj", { program: REP.program.id, druh: "zistenia" });
  REP.registre.zistenia = { verzia: rz.verzia || 0, obsah: rz.obsah || repZisteniaPrazdny(), zmenene: false };
}
function repZisteniaHtml(){
  const R = REP.registre.zistenia, doc = R.obsah, pis = repMozemPisat() && REP.program.stav !== "archiv" && !repJeUzky();
  const opt = (zoz, v, prazdne) => (prazdne ? '<option value="">' + prazdne + "</option>" : "") + zoz.map(p => '<option value="' + p.kluc + '"' + (p.kluc === v ? " selected" : "") + ">" + esc(p.nazov) + "</option>").join("");
  const riadky = doc.riadky.map((z, i) => ({ z, i }));
  const akt = riadky.filter(x => x.z.stav !== "zrusene"), zrus = riadky.filter(x => x.z.stav === "zrusene");
  const sumar = z => {
    const fz = z.zavaznost === "critical" ? "var(--neg)" : z.zavaznost === "high" ? "var(--warn,#b7791f)" : "var(--muted)";
    return '<b>' + esc(z.id) + '</b> <span style="color:' + fz + ';font-weight:600">' + esc(REP_PRIORITA_TXT[z.zavaznost] || "bez závažnosti") + '</span> · ' + esc(REP_STAV_ZIST_TXT[z.stav] || z.stav || "") +
      (z.oblast ? " · " + esc(z.oblast) : "") + (z.termin ? " · do " + esc(repDMR(z.termin)) : z.terminText ? " · " + esc(z.terminText) : "") +
      '<div style="margin:2px 0 0;font-weight:normal">' + esc(z.zistenie || "(bez textu)") + "</div>";
  };
  const pole = (i, k, nazov, z, typ) => '<div class="mfield" style="flex:1;min-width:' + (typ === "area" ? 260 : 160) + 'px"><label>' + nazov + "</label>" +
    (typ === "area" ? '<textarea rows="3" style="' + REP_TEXTAREA + '" onchange="repZistUprav(' + i + ",'" + k + "',this.value)\">" + esc(z[k] || "") + "</textarea>"
      : '<input' + (typ === "date" ? ' type="date"' : "") + ' value="' + esc(z[k] || "") + '" onchange="repZistUprav(' + i + ",'" + k + "',this.value)\">") + "</div>";
  const vyber = (i, k, nazov, zoz, z, prazdne) => '<div class="mfield" style="flex:1;min-width:140px"><label>' + nazov + '</label><select onchange="repZistUprav(' + i + ",'" + k + "',this.value)\">" + opt(zoz, z[k], prazdne) + "</select></div>";
  const karta = ({ z, i }) => {
    const kto = z.upravil ? repOsobaMeno(z.upravil) : "", meta = '<div class="csub" style="margin:6px 0 0">' + (z.zdroj === "import" ? "z importu · " : "") + (z.upravene ? "upravené " + esc(repDMR(String(z.upravene).slice(0, 10))) : "") + (kto ? " · " + esc(kto) : "") + "</div>";
    if (!pis) return '<div class="card" style="padding:8px 12px;margin-bottom:6px">' + sumar(z) + (z.odporucanie ? '<div class="csub" style="margin:4px 0 0">Odporúčanie: ' + esc(z.odporucanie) + "</div>" : "") + "</div>";
    return '<details class="card" style="padding:8px 12px;margin-bottom:6px"' + (REP.zistOtvorene === i ? " open" : "") + '><summary style="cursor:pointer">' + sumar(z) + "</summary>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' + pole(i, "oblast", "Oblasť", z) + vyber(i, "zavaznost", "Závažnosť", REP_CISELNIKY.priorita, z, "—") +
      vyber(i, "stav", "Stav", REP_CISELNIKY.stavZistenia.filter(p => p.kluc !== "zrusene"), z) + pole(i, "termin", "Termín", z, "date") + pole(i, "zodpovednost", "Zodpovednosť", z) + "</div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + pole(i, "zistenie", "Zistenie (QA)", z, "area") + pole(i, "odporucanie", "Odporúčanie / nápravné opatrenie", z, "area") + "</div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + vyber(i, "sulad", "Súlad s metodikou", REP_CISELNIKY.sulad, z, "—") + pole(i, "suladKomentar", "Komentár k súladu", z) + "</div>" +
      pole(i, "buduce", "Odporúčanie pre budúce projekty", z, "area") +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' + meta + '<button class="aabtn" onclick="repZistZrus(' + i + ')">Zrušiť zistenie</button></div></details>';
  };
  const hlav = '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;margin:0 2px 10px">' +
    '<div><button class="aabtn" onclick="repZistOdist()">‹ ' + esc(REP.program.nazov) + '</button> <b style="margin-left:6px">Register zistení</b> <span class="csub" style="margin:0">' +
    (R.verzia ? "verzia " + R.verzia : "zatiaľ neuložený") + '</span> <span id="repZistStav" class="csub" style="margin:0;color:var(--neg)">' + (R.zmenene ? "· neuložené zmeny" : "") + "</span></div>" +
    '<div style="display:flex;gap:6px;flex-wrap:wrap">' + (pis ? '<button class="aabtn" onclick="repZistNove()">+ Nové zistenie</button>' +
      '<label class="aabtn" style="cursor:pointer">Import z Excelu<input type="file" accept=".xlsx,.xlsm" style="display:none" onchange="repImport(\'zistenia\', this)"></label>' : "") +
    '<button class="aabtn" onclick="repZisteniaExport()">⬇ XLSX</button>' + (pis ? '<button class="aabtn pri" onclick="repZistUloz()">Uložiť</button>' : "") + "</div></div>";
  return hlav + '<div class="csub" style="margin:0 2px 8px">ID (QA-nn) dáva systém a po zrušení sa znova nepoužije. Import z Excelu pridá len zistenia s novým ID — to, čo je v portáli, neprepíše. ' +
    'Do QA reportu idú zistenia okrem zrušených; uzavretie cyklu zamkne ich stav do snímky.</div>' +
    (akt.map(karta).join("") || '<div class="aempty">Register je prázdny.</div>') +
    (zrus.length ? '<details style="margin-top:10px"><summary class="csub" style="cursor:pointer">Zrušené (' + zrus.length + ')</summary>' + zrus.map(({ z, i }) =>
      '<div class="card" style="padding:8px 12px;margin:6px 0;opacity:.6">' + sumar(z) + '<div class="csub" style="margin:4px 0 0">Dôvod zrušenia: ' + esc(z.dovodZrusenia || "") + "</div>" +
      (pis ? '<button class="aabtn" onclick="repZistObnov(' + i + ')">Obnoviť</button>' : "") + "</div>").join("") + "</details>" : "");
}
function repZistZmena(i){
  const R = REP.registre.zistenia, z = R.obsah.riadky[i];
  z.upravil = repMojeId(); z.upravene = repDnes(); R.zmenene = true; REP.zistOtvorene = i;
  const el = document.getElementById("repZistStav"); if (el) el.textContent = "· neuložené zmeny";
}
function repZistUprav(i, k, v){
  const z = REP.registre.zistenia.obsah.riadky[i];
  if (!z) return;
  v = String(v == null ? "" : v).trim();
  if (k === "termin") { z.termin = repDatum(v) || null; if (z.termin) z.terminText = ""; }
  else z[k] = v;
  repZistZmena(i);
}
function repZistNove(){
  const R = REP.registre.zistenia, d = repZisteniaDalsieId(R.obsah);
  R.obsah.riadky.push({ id: d.id, oblast: "", zistenie: "", zavaznost: "medium", odporucanie: "", zodpovednost: "", termin: null, terminText: "", stav: "otvorene",
    sulad: "", suladKomentar: "", buduce: "", zdroj: "portal" });
  R.obsah.dalsieCislo = d.dalsieCislo;
  repZistZmena(R.obsah.riadky.length - 1);
  repPrekresli();
}
function repZistZrus(i){
  const z = REP.registre.zistenia.obsah.riadky[i];
  const dovod = prompt("Dôvod zrušenia zistenia " + z.id + " (ostane v histórii registra, ID sa znova nepoužije):", "");
  if (!dovod || !dovod.trim()) return;
  z.stav = "zrusene"; z.dovodZrusenia = dovod.trim();
  repZistZmena(i); REP.zistOtvorene = null; repPrekresli();
}
function repZistObnov(i){
  const z = REP.registre.zistenia.obsah.riadky[i];
  z.stav = "otvorene"; delete z.dovodZrusenia;
  repZistZmena(i); repPrekresli();
}
async function repZistUloz(){
  const R = REP.registre.zistenia;
  try {
    REP.pracuje = "Ukladám register zistení…"; repPrekresli();
    const d = await b2bEdge("rep_register_uloz", { program: REP.program.id, druh: "zistenia", verzia: R.verzia, obsah: R.obsah });
    R.verzia = d.verzia; R.zmenene = false; REP.pracuje = "";
  } catch (e) {
    if (e.stav === 409) { REP.pracuje = ""; alert("Register medzitým uložil niekto iný. Načítam aktuálny stav — vaše neuložené úpravy treba zopakovať."); try { await repNacitajRegister(); } catch (e2) { repChyba(e2, "Register sa nepodarilo načítať"); return false; } repPrekresli(); return false; }
    repChyba(e, "Register sa nepodarilo uložiť"); return false;
  }
  repPrekresli();
  return true;
}
async function repZistOdist(){
  const R = REP.registre.zistenia;
  if (R.zmenene) {
    if (!confirm("Register má neuložené zmeny. Odísť bez uloženia?")) return;
    try { await repNacitajRegister(); } catch (e) { return repChyba(e, "Register sa nepodarilo načítať"); }
  }
  REP.zistOtvorene = null; REP.pohlad = "program"; repPrekresli();
}
// Import zistení z XLSX: zlúčenie do registra a uloženie (repZisteniaImport, N22).
async function repZisteniaZXlsx(r){
  const R = REP.registre.zistenia;
  if (R.zmenene) { REP.pracuje = ""; repPrekresli(); return alert("Register má neuložené zmeny — najprv ich uložte, potom importujte."); }
  const v = repZisteniaImport(R.obsah, r.riadky, repMojeId(), repDnes());
  REP.pohlad = "zistenia";
  if (!v.pridane) { REP.pracuje = ""; repPrekresli(); return alert("Žiadne nové zistenie — všetky ID zo súboru (" + v.preskocene + ") už register má alebo riadok nemá ID. Import existujúce záznamy neprepisuje."); }
  R.obsah = v.doc; R.zmenene = true;
  if (await repZistUloz()) alert("Pridané zistenia: " + v.pridane + (v.preskocene ? ". Preskočené (ID už v registri alebo bez ID): " + v.preskocene : "") + ".");
}
async function repZisteniaExport(){
  try {
    const X = await ensureXlsxStyle(), F = await ensureFflate(), wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, repZisteniaHarok(X, REP.registre.zistenia.obsah.riadky, true), "Register zistení");
    downloadBlob(new Blob([repXlsxDopln(F, new Uint8Array(X.write(wb, { type: "array", bookType: "xlsx" })))], { type: REP_MIME.xlsx }),
      (REP.program.kod || "program") + "_RegisterZisteni_" + repDnes() + ".xlsx");
  } catch (e) { repChyba(e, "Export registra sa nepodaril"); }
}

// ── Prenos úsudku do nového cyklu (§6.8): ★, RAG, poznámky, výber ─
function repPrenesUsudok(po, z){
  const u = po.usudok || {}, o = {}, us = {};
  if ((u.kluceOtazky || []).length) us.kluceOtazky = u.kluceOtazky.slice();
  if (u.rag && Object.keys(u.rag).length) us.rag = JSON.parse(JSON.stringify(u.rag));
  if (u.poznamky && Object.keys(u.poznamky).length) us.poznamky = Object.assign({}, u.poznamky);
  if (u.financie && (u.financie.polozky || []).length) us.financie = JSON.parse(JSON.stringify(u.financie));
  if (Object.keys(us).length) { us.prenesene = { z }; o.usudok = us; }
  if (po.vyber && Object.keys(po.vyber).length) o.vyber = JSON.parse(JSON.stringify(po.vyber));
  if (po.tema) o.tema = po.tema;
  return o;
}
// Porovnanie nového cyklu = vstupy predošlého cyklu k jeho stavu ku dňu; trend
// pokračuje bodmi predošlého cyklu (najviac 7 starších bodov + tento cyklus).
function repPrenesPorovnanie(po, pred){
  const V = po.vstupy || {};
  if (!V.plan) return {};
  const popis = "cyklus k " + repDMR(pred.stav_ku_dnu);
  const body = (((po.trend || {}).body) || []).concat([{ plan: V.plan, stavKuDnu: pred.stav_ku_dnu, popis }]);
  const videne = new Set(), uniq = [];
  for (const b of body) { const k = b.plan + "|" + b.stavKuDnu; if (!videne.has(k)) { videne.add(k); uniq.push(b); } }
  return { porovnanie: { plan: V.plan, stavKuDnu: pred.stav_ku_dnu, popis, issue: V.issue || null, ct: V.ct || null, dep: V.dep || null, cyklus: pred.id },
    trend: { body: uniq.slice(-7) } };
}
function repUsudok(){ return REP.cyklusObsah.usudok = REP.cyklusObsah.usudok || {}; }
function repPreneseneOverene(){ delete repUsudok().prenesene; repPrekresli(); }
function repRagNastav(kluc, pole, v){
  const u = repUsudok(); u.rag = u.rag || {};
  const r = u.rag[kluc] = u.rag[kluc] || {};
  v = String(v || "").trim();
  if (pole === "komentar" && r.zdrojKomentara) { if (v) r.zdrojKomentara = repZdrojPoUprave(r.zdrojKomentara); else delete r.zdrojKomentara; }
  if (v) r[pole] = v; else delete r[pole];
  if (!Object.keys(r).length) delete u.rag[kluc];
  repPrekresli();
}
function repKpiPrepis(kluc, pole, v){
  const u = repUsudok(); u.kpiPrepisy = u.kpiPrepisy || {};
  const p = u.kpiPrepisy[kluc] = u.kpiPrepisy[kluc] || {};
  p[pole] = String(v || "").trim();
  if (!p.hodnota) delete u.kpiPrepisy[kluc];
  repPrekresli();
}
function repNastavQaNaratiV(text){ const u = repUsudok(); u.qaNaratiV = text.trim() ? { text: text.trim(), zdroj: repZdrojPoUprave(u.qaNaratiV && u.qaNaratiV.zdroj) } : null; }
function repHviezda(kluc, zap){
  const u = repUsudok(), s = new Set(u.kluceOtazky || []);
  if (zap) s.add(kluc); else s.delete(kluc);
  u.kluceOtazky = [...s];
  const el = document.getElementById("repHviezdyPocet"); if (el) el.textContent = String(s.size);
}

// Úsudok QA (§6.8): návrh z dát s dôvodom, rozhoduje QA; prepis KPI vždy s dôvodom.
function repKrokUsudokQa(K){
  const Q = K.qa;
  if (!Q) return '<div class="card" style="padding:10px 14px"><b>Dohľad kvality (QA)</b><div class="csub" style="margin:2px 0 0">QA hodnotenie sa ponúkne, keď cyklus má Issue Log, záväzky alebo závislosti, alebo keď register zistení nie je prázdny.</div></div>';
  const us = REP.cyklusObsah.usudok || {}, ragUs = us.rag || {}, kp = us.kpiPrepisy || {};
  const rag = Q.rag.map(d => {
    const u = ragUs[d.kluc] || {}, bezDovodu = u.farba && d.navrh && u.farba !== d.navrh.farba && !u.komentar;
    return '<tr style="border-top:1px solid var(--line)"><td style="padding:6px 6px 6px 0;vertical-align:top"><b>' + esc(d.nazov) + '</b><div class="csub" style="margin:2px 0 0">' +
      (d.navrh ? "návrh z dát: " + repRagCip(d.navrh.farba) + " " + esc(d.navrh.dovod) : "dáta nehovoria — len úsudok QA") + "</div></td>" +
      '<td style="vertical-align:top;padding-top:6px"><select onchange="repRagNastav(\'' + d.kluc + '\',\'farba\',this.value)"><option value="">' + (d.navrh ? "podľa návrhu" : "—") + "</option>" +
      Object.keys(REP_RAG).map(k => '<option value="' + k + '"' + (u.farba === k ? " selected" : "") + ">" + REP_RAG[k] + "</option>").join("") + "</select></td>" +
      '<td style="width:45%;vertical-align:top;padding-top:6px"><input value="' + esc(u.komentar || "") + '" placeholder="' + esc(d.navrh && !u.farba ? d.navrh.dovod : "komentár QA") + '" style="width:100%" onchange="repRagNastav(\'' + d.kluc + '\',\'komentar\',this.value)">' +
      (bezDovodu ? '<div style="color:var(--neg);font-size:12px">Farba sa líši od návrhu — napíšte dôvod.</div>' : "") +
      (u.zdrojKomentara ? '<div class="csub" style="margin:0">' + esc(REP_ZDROJ_TXT[u.zdrojKomentara] || "") + "</div>" : "") + "</td></tr>";
  }).join("");
  const kpi = Q.kpi.map(k => {
    const p = kp[k.kluc] || {};
    return '<tr style="border-top:1px solid var(--line)"><td style="padding:4px 6px 4px 0">' + esc(k.popis) + '</td><td style="text-align:right;padding-right:10px"><b>' + esc(String(k.vypocitane)) + "</b></td>" +
      '<td><input style="width:80px" value="' + esc(p.hodnota || "") + '" placeholder="' + esc(String(k.vypocitane)) + '" onchange="repKpiPrepis(\'' + k.kluc + '\',\'hodnota\',this.value)"></td>' +
      '<td style="width:50%"><input style="width:100%" value="' + esc(p.dovod || "") + '" placeholder="dôvod prepisu" onchange="repKpiPrepis(\'' + k.kluc + '\',\'dovod\',this.value)">' +
      (p.hodnota && !p.dovod ? '<div style="color:var(--neg);font-size:12px">Prepis bez dôvodu — doplňte ho.</div>' : "") + "</td></tr>";
  }).join("");
  const auto = repQaNaratiV(Object.assign({}, Q, { model: K.model, il: K.il, ct: K.ct, dep: K.dep }), Object.fromEntries(Q.kpi.map(k => [k.kluc, k.hodnota])));
  const hv = new Set(us.kluceOtazky || []);
  const kandidati = Q.issue.filter(z => z.aktivny || hv.has(z.kluc));
  // „nezapočítať“ (anotácia programu, R4): problém ostane v registri, KPI ho nerátajú
  const pisA = repMozemPisat();
  const otazky = kandidati.map(z => { const nz = z.anotacia && z.anotacia.nezapocitat;
    return '<div style="display:flex;gap:6px;align-items:flex-start;justify-content:space-between;padding:3px 0;border-top:1px solid var(--line)"><label style="display:flex;gap:6px;align-items:flex-start;margin:0"><input type="checkbox"' + (hv.has(z.kluc) ? " checked" : "") +
    ' onchange="repHviezda(\'' + esc(z.kluc) + '\', this.checked)"><span><b>' + esc(z.id) + "</b> " + esc(REP_PRIORITA_TXT[z.prioritaKluc] || z.priorita || "") + (z.aktivny ? "" : " · uzavretý") +
    (nz ? ' · <span style="color:var(--warn,#b7791f)">nezapočítaný: ' + esc(nz.dovod || "") + "</span>" : "") +
    ' <span class="csub" style="margin:0">' + esc(String(z.popis || "").slice(0, 160)) + "</span></span></label>" +
    (pisA && (z.aktivny || nz) ? '<button class="aabtn" style="white-space:nowrap" onclick="repIssueNezapocitat(\'' + esc(z.kluc) + "', " + (nz ? "false" : "true") + ')">' + (nz ? "Započítať" : "Nezapočítať") + "</button>" : "") + "</div>"; }).join("");
  return '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Hodnotenie QA (RAG)</b><div class="csub" style="margin:2px 0 6px">Návrh farby je z dát a s dôvodom; kde dáta nehovoria, rozhoduje len QA. Farba iná než návrh potrebuje komentár — vo výstupe je označená „úsudok QA“.</div>' +
    '<table style="width:100%;border-collapse:collapse">' + rag + "</table></div>" +
    '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Celkový stav (QA)</b>' + (us.qaNaratiV && us.qaNaratiV.zdroj && us.qaNaratiV.zdroj !== "rucne" ? ' <span class="csub" style="margin:0">· ' + esc(REP_ZDROJ_TXT[us.qaNaratiV.zdroj] || "") + "</span>" : "") +
    '<div class="csub" style="margin:2px 0 6px">Prázdne pole = automatický text z výsledných hodnôt dlaždíc.</div>' +
    '<textarea rows="4" style="' + REP_TEXTAREA + '" placeholder="' + esc(auto) + '" onchange="repNastavQaNaratiV(this.value)">' + esc(us.qaNaratiV && us.qaNaratiV.text || "") + "</textarea></div>" +
    '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>KPI dohľadu kvality</b><div class="csub" style="margin:2px 0 6px">Vypočítanú hodnotu môže QA prepísať len s dôvodom; výstup ukáže prepis s hviezdičkou a vypočítanú hodnotu pod ním.</div>' +
    '<table style="width:100%;border-collapse:collapse"><tr class="csub"><th style="text-align:left">KPI</th><th>Vypočítané</th><th style="text-align:left">Prepis</th><th style="text-align:left">Dôvod</th></tr>' + kpi + "</table></div>" +
    '<div class="card" style="padding:10px 14px"><b>Kľúčové otvorené otázky (★)</b> <span class="csub" style="margin:0">vybraných <span id="repHviezdyPocet">' + hv.size + "</span></span>" +
    '<div class="csub" style="margin:2px 0 6px">Označené problémy z Issue Logu idú na stranu „Kľúčové otvorené otázky“. Výber sa prenáša do ďalšieho cyklu.</div>' +
    '<div data-scroll style="max-height:360px;overflow:auto">' + (otazky || '<div class="csub">Issue Log nemá aktívne problémy.</div>') + "</div></div>";
}

// ═══ 26. Zmeny, trend a financie (kolo R3a; NAVRH §6.7, §6.8, §9.2) ═══
// Porovnanie dvoch snímok plánu je po UID (premenovanie úlohu neodpojí, N2).
// „Novo oneskorené“ = po termíne k stavu tejto snímky a NIE po termíne k stavu
// predošlej (generátor 4.0 porovnával predošlý termín s dnešným stavom, N12).
const REP_ZMENY_PRAHY = { posunDni: 7, poklesBodov: 10 };

function repOblastUloh(plan, profil){
  const strom = repStrom(plan), korene = new Map(), mapa = new Map();
  for (const ob of profil.oblasti || []) for (const uid of ob.uids || []) korene.set(uid, ob);
  for (const u of plan.ulohy) {
    let x = u.uid, ob = null;
    while (x != null && !ob) { ob = korene.get(x) || null; x = strom.rodic.get(x); }
    if (ob) mapa.set(u.uid, ob);
  }
  return mapa;
}
function repFazaUlohy(u, profil){ const f = (profil.fazy || []).find(f => repFazaZhoda(u, f)); return f ? f.kluc : ""; }

// pred/teraz: { plan, stavKuDnu, model, popis? }
function repZmeny(pred, teraz, profil, volby){
  const pr = Object.assign({}, REP_ZMENY_PRAHY, (profil.metriky && profil.metriky.zmeny) || {}, volby || {});
  const P = new Map(pred.plan.ulohy.map(u => [u.uid, u])), N = new Map(teraz.plan.ulohy.map(u => [u.uid, u]));
  const obN = repOblastUloh(teraz.plan, profil), obP = repOblastUloh(pred.plan, profil);
  const meno = (u, mapa) => { const o = mapa.get(u.uid); return o ? (o.kratky || repKratky(o.nazov)) : ""; };
  const jeMilnik = u => !u.suhrn && (!!u.milnik || !!repFazaUlohy(u, profil));
  const poTermine = (u, stav) => !!(u && u.finish && u.pct < 100 && stav && u.finish < stav);
  const posuny = [], novoOneskorene = [], dokoncene = [], regresie = [], noveMilniky = [], odobrateMilniky = [];
  for (const u of teraz.plan.ulohy) {
    const p = P.get(u.uid), mil = jeMilnik(u);
    const z = { uid: u.uid, nazov: u.nazov, oblast: meno(u, obN), faza: repFazaUlohy(u, profil), teraz: u.finish || null, pct: u.pct };
    if (mil) {
      if (!p) {
        noveMilniky.push(z);
        if (poTermine(u, teraz.stavKuDnu)) novoOneskorene.push(Object.assign({ predtym: null, dni: null, novy: true }, z));
      } else {
        const dd = p.finish && u.finish ? repDni(p.finish, u.finish) : null;
        if (dd != null && Math.abs(dd) >= pr.posunDni) posuny.push(Object.assign({ predtym: p.finish, dni: dd, hotove: u.pct >= 100, poTermine: poTermine(u, teraz.stavKuDnu) }, z));
        if (p.pct < 100 && u.pct >= 100) dokoncene.push(z);
        if (poTermine(u, teraz.stavKuDnu) && !poTermine(p, pred.stavKuDnu)) novoOneskorene.push(Object.assign({ predtym: p.finish, dni: dd }, z));
      }
    }
    if (p && (u.suhrn || mil) && p.pct - u.pct >= pr.poklesBodov) regresie.push(Object.assign({ pctPred: p.pct, pokles: p.pct - u.pct }, z));
  }
  for (const p of pred.plan.ulohy) if (!N.has(p.uid) && jeMilnik(p)) odobrateMilniky.push({ uid: p.uid, nazov: p.nazov, oblast: meno(p, obP), faza: repFazaUlohy(p, profil), predtym: p.finish || null });
  const pole = profil.polia && profil.polia.kodZavazku;
  const kody = plan => { const s = new Set(); if (pole) for (const u of plan.ulohy) for (const t of repTokeny(u.polia[pole])) { const k = repKanonKod(t); if (k && !/^N\/?A$/.test(k)) s.add(k); } return s; };
  const kP = kody(pred.plan), kN = kody(teraz.plan);
  const rozsah = { ulohyPred: pred.plan.ulohy.length, ulohyTeraz: teraz.plan.ulohy.length,
    pridane: teraz.plan.ulohy.filter(u => !P.has(u.uid)).length, odobrate: pred.plan.ulohy.filter(u => !N.has(u.uid)).length,
    milnikyPred: pred.plan.ulohy.filter(jeMilnik).length, milnikyTeraz: teraz.plan.ulohy.filter(jeMilnik).length,
    noveMilniky: noveMilniky.length, odobrateMilniky: odobrateMilniky.length,
    kodyPridane: [...kN].filter(k => !kP.has(k)).sort(), kodyOdobrate: [...kP].filter(k => !kN.has(k)).sort() };
  const fazy = profil.fazy || [], posl = fazy.length ? fazy[fazy.length - 1].kluc : null;
  const mP = new Map(pred.model.drahy.filter(d => !d.chyba).map(d => [d.kluc, d]));
  const oblasti = [];
  for (const d of teraz.model.drahy.filter(d => !d.chyba)) {
    const p = mP.get(d.kluc);
    if (!p) continue;
    const rn = posl && d.fazy[posl], rp = posl && p.fazy[posl];
    oblasti.push({ kluc: d.kluc, kratky: d.kratky, pctPred: p.pct, pctTeraz: d.pct, delta: d.pct - p.pct,
      poslednaPred: rp ? rp.datum : null, poslednaTeraz: rn ? rn.datum : null,
      posunPoslednej: rp && rn && rp.datum && rn.datum ? repDni(rp.datum, rn.datum) : null, dokoncena: p.pct < 100 && d.pct >= 100 });
  }
  oblasti.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.kratky.localeCompare(b.kratky));
  posuny.sort((a, b) => Math.abs(b.dni) - Math.abs(a.dni) || String(a.oblast).localeCompare(String(b.oblast)) || a.uid - b.uid);
  novoOneskorene.sort((a, b) => String(a.teraz).localeCompare(String(b.teraz)) || a.uid - b.uid);
  regresie.sort((a, b) => b.pokles - a.pokles || a.uid - b.uid);
  dokoncene.sort((a, b) => String(a.teraz).localeCompare(String(b.teraz)) || a.uid - b.uid);
  return { pred: { stavKuDnu: pred.stavKuDnu, popis: pred.popis || "" }, teraz: { stavKuDnu: teraz.stavKuDnu }, prahy: pr,
    posuny, novoOneskorene, dokoncene, regresie, noveMilniky, odobrateMilniky, rozsah, oblasti,
    sumar: { posunute: posuny.filter(x => x.dni > 0).length, uvolnene: posuny.filter(x => x.dni < 0).length, novoOneskorene: novoOneskorene.length,
      dokoncene: dokoncene.length, regresie: regresie.length, postupPred: pred.model.program.pct, postupTeraz: teraz.model.program.pct,
      oblastiHore: oblasti.filter(o => o.delta > 0).length, oblastiDole: oblasti.filter(o => o.delta < 0).length } };
}

// Trend (§6.7): séria reprezentantov oblasť × fáza cez body zoradené podľa
// stavu ku dňu, nie podľa popisu (G:5517). Posledný bod je tento cyklus.
function repTrend(body, profil){
  const B = body.slice().sort((a, b) => (a.stavKuDnu < b.stavKuDnu ? -1 : a.stavKuDnu > b.stavKuDnu ? 1 : 0));
  if (B.length < 2) return null;
  const fazy = profil.fazy || [], mapy = B.map(b => new Map(b.model.drahy.filter(d => !d.chyba).map(d => [d.kluc, d])));
  const riadky = [];
  for (const d of B[B.length - 1].model.drahy.filter(d => !d.chyba)) for (const f of fazy) {
    const seria = mapy.map(m => { const x = m.get(d.kluc), r = x && x.fazy[f.kluc]; return r && r.datum ? r.datum : null; });
    const idx = seria.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
    if (idx.length < 2) continue;
    const kroky = []; let prev = null;
    for (const v of seria) { if (!v) { kroky.push(null); continue; } kroky.push(prev ? repDni(prev, v) : 0); prev = v; }
    const r = d.fazy[f.kluc];
    riadky.push({ kluc: d.kluc, kratky: d.kratky, faza: f.kluc, seria, kroky, spolu: repDni(seria[idx[0]], seria[idx[idx.length - 1]]),
      hotove: !!(r && r.hotove), oneskorene: !!(r && r.oneskorene) });
  }
  riadky.sort((a, b) => Math.abs(b.spolu) - Math.abs(a.spolu) || a.kratky.localeCompare(b.kratky) || a.faza.localeCompare(b.faza));
  return { body: B.map(b => ({ stavKuDnu: b.stavKuDnu, popis: b.popis || "" })), riadky, posunute: riadky.filter(r => r.spolu !== 0).length };
}

// Zmeny v registroch medzi dvoma importmi (§6.7, QA balík). Identita = ID záznamu.
function repZmenyRegistrov(pred, teraz){
  const z = [], txt = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  // identita = kluc importu (duplicitné ID dostanú „#2“), inak by sa prvý riadok
  // porovnal s posledným a vznikli by zmeny, ktoré neexistujú
  const id = r => r.kluc || repNorm(r.id);
  if (pred.issue && teraz.issue) {
    const P = new Map(pred.issue.filter(r => r.id).map(r => [id(r), r])), N = new Set(teraz.issue.filter(r => r.id).map(id));
    const vaha = { critical: 0, high: 1, medium: 2, low: 3 };
    for (const r of teraz.issue) {
      if (!r.id) continue;
      const p = P.get(id(r)), popis = txt(r.popis).slice(0, 140), v = vaha[r.prioritaKluc] ?? 4;
      if (!p) { if (r.aktivny) z.push({ reg: "issue", id: r.id, druh: "nove", zmena: "Nový problém", predtym: "", teraz: REP_PRIORITA_TXT[r.prioritaKluc] || r.priorita || "", popis, vaha: v }); continue; }
      if (p.aktivny && !r.aktivny) z.push({ reg: "issue", id: r.id, druh: "uzavrete", zmena: "Uzavretý", predtym: p.stav || "", teraz: r.stav || "", popis, vaha: 10 + v });
      else if (!p.aktivny && r.aktivny) z.push({ reg: "issue", id: r.id, druh: "znovu", zmena: "Znova otvorený", predtym: p.stav || "", teraz: r.stav || "", popis, vaha: v });
      if (r.aktivny && p.prioritaKluc && r.prioritaKluc && p.prioritaKluc !== r.prioritaKluc)
        z.push({ reg: "issue", id: r.id, druh: "priorita", zmena: (vaha[r.prioritaKluc] < vaha[p.prioritaKluc] ? "Vyššia" : "Nižšia") + " priorita", predtym: REP_PRIORITA_TXT[p.prioritaKluc], teraz: REP_PRIORITA_TXT[r.prioritaKluc], popis, vaha: v + 1 });
      if (r.aktivny && p.termin && r.termin && p.termin !== r.termin) {
        const d = repDni(p.termin, r.termin);
        z.push({ reg: "issue", id: r.id, druh: "termin", zmena: "Termín " + (d > 0 ? "+" : "") + d + " d", predtym: repDMR(p.termin), teraz: repDMR(r.termin), popis, vaha: v + 2, dni: d });
      }
    }
    for (const p of pred.issue) if (p.id && p.aktivny && !N.has(id(p))) z.push({ reg: "issue", id: p.id, druh: "zmiznute", zmena: "Chýba v novom importe", predtym: p.stav || "", teraz: "", popis: txt(p.popis).slice(0, 140), vaha: 5 });
  }
  if (pred.ct && teraz.ct) {
    const P = new Map(pred.ct.filter(r => r.kod).map(r => [r.kod, r])), N = new Set(teraz.ct.filter(r => r.kod).map(r => r.kod));
    for (const r of teraz.ct) {
      if (!r.kod) continue;
      const p = P.get(r.kod), popis = txt(r.dodavka || r.oblast).slice(0, 100);
      if (!p) { z.push({ reg: "ct", id: r.id, druh: "nove", zmena: "Nový záväzok", predtym: "", teraz: r.commit ? repDMR(r.commit) : "bez dátumu", popis, vaha: 6 }); continue; }
      if (!p.dodane && r.dodane) z.push({ reg: "ct", id: r.id, druh: "dodane", zmena: "Dodané", predtym: p.commit ? repDMR(p.commit) : "", teraz: "dodané", popis, vaha: 12 });
      if (p.commit && r.commit && p.commit !== r.commit) { const d = repDni(p.commit, r.commit); z.push({ reg: "ct", id: r.id, druh: "termin", zmena: "Záväzok " + (d > 0 ? "+" : "") + d + " d", predtym: repDMR(p.commit), teraz: repDMR(r.commit), popis, vaha: d > 0 ? 3 : 8, dni: d }); }
      else if (p.commit && !r.commit) z.push({ reg: "ct", id: r.id, druh: "bez", zmena: "Dátum záväzku zmizol", predtym: repDMR(p.commit), teraz: "", popis, vaha: 4 });
    }
    for (const p of pred.ct) if (p.kod && !N.has(p.kod)) z.push({ reg: "ct", id: p.id, druh: "zmiznute", zmena: "Chýba v novom importe", predtym: p.commit ? repDMR(p.commit) : "", teraz: "", popis: txt(p.dodavka || p.oblast).slice(0, 100), vaha: 7 });
  }
  if (pred.dep && teraz.dep) {
    const P = new Map(pred.dep.filter(r => r.id).map(r => [id(r), r]));
    for (const r of teraz.dep) {
      if (!r.id) continue;
      const p = P.get(id(r)), popis = txt(r.nazov).slice(0, 100);
      if (!p) { if (r.aktivny !== false) z.push({ reg: "dep", id: r.id, druh: "nove", zmena: "Nová závislosť", predtym: "", teraz: r.stav || "", popis, vaha: 6 }); continue; }
      if (p.stavKluc !== r.stavKluc) z.push({ reg: "dep", id: r.id, druh: "stav", zmena: "Stav", predtym: p.stav || "", teraz: r.stav || "", popis, vaha: r.stavKluc === "blokuje" || r.stavKluc === "ohrozena" ? 0 : 9 });
      if (p.prislub && r.prislub && p.prislub !== r.prislub) { const d = repDni(p.prislub, r.prislub); z.push({ reg: "dep", id: r.id, druh: "termin", zmena: "Prísľub " + (d > 0 ? "+" : "") + d + " d", predtym: repDMR(p.prislub), teraz: repDMR(r.prislub), popis, vaha: d > 0 ? 2 : 8, dni: d }); }
    }
  }
  z.sort((a, b) => a.vaha - b.vaha || String(a.reg).localeCompare(String(b.reg)) || String(a.id).localeCompare(String(b.id)));
  const pocet = (reg, druh) => z.filter(x => x.reg === reg && (!druh || x.druh === druh)).length;
  return { zmeny: z, sumar: { noveIssue: pocet("issue", "nove"), uzavrete: pocet("issue", "uzavrete"), znovu: pocet("issue", "znovu"), priorita: pocet("issue", "priorita"),
    terminIssue: pocet("issue", "termin"), zavazky: pocet("ct"), zavislosti: pocet("dep") }, porovnane: { issue: !!(pred.issue && teraz.issue), ct: !!(pred.ct && teraz.ct), dep: !!(pred.dep && teraz.dep) } };
}

// Financie (§6.8, D8): zložky z úsudku cyklu, celok súčtom alebo ručne,
// rozdiel svieti. V kóde žiadne predvolené sumy.
const REP_FIN_PALETA = ["1F3864", "2E75B6", "70AD47", "FFC000", "C00000", "7030A0", "00B0F0", "A5A5A5"];
function repFinancie(f){
  if (!f || !(f.polozky || []).length) return null;
  const polozky = f.polozky.map((p, i) => {
    const h = String(p.farba || "").replace("#", "");
    return { popis: String(p.popis || ""), suma: Number(p.suma) || 0, farba: /^[0-9A-Fa-f]{6}$/.test(h) ? h.toUpperCase() : REP_FIN_PALETA[i % REP_FIN_PALETA.length] };
  });
  const sucet = Math.round(polozky.reduce((s, p) => s + p.suma, 0) * 100) / 100;
  const rucny = f.celkom != null && f.celkom !== "" && Number.isFinite(Number(f.celkom));
  const celok = rucny ? Number(f.celkom) : sucet;
  return { nadpis: f.nadpis || "Prehľad stavu čerpania finančných prostriedkov", mena: f.mena || "EUR", popisCelku: f.popisCelku || "Celkový rozpočet",
    polozky, sucet, celok, rucny, rozdiel: Math.round((celok - sucet) * 100) / 100 };
}
function repSuma(v){ const n = Math.round(Number(v) || 0), s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); return (n < 0 ? "-" : "") + s; }

// Snímky R3a — skladá ich view-model, nie zapisovač (§3.4).
function repZmenySnimky(k, vybrane){
  const s = [], Z = k.zmeny;
  if (Z) {
    s.push({ kluc: "zmeny", typ: "zmeny", nazov: "Čo sa zmenilo od minula", zahrnuta: vybrane("zmeny"),
      zmeny: { pred: Z.pred, teraz: Z.teraz, sumar: Z.sumar, prahy: Z.prahy, oblasti: Z.oblasti.filter(o => o.delta || o.posunPoslednej), posuny: Z.posuny } });
    const R = Z.rozsah, pm = (a, b) => (a ? "+" + a : "0") + " / " + (b ? "−" + b : "0");
    s.push({ kluc: "podstatne", typ: "tabulka", nazov: "Podstatné zmeny v projekte", zahrnuta: vybrane("podstatne"), kicker: "Report zmien", nadpis: "Podstatné zmeny v projekte",
      sumar: [{ popis: "Úlohy (pridané / odobraté)", hodnota: pm(R.pridane, R.odobrate), akcent: "textSec" }, { popis: "Míľniky (nové / odobraté)", hodnota: pm(R.noveMilniky, R.odobrateMilniky), akcent: "textSec" },
        { popis: "Kódy záväzkov (nové / odobraté)", hodnota: pm(R.kodyPridane.length, R.kodyOdobrate.length), akcent: "textSec" },
        { popis: "Novo oneskorené", hodnota: String(Z.sumar.novoOneskorene), akcent: Z.sumar.novoOneskorene ? "red" : "green" }, { popis: "Regresie postupu", hodnota: String(Z.sumar.regresie), akcent: Z.sumar.regresie ? "amber" : "green" }],
      tabulka: repTabPodstatne(Z) });
  }
  if (k.trend) s.push({ kluc: "trend", typ: "tabulka", nazov: "Trend míľnikov", zahrnuta: vybrane("trend"), kicker: "Trend míľnikov", nadpis: "Posuny termínov cez verzie plánu",
    sumar: [{ popis: "Verzie v trende", hodnota: String(k.trend.body.length), akcent: "textSec" }, { popis: "Míľniky s posunom", hodnota: String(k.trend.posunute), akcent: k.trend.posunute ? "amber" : "green" },
      { popis: "Najväčší sklz", hodnota: k.trend.riadky.length && k.trend.riadky[0].spolu > 0 ? "+" + k.trend.riadky[0].spolu + " d" : "—", akcent: "red" }],
    tabulka: repTabTrend(k.trend) });
  return s;
}
function repTabPodstatne(Z){
  const r = [], dt = d => (d ? repDMR(d) : "—");
  for (const x of Z.novoOneskorene) r.push({ b: ["Novo oneskorené", x.oblast, x.faza, x.nazov, dt(x.predtym), dt(x.teraz), x.novy ? "nový" : x.dni ? (x.dni > 0 ? "+" : "") + x.dni + " d" : "", x.pct + " %"], farby: { 0: "red" } });
  for (const x of Z.posuny) r.push({ b: [x.dni > 0 ? "Posun" : "Uvoľnenie", x.oblast, x.faza, x.nazov, dt(x.predtym), dt(x.teraz), (x.dni > 0 ? "+" : "") + x.dni + " d", x.pct + " %" + (x.poTermine ? " !" : "")], farby: { 0: x.dni > 0 ? "amber" : "green", 6: x.dni > 0 ? "red" : "green" } });
  for (const x of Z.regresie) r.push({ b: ["Regresia", x.oblast, x.faza, x.nazov, x.pctPred + " %", x.pct + " %", "−" + x.pokles + " b.", ""], farby: { 0: "amber" } });
  for (const x of Z.dokoncene) r.push({ b: ["Dokončené", x.oblast, x.faza, x.nazov, "", dt(x.teraz), "", "100 %"], farby: { 0: "green" } });
  for (const x of Z.noveMilniky) if (!Z.novoOneskorene.some(y => y.uid === x.uid)) r.push({ b: ["Nový míľnik", x.oblast, x.faza, x.nazov, "", dt(x.teraz), "", x.pct + " %"], farby: {} });
  for (const x of Z.odobrateMilniky) r.push({ b: ["Odobratý míľnik", x.oblast, x.faza, x.nazov, dt(x.predtym), "", "", ""], farby: { 0: "textSec" } });
  if (Z.rozsah.kodyPridane.length) r.push({ b: ["Nové kódy", "", "", Z.rozsah.kodyPridane.join(", "), "", "", "", ""], farby: {} });
  if (Z.rozsah.kodyOdobrate.length) r.push({ b: ["Odobraté kódy", "", "", Z.rozsah.kodyOdobrate.join(", "), "", "", "", ""], farby: {} });
  return { stlpce: [{ n: "Zmena", w: 0.12 }, { n: "Oblasť", w: 0.11 }, { n: "Fáza", w: 0.06 }, { n: "Úloha", w: 0.37 }, { n: "Predtým", w: 0.09 }, { n: "Teraz", w: 0.09 }, { n: "Δ", w: 0.07 }, { n: "%", w: 0.09 }],
    riadky: r, prazdne: "Od " + repDMR(Z.pred.stavKuDnu) + " sa v pláne nič podstatné nezmenilo (prahy: posun ≥ " + Z.prahy.posunDni + " dní, pokles ≥ " + Z.prahy.poklesBodov + " b.)." };
}
function repTabTrend(Tr){
  const n = Tr.body.length, wB = Math.min(0.11, 0.62 / n);
  const riadky = Tr.riadky.filter(r => r.spolu !== 0 || r.kroky.some(k => k));
  return { stlpce: [{ n: "Oblasť", w: 0.16 }, { n: "Fáza", w: 0.08 }].concat(Tr.body.map((b, i) => ({ n: i === n - 1 ? "Teraz" : repDM(b.stavKuDnu) + (b.stavKuDnu.slice(0, 4) !== Tr.body[n - 1].stavKuDnu.slice(0, 4) ? b.stavKuDnu.slice(2, 4) : ""), w: wB })))
      .concat([{ n: "Spolu", w: 1 - 0.24 - wB * n }]),
    riadky: riadky.map(r => ({ b: [r.kratky, r.faza].concat(r.seria.map(d => (d ? repDM(d) : "—"))).concat([(r.spolu > 0 ? "+" : "") + r.spolu + " d"]),
      farby: Object.assign({ [2 + n]: r.spolu > 0 ? "red" : r.spolu < 0 ? "green" : null }, Object.fromEntries(r.kroky.map((k, i) => [2 + i, k > 0 ? "red" : k < 0 ? "green" : null]))) })),
    prazdne: "Medzi verziami plánu sa žiadny fázový míľnik nepohol." };
}
function repQaZmenyRegistrovSnimka(ZR, vybrane){
  const S = ZR.sumar, nm = { issue: "Issue Log", ct: "Záväzky", dep: "Závislosti" };
  return { kluc: "qa-registre", typ: "qaTabulka", nazov: "QA: zmeny v registroch", zahrnuta: vybrane("qa-registre"), kicker: "Dohľad kvality", nadpis: "Zmeny v registroch od minulého reportu",
    sumar: [{ popis: "Nové problémy", hodnota: String(S.noveIssue), akcent: S.noveIssue ? "amber" : "green" }, { popis: "Uzavreté", hodnota: String(S.uzavrete), akcent: "green" },
      { popis: "Zmena priority", hodnota: String(S.priorita), akcent: "textSec" }, { popis: "Posun termínu (IL)", hodnota: String(S.terminIssue), akcent: S.terminIssue ? "amber" : "green" },
      { popis: "Záväzky / závislosti", hodnota: S.zavazky + " / " + S.zavislosti, akcent: "textSec" }],
    tabulka: { stlpce: [{ n: "Register", w: 0.1 }, { n: "ID", w: 0.1 }, { n: "Zmena", w: 0.15 }, { n: "Predtým", w: 0.11 }, { n: "Teraz", w: 0.11 }, { n: "Popis", w: 0.43 }],
      riadky: ZR.zmeny.map(x => ({ b: [nm[x.reg], x.id, x.zmena, x.predtym, x.teraz, x.popis], farby: { 2: x.druh === "uzavrete" || x.druh === "dodane" ? "green" : (x.dni > 0 || x.druh === "nove" || x.druh === "znovu" || x.druh === "zmiznute") ? "amber" : null } })),
      prazdne: "Medzi porovnávanými importmi sa v registroch nič nezmenilo." } };
}

// Tabuľka so sumárom je spoločná pre QA aj roadmapu.
REP_LAYOUTY.tabulka = REP_LAYOUTY.qaTabulka;

REP_LAYOUTY.zmeny = function(s, view, T){
  const A = repPrvky(T), Z = s.zmeny, S = Z.sumar, d = S.postupTeraz - S.postupPred;
  let y = repHlavicka(A, T, "Report zmien", "Čo sa zmenilo od minula", "predtým " + repDMR(Z.pred.stavKuDnu) + " → " + repDMR(Z.teraz.stavKuDnu));
  repDlazdice(A, T, [
    { popis: "Postup programu", hodnota: S.postupTeraz + " %", sub: "predtým " + S.postupPred + " % (" + (d >= 0 ? "+" : "") + d + " b.)", akcent: d < 0 ? "red" : "green" },
    { popis: "Posunuté míľniky", hodnota: String(S.posunute), sub: "≥ " + Z.prahy.posunDni + " dní · uvoľnené " + S.uvolnene, akcent: S.posunute ? "amber" : "green" },
    { popis: "Novo oneskorené", hodnota: String(S.novoOneskorene), sub: "po termíne k " + repDMR(Z.teraz.stavKuDnu), akcent: S.novoOneskorene ? "red" : "green" },
    { popis: "Dokončené míľniky", hodnota: String(S.dokoncene), sub: "od minulého reportu", akcent: "green" },
    { popis: "Oblasti ↑ / ↓", hodnota: S.oblastiHore + " / " + S.oblastiDole, sub: "zmena postupu", akcent: S.oblastiDole ? "amber" : "green" }], y, 0.85, view.farby);
  y += 0.85 + 0.3;
  const wL = 5.6, xR = REP_L + wL + 0.3, wR = REP_CW - wL - 0.3;
  A.text(REP_L, y, wL, 0.24, "ZMENY POSTUPU OBLASTÍ", { pt: 10, bold: true, color: T.textSec });
  A.text(xR, y, wR, 0.24, "NAJVÄČŠIE POSUNY MÍĽNIKOV", { pt: 10, bold: true, color: T.textSec });
  y += 0.3;
  const tO = { stlpce: [{ n: "Oblasť", w: 0.34 }, { n: "Predtým", w: 0.17 }, { n: "Teraz", w: 0.15 }, { n: "Δ", w: 0.12 }, { n: "Posledná fáza", w: 0.22 }],
    riadky: Z.oblasti.map(o => ({ b: [o.kratky, o.pctPred + " %", o.pctTeraz + " %", (o.delta > 0 ? "+" : "") + o.delta, o.posunPoslednej ? (o.posunPoslednej > 0 ? "+" : "") + o.posunPoslednej + " d" : ""],
      farby: { 3: o.delta < 0 ? "red" : o.delta > 0 ? "green" : null, 4: o.posunPoslednej > 0 ? "red" : o.posunPoslednej < 0 ? "green" : null } })), prazdne: "Postup oblastí sa nezmenil." };
  const tP = { stlpce: [{ n: "Oblasť", w: 0.2 }, { n: "Fáza", w: 0.1 }, { n: "Míľnik", w: 0.38 }, { n: "Nový termín", w: 0.17 }, { n: "Posun", w: 0.15 }],
    riadky: Z.posuny.map(p => ({ b: [p.oblast, p.faza, p.nazov, repDMR(p.teraz), (p.dni > 0 ? "+" : "") + p.dni + " d" + (p.poTermine ? " !" : "")], farby: { 4: p.dni > 0 ? "red" : "green" } })),
    prazdne: "Žiadny míľnik sa neposunul o " + Z.prahy.posunDni + " a viac dní." };
  const iO = repKresliTabulku(A, T, REP_L, y, wL, tO, 0, 6.85, 9), iP = repKresliTabulku(A, T, xR, y, wR, tP, 0, 6.85, 9);
  const zvysok = [];
  if (iO < tO.riadky.length) zvysok.push((tO.riadky.length - iO) + " oblastí");
  if (iP < tP.riadky.length) zvysok.push((tP.riadky.length - iP) + " posunov");
  A.text(REP_L, 6.95, REP_CW - 3.2, 0.18, zvysok.length ? "Nezobrazené: " + zvysok.join(", ") + " — celý zoznam je v XLSX a na strane Podstatné zmeny." : "Porovnanie podľa UID úloh; ! = míľnik po termíne.", { pt: 7.5, italic: true, color: T.textTer });
  A.text(REP_W - REP_L - 3, 6.95, 3, 0.18, "Zdroj: MS Project · dve snímky plánu", { pt: 7.5, italic: true, color: T.textTer, align: "r" });
  return [{ prvky: A.prvky, nadpis: s.nazov }];
};

REP_LAYOUTY.financie = function(s, view, T){
  const A = repPrvky(T), F = s.fin;
  let y = repHlavicka(A, T, "Financie", F.nadpis, "Stav " + repDMR(view.stavKuDnu));
  const dl = [{ popis: F.popisCelku + " (" + F.mena + ")", hodnota: repSuma(F.celok), sub: F.rucny ? "zadané ručne" : "súčet zložiek", farba: T.text }]
    .concat(F.polozky.slice(0, F.polozky.length > 5 ? 3 : 4).map(p => ({ popis: p.popis, hodnota: repSuma(p.suma), sub: F.mena, farba: p.farba })));
  if (F.polozky.length > 5) dl.push({ popis: "Ďalšie zložky (" + (F.polozky.length - 3) + ")", hodnota: repSuma(F.polozky.slice(3).reduce((a, p) => a + p.suma, 0)), sub: F.mena, akcent: "textSec" });
  repDlazdice(A, T, dl, y, 0.85, view.farby);
  y += 0.85 + 0.3;
  const kladne = F.polozky.filter(p => p.suma > 0), spolu = kladne.reduce((a, p) => a + p.suma, 0);
  const r = 1.95, cx = REP_L + 0.25 + r, cy = y + 0.35 + r;
  A.text(REP_L, y, 5.2, 0.24, "ROZPAD", { pt: 10, bold: true, color: T.textSec });
  if (spolu > 0) {
    A.prvky.push({ t: "kolac", cx, cy, r, okraj: T.bg, diely: kladne.map(p => ({ nazov: p.popis, v: p.suma, farba: p.farba })) });
    let a = -Math.PI / 2;
    for (const p of kladne) {
      const da = p.suma / spolu * 2 * Math.PI, m = a + da / 2;
      if (p.suma / spolu >= 0.06) A.text(cx + 0.62 * r * Math.cos(m) - 0.5, cy + 0.62 * r * Math.sin(m) - 0.13, 1, 0.26, Math.round(p.suma / spolu * 1000) / 10 + " %", { pt: 10, bold: true, color: T.white, align: "c" });
      a += da;
    }
  } else A.text(REP_L, y + 0.4, 5.2, 0.3, "Žiadna zložka nemá kladnú sumu — rozpad sa nedá nakresliť.", { pt: 11, color: T.textSec });
  const xL = REP_L + 5.4, wL = REP_W - REP_L - xL;
  A.text(xL, y, wL, 0.24, "ZLOŽKY", { pt: 10, bold: true, color: T.textSec });
  let yy = y + 0.35;
  const rh = Math.min(0.42, (6.4 - yy) / Math.max(1, F.polozky.length + 2));
  for (const p of F.polozky) {
    A.rect(xL, yy + rh / 2 - 0.09, 0.18, 0.18, { fill: p.farba });
    A.text(xL + 0.3, yy, wL - 2.9, rh, repSkrat(p.popis, wL - 2.9, 11, false, T.font), { pt: 11 });
    A.text(xL + wL - 2.55, yy, 1.75, rh, repSuma(p.suma) + " " + F.mena, { pt: 11, bold: true, align: "r" });
    A.text(xL + wL - 0.75, yy, 0.75, rh, spolu > 0 && p.suma > 0 ? Math.round(p.suma / spolu * 1000) / 10 + " %" : "—", { pt: 10, color: T.textSec, align: "r" });
    yy += rh;
  }
  A.line(xL, yy + 0.04, xL + wL, yy + 0.04, { color: T.border, lw: 0.75 });
  A.text(xL + 0.3, yy + 0.06, wL - 2.9, rh, "Súčet zložiek", { pt: 11, bold: true });
  A.text(xL + wL - 2.55, yy + 0.06, 1.75, rh, repSuma(F.sucet) + " " + F.mena, { pt: 11, bold: true, align: "r" });
  if (F.rozdiel) A.text(xL, yy + 0.1 + rh, wL, 0.4, repZalom(F.popisCelku + " " + repSuma(F.celok) + " " + F.mena + " sa líši od súčtu zložiek o " + repSuma(F.rozdiel) + " " + F.mena + ".", wL, 10, true, T.font, 2), { pt: 10, bold: true, color: T.red, valign: "t" });
  return [{ prvky: A.prvky, nadpis: s.nazov }];
};

// ═══ 27. UI kola R3a: porovnanie a trend, financie ════════════════
// Stav ku dňu staršej snímky plánu: z cyklu, ktorý ju použil (porovnanie
// prenesené z cyklu), inak dátum stavu v súbore plánu (datum_suboru).
function repStavVstupu(v){ return v ? (v.datum_suboru || String(v.nahrane || "").slice(0, 10)) : null; }
function repPorovnanieHtml(){
  const O = REP.cyklusObsah, por = O.porovnanie || {}, V = O.vstupy || {}, stav = REP.cyklus.stav_ku_dnu;
  const pis = REP.cyklus.stav === "koncept" && !REP.verziaSnimka && repMozemPisat();
  const lbl = v => esc(v.nazov_suboru + " · " + repDMR(repStavVstupu(v)));
  const vyber = (druh, nazov) => {
    const moz = REP.vstupy.filter(v => v.druh === druh && v.id !== V[druh]);
    if (!moz.length) return "";
    return '<div class="mfield" style="flex:1;min-width:220px"><label>' + nazov + '</label><select' + (pis ? "" : " disabled") + ' onchange="repNastavPorovnanie(\'' + druh + '\', this.value)"><option value="">— bez porovnania —</option>' +
      moz.map(v => '<option value="' + esc(v.id) + '"' + (por[druh] === v.id ? " selected" : "") + ">" + lbl(v) + "</option>").join("") + "</select></div>";
  };
  const plany = REP.vstupy.filter(v => v.druh === "plan" && v.id !== V.plan);
  const body = ((O.trend || {}).body) || [];
  const neskor = por.stavKuDnu && por.stavKuDnu >= stav;
  const trend = plany.map(v => {
    const b = body.find(x => x.plan === v.id), st = b ? b.stavKuDnu : repStavVstupu(v), zly = st >= stav;
    return '<label style="display:flex;gap:6px;align-items:center;padding:2px 0"><input type="checkbox"' + (b ? " checked" : "") + (pis && !zly ? "" : " disabled") +
      ' onchange="repTrendBod(\'' + esc(v.id) + '\', this.checked)"> ' + esc(v.nazov_suboru) + ' <span class="csub" style="margin:0">stav ' + esc(repDMR(st)) + (zly ? " — nie je pred týmto cyklom" : "") + "</span></label>";
  }).join("");
  return '<div class="card" style="padding:10px 14px;margin-top:10px"><b>Porovnanie a trend</b><div class="csub" style="margin:2px 0 6px">Zmeny od minula a podstatné zmeny sa počítajú proti staršej snímke plánu po UID úloh, ' +
    'k jej vlastnému stavu ku dňu. Nový cyklus si porovnanie a trend prevezme z predošlého cyklu.' + (por.popis ? " Teraz: <b>" + esc(por.popis) + "</b>." : "") + "</div>" +
    (REP.porovnanieChyba ? '<div style="color:var(--neg);font-size:12px;margin-bottom:6px">Vstup porovnania sa nenačítal: ' + esc(REP.porovnanieChyba) + "</div>" : "") +
    (neskor ? '<div style="color:var(--neg);font-size:12px;margin-bottom:6px">Porovnávaná snímka má stav ku dňu ' + esc(repDMR(por.stavKuDnu)) + " — nie je staršia než cyklus, zmeny sa nepočítajú.</div>" : "") +
    '<div style="display:flex;gap:10px;flex-wrap:wrap">' + vyber("plan", "Plán na porovnanie") + vyber("issue", "Issue Log na porovnanie") + vyber("ct", "Commitment Tracker na porovnanie") + vyber("dep", "Dependency Log na porovnanie") + "</div>" +
    (plany.length ? '<div class="csub" style="margin:6px 0 2px">Body trendu míľnikov (tento cyklus je vždy posledný):</div>' + trend : '<div class="csub">Zatiaľ je nahratý len jeden plán — trend a porovnanie potrebujú staršiu snímku plánu.</div>') + "</div>";
}
async function repNastavPorovnanie(druh, id){
  const O = REP.cyklusObsah, por = O.porovnanie = O.porovnanie || {};
  if (!id) { delete por[druh]; if (druh === "plan") { delete por.stavKuDnu; delete por.popis; } return repPrekresli(); }
  const v = REP.vstupy.find(x => x.id === id);
  try { await repNacitajVstup(id); } catch (e) { return repChyba(e, "Vstup na porovnanie sa nepodarilo načítať"); }
  por[druh] = id;
  if (druh === "plan") { por.stavKuDnu = repStavVstupu(v); por.popis = "plán " + (v ? v.nazov_suboru : "") + " k " + repDMR(por.stavKuDnu); delete por.cyklus; }
  repPrekresli();
}
async function repTrendBod(id, zap){
  const O = REP.cyklusObsah, T = O.trend = O.trend || {}, body = T.body = T.body || [];
  const i = body.findIndex(b => b.plan === id);
  if (!zap) { if (i >= 0) body.splice(i, 1); return repPrekresli(); }
  const v = REP.vstupy.find(x => x.id === id);
  try { await repNacitajVstup(id); } catch (e) { return repChyba(e, "Plán pre trend sa nepodarilo načítať"); }
  if (i < 0) body.push({ plan: id, stavKuDnu: repStavVstupu(v), popis: v ? v.nazov_suboru : "" });
  body.sort((a, b) => (a.stavKuDnu < b.stavKuDnu ? -1 : 1));
  repPrekresli();
}

// Financie (§6.8): zložky s farbou, celok súčtom alebo ručne; žiadne predvolené sumy.
function repFinancieHtml(){
  const f = repUsudok().financie;
  if (!f) return '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Finančný report</b><div class="csub" style="margin:2px 0 6px">Voliteľná strana s rozpadom rozpočtu (koláčový graf). Sumy zadáte ručne, appka nič nepredvypĺňa.</div>' +
    '<button class="aabtn" onclick="repFinZaloz()">+ Pridať finančný report</button></div>';
  const F = repFinancie(f) || { sucet: 0, celok: Number(f.celkom) || 0, rozdiel: 0, mena: f.mena || "EUR" };
  const riadky = (f.polozky || []).map((p, i) => {
    const farba = (F.polozky && F.polozky[i] ? F.polozky[i].farba : REP_FIN_PALETA[i % REP_FIN_PALETA.length]);
    return '<tr><td><input type="color" value="#' + esc(farba) + '" onchange="repFinPolozka(' + i + ',\'farba\',this.value)" style="width:38px;height:30px;padding:0;border:0"></td>' +
      '<td style="width:60%"><input value="' + esc(p.popis || "") + '" placeholder="napr. Vyčerpané" style="width:100%" onchange="repFinPolozka(' + i + ',\'popis\',this.value)"></td>' +
      '<td><input type="number" step="0.01" value="' + esc(p.suma === "" || p.suma == null ? "" : p.suma) + '" style="width:130px;text-align:right" onchange="repFinPolozka(' + i + ',\'suma\',this.value)"></td>' +
      '<td><button class="aabtn" title="Odstrániť zložku" onclick="repFinOdober(' + i + ')">×</button></td></tr>';
  }).join("");
  const pole = (k, n, ph, typ, w) => '<div class="mfield" style="flex:1;min-width:' + (w || 160) + 'px"><label>' + n + '</label><input' + (typ ? ' type="' + typ + '" step="0.01"' : "") + ' value="' + esc(f[k] == null ? "" : f[k]) + '" placeholder="' + esc(ph) + '" onchange="repFinUprav(\'' + k + '\', this.value)"></div>';
  return '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Finančný report</b><div class="csub" style="margin:2px 0 6px">Celok je súčet zložiek, kým ho nezadáte ručne; keď sa líši od súčtu, strana to ukáže červeno. Finančné sumy nejdú žiadnemu jazykovému modelu.</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' + pole("nadpis", "Nadpis strany", "Prehľad stavu čerpania finančných prostriedkov", "", 260) + pole("popisCelku", "Popis celku", "Celkový rozpočet") +
    pole("celkom", "Celok (prázdne = súčet)", repSuma(F.sucet), "number") + pole("mena", "Mena", "EUR", "", 80) + "</div>" +
    '<table style="width:100%;margin-top:4px"><tr class="csub"><th></th><th style="text-align:left">Zložka</th><th style="text-align:right">Suma</th><th></th></tr>' + riadky + "</table>" +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px"><button class="aabtn" onclick="repFinPridaj()">+ Zložka</button>' +
    '<span class="csub" style="margin:0">súčet ' + esc(repSuma(F.sucet)) + " · celok " + esc(repSuma(F.celok)) + (F.rozdiel ? ' · <b style="color:var(--neg)">rozdiel ' + esc(repSuma(F.rozdiel)) + "</b>" : "") + "</span>" +
    '<button class="aabtn" onclick="repFinZrus()">Odstrániť finančný report</button></div></div>';
}
function repFinZaloz(){ repUsudok().financie = { nadpis: "", popisCelku: "", celkom: null, mena: "EUR", polozky: [{ popis: "", suma: "" }] }; repPrekresli(); }
function repFinUprav(k, v){
  const f = repUsudok().financie;
  v = String(v == null ? "" : v).trim();
  if (k === "celkom") f.celkom = v === "" ? null : Number(v);
  else f[k] = v;
  repPrekresli();
}
function repFinPolozka(i, k, v){
  const p = repUsudok().financie.polozky[i];
  if (!p) return;
  if (k === "suma") p.suma = String(v).trim() === "" ? "" : Number(v);
  else if (k === "farba") p.farba = String(v).replace("#", "").toUpperCase();
  else p[k] = String(v).trim();
  repPrekresli();
}
function repFinPridaj(){ repUsudok().financie.polozky.push({ popis: "", suma: "" }); repPrekresli(); }
function repFinOdober(i){ repUsudok().financie.polozky.splice(i, 1); repPrekresli(); }
function repFinZrus(){ if (!confirm("Odstrániť finančný report z tohto cyklu?")) return; delete repUsudok().financie; repPrekresli(); }

// ═══ 28. Návrh textov modelom (kolo R3b; NAVRH §11, D7, č. 301) ═══
// Modelu ide len AGREGÁT podľa bieleho zoznamu: čísla, termíny, kľúče fáz
// a dimenzií a názvy oblastí a skupín z profilu. Žiadne texty registrov, mená,
// poznámky, naratívy, komentáre ani finančné sumy (D14). Server vstup postaví
// nanovo (repAiVstupServer v edge b2b) — toto je len prvá vrstva.
const REP_AI_KPI = ["aktivne", "kriticke", "vysoke", "eskalovane", "oneskorene"];
function repAiVstup(K){
  const m = K.model, fazy = (m.fazy || []).map(f => f.kluc), skup = {};
  for (const s of m.skupiny || []) skup[s.kluc] = s.nazov;
  const v = { stavKuDnu: m.stavKuDnu, cielovyTermin: m.cielovyTermin || null, postupProgramu: m.program.pct,
    metodaPostupu: String(m.program.metoda).indexOf("súhrnná") === 0 ? "suhrn" : "priemer",
    pocty: { oblasti: m.pocty.drahy, dokoncene: m.pocty.hotove, nasadene: m.pocty.nasadene, oneskorene: m.pocty.oneskorene, pomale: m.pocty.pomale, dniDoKonca: m.dniDoKonca },
    fazy,
    oblasti: m.drahy.filter(d => !d.chyba).slice(0, 60).map(d => ({ oblast: d.kratky, skupina: skup[d.skupina] || null, pct: d.pct,
      fazy: Object.fromEntries(fazy.filter(k => d.fazy[k]).map(k => { const r = d.fazy[k]; return [k, { datum: r.datum, stav: r.hotove ? "hotove" : r.oneskorene ? "oneskorene" : "planovane", dniPoTermine: r.dniPoTermine || 0 }]; })) })) };
  if (K.qa) {
    v.kpi = Object.fromEntries(K.qa.kpi.filter(k => REP_AI_KPI.includes(k.kluc) && Number.isFinite(Number(k.hodnota))).map(k => [k.kluc, Number(k.hodnota)]));
    v.rag = K.qa.rag.map(d => ({ dimenzia: d.kluc, navrh: d.navrh ? d.navrh.farba : null, farba: d.farba }));
  }
  if (K.il) v.issue = { aktivne: K.il.aktivne, kriticke: K.il.kriticke, vysoke: K.il.vysoke, eskalovane: K.il.eskalovane, poTermine: K.il.poTermine, bezTerminu: K.il.bezTerminu };
  if (K.ct) v.zavazky = { spolu: K.ct.zavazky.length, sparovane: K.ct.sparovane, vNesulade: K.ct.vNesulade, pocty: Object.assign({}, K.ct.pocty) };
  if (K.dep) v.zavislosti = Object.assign({}, K.dep.kpi);
  if (K.zmeny) {
    const S = K.zmeny.sumar;
    v.zmeny = { od: K.zmeny.pred.stavKuDnu, posunute: S.posunute, uvolnene: S.uvolnene, novoOneskorene: S.novoOneskorene, dokoncene: S.dokoncene, regresie: S.regresie,
      postupPred: S.postupPred, posuny: K.zmeny.posuny.filter(p => p.oblast).slice(0, 15).map(p => ({ oblast: p.oblast, faza: p.faza || null, dni: p.dni, termin: p.teraz })) };
  }
  if (K.zmenyRegistrov) v.zmenyRegistrov = Object.assign({}, K.zmenyRegistrov.sumar);
  if (K.trend) v.trend = { body: K.trend.body.map(b => b.stavKuDnu), riadky: K.trend.riadky.filter(r => r.spolu).slice(0, 15).map(r => ({ oblast: r.kratky, faza: r.faza, spolu: r.spolu })) };
  return v;
}
// Odpoveď sa neberie naslepo: len známe polia, dĺžky a dimenzie, ktoré report má.
function repAiNavrhZOdpovede(n, K){
  const txt = (x, max) => String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, max);
  const dim = new Set(((K.qa && K.qa.rag) || []).map(d => d.kluc));
  const rag = {};
  for (const d of (n && Array.isArray(n.rag) ? n.rag : [])) { const k = String(d && d.dimenzia || ""); if (dim.has(k) && !rag[k]) { const t = txt(d.komentar, 300); if (t) rag[k] = t; } }
  return { naratiV: txt(n && n.naratiV, 1200), qaNaratiV: K.qa ? txt(n && n.qaNaratiV, 900) : "", rag };
}
const REP_ZDROJ_TXT = { ai: "AI návrh", ai_upraveny: "AI návrh, upravený", rucne: "ručne" };
function repZdrojPoUprave(predtym){ return predtym === "ai" || predtym === "ai_upraveny" ? "ai_upraveny" : "rucne"; }

async function repAiNavrh(){
  const cid = REP.cyklus.id;
  try {
    const K = repKontextCyklu();
    REP.aiNavrh = { cyklus: cid, caka: true }; REP.pracuje = "Model pripravuje návrh textov…"; repPrekresli();
    const d = await b2bEdge("rep_navrh", { cyklus: cid, vstup: repAiVstup(K) });
    if (!REP.cyklus || REP.cyklus.id !== cid) {                       // medzitým iný cyklus — návrh patrí inam
      if (REP.aiNavrh && REP.aiNavrh.cyklus === cid) REP.aiNavrh = null;
      REP.pracuje = ""; return repPrekresli();
    }
    REP.aiNavrh = Object.assign({ cyklus: cid, model: d.model }, repAiNavrhZOdpovede(d.navrh, K));
    REP.pracuje = "";
  } catch (e) { REP.aiNavrh = null; return repChyba(e, "Návrh textov sa nepodaril"); }
  repPrekresli();
}
function repAiPouzi(pole, kluc){
  const N = REP.aiNavrh, u = repUsudok();
  if (!N || N.cyklus !== REP.cyklus.id) return;
  if (pole === "naratiV" && N.naratiV) u.naratiV = { text: N.naratiV, zdroj: "ai" };
  else if (pole === "qaNaratiV" && N.qaNaratiV) u.qaNaratiV = { text: N.qaNaratiV, zdroj: "ai" };
  else if (pole === "rag" && N.rag[kluc]) { u.rag = u.rag || {}; const r = u.rag[kluc] = u.rag[kluc] || {}; r.komentar = N.rag[kluc]; r.zdrojKomentara = "ai"; }
  else if (pole === "vsetko") { repAiPouzi("naratiV"); repAiPouzi("qaNaratiV"); for (const k of Object.keys(N.rag)) repAiPouzi("rag", k); return; }
  repPrekresli();
}
function repAiNavrhHtml(K){
  const P = REP.profil || {};
  if (!P.aiNavrhy) return '<div class="csub" style="margin:0 2px 10px">✨ Návrh textov modelom je vypnutý — zapína ho profil programu, keď s tým objednávateľ súhlasí.</div>';
  const N = REP.aiNavrh && REP.aiNavrh.cyklus === REP.cyklus.id ? REP.aiNavrh : null;
  const blok = (nazov, text, pole, kluc) => text ? '<div style="padding:6px 0;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>' + esc(nazov) + "</b>" +
    '<button class="aabtn" onclick="repAiPouzi(\'' + pole + "'" + (kluc ? ",'" + kluc + "'" : "") + ')">Použiť</button></div><div style="margin-top:2px">' + esc(text) + "</div></div>" : "";
  const dim = K.qa ? K.qa.rag : [];
  return '<div class="card" style="padding:10px 14px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><b>✨ Návrh textov</b>' +
    '<button class="aabtn' + (N ? "" : " pri") + '"' + (N && N.caka ? " disabled" : "") + ' onclick="repAiNavrh()">' + (N && !N.caka ? "Navrhnúť znova" : "Navrhnúť texty") + "</button></div>" +
    '<div class="csub" style="margin:2px 0 6px">Model dostane len čísla a termíny reportu s názvami oblastí z profilu — nie texty registrov, mená, poznámky ani financie. Návrh sa prevezme až tlačidlom Použiť; ' +
    "prevzatý text je v úsudku označený ako AI návrh.</div>" +
    (N && !N.caka ? blok("Exekutívny súhrn", N.naratiV, "naratiV") + blok("Celkový stav (QA)", N.qaNaratiV, "qaNaratiV") +
      dim.map(d => blok("RAG — " + d.nazov, N.rag[d.kluc], "rag", d.kluc)).join("") +
      '<div style="margin-top:6px"><button class="aabtn" onclick="repAiPouzi(\'vsetko\')">Použiť všetko</button></div>' : "") + "</div>";
}

// Log exportov (§12.3): zapisuje server (b2b_rep_export_log) — kto, ktorý
// cyklus a verzia, aký výstup a jeho sha256. Neúspech log export nezastaví.
async function repLogExport(druh, blob){
  try {
    const sha = await b2bSha256(new Uint8Array(await blob.arrayBuffer()));
    const { error } = await sb.rpc("b2b_rep_export_log", { p_cyklus: REP.cyklus.id, p_cislo: REP.verziaSnimka ? (REP.verziaCislo || null) : null, p_druh: druh, p_sha256: sha });
    if (error) throw error;
  } catch (e) { console.error("Reporting: export sa nezapísal do logu projektu", e); }
}

// ═══ 29. Kolo R4: detail oblastí, anotácie, číselník oblastí, výstupy ═══
// ── Detail oblastí (§9.2): strana za skupinu — oblasť a jej balíky ─
function repFazaBunka(r){ return !r ? "—" : r.hotove ? "✓ " + repDM(r.datum) : repDM(r.datum) + (r.oneskorene ? " !" : ""); }
function repFazaFarba(r){ return r && r.oneskorene ? "red" : r && r.hotove ? "green" : null; }
function repTabDetail(drahy, fazy, poznamka){
  const n = fazy.length, wF = n ? Math.min(0.11, 0.4 / n) : 0, wP = 1 - 0.3 - 0.07 - wF * n;
  const riadky = [];
  for (const d of drahy) {
    riadky.push({ tucne: true, b: [d.kratky, d.pct + " %"].concat(fazy.map(f => repFazaBunka(d.fazy[f.kluc]))).concat([poznamka(d)]),
      farby: Object.assign({ 1: d.pct >= 70 ? "green" : d.pct >= 40 ? "blue" : "amber" }, Object.fromEntries(fazy.map((f, i) => [2 + i, repFazaFarba(d.fazy[f.kluc])]))) });
    for (const b of d.balicky) riadky.push({ b: ["   " + repKratky(b.nazov), b.pct + " %"].concat(fazy.map(f => repFazaBunka(b.fazy[f.kluc]))).concat([""]),
      farby: Object.fromEntries(fazy.map((f, i) => [2 + i, repFazaFarba(b.fazy[f.kluc])])) });
  }
  return { stlpce: [{ n: "Oblasť / balík", w: 0.3 }, { n: "%", w: 0.07 }].concat(fazy.map(f => ({ n: f.kluc, w: wF }))).concat([{ n: "Poznámka", w: wP }]),
    riadky, prazdne: "Skupina nemá oblasť so zobrazením v reporte." };
}
// Strana za skupinu profilu; oblasti bez skupiny spolu na konci. Tvar volí výber
// cyklu (vy.detailTvar): tabuľka s balíkmi, alebo karty oblastí.
function repDetailSnimky(p, drahy, drahaView, vybrane, tvar){
  const fazy = p.fazy || [], zname = new Set((p.skupiny || []).map(s => s.kluc));
  const skupiny = (p.skupiny || []).concat(drahy.some(d => !zname.has(d.skupina)) ? [{ kluc: "_", nazov: (p.skupiny || []).length ? "Ostatné oblasti" : "Oblasti programu", ostatne: true }] : []);
  return skupiny.map(s => ({ s, ds: drahy.filter(d => (s.ostatne ? !zname.has(d.skupina) : d.skupina === s.kluc)) })).filter(x => x.ds.length).map(({ s, ds }) => {
    const sn = { kluc: "detail:" + s.kluc, typ: tvar === "karty" ? "detailKarty" : "tabulka", nazov: "Detail: " + s.nazov, zahrnuta: vybrane("detail:" + s.kluc), kicker: "Detail oblastí", nadpis: s.nazov,
      sumar: [{ popis: "Oblastí", hodnota: String(ds.length), akcent: "textSec" }, { popis: "Priemerný postup", hodnota: Math.round(ds.reduce((a, d) => a + d.pct, 0) / ds.length) + " %", akcent: "blue" },
        { popis: "S oneskoreným míľnikom", hodnota: String(ds.filter(d => d.oneskorena).length), akcent: ds.some(d => d.oneskorena) ? "red" : "green" }] };
    if (tvar === "karty") return Object.assign(sn, { fazy: fazy.map(f => ({ kluc: f.kluc, legenda: f.legenda || f.kluc })), drahy: ds.map(drahaView) });
    return Object.assign(sn, { tabulka: repTabDetail(ds, fazy, d => drahaView(d).poznamka.text) });
  });
}
// Karty: 3 × 2 na stranu — názov, postup, míľniky fáz a poznámka oblasti.
REP_LAYOUTY.detailKarty = function(s, view, T){
  const strany = [], kol = 3, med = 0.2, naStranu = 6, w = (REP_CW - (kol - 1) * med) / kol;
  for (let od = 0, n = 0; (od < s.drahy.length || n === 0) && n < 8; od += naStranu, n++) {
    const A = repPrvky(T);
    let y0 = repHlavicka(A, T, s.kicker + (n ? " — pokračovanie" : ""), s.nadpis, "Stav " + repDMR(view.stavKuDnu));
    if (n === 0 && s.sumar) { repDlazdice(A, T, s.sumar, y0, 0.7, view.farby); y0 += 0.9; }
    const h = Math.min(2.7, (7.2 - y0 - med) / 2);
    s.drahy.slice(od, od + naStranu).forEach((d, i) => {
      const x = REP_L + (i % kol) * (w + med), y = y0 + Math.floor(i / kol) * (h + med);
      const ak = d.oneskorena ? T.red : repFarbaStavu(d.pct, view.farby, T);
      A.rect(x, y, w, h, { fill: T.panel, r: T.rounded ? 0.08 : 0 });
      A.rect(x, y, 0.06, h, { fill: ak });
      A.text(x + 0.17, y + 0.08, w - 1.1, 0.28, repSkrat(d.kratky, w - 1.1, 12, true, T.font), { pt: 12, bold: true });
      A.text(x + w - 0.95, y + 0.08, 0.8, 0.28, d.pct + " %", { pt: 13, bold: true, color: ak, align: "r" });
      A.rect(x + 0.17, y + 0.42, w - 0.34, 0.06, { fill: T.border });
      A.rect(x + 0.17, y + 0.42, Math.max(0.01, (w - 0.34) * Math.min(100, d.pct) / 100), 0.06, { fill: ak });
      const rh = Math.min(0.24, (h - 1.05) / Math.max(1, d.fazy.length));
      d.fazy.forEach((f, j) => {
        const yy = y + 0.58 + j * rh, leg = (s.fazy.find(q => q.kluc === f.kluc) || {}).legenda || f.kluc;
        repZnacka(A, T, f, x + 0.27, yy + rh / 2, Math.min(0.13, rh * 0.6));
        A.text(x + 0.42, yy, w - 1.6, rh, repSkrat(leg, w - 1.6, 9, false, T.font), { pt: 9, color: T.textSec });
        A.text(x + w - 1.15, yy, 1.0, rh, f.datum ? repDMR(f.datum) : "—", { pt: 9, bold: !!(f.oneskorene || f.hotove), color: f.oneskorene ? T.red : f.hotove ? T.green : T.text, align: "r" });
      });
      const poz = repZalom(d.poznamka && d.poznamka.text, w - 0.34, 9, false, T.font, 2);
      if (poz.length) A.text(x + 0.17, y + h - 0.44, w - 0.34, 0.38, poz, { pt: 9, italic: true, color: T.textSec, valign: "t" });
    });
    strany.push({ prvky: A.prvky, nadpis: s.nazov + (n ? " (" + (n + 1) + ")" : "") });
  }
  return strany;
};

// ── Anotácie (§4.2, §6.6): žijú v programe, prežijú ďalší import ─────
// anotacie_issue: { polozky: { kluc: { nezapocitat: { dovod }, kto, kedy } } }
// anotacie_ct:    { polozky: { kluc: { uid?, stav?, dovod?, kto, kedy } } }
const REP_REGISTRE_PROGRAMU = ["anotacie_issue", "anotacie_ct", "ciselnik_oblasti"];
function repAnotPolozky(druh){ const r = REP.registre && REP.registre[druh]; return (r && r.obsah && r.obsah.polozky) || {}; }
function repIssueSAnotaciami(riadky, anot){
  if (!riadky) return riadky;
  return riadky.map(z => (anot[z.kluc] ? Object.assign({}, z, { anotacia: anot[z.kluc] }) : z));
}
function repOsireleAnotacie(anotIssue, issue, anotCt, ct){
  const ki = new Set((issue || []).map(z => z.kluc)), kc = new Set((ct || []).map(z => z.kluc));
  return Object.keys(anotIssue || {}).filter(k => issue && !ki.has(k)).map(k => ({ druh: "anotacie_issue", kluc: k, register: "Issue Log" }))
    .concat(Object.keys(anotCt || {}).filter(k => ct && !kc.has(k)).map(k => ({ druh: "anotacie_ct", kluc: k, register: "Commitment Tracker" })));
}

// ── Číselník oblastí (§4.4): zápis oblasti v registri → oblasť profilu ─
// Automaticky podľa krátkeho a plného názvu a aliasov; zvyšok ručne
// (ciselnik_oblasti: { mapa: { normalizovaný zápis: kľúč oblasti | "*" | "-" } }).
function repOblastiAuto(P){
  const m = new Map();
  for (const o of P.oblasti || []) for (const t of [o.kratky, o.nazov].concat(o.aliasy || [])) if (t) m.set(repNorm(t), o.kluc);
  return m;
}
function repOblastZapisu(text, auto, mapa){
  const n = repNorm(text);
  if (!n) return null;
  if (mapa && mapa[n]) return mapa[n];
  return auto.get(n) || null;
}
// Funkcia pre QA: kľúče oblastí profilu, ku ktorým patrí problém z Issue Logu.
function repOblastIssueFn(P, mapa){
  const auto = repOblastiAuto(P);
  return z => (z.oblast || []).map(t => repOblastZapisu(t, auto, mapa)).filter(k => k && k !== "-" && k !== "*");
}
// Text pre výstup: krátky názov oblasti, „celý program“, alebo „? zápis“, keď
// zápis v číselníku nie je; „neprideľovať“ sa vynechá.
function repOblastIssuePopis(P, mapa){
  const auto = repOblastiAuto(P), meno = k => ((P.oblasti || []).find(o => o.kluc === k) || {}).kratky || k;
  return z => (z.oblast || []).map(t => { const k = repOblastZapisu(t, auto, mapa); return k === "-" ? null : k === "*" ? "celý program" : k ? meno(k) : "? " + t; }).filter(Boolean).join(", ");
}
function repNezname(P, mapa, riadkyIssue, riadkyDep){
  const auto = repOblastiAuto(P), poc = new Map();
  for (const z of (riadkyIssue || []).concat(riadkyDep || [])) for (const t of z.oblast || []) {
    if (repOblastZapisu(t, auto, mapa)) continue;
    const n = repNorm(t); if (!poc.has(n)) poc.set(n, { text: t, pocet: 0 }); poc.get(n).pocet++;
  }
  return [...poc.values()].sort((a, b) => b.pocet - a.pocet || a.text.localeCompare(b.text));
}

// ── UI: uloženie registra programu (anotácie, číselník) — zámok verzie ─
async function repNacitajRegisterDruh(druh){
  const r = await b2bEdge("rep_register_nacitaj", { program: REP.program.id, druh });
  REP.registre[druh] = { verzia: r.verzia || 0, obsah: r.obsah || (druh === "ciselnik_oblasti" ? { schema: 1, mapa: {} } : { schema: 1, polozky: {} }), zmenene: false };
}
// Zmena sa skladá nad kópiou a do REP.registre ide až po uložení — zlyhané
// uloženie nenechá v náhľade anotáciu, ktorá na serveri nie je.
async function repUlozRegisterDruh(druh, obsah){
  const R = REP.registre[druh];
  try {
    REP.pracuje = "Ukladám…"; repPrekresli();
    const d = await b2bEdge("rep_register_uloz", { program: REP.program.id, druh, verzia: R.verzia, obsah });
    R.verzia = d.verzia; R.obsah = obsah; REP.pracuje = "";
  } catch (e) {
    if (e.stav === 409) { REP.pracuje = ""; alert("Medzitým to uložil niekto iný. Načítam aktuálny stav — úpravu zopakujte."); try { await repNacitajRegisterDruh(druh); } catch (e2) { return repChyba(e2, "Načítanie zlyhalo"); } return repPrekresli(); }
    return repChyba(e, "Uloženie sa nepodarilo");
  }
  repPrekresli();
}
function repAnotZmen(druh, kluc, fn){
  const obsah = JSON.parse(JSON.stringify(REP.registre[druh].obsah));
  const p = obsah.polozky = obsah.polozky || {};
  const a = Object.assign({}, p[kluc] || {});
  fn(a);
  const ostava = Object.keys(a).filter(k => !["kto", "kedy"].includes(k));
  if (ostava.length) p[kluc] = Object.assign(a, { kto: repMojeId(), kedy: repDnes() }); else delete p[kluc];
  return repUlozRegisterDruh(druh, obsah);
}
function repIssueNezapocitat(kluc, zap){
  let dovod = "";
  if (zap) { dovod = String(prompt("Dôvod, prečo sa problém nezapočíta do KPI (ostane pri ňom):", "") || "").trim(); if (!dovod) return repPrekresli(); }
  return repAnotZmen("anotacie_issue", kluc, a => { if (zap) a.nezapocitat = { dovod }; else delete a.nezapocitat; });
}
function repCtUid(kluc, v){
  v = String(v || "").trim();
  if (v && !(Number.isInteger(+v) && REP.plany[REP.cyklusObsah.vstupy.plan].ulohy.some(u => u.uid === +v))) { alert("UID " + v + " v pláne cyklu nie je."); return repPrekresli(); }
  return repAnotZmen("anotacie_ct", kluc, a => { if (v) a.uid = +v; else delete a.uid; });
}
function repCtPrepis(kluc, stav){
  let dovod = "";
  if (stav) { dovod = String(prompt("Dôvod ručného prepisu stavu záväzku (ukáže sa vo výstupe):", "") || "").trim(); if (!dovod) return repPrekresli(); }
  return repAnotZmen("anotacie_ct", kluc, a => { if (stav) { a.stav = stav; a.dovod = dovod; } else { delete a.stav; delete a.dovod; } });
}
function repOsirelaZmaz(druh, kluc){ return repAnotZmen(druh, kluc, a => { for (const k of Object.keys(a)) delete a[k]; }); }
function repCiselnikNastav(n, v){
  const obsah = JSON.parse(JSON.stringify(REP.registre.ciselnik_oblasti.obsah)), m = obsah.mapa = obsah.mapa || {};
  if (v) m[n] = v; else delete m[n];
  return repUlozRegisterDruh("ciselnik_oblasti", obsah);
}

// Karty kroku Kontrola dát (R4): ručné úpravy záväzkov, oblasti v registroch, osirelé anotácie.
function repKontrolaR4Html(K){
  const pis = REP.cyklus.stav === "koncept" && !REP.verziaSnimka && repMozemPisat(), dis = pis ? "" : " disabled";
  let h = "";
  if (K.ct) {
    const anot = repAnotPolozky("anotacie_ct");
    const kand = K.ct.zavazky.filter(z => ["CHYBA_V_PLANE", "PLAN_NESKOR", "DATUM_NESULAD", "PO_TERMINE"].includes(z.hlavny) || anot[z.kluc]);
    const opt = v => '<option value="">— vypočítaný —</option>' + REP_CT_PORADIE.map(k => '<option value="' + k + '"' + (v === k ? " selected" : "") + ">" + esc(REP_CT_POPIS[k]) + "</option>").join("");
    h += '<details class="card" style="padding:10px 14px;margin-bottom:10px"' + (kand.some(z => anot[z.kluc]) ? " open" : "") + '><summary style="cursor:pointer"><b>Záväzky — ručné párovanie a prepis stavu</b> <span class="csub" style="margin:0">' + kand.length + " na posúdenie</span></summary>" +
      '<div class="csub" style="margin:4px 0 6px">Záväzok sa páruje s úlohou plánu cez kód; keď kód v pláne chýba alebo je zlý, zadajte UID úlohy. Prepis stavu potrebuje dôvod a vo výstupe je označený „(ručne)“. Platí pre ďalšie cykly aj importy.</div>' +
      '<div data-scroll style="max-height:360px;overflow:auto"><table style="width:100%;border-collapse:collapse"><tr class="csub"><th style="text-align:left">ID</th><th style="text-align:left">Dodávka</th><th style="text-align:left">Vypočítané</th><th>UID úlohy</th><th style="text-align:left">Prepis stavu</th></tr>' +
      kand.map(z => { const a = anot[z.kluc] || {};
        return '<tr style="border-top:1px solid var(--line)"><td>' + esc(z.id) + '</td><td>' + esc(z.dodavka || "") + '<div class="csub" style="margin:0">' + esc(z.uloha ? z.uloha.nazov : "úloha v pláne nie je") + "</div></td>" +
          "<td>" + esc(REP_CT_POPIS[z.priznaky.find(p => p !== "V_SULADE") || z.priznaky[0]] || "") + "</td>" +
          '<td style="text-align:center"><input style="width:80px" value="' + esc(a.uid == null ? "" : a.uid) + '" placeholder="' + esc(z.uloha && !a.uid ? z.uloha.uid : "") + '" onchange="repCtUid(\'' + esc(z.kluc) + "', this.value)\"" + dis + "></td>" +
          '<td><select onchange="repCtPrepis(\'' + esc(z.kluc) + "', this.value)\"" + dis + ">" + opt(a.stav) + "</select>" + (a.dovod ? '<div class="csub" style="margin:0">' + esc(a.dovod) + "</div>" : "") + "</td></tr>"; }).join("") +
      "</table></div></details>";
  }
  const cis = REP.registre.ciselnik_oblasti, mapa = (cis && cis.obsah && cis.obsah.mapa) || {};
  const V = REP.cyklusObsah.vstupy || {}, reg = d => (V[d] && REP.plany[V[d]] ? REP.plany[V[d]].riadky : null);
  if (reg("issue") || reg("dep")) {
    const nez = repNezname(REP.profil, mapa, reg("issue"), reg("dep"));
    const rucne = Object.keys(mapa);
    const opt = v => '<option value="">— nepriradené —</option><option value="*"' + (v === "*" ? " selected" : "") + '>celý program</option><option value="-"' + (v === "-" ? " selected" : "") + ">neprideľovať</option>" +
      (REP.profil.oblasti || []).map(o => '<option value="' + esc(o.kluc) + '"' + (v === o.kluc ? " selected" : "") + ">" + esc(o.kratky || o.nazov) + "</option>").join("");
    h += '<details class="card" style="padding:10px 14px;margin-bottom:10px"' + (nez.length ? " open" : "") + '><summary style="cursor:pointer"><b>Oblasti v registroch</b> <span class="csub" style="margin:0">' +
      (nez.length ? nez.length + " neznámych zápisov" : "všetky zápisy priradené") + "</span></summary>" +
      '<div class="csub" style="margin:4px 0 6px">Zápis oblasti v Issue Logu a Dependency Logu sa priradí k oblasti profilu podľa názvu; neznámy zápis priraďte raz — pravidlo platí pre program. Podľa toho QA report počíta problémy po oblastiach.</div>' +
      nez.concat(rucne.filter(n => !nez.some(x => repNorm(x.text) === n)).map(n => ({ text: n, pocet: null, rucne: true }))).map(x =>
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:3px 0;border-top:1px solid var(--line)"><span>' + esc(x.text) + (x.pocet ? ' <span class="csub" style="margin:0">' + x.pocet + "×</span>" : "") + "</span>" +
        '<select onchange="repCiselnikNastav(\'' + esc(repNorm(x.text)) + "', this.value)\"" + dis + ">" + opt(mapa[repNorm(x.text)]) + "</select></div>").join("") + "</details>";
  }
  const osi = repOsireleAnotacie(repAnotPolozky("anotacie_issue"), reg("issue"), repAnotPolozky("anotacie_ct"), reg("ct"));
  if (osi.length) h += '<div class="card" style="padding:10px 14px;margin-bottom:10px;border-color:var(--warn,#b7791f)"><b>Osirelé anotácie</b> <span class="csub" style="margin:0">' + osi.length + "</span>" +
    '<div class="csub" style="margin:2px 0 6px">Záznam s týmto kľúčom v aktuálnom importe nie je (premenované alebo zmazané ID). Anotácia sa neuplatní, kým sa ID nevráti.</div>' +
    osi.map(o => '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:3px 0;border-top:1px solid var(--line)"><span>' + esc(o.register) + " · " + esc(o.kluc) + "</span>" +
      (pis ? '<button class="aabtn" onclick="repOsirelaZmaz(\'' + o.druh + "','" + esc(o.kluc) + "')\">Odstrániť</button>" : "") + "</div>").join("") + "</div>";
  return h;
}

// ── Výstupy projektu (§9.7): uzavretý cyklus → šifrované výstupy s väzbou na verziu ─
const REP_VYSTUP_NAZVY = { roadmapa: "Roadmapa", qa: "QA report", pdf: "Report (PDF)", xlsx: "Dáta reportu (XLSX)", html: "HTML report" };
function repVystupyProjektuHtml(K){
  if (!REP.verziaSnimka) return '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Výstupy projektu</b><div class="csub" style="margin:2px 0 0">Súbory reportu sa dajú uložiť do Výstupov projektu (šifrovane, s väzbou na verziu cyklu) po uzavretí cyklu.</div></div>';
  if (!repMozemPisat()) return "";
  const V = REP.vystupyVyber = REP.vystupyVyber || { roadmapa: true, qa: true, pdf: true, xlsx: false, html: false };
  const qa = repLayout(K.view, K.tema, null, { balik: "qa" }).strany.length > 0, uz = repVystupyVerzie();
  return '<div class="card" style="padding:10px 14px;margin-bottom:10px"><b>Uložiť do Výstupov projektu</b><div class="csub" style="margin:2px 0 6px">Vybrané súbory sa uložia ako výstupy projektu (šifrovane, s väzbou na verziu ' + esc(REP.verziaCislo || "") + ' tohto cyklu) — uvidí ich celý tím v záložke Výstupy.</div>' +
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px">' + Object.keys(REP_VYSTUP_NAZVY).filter(d => d !== "qa" || qa).map(d =>
      '<label style="display:flex;gap:4px;align-items:center"><input type="checkbox"' + (V[d] ? " checked" : "") + ' onchange="REP.vystupyVyber.' + d + '=this.checked"> ' + esc(REP_VYSTUP_NAZVY[d]) + "</label>").join("") + "</div>" +
    (uz.length ? '<div class="csub" style="margin:0 0 6px">K tejto verzii už sú vo Výstupoch: ' + esc(uz.map(v => v.cislo + " " + v.nazov).join(" · ")) + "</div>" : "") +
    '<button class="aabtn" onclick="repUlozDoVystupov()">Uložiť do Výstupov</button></div>';
}
// Výstupy projektu, ktoré už nesú väzbu na otvorenú verziu cyklu (zoznam B2B).
function repVystupyVerzie(){
  const d = typeof B2B !== "undefined" && B2B.d;
  return REP.verziaId && d ? (d.vystupy || []).filter(v => !v.zmazane && v.rep_cyklus_verzia === REP.verziaId) : [];
}
// Poradie: založiť výstup → nahrať šifrovaný súbor → priradiť k verzii cyklu.
// Pád uprostred povie, ktorý výstup je založený a čo mu chýba.
async function repUlozDoVystupov(){
  const os = b2bMojaOsoba();
  if (!REP.verziaSnimka || !REP.verziaId) return;
  if (!os) return alert("Vo Výstupoch projektu ukladá len aktívny člen projektu.");
  const K = repKontextCyklu(), V = REP.vystupyVyber || {}, qa = repLayout(K.view, K.tema, null, { balik: "qa" }).strany.length > 0;
  const druhy = Object.keys(REP_VYSTUP_NAZVY).filter(d => V[d] && (d !== "qa" || qa));
  if (!druhy.length) return alert("Vyberte aspoň jeden súbor.");
  const uz = repVystupyVerzie();
  if (uz.length && !confirm("K tejto verzii cyklu už sú vo Výstupoch " + uz.map(v => v.cislo).join(", ") + ". Uložiť ďalšie?")) return;
  const ulozene = [];
  let rozpracovany = null;
  try {
    for (const d of druhy) {
      REP.pracuje = "Ukladám do Výstupov: " + REP_VYSTUP_NAZVY[d] + "…"; repPrekresli();
      const s = await repSubor(d, K);
      if (s.blob.size > 25 * 1024 * 1024) throw new Error(s.nazov + " má viac než 25 MB");
      const nazov = REP_VYSTUP_NAZVY[d] + " " + (REP.program.kod || REP.program.nazov || "") + " k " + repDMR(REP.cyklus.stav_ku_dnu);
      const r = await sb.rpc("b2b_vystup_zaloz", { p_projekt: REP.pid, p_typ: null, p_nazov: nazov, p_datum: REP.cyklus.stav_ku_dnu, p_autori: [os.id] });
      if (r.error) throw r.error;
      const v = r.data || {};
      rozpracovany = v.cislo;
      await b2bEdgeSubor({ akcia: "vystup_nahraj", vystup: v.id, nazov: s.nazov }, s.blob);
      const p = await sb.rpc("b2b_rep_vystup_prirad", { p_vystup: v.id, p_cyklus_verzia: REP.verziaId });
      if (p.error) throw p.error;
      rozpracovany = null;
      ulozene.push(v.cislo);
      if (typeof B2B !== "undefined" && B2B.d) B2B.d.vystupy = (B2B.d.vystupy || []).concat([{ id: v.id, projekt_id: REP.pid, cislo: v.cislo, nazov, datum: REP.cyklus.stav_ku_dnu, typ: null,
        autori: [os.id], zmazane: null, rep_cyklus_verzia: REP.verziaId }]);
    }
    REP.pracuje = "";
    alert("Uložené do Výstupov projektu: " + ulozene.join(", ") + ".");
  } catch (e) {
    const pred = (ulozene.length ? "Uložené: " + ulozene.join(", ") + ". " : "") + (rozpracovany ? "Výstup " + rozpracovany + " je založený, ale nie je dokončený (súbor alebo väzba na verziu) — skontrolujte ho v záložke Výstupy. " : "");
    return repChyba(e, pred + "Uloženie do Výstupov sa nepodarilo");
  }
  repPrekresli();
}
