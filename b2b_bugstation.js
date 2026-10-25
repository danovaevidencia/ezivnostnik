// ═══════════════════════════════════════════════════════════════
//  b2b_bugstation.js — BUGstation: úlohy, defekty, incidenty a zmenové
//  požiadavky B2B projektu (dev/docs/NAVRH_B2B_BUGSTATION.md, č. 307)
//
//  Klasický skript načítaný lenivo (bsNacitaj v appke, ?v=APP_VERZIA),
//  beží v globálnom rozsahu appky — všetky mená majú predponu bs / BS_.
//  Nástroj je anonymný: v kóde nie je klient, projekt ani osoba.
//
//  Server (admin_88) je strážca stavov a práv. Appka z tých istých tabuliek
//  len kreslí tlačidlá: BS_AKCIE = b2b_bs_akcie(), BS_POLIA = biely zoznam
//  b2b_bs_polia() — zhodu oboch kópií stráži test_bs_stavy.
//  Výpočty (§9 návrhu) sú čisté funkcie bez DOM; čas dostávajú v parametri.
// ═══════════════════════════════════════════════════════════════

// ── typy a stavy ────────────────────────────────────────────────
const BS_TYPY = {
  uloha:    { pismeno: "U", nazov: "Úloha", mnozne: "Úlohy", os: "Priorita", stlpec: "Úloha" },
  defekt:   { pismeno: "B", nazov: "Defekt", mnozne: "Defekty", os: "Závažnosť", stlpec: "Popis defektu" },
  incident: { pismeno: "I", nazov: "Incident", mnozne: "Incidenty", os: "Dopad", stlpec: "Popis incidentu" },
  zmena:    { pismeno: "C", nazov: "Zmenová požiadavka", mnozne: "Zmenové požiadavky", os: "Rozsah", stlpec: "Požiadavka na zmenu" }
};
const BS_TYPY_PORADIE = ["uloha", "defekt", "incident", "zmena"];
const BS_TYPY_8 = ["defekt", "incident", "zmena"];

// Stavy v poradí životného cyklu z návrhu (README_HANDOFF „Stavy záznamov“):
// [kľúč, text, odtieň oklch, sýtosť]. Texty sa do viet vkladajú doslovne.
const BS_STAVY = [
  ["identifikovane", "Identifikované", 38, 0.13],
  ["odoslane", "Odoslané na riešenie", 250, 0.10],
  ["akceptovane", "Akceptované na riešenie", 285, 0.10],
  ["vysvetlene", "Vyriešené vysvetlením", 250, 0.02],
  ["retest", "Pripravené na retest", 78, 0.12],
  ["ok_test", "OK na TEST", 178, 0.10],
  ["prod", "Nasadené na PROD", 235, 0.11],
  ["ok_prod", "OK na PROD", 162, 0.11]
];
const BS_STAVY_ULOHA = [
  ["nova", "Nová", 250, 0.10],
  ["rozpracovana", "Rozpracovaná", 285, 0.10],
  ["hotova", "Hotová", 162, 0.11],
  ["zrusena", "Zrušená", 250, 0.02]
];
function bsStavy(typ){ return typ === "uloha" ? BS_STAVY_ULOHA : BS_STAVY; }
function bsStav(k){
  return BS_STAVY.find(s => s[0] === k) || BS_STAVY_ULOHA.find(s => s[0] === k) || [k, k, 250, 0.06];
}
// Úroveň 1–4 (1 = najvážnejšia): farby podľa čísla, názvy z nastavení projektu (§6.2).
const BS_UROVNE_FARBY = { 1: [32, 0.14], 2: [58, 0.12], 3: [85, 0.11], 4: [255, 0.06] };

const BS_ROZLISENIA = [
  ["vysvetlenie", "Vysvetlené"],
  ["duplicita", "Duplicita"],
  ["nezopakovatelne", "Nedá sa zopakovať"],
  ["nebude", "Nebude sa riešiť"],
  ["mimo_rozsahu", "Mimo rozsahu"],
  ["omyl", "Založené omylom"]
];

// ── roly a akcie (§5, §24) ──────────────────────────────────────
const BS_ROLY = {
  tm: "Test manager",
  ttl: "Test team leader",
  tester: "Tester",
  dmd: "Defekt manažér dodávateľa",
  riesitel: "Riešiteľ",
  citatel: "Čitateľ"
};
const BS_PRACOVNICI = ["tm", "ttl", "tester", "dmd", "riesitel"];

// Poradie akcií je poradie tlačidiel: prvá povolená = primárna akcia v detaile.
// pridelenyRiesitel: rola riesitel smie len na zázname, kde je riešiteľom ona.
// len: "neprijate" | "uzavrete" — doplnková podmienka nad stavom.
// prijate: akcia sama uzavrie vysvetlenie; prijateRoly: uzavrie, ak ju urobí tá rola.
const BS_AKCIE = {
  odoslat:    { typy: BS_TYPY_8, z: ["identifikovane"], na: "odoslane", roly: ["tm", "ttl"], povinne: 1, text: "Odoslať na riešenie" },
  zamietnut:  { typy: BS_TYPY_8, z: ["identifikovane"], na: "vysvetlene", roly: ["tm", "ttl"], rozlisenie: 1, komentar: 1, prijate: 1, text: "Zamietnuť" },
  prevziat:   { typy: ["defekt", "incident"], z: ["odoslane"], na: "akceptovane", roly: ["dmd", "riesitel"], pridelenyRiesitel: 1, text: "Prevziať" },
  schvalit:   { typy: ["zmena"], z: ["odoslane"], na: "akceptovane", roly: ["tm"], text: "Schváliť" },
  na_retest:  { typy: BS_TYPY_8, z: ["akceptovane"], na: "retest", roly: ["dmd", "riesitel"], pridelenyRiesitel: 1, text: "Poslať na retest" },
  hotfix:     { typy: ["incident"], z: ["akceptovane"], na: "prod", roly: ["dmd"], text: "Hotfix nasadený" },
  vysvetlit:  { typy: BS_TYPY_8, z: ["odoslane", "akceptovane"], na: "vysvetlene", roly: ["dmd", "tm", "ttl"], rozlisenie: 1, komentar: 1, prijateRoly: ["tm", "ttl"], text: "Vyriešiť vysvetlením" },
  prijat:     { typy: BS_TYPY_8, z: ["vysvetlene"], na: "vysvetlene", roly: ["tm", "ttl"], len: "neprijate", text: "Prijať vysvetlenie" },
  neprijat:   { typy: BS_TYPY_8, z: ["vysvetlene"], na: "odoslane", roly: ["tm", "ttl"], len: "neprijate", komentar: 1, znovu: 1, text: "Neprijať vysvetlenie" },
  retest_ok:  { typy: BS_TYPY_8, z: ["retest"], na: "ok_test", roly: ["tester", "ttl", "tm"], text: "Retest OK" },
  retest_nie: { typy: BS_TYPY_8, z: ["retest"], na: "akceptovane", roly: ["tester", "ttl", "tm"], komentar: 1, znovu: 1, text: "Retest neprešiel" },
  nasadene:   { typy: BS_TYPY_8, z: ["ok_test"], na: "prod", roly: ["dmd"], text: "Nasadené na PROD" },
  overene:    { typy: BS_TYPY_8, z: ["prod"], na: "ok_prod", roly: ["tester", "ttl", "tm"], text: "Overené na PROD" },
  prod_nie:   { typy: BS_TYPY_8, z: ["prod"], na: "akceptovane", roly: ["tester", "ttl", "tm"], komentar: 1, znovu: 1, text: "Na PROD neprešlo" },
  znovu:      { typy: BS_TYPY_8, z: ["ok_prod", "vysvetlene"], na: "odoslane", roly: ["tm", "ttl"], len: "uzavrete", komentar: 1, znovu: 1, text: "Znovu otvoriť" },
  zacat:      { typy: ["uloha"], z: ["nova"], na: "rozpracovana", roly: BS_PRACOVNICI, text: "Začať" },
  dokoncit:   { typy: ["uloha"], z: ["nova", "rozpracovana"], na: "hotova", roly: BS_PRACOVNICI, text: "Hotovo" },
  zrusit:     { typy: ["uloha"], z: ["nova", "rozpracovana"], na: "zrusena", roly: BS_PRACOVNICI, rozlisenie: 1, text: "Zrušiť" },
  obnovit:    { typy: ["uloha"], z: ["hotova", "zrusena"], na: "rozpracovana", roly: BS_PRACOVNICI, znovu: 1, text: "Obnoviť" }
};
// Oprava stavu (ľubovoľný → ľubovoľný s dôvodom) nie je v tabuľke: smie TM a správca.
const BS_OPRAVA_ROLY = ["tm"];

// Polia záznamu podľa typu (§6.1) — biely zoznam pre formulár aj server.
// „priloha“ nie je stĺpec: povinnosť sa overí pri odoslaní na riešenie.
const BS_POLIA = {
  popis:          { nazov: "Opis", typy: ["uloha", "defekt", "incident", "zmena"] },
  is_id:          { nazov: "IS", typy: ["defekt", "incident", "zmena"], ciselnik: "is" },
  modul_id:       { nazov: "Modul", typy: ["uloha", "defekt", "incident", "zmena"], ciselnik: "moduly" },
  prostredie_id:  { nazov: "Prostredie", typy: ["defekt", "incident"], ciselnik: "prostredia" },
  scenar:         { nazov: "Scenár", typy: ["defekt"] },
  pripad:         { nazov: "Prípad", typy: ["defekt"] },
  poziadavka_id:  { nazov: "Biznis požiadavka", typy: ["defekt", "zmena"] },
  priloha:        { nazov: "Printscreen / príloha", typy: ["uloha", "defekt", "incident", "zmena"] },
  identifikovane: { nazov: "Kedy identifikované", typy: ["defekt", "incident"] },
  suvisi:         { nazov: "Súvisí s", typy: ["uloha", "defekt", "incident", "zmena"] },
  termin:         { nazov: "Požadovaný termín", typy: ["uloha", "defekt", "incident", "zmena"] },
  release_id:     { nazov: "Release", typy: ["defekt", "incident", "zmena"], ciselnik: "releasy" },
  riesitel:       { nazov: "Riešiteľ", typy: ["uloha", "defekt", "incident", "zmena"] },
  ziadatel:       { nazov: "Žiadateľ", typy: ["zmena"] }
};
function bsPoliaTypu(typ){ return Object.keys(BS_POLIA).filter(k => BS_POLIA[k].typy.includes(typ)); }

// ── uzavretie a akcie (D20) ─────────────────────────────────────
// „Konečný stav je OK za zákazníka“: uzavreté je len OK na PROD a vysvetlenie
// prijaté TM/TTL. Nasadené na PROD a neprijaté vysvetlenie sú otvorené.
function bsUzavrety(z){
  if (!z) return false;
  if (z.typ === "uloha") return z.stav === "hotova" || z.stav === "zrusena";
  return z.stav === "ok_prod" || (z.stav === "vysvetlene" && !!z.vysvetlenie_prijate);
}
function bsOtvoreny(z){ return !!z && !z.zmazane && !bsUzavrety(z); }
// Otvorené sa delia podľa toho, kto má loptičku (§9).
function bsUZakaznika(z){
  return bsOtvoreny(z) && z.typ !== "uloha" &&
    (z.stav === "retest" || z.stav === "ok_test" || z.stav === "prod" || z.stav === "vysvetlene");
}

// ja = { osoba: id osoby projektu, roly: [...], spravca: bool }
function bsMaRolu(ja, roly){
  if (!ja) return false;
  if (ja.spravca) return true;
  return (ja.roly || []).some(r => roly.includes(r));
}
function bsAkciaPovolena(z, k, ja){
  const a = BS_AKCIE[k];
  if (!a || !z || z.zmazane || !ja) return false;
  if (!a.typy.includes(z.typ) || !a.z.includes(z.stav)) return false;
  if (a.len === "neprijate" && z.vysvetlenie_prijate) return false;
  if (a.len === "uzavrete" && !bsUzavrety(z)) return false;
  if (ja.spravca) return true;
  const moje = (ja.roly || []).filter(r => a.roly.includes(r));
  if (!moje.length) return false;
  // Riešiteľ bez inej oprávnenej roly smie len na svojom pridelenom zázname.
  if (a.pridelenyRiesitel && moje.length === 1 && moje[0] === "riesitel") return z.riesitel_osoba === ja.osoba;
  return true;
}
function bsAkcieZaznamu(z, ja){ return Object.keys(BS_AKCIE).filter(k => bsAkciaPovolena(z, k, ja)); }
function bsSmieOpravu(ja){ return bsMaRolu(ja, BS_OPRAVA_ROLY); }
// Vysvetlenie od TM/TTL (alebo správcu) je prijaté hneď — rozhodla strana zákazníka.
function bsPrijateHned(k, ja){
  const a = BS_AKCIE[k];
  if (!a) return false;
  if (a.prijate) return true;
  return !!a.prijateRoly && bsMaRolu(ja, a.prijateRoly);
}

// „Čaká na mňa“ (§5.4): podľa mojich rolí, zlúčené.
const BS_CAKA = {
  tm: z => z.stav === "identifikovane" || (z.stav === "vysvetlene" && !z.vysvetlenie_prijate) ||
    z.stav === "prod" || (z.typ === "zmena" && z.stav === "odoslane"),
  ttl: z => z.stav === "identifikovane" || (z.stav === "vysvetlene" && !z.vysvetlenie_prijate) || z.stav === "retest",
  tester: (z, ja) => z.nahlasil === ja.osoba && (z.stav === "retest" || z.stav === "prod"),
  dmd: z => (z.stav === "odoslane" && z.typ !== "zmena") ||
    (z.stav === "akceptovane" && !z.riesitel_osoba && !z.riesitel_tim) || z.stav === "ok_test",
  riesitel: (z, ja) => z.riesitel_osoba === ja.osoba && z.stav === "akceptovane"
};
function bsCakaNaMna(z, ja){
  if (!bsOtvoreny(z) || !ja) return false;
  if (z.typ === "uloha") return !!ja.osoba && z.riesitel_osoba === ja.osoba;
  const roly = ja.spravca && !(ja.roly || []).length ? ["tm"] : (ja.roly || []);
  return roly.some(r => BS_CAKA[r] && BS_CAKA[r](z, ja));
}

// ── kľúč, úrovne, texty ─────────────────────────────────────────
function bsKluc(kodProjektu, typ, cislo){ return String(kodProjektu || "") + "-" + BS_TYPY[typ].pismeno + cislo; }
function bsUrovenNazov(nastavenia, typ, u){
  const m = ((nastavenia || {}).urovne || {})[typ] || {};
  return m[u] || m[String(u)] || ("Úroveň " + u);
}
function bsUrovneTypu(nastavenia, typ){
  const m = ((nastavenia || {}).urovne || {})[typ] || {};
  return Object.keys(m).map(Number).filter(u => u >= 1 && u <= 4).sort((a, b) => a - b);
}
function bsCiselnikNazov(nastavenia, ciselnik, id){
  if (!id) return "";
  const x = (((nastavenia || {})[ciselnik]) || []).find(p => p.id === id);
  return x ? x.nazov : "";
}
function bsPocet(n, jeden, dva, viac){
  return n + " " + (typeof sklon === "function" ? sklon(n, jeden, dva, viac) : (n === 1 ? jeden : (n >= 2 && n <= 4 ? dva : viac)));
}

// ── povinné polia (§6.4) ────────────────────────────────────────
// Rovnaké pravidlo ako server (b2b_bs_chyba_povinnych): neprázdne. Príloha sa
// overuje až pri odoslaní na riešenie, keď už záznam má id a prílohy.
function bsPrazdne(v){ return v == null || v === "" || (Array.isArray(v) && !v.length); }
function bsChybajucePovinne(typ, polia, nastavenia, opts){
  const o = opts || {};
  const p = (((nastavenia || {}).povinne) || {})[typ] || {};
  const chyba = [];
  if (bsPrazdne(polia.nazov)) chyba.push("Názov");
  if (bsPrazdne(polia.uroven)) chyba.push(BS_TYPY[typ].os);
  bsPoliaTypu(typ).forEach(k => {
    if (p[k] !== "povinne") return;
    if (k === "priloha") { if (o.sPrilohou && !(o.pocetPriloh > 0)) chyba.push(BS_POLIA[k].nazov); return; }
    if (k === "riesitel") { if (bsPrazdne(polia.riesitel_osoba) && bsPrazdne(polia.riesitel_tim)) chyba.push(BS_POLIA[k].nazov); return; }
    // Číselník bez položiek sa nevyžaduje — nie je z čoho vybrať (rovnako server).
    const c = BS_POLIA[k].ciselnik;
    if (c && !((((nastavenia || {})[c]) || []).length)) return;
    if (bsPrazdne(polia[k])) chyba.push(BS_POLIA[k].nazov);
  });
  return chyba;
}

// ── odvodenia (§9) — jedna pravda pre KPI, badge, podtitulky ────
const BS_DEN = 86400000;
const BS_ZNOVU = Object.keys(BS_AKCIE).filter(k => BS_AKCIE[k].znovu);

// Stav záznamu k času t z histórie (udalosti zalozenie/stav/prijatie/zmazanie).
// null = záznam vtedy ešte neexistoval alebo bol zmazaný.
function bsStavK(z, hist, t){
  const h = (hist || []).filter(x => x.zaznam_id === z.id && new Date(x.kedy).getTime() <= t)
    .sort((a, b) => new Date(a.kedy) - new Date(b.kedy));
  if (!h.length || h[0].udalost !== "zalozenie") return null;
  let stav = h[0].na, prijate = null;
  for (const x of h) {
    if (x.udalost === "stav") { stav = x.na; prijate = null; if (x.akcia && bsPrijateZHistorie(x)) prijate = x.kedy; }
    else if (x.udalost === "prijatie") prijate = x.kedy;
    else if (x.udalost === "zmazanie") return null;
  }
  return { typ: z.typ, stav, vysvetlenie_prijate: prijate };
}
// Prechod, ktorý vysvetlenie rovno uzavrel, nesie v histórii príznak prijate.
function bsPrijateZHistorie(x){ return !!(x.data && x.data.prijate); }
function bsOtvorenyK(z, hist, t){
  const s = bsStavK(z, hist, t);
  return !!s && !bsUzavrety(s);
}

// Pracovné dni medzi dvoma časmi (víkendy a sviatky appky sa nerátajú), 1 desatinné.
function bsPracDni(od, po){
  const a = new Date(od).getTime(), b = new Date(po).getTime();
  if (!(b > a)) return 0;
  let ms = 0;
  for (let t = a; t < b; ) {
    const d = new Date(t);
    const koniecDna = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const krok = Math.min(koniecDna, b) - t;
    const prac = typeof isPracDen === "function" ? isPracDen(d) : (d.getDay() >= 1 && d.getDay() <= 5);
    if (prac) ms += krok;
    t += krok;
  }
  return Math.round(ms / BS_DEN * 10) / 10;
}

function bsOdvod(zaznamy, hist, teraz){
  const t = teraz != null ? teraz : Date.now();
  const zz = (zaznamy || []).filter(z => !z.zmazane);
  const otv = zz.filter(bsOtvoreny);
  const poTypoch = {};
  BS_TYPY_PORADIE.forEach(typ => {
    const vsetky = zz.filter(z => z.typ === typ);
    const o = otv.filter(z => z.typ === typ);
    poTypoch[typ] = { vsetky: vsetky.length, otvorene: o.length, uZakaznika: o.filter(bsUZakaznika).length };
  });
  const otvDef = otv.filter(z => z.typ === "defekt");
  const urovne = [1, 2, 3, 4].map(u => otvDef.filter(z => +z.uroven === u).length);
  const blokujuce = otvDef.filter(z => +z.uroven === 1);
  const nad48 = blokujuce.filter(z => t - new Date(z.vytvorene).getTime() > 2 * BS_DEN).length;
  const tyzden = t - 7 * BS_DEN;
  const otvDefPred = zz.filter(z => z.typ === "defekt" && bsOtvorenyK(z, hist, tyzden)).length;
  // Priebeh stavov: tri 8-stavové typy podľa stavu; neprijaté vysvetlenie je v stĺpci svojho stavu.
  const priebeh = BS_STAVY.map(s => [s[0], zz.filter(z => z.typ !== "uloha" && z.stav === s[0]).length]);
  const ulohy = BS_STAVY_ULOHA.map(s => [s[0], zz.filter(z => z.typ === "uloha" && z.stav === s[0]).length]);
  return {
    poTypoch, urovne,
    otvorene: otv.length,
    blokujuce: blokujuce.length, blokujuceNad48: nad48,
    deltaDefektov: otvDef.length - otvDefPred,
    priebeh, ulohy,
    zmenyVObehu: poTypoch.zmena.otvorene,
    casOpravy: bsCasOpravy(zz, hist, t),
    reopen: bsReopen(zz, hist)
  };
}
// Priemer pracovných dní od prvého Odoslané na riešenie po prvé Pripravené na
// retest pri defektoch, ktoré retest dosiahli za posledných 30 dní (§9).
function bsCasOpravy(zaznamy, hist, t){
  const od30 = t - 30 * BS_DEN, vys = [];
  zaznamy.filter(z => z.typ === "defekt").forEach(z => {
    const h = (hist || []).filter(x => x.zaznam_id === z.id).sort((a, b) => new Date(a.kedy) - new Date(b.kedy));
    const zac = h.find(x => x.na === "odoslane" && (x.udalost === "stav" || x.udalost === "zalozenie"));
    const kon = h.find(x => x.udalost === "stav" && x.na === "retest");
    if (!zac || !kon) return;
    const k = new Date(kon.kedy).getTime();
    if (k < od30 || k > t) return;
    vys.push(bsPracDni(zac.kedy, kon.kedy));
  });
  if (!vys.length) return null;
  return Math.round(vys.reduce((a, b) => a + b, 0) / vys.length * 10) / 10;
}
// Podiel defektov s aspoň jedným znovuotvorením spomedzi tých, ktoré aspoň raz
// dosiahli Pripravené na retest alebo Vyriešené vysvetlením (§9).
function bsReopen(zaznamy, hist){
  let zaklad = 0, znovu = 0;
  zaznamy.filter(z => z.typ === "defekt").forEach(z => {
    const h = (hist || []).filter(x => x.zaznam_id === z.id && x.udalost === "stav");
    if (!h.some(x => x.na === "retest" || x.na === "vysvetlene")) return;
    zaklad++;
    if (h.some(x => BS_ZNOVU.includes(x.akcia))) znovu++;
  });
  return zaklad ? Math.round(znovu / zaklad * 1000) / 10 : null;
}

// ── filter (§13, §15) — ten istý pre ručné chipy aj otázku cez AI ─
// f = { typy, stav: "vsetky"|"otvorene"|[stavy], urovne, is, moduly, prostredia,
//       releasy, riesitel: id osoby|"ja", cakaNaMna, text, vekDniMin }
function bsNorm(s){
  return String(s == null ? "" : s).normalize("NFD")
    .replace(new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g"), "")
    .toLowerCase().trim();
}
function bsFilter(zaznamy, f, ja, teraz){
  const ff = f || {}, t = teraz != null ? teraz : Date.now();
  const v = (pole, hodnoty) => !hodnoty || !hodnoty.length || hodnoty.includes(pole);
  const text = bsNorm(ff.text);
  return (zaznamy || []).filter(z => {
    if (z.zmazane) return false;
    if (!v(z.typ, ff.typy)) return false;
    if (ff.stav === "otvorene" && !bsOtvoreny(z)) return false;
    if (Array.isArray(ff.stav) && ff.stav.length && !ff.stav.includes(z.stav)) return false;
    if (!v(+z.uroven, ff.urovne)) return false;
    if (!v(z.is_id, ff.is) || !v(z.modul_id, ff.moduly) || !v(z.prostredie_id, ff.prostredia) || !v(z.release_id, ff.releasy)) return false;
    if (ff.riesitel) {
      const kto = ff.riesitel === "ja" ? (ja || {}).osoba : ff.riesitel;
      if (z.riesitel_osoba !== kto) return false;
    }
    if (ff.cakaNaMna && !bsCakaNaMna(z, ja)) return false;
    if (ff.poSla) { const s = bsSla(z, t); if (!s || !s.po || s.druh === "koniec") return false; }
    if (ff.vekDniMin != null) {
      const od = new Date(z.identifikovane || z.vytvorene).getTime();
      if (t - od < ff.vekDniMin * BS_DEN) return false;
    }
    if (text && !bsNorm(z.kluc + " " + z.nazov).includes(text)) return false;
    return true;
  });
}

// ── SLA (§10, BS1b) ─────────────────────────────────────────────
// Termíny počíta server (trigger b2b_bs_sla nad históriou a pracovným časom
// po–pi 8–16 bez sviatkov) — platforma je neutrálna, termín, o ktorom sa môžu
// strany sporiť, nepočíta klient jednej z nich. Appka ich len číta a ukáže.
// „Blízko termínu“ = server už poslal upozornenie (sla_upozornene), nie odhad
// appky: pracovný čas do termínu by inak počítali dve kópie pravidla.
const BS_SLA_BEH = ["odoslane", "akceptovane"];
function bsMinText(m){
  const x = Math.max(0, Math.round(m)), d = Math.floor(x / 1440), h = Math.floor((x % 1440) / 60), mi = x % 60;
  return d ? d + " d" + (h ? " " + h + " h" : "") : h ? h + " h" + (mi ? " " + mi + " min" : "") : mi + " min";
}
function bsTerminText(ts){ const d = new Date(ts); return isNaN(d) ? "" : bsDM(ts) + " " + bsDva(d.getHours()) + ":" + bsDva(d.getMinutes()); }
function bsSla(z, teraz){
  const t = teraz != null ? teraz : Date.now();
  if (!z || z.typ === "uloha" || z.zmazane) return null;
  if (z.stav === "identifikovane" && z.sla_triaz_do) {
    const ms = new Date(z.sla_triaz_do).getTime() - t;
    return { druh: "triaz", po: ms < 0, blizko: false, termin: z.sla_triaz_do,
      text: ms < 0 ? "triáž po termíne " + bsMinText(-ms / 60000) : "triáž do " + bsTerminText(z.sla_triaz_do) };
  }
  if (BS_SLA_BEH.includes(z.stav) && z.sla_vyriesenie_do) {
    const ms = new Date(z.sla_vyriesenie_do).getTime() - t;
    return { druh: "bezi", po: ms < 0, blizko: ms >= 0 && (z.sla_upozornene || []).includes("blizko"), termin: z.sla_vyriesenie_do,
      text: ms < 0 ? "po termíne " + bsMinText(-ms / 60000) : "termín " + bsTerminText(z.sla_vyriesenie_do) + " · zostáva " + bsMinText(ms / 60000) };
  }
  if (z.sla_zostava_min != null) {
    const m = +z.sla_zostava_min;
    if (!bsOtvoreny(z)) return { druh: "koniec", po: m < 0, blizko: false, termin: null, text: m < 0 ? "vyriešené po termíne SLA" : "vyriešené v termíne SLA" };
    // Pauza: loptička u zákazníka (retest, OK na TEST, PROD, neprijaté vysvetlenie).
    return { druh: "pauza", po: m < 0, blizko: false, termin: null,
      text: "pozastavené · " + (m < 0 ? "po termíne " + bsMinText(-m) : "zostáva " + bsMinText(m)) + " prac. času" };
  }
  return null;
}
function bsSlaReakcia(z, teraz){
  if (!z || !z.sla_reakcia_do) return "";
  const t = teraz != null ? teraz : Date.now(), d = new Date(z.sla_reakcia_do).getTime();
  if (z.sla_reakcia_kedy) return new Date(z.sla_reakcia_kedy).getTime() <= d ? "v termíne" : "po termíne";
  return t > d ? "po termíne (" + bsTerminText(z.sla_reakcia_do) + ")" : "do " + bsTerminText(z.sla_reakcia_do);
}
// Pravidlá v nastaveniach: „4 h“, „2 d“, „90 min“; deň = 8 h v pracovnom čase, 24 h pri 24 × 7.
function bsSlaMin(text, nonstop){
  const s = String(text == null ? "" : text).trim().toLowerCase().replace(",", ".");
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(min|m|h|hod|d|dni|dní|deň|den)?$/);
  if (!m) return NaN;
  const n = parseFloat(m[1]), j = m[2] || "h";
  const min = j === "min" || j === "m" ? n : j.startsWith("d") ? n * (nonstop ? 1440 : 480) : n * 60;
  return Math.round(min) >= 1 && Math.round(min) <= 525600 ? Math.round(min) : NaN;
}
function bsSlaZMin(min, nonstop){
  if (min == null || min === "") return "";
  const den = nonstop ? 1440 : 480;
  return min % den === 0 ? (min / den) + " d" : min % 60 === 0 ? (min / 60) + " h" : min + " min";
}

// ═══════════════════════════════════════════════════════════════
//  VZHĽAD — tokeny z dizajnového balíčka (README_HANDOFF „Design Tokens“)
//  Všetko pod koreňom .bs; chipy cez --h / --c (odtieň a sýtosť oklch).
// ═══════════════════════════════════════════════════════════════
const BS_PISMO = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";
const BS_CSS = [
  ".bs,.bs-ok{--bs-rail:#22304a;--bs-ak:#2f4260;--bs-okr:#e2a94f;--bs-okr2:#d99a3f;--bs-pet:#57a396;--bs-pet2:#3f8a7d;--bs-odznak:#2b6a5f;",
  "--bs-bg:#eef1f6;--bs-main:#f6f7fa;--bs-panel:#fff;--bs-thead:#f7f9fc;--bs-hover:#f4f6fa;--bs-vyb:#eaeff7;",
  "--bs-t1:#1b2740;--bs-t2:#243350;--bs-t3:#42506a;--bs-t4:#56637a;--bs-t5:#4d5a70;",
  "--bs-l08:rgba(34,48,74,.08);--bs-l09:rgba(34,48,74,.09);--bs-l13:rgba(34,48,74,.13);--bs-l14:rgba(34,48,74,.14);--bs-l16:rgba(34,48,74,.16);--bs-l18:rgba(34,48,74,.18);--bs-l30:rgba(34,48,74,.3);",
  "--bs-chip-l:.95;--bs-chip-c:.35;--bs-chip-tl:.42;--bs-bar-l:.62;--bs-tien:0 12px 28px rgba(27,39,64,.16);",
  "--bs-sans:'IBM Plex Sans',system-ui,-apple-system,'Segoe UI',sans-serif;--bs-mono:'IBM Plex Mono',ui-monospace,Consolas,monospace}",
  ".bs-ok{font-family:var(--bs-sans);color:var(--bs-t1)}",
  ".bs{display:flex;min-height:520px;height:calc(100vh - var(--bs-hore,132px));overflow:hidden;background:var(--bs-bg);color:var(--bs-t1);font-family:var(--bs-sans);border-radius:10px;border:1px solid var(--bs-l13)}",
  "[data-tema=\"tmavy\"] .bs,[data-tema=\"tmavy\"] .bs-ok{--bs-rail:#141c2c;--bs-ak:#6f8fc4;--bs-bg:#0f1520;--bs-main:#121a27;--bs-panel:#182131;--bs-thead:#1c2638;--bs-hover:#1f2a3d;--bs-vyb:#24324a;",
  "--bs-t1:#e8edf5;--bs-t2:#d6dde9;--bs-t3:#bcc6d6;--bs-t4:#a6b1c3;--bs-t5:#aab4c5;",
  "--bs-l08:rgba(214,222,236,.08);--bs-l09:rgba(214,222,236,.09);--bs-l13:rgba(214,222,236,.13);--bs-l14:rgba(214,222,236,.14);--bs-l16:rgba(214,222,236,.16);--bs-l18:rgba(214,222,236,.2);--bs-l30:rgba(214,222,236,.34);",
  "--bs-chip-l:.30;--bs-chip-c:.55;--bs-chip-tl:.86;--bs-bar-l:.66;--bs-tien:0 12px 28px rgba(0,0,0,.45)}",
  ".bs *{box-sizing:border-box}",
  ".bs button{font-family:inherit;cursor:pointer}",
  ".bs .mono{font-family:var(--bs-mono)}",
  // rail
  ".bs-rail{width:58px;flex:none;display:flex;flex-direction:column;background:var(--bs-rail);color:#eef2f8;transition:width .18s ease;position:relative;z-index:3}",
  ".bs-rail.on{width:224px}",
  ".bs-rh{display:flex;flex-direction:column;align-items:center;gap:9px;padding:12px 8px 14px;min-width:0}",
  ".bs-rail.on .bs-rh{flex-direction:row;padding:12px 12px 14px}",
  ".bs-rh-nazov{font:600 13.5px/1 var(--bs-sans);letter-spacing:-.3px;white-space:nowrap}",
  ".bs-rh-nazov span{font-weight:400;color:rgba(238,242,248,.72)}",
  ".bs-rail:not(.on) .bs-iba-on{display:none!important}",
  ".bs-prep{display:flex;align-items:center;justify-content:center;flex:none;width:26px;height:26px;border:none;border-radius:7px;background:rgba(255,255,255,.09)}",
  ".bs-rail.on .bs-prep{margin-left:auto}",
  ".bs-projw{position:relative;padding:0 8px 10px;min-width:0}",
  ".bs-projb{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-width:0;padding:7px 0;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:rgba(255,255,255,.07);color:#fff;text-align:left}",
  ".bs-rail.on .bs-projb{justify-content:flex-start;padding:7px 9px}",
  ".bs-kod{flex:none;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;background:var(--bs-odznak);font:600 9px/1 var(--bs-mono);color:#fff}",
  ".bs-projt{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}",
  ".bs-projt b{font:500 11.5px/1.2 var(--bs-sans);color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".bs-projt i{font:400 9.5px/1.2 var(--bs-sans);font-style:normal;color:#b0bacb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".bs-menu{position:absolute;top:calc(100% - 4px);left:6px;z-index:20;width:280px;background:#fff;border:1px solid rgba(34,48,74,.16);border-radius:10px;box-shadow:var(--bs-tien);overflow:hidden;color:#1b2740}",
  ".bs-rail.on .bs-menu{left:8px}",
  ".bs-menu-h{padding:9px 12px 7px;font:500 9.5px/1 var(--bs-mono);letter-spacing:.5px;color:#4d5a70}",
  ".bs-menu-p{display:flex;align-items:flex-start;gap:10px;width:100%;padding:9px 12px;border:none;border-top:1px solid rgba(34,48,74,.08);background:#fff;text-align:left}",
  ".bs-menu-p.on{background:#eaeff7}",
  ".bs-menu-p .bs-kod{background:#dfe5ee;color:#42506a}",
  ".bs-menu-p.on .bs-kod{background:#2f4260;color:#fff}",
  ".bs-menu-p b{display:block;font:500 12px/1.2 var(--bs-sans);color:#1b2740}",
  ".bs-menu-p i{display:block;font:400 10.5px/1.25 var(--bs-sans);font-style:normal;color:#56637a;margin-top:3px}",
  ".bs-menu-p .bs-tick{flex:none;font:500 12px/1.4 var(--bs-sans);color:#2f4260;visibility:hidden}",
  ".bs-menu-p.on .bs-tick{visibility:visible}",
  ".bs-menu-f{border-top:1px solid rgba(34,48,74,.1);padding:8px 12px;font:400 11px/1 var(--bs-sans);color:#2f4260}",
  ".bs-menu-f button{border:none;background:none;padding:0;font:inherit;color:inherit}",
  "[data-tema=\"tmavy\"] .bs-menu,[data-tema=\"tmavy\"] .bs-menu-p{background:#1c2638;color:#e8edf5}",
  "[data-tema=\"tmavy\"] .bs-menu-p.on{background:#24324a}",
  "[data-tema=\"tmavy\"] .bs-menu-p b{color:#e8edf5}",
  "[data-tema=\"tmavy\"] .bs-menu-p i,[data-tema=\"tmavy\"] .bs-menu-h{color:#aab4c5}",
  ".bs-nav{display:flex;flex-direction:column;gap:2px;padding:0 8px}",
  ".bs-nav button{position:relative;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:9px 0;border:none;border-radius:7px;background:transparent;font:400 12px/1 var(--bs-sans);color:#c6cedd;text-align:left}",
  ".bs-rail.on .bs-nav button{justify-content:flex-start;padding:8px 10px}",
  ".bs-nav button.on{background:rgba(255,255,255,.13);font-weight:500;color:#fff}",
  ".bs-nav svg{flex:none;width:17px;height:17px}",
  ".bs-nav svg path{fill:#9aa7bd}",
  ".bs-nav button.on svg path{fill:#e2a94f}",
  ".bs-nav .bs-nl{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".bs-nav .bs-nc{font:500 10px/1 var(--bs-mono);color:#a7b2c4}",
  ".bs-nav button.on .bs-nc{color:#dfe5ee}",
  ".bs-nav .bs-nd{position:absolute;top:6px;left:calc(50% + 6px);width:6px;height:6px;border-radius:50%;background:#e2a94f}",
  ".bs-rail.on .bs-nd{display:none}",
  ".bs-pata{margin-top:auto;display:flex;flex-direction:column;gap:10px;padding:12px 8px;border-top:1px solid rgba(255,255,255,.08)}",
  ".bs-pata-h{font:500 9.5px/1 var(--bs-mono);letter-spacing:.5px;color:#a7b2c4}",
  ".bs-pata-t{font:400 12px/1.3 var(--bs-sans);color:rgba(238,242,248,.85)}",
  ".bs-pata-m{font:400 10.5px/1.3 var(--bs-sans);color:#b0bacb}",
  ".bs-pata button{border:none;background:none;padding:0;text-align:left;font:400 11px/1.3 var(--bs-sans);color:#c6cedd}",
  // hlavná plocha
  ".bs-main{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--bs-main)}",
  ".bs-lista{display:flex;flex-wrap:wrap;align-items:center;gap:10px;row-gap:6px;padding:8px 18px;background:var(--bs-panel);border-bottom:1px solid var(--bs-l13)}",
  ".bs-tit{display:flex;align-items:baseline;gap:10px;min-width:0;flex:1 1 260px}",
  ".bs-tit h2{margin:0;font:600 13.5px/1.3 var(--bs-sans);letter-spacing:-.2px;white-space:nowrap;color:var(--bs-t1)}",
  ".bs-tit span{font:400 11px/1.3 var(--bs-sans);color:var(--bs-t5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}",
  ".bs-lista-a{display:flex;flex-wrap:wrap;align-items:center;gap:6px}",
  ".bs-hl{display:flex;align-items:center;gap:7px;padding:4px 9px;border:1px solid var(--bs-l16);border-radius:6px;background:var(--bs-main);font:400 11px/1 var(--bs-sans);color:var(--bs-t4)}",
  ".bs-hl i{width:10px;height:10px;border:1.5px solid #7c8798;border-radius:50%}",
  ".bs-hl kbd{font:500 9.5px/1 var(--bs-mono);color:var(--bs-t4);white-space:nowrap}",
  ".bs-hl input{border:none;outline:none;background:transparent;font:inherit;color:var(--bs-t1);width:130px}",
  ".bs-chipf{display:flex;align-items:center;gap:5px;padding:4px 9px;border:1px solid var(--bs-l16);border-radius:6px;background:var(--bs-panel);font:400 11.5px/1 var(--bs-sans);color:var(--bs-t4);white-space:nowrap}",
  ".bs-chipf:hover{border-color:rgba(34,48,74,.32)}",
  ".bs-chipf b{font-weight:500;color:var(--bs-t3)}",
  ".bs-chipf.on{background:var(--bs-vyb);border-color:var(--bs-l30)}",
  ".bs-btn{display:inline-flex;align-items:center;gap:6px;flex:none;white-space:nowrap;padding:5px 11px;border:1px solid var(--bs-l18);border-radius:7px;background:var(--bs-panel);font:500 11.5px/1 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-btn.pri{border-color:transparent;background:var(--bs-ak);color:#fff}",
  "[data-tema=\"tmavy\"] .bs-btn.pri{background:#3d5680}",
  ".bs-btn.mal{padding:4px 9px;font-weight:400;font-size:11px;border-radius:6px;background:var(--bs-main);color:var(--bs-t3);border-color:var(--bs-l16)}",
  ".bs-btn.mal.on{background:var(--bs-vyb);border-color:var(--bs-l30)}",
  ".bs-btn[disabled]{opacity:.5;cursor:default}",
  ".bs-telo{flex:1;display:flex;min-height:0}",
  ".bs-obsah{flex:1;min-width:0;overflow:auto;padding:20px 22px 32px}",
  ".bs-obsah>.bs-sirka{max-width:1180px}",
  ".bs-drawer{width:376px;flex:none;overflow:auto;background:var(--bs-panel);border-left:1px solid var(--bs-l14);padding:16px 18px 28px}",
  // karty, panely, KPI
  ".bs-stlp{display:flex;flex-direction:column;gap:18px}",
  ".bs-kpi{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}",
  ".bs-kpi>div{background:var(--bs-panel);border:1px solid var(--bs-l13);border-radius:9px;padding:13px 14px 12px;min-width:0}",
  ".bs-kpi-l{font:500 9.5px/1.2 var(--bs-mono);letter-spacing:.5px;color:var(--bs-t5)}",
  ".bs-kpi-v{font:500 25px/1.15 var(--bs-mono);letter-spacing:-1px;color:var(--bs-t1);margin:6px 0 4px}",
  ".bs-kpi-d{font:400 10.5px/1.3 var(--bs-sans);color:var(--bs-t5)}",
  ".bs-kpi-d.pos{color:oklch(0.48 0.1 162)}",
  ".bs-kpi-d.neg{color:oklch(0.5 0.13 32)}",
  "[data-tema=\"tmavy\"] .bs-kpi-d.pos{color:oklch(0.78 0.1 162)}",
  "[data-tema=\"tmavy\"] .bs-kpi-d.neg{color:oklch(0.78 0.11 32)}",
  ".bs-num.neg{color:oklch(0.5 0.13 32);font-weight:600}",
  "[data-tema=\"tmavy\"] .bs-num.neg{color:oklch(0.78 0.11 32)}",
  ".bs-chip.sla{margin-left:4px}",
  ".bs-zmienka{font:400 12px/1.3 var(--bs-sans);padding:5px 8px;border:1px solid var(--bs-l13);border-radius:7px;background:var(--bs-panel);color:var(--bs-t2)}",
  ".bs-sla-m{width:72px}",
  ".bs-dva{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:14px;align-items:start}",
  ".bs-panel{background:var(--bs-panel);border:1px solid var(--bs-l13);border-radius:10px;overflow:hidden;min-width:0}",
  ".bs-ph{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:12px 16px;border-bottom:1px solid var(--bs-l08)}",
  ".bs-ph h3{margin:0;font:600 12.5px/1.3 var(--bs-sans);color:var(--bs-t1);flex:1}",
  ".bs-ph small{font:400 11px/1 var(--bs-mono);color:var(--bs-t5)}",
  ".bs-riadok{display:grid;grid-template-columns:78px 1fr 26px;align-items:center;gap:10px;padding:7px 16px;font:400 11.5px/1.3 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-bar{height:16px;border-radius:4px;background:var(--bs-l08);overflow:hidden}",
  ".bs-bar>i{display:block;height:100%;border-radius:4px;background:oklch(var(--bs-bar-l) var(--c) var(--h))}",
  ".bs-num{font:500 12px/1 var(--bs-mono);color:var(--bs-t3);text-align:right}",
  ".bs-mini{display:flex;gap:28px;padding:12px 16px 14px;border-top:1px solid var(--bs-l08)}",
  ".bs-mini b{display:block;font:500 15px/1.2 var(--bs-mono);color:var(--bs-t1);margin-top:4px}",
  ".bs-akt{display:flex;flex-direction:column;padding:6px 16px 12px}",
  ".bs-akt>div{display:flex;gap:9px;padding:7px 0}",
  ".bs-akt i{width:7px;height:7px;border-radius:50%;flex:none;margin-top:4px;background:oklch(0.62 var(--c) var(--h))}",
  ".bs-akt p{margin:0;font:400 11.5px/1.4 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-akt small{display:block;font:400 10px/1.4 var(--bs-mono);color:var(--bs-t4)}",
  ".bs-pipe{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}",
  ".bs-pipe>div{display:flex;flex-direction:column;gap:9px;padding:14px 14px 15px;min-width:0;border-right:1px solid var(--bs-l09)}",
  ".bs-pipe>div:last-child{border-right:none}",
  ".bs-pipe-s{display:flex;align-items:center;gap:7px;font:400 10.5px/1.3 var(--bs-sans);color:var(--bs-t5)}",
  ".bs-pipe-s i{width:7px;height:7px;border-radius:50%;flex:none;background:oklch(0.62 max(var(--c),.04) var(--h))}",
  ".bs-pipe-n{font:500 19px/1 var(--bs-mono);color:var(--bs-t1)}",
  ".bs-pipe-b{height:5px;border-radius:3px;min-width:6px;background:oklch(0.62 max(var(--c),.04) var(--h))}",
  // chipy
  ".bs-chip{display:inline-flex;align-items:center;padding:3px 8px;border-radius:5px;font:500 10.5px/1.35 var(--bs-sans);white-space:nowrap;",
  "background:oklch(var(--bs-chip-l) calc(var(--c) * var(--bs-chip-c)) var(--h));color:oklch(var(--bs-chip-tl) var(--c) var(--h))}",
  ".bs-chip.st{border:1px solid rgba(34,48,74,.08)}",
  ".bs-chip.caka{box-shadow:inset 0 0 0 1px oklch(0.62 0.12 78)}",
  // evidencie
  ".bs-split{display:flex;flex-direction:column;gap:18px}",
  ".bs-split.dva{display:grid;grid-template-columns:repeat(auto-fit,minmax(430px,1fr));align-items:start}",
  ".bs-tabs{display:flex;align-items:center;gap:4px;margin-bottom:10px;flex-wrap:wrap}",
  ".bs-tab{display:flex;align-items:center;gap:7px;padding:6px 11px;border-radius:7px;border:1px solid transparent;background:transparent;font:400 12px/1 var(--bs-sans);color:var(--bs-t5)}",
  ".bs-tab.on{background:var(--bs-panel);border-color:var(--bs-l18);font-weight:500;color:var(--bs-t1)}",
  ".bs-tab.zab{opacity:.4;cursor:default}",
  ".bs-tab small{font:500 10px/1 var(--bs-mono);color:#6b7789}",
  ".bs-tabs-p{margin-left:auto;display:flex;align-items:center;gap:8px;font:400 11px/1 var(--bs-mono);color:var(--bs-t5)}",
  ".bs-x{width:22px;height:22px;border:1px solid var(--bs-l16);border-radius:6px;background:var(--bs-panel);color:var(--bs-t5);font:400 12px/1 var(--bs-sans)}",
  ".bs-tw{background:var(--bs-panel);border:1px solid var(--bs-l13);border-radius:10px;overflow-x:auto}",
  ".bs-t{width:100%;min-width:880px;border-collapse:collapse}",
  ".bs-split.dva .bs-t{min-width:520px}",
  ".bs-t th{padding:9px 14px;background:var(--bs-thead);text-align:left;font:500 10px/1 var(--bs-mono);letter-spacing:.5px;color:var(--bs-t5);white-space:nowrap;text-transform:uppercase}",
  ".bs-t th:last-child,.bs-t td:last-child{text-align:right}",
  ".bs-t th.zor{cursor:pointer}",
  ".bs-t tr.r{height:38px;cursor:pointer;border-bottom:1px solid var(--bs-l08)}",
  ".bs.komf .bs-t tr.r{height:50px}",
  ".bs-t tr.r:hover{background:var(--bs-hover)}",
  ".bs-t tr.r.on{background:var(--bs-vyb);box-shadow:inset 2px 0 0 var(--bs-ak)}",
  ".bs-t td{padding:0 14px;font:400 11.5px/1.3 var(--bs-sans);color:var(--bs-t4);white-space:nowrap}",
  ".bs-t td.id{font:500 11px/1 var(--bs-mono);color:var(--bs-ak)}",
  ".bs-t td.ti{min-width:280px;white-space:normal;font-size:12.5px;line-height:1.35;color:var(--bs-t1)}",
  ".bs-split.dva .bs-t td.ti{min-width:200px}",
  ".bs-t td.da{font:400 10.5px/1 var(--bs-mono)}",
  ".bs-t tr.uz td.ti{color:var(--bs-t4)}",
  ".bs-split.dva .bs-t .uzke{display:none}",
  ".bs-prazdne{padding:28px 16px;text-align:center;font:400 12px/1.5 var(--bs-sans);color:var(--bs-t5)}",
  // detail
  ".bs-dh{display:flex;align-items:center;gap:8px;margin-bottom:10px}",
  ".bs-dh .id{font:500 11px/1 var(--bs-mono);color:var(--bs-ak)}",
  ".bs-dh .bs-x{margin-left:auto}",
  ".bs-dt{margin:0 0 12px;font:600 14.5px/1.35 var(--bs-sans);color:var(--bs-t1)}",
  ".bs-da{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}",
  ".bs-pol{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px;margin-bottom:16px}",
  ".bs-pol div{min-width:0}",
  ".bs-pol .k,.bs-sek{display:block;font:500 10px/1.2 var(--bs-mono);letter-spacing:.5px;color:var(--bs-t4);text-transform:uppercase;margin-bottom:4px}",
  ".bs-pol .v{font:400 11.5px/1.4 var(--bs-sans);color:var(--bs-t2);overflow-wrap:anywhere}",
  ".bs-sek{margin:18px 0 8px}",
  ".bs-opis{white-space:pre-wrap;font:400 12px/1.5 var(--bs-sans);color:var(--bs-t2);margin:0}",
  ".bs-hist{display:flex;flex-direction:column}",
  ".bs-hist>div{display:flex;gap:10px;padding:6px 0}",
  ".bs-hist i{width:6px;height:6px;border-radius:50%;background:#c2cad8;flex:none;margin-top:5px}",
  ".bs-hist p{margin:0;font:400 11.5px/1.4 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-hist small{display:block;font:400 10px/1.4 var(--bs-mono);color:var(--bs-t4)}",
  ".bs-kom{border:1px solid var(--bs-l13);border-radius:8px;padding:9px 11px;margin-bottom:8px}",
  ".bs-kom p{margin:4px 0 0;white-space:pre-wrap;font:400 11.5px/1.45 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-kom small{font:400 10px/1 var(--bs-mono);color:var(--bs-t4)}",
  ".bs textarea,.bs input[type=text],.bs input[type=date],.bs input[type=datetime-local],.bs select,.bs-ok textarea,.bs-ok input[type=text],.bs-ok input[type=date],.bs-ok input[type=datetime-local],.bs-ok select{width:100%;padding:7px 9px;border:1px solid var(--bs-l18);border-radius:7px;background:var(--bs-panel);font:400 12px/1.4 var(--bs-sans);color:var(--bs-t1)}",
  ".bs textarea,.bs-ok textarea{min-height:64px;resize:vertical}",
  ".bs-ok .bs-pril{margin-top:4px}",
  ".bs-nast{display:flex;flex-direction:column;gap:14px}",
  ".bs-nast .bs-panel>div.in{padding:12px 16px;display:flex;flex-direction:column;gap:8px}",
  ".bs-pol-r{display:flex;gap:6px;align-items:center}",
  ".bs-pol-r input{flex:1}",
  ".bs-mriezka{width:100%;border-collapse:collapse;font:400 11.5px/1.3 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-mriezka td,.bs-mriezka th{padding:5px 8px;border-bottom:1px solid var(--bs-l08);text-align:left;white-space:nowrap}",
  ".bs-mriezka th{font:500 10px/1 var(--bs-mono);letter-spacing:.5px;color:var(--bs-t5);text-transform:uppercase}",
  ".bs-pril{display:flex;flex-wrap:wrap;gap:8px}",
  ".bs-pril a,.bs-pril button{display:flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid var(--bs-l16);border-radius:6px;background:var(--bs-main);font:400 11px/1.2 var(--bs-sans);color:var(--bs-t3);text-decoration:none}",
  // formulár (okno appky s triedou bs-okno)
  ".bs-form{display:flex;flex-direction:column;gap:12px}",
  ".bs-form label{display:flex;flex-direction:column;gap:4px;font:500 10px/1.2 var(--bs-mono);letter-spacing:.5px;color:var(--bs-t4);text-transform:uppercase}",
  ".bs-form label.pov::after{content:none}",
  ".bs-form .dva{display:grid;grid-template-columns:1fr 1fr;gap:10px}",
  ".bs-form details{border:1px solid var(--bs-l13);border-radius:8px;padding:8px 10px}",
  ".bs-form summary{cursor:pointer;font:500 11.5px/1.3 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-form summary small{font-weight:400;color:var(--bs-t4);margin-left:6px}",
  ".bs-chyba{padding:8px 10px;border-radius:8px;background:oklch(0.96 0.03 38);border:1px solid oklch(0.87 0.05 38);color:oklch(0.4 0.12 38);font:400 11.5px/1.4 var(--bs-sans)}",
  ".bs-podobne{font:400 11px/1.4 var(--bs-sans);color:var(--bs-t4)}",
  // úzke okno: split len od 1100 px, mobil pod 900 px (§4.4)
  "@media (max-width:1099px){.bs-split.dva{display:flex}.bs-splitb{display:none!important}}",
  "@media (max-width:899px){",
  ".bs{flex-direction:column;height:auto;min-height:0;overflow:visible;border-radius:0;border-left:0;border-right:0}",
  ".bs-rail,.bs-rail.on{width:auto;flex-direction:column}",
  ".bs-rh,.bs-rail.on .bs-rh{flex-direction:row;padding:8px 12px}",
  ".bs-rail .bs-iba-on{display:inline!important}",
  ".bs-prep,.bs-pata{display:none!important}",
  ".bs-projw{padding:0 12px 8px}",
  ".bs-projb,.bs-rail.on .bs-projb{justify-content:flex-start;padding:7px 9px}",
  ".bs-nav{flex-direction:row;overflow-x:auto;padding:0 8px 8px;gap:4px}",
  ".bs-nav button,.bs-rail.on .bs-nav button{flex:none;width:auto;justify-content:flex-start;padding:8px 10px}",
  ".bs-nav .bs-nd{display:none}",
  ".bs-lista{padding:8px 12px}",
  ".bs-hl kbd{display:none}",
  ".bs-obsah{padding:14px 12px 24px;overflow:visible}",
  ".bs-telo{display:block}",
  ".bs-drawer{position:fixed;inset:0;width:auto;z-index:60;border-left:0;padding:14px 16px 90px}",
  ".bs-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}",
  ".bs-kpi>div:last-child:nth-child(odd){grid-column:1/-1}",
  ".bs-dva{grid-template-columns:1fr}",
  ".bs-tw{border:none;background:transparent;overflow:visible}",
  ".bs-t{min-width:0}",
  ".bs-t thead{display:none}",
  ".bs-t tr.r{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;height:auto!important;padding:10px 12px;margin-bottom:8px;background:var(--bs-panel);border:1px solid var(--bs-l13);border-radius:10px}",
  ".bs-t td{display:block;padding:0;white-space:normal}",
  ".bs-t td.ti{grid-column:1/-1;order:-1;min-width:0!important}",
  ".bs-t td:last-child{text-align:left}",
  ".bs-t .uzke{display:block}",
  ".bs-form .dva,.bs-pol{grid-template-columns:1fr}",
  "}"
].join("\n");
const BS_LOGO = '<svg width="26" height="20" viewBox="0 0 82 64" role="img" aria-label="BUGstation" style="flex:none"><path d="M14 14H2v36h12v-6H8V20h6z" fill="#fff"/><path d="M68 14h12v36H68v-6h6V20h-6z" fill="#fff"/><rect x="19" y="30.7" width="44" height="2.6" rx="1.3" fill="#5d708d"/><circle cx="20.5" cy="32" r="4.4" fill="#a9b6c9"/><circle cx="41" cy="32" r="8.4" fill="#e2a94f"/><circle cx="41" cy="32" r="3" fill="#22304a"/><circle cx="61.5" cy="32" r="4.4" fill="#57a396"/></svg>';
// Ikony navigácie z prototypu (viewBox 0 0 20 20); „ulohy“ a „caka“ dokreslené v tom istom štýle.
const BS_IKONY = {
  prehlad: "M3 11h4v6H3zM8.5 6h3v11h-3zM14 8.5h3V17h-3z",
  caka: "M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16m0 1.8a6.2 6.2 0 1 1 0 12.4 6.2 6.2 0 0 1 0-12.4M9.1 5.5v5l3.8 2.3.9-1.5-2.9-1.7V5.5z",
  uloha: "M3 3h14v14H3zm1.8 1.8v10.4h10.4V4.8zm1.6 5.3 1.3-1.3 1.7 1.7 3.9-3.9 1.3 1.3-5.2 5.2z",
  defekt: "M10 2.4 17.6 16H2.4zm-.9 5.1v4.2h1.8V7.5zm0 5.6v1.8h1.8v-1.8z",
  incident: "M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16m-.9 3.4h1.8v6h-1.8zm0 7.4h1.8v1.8h-1.8z",
  zmena: "M4 3h8l4 4v10H4zm7.5 1.6V7.4H14zM6 9h8v1.6H6zm0 3.2h6V13.8H6z",
  plan: "M4 3h12v2.2H4zm0 4h12v2.2H4zm0 4h7.5v2.2H4zM13 11.2 17 14l-4 2.8z",
  scenare: "M3.2 4.6 5 6.4l3-3-1.3-1.2L5 3.9 4.4 3.3zM9.5 3h7.3v1.9H9.5zM3.2 10.6 5 12.4l3-3-1.3-1.2L5 9.9l-.6-.6zM9.5 9h7.3v1.9H9.5zM3.2 16.6 5 18.4l3-3-1.3-1.2L5 15.9l-.6-.6zM9.5 15h7.3v1.9H9.5z"
};
function bsStyly(){
  if (typeof document === "undefined" || document.getElementById("bs-styly")) return;
  const st = document.createElement("style"); st.id = "bs-styly"; st.textContent = BS_CSS;
  document.head.appendChild(st);
  if (!document.getElementById("bs-pismo")) {
    const l = document.createElement("link"); l.id = "bs-pismo"; l.rel = "stylesheet"; l.href = BS_PISMO;
    document.head.appendChild(l);
  }
}
function bsChipHtml(text, h, c, extra){
  return '<span class="bs-chip' + (extra ? " " + extra : "") + '" style="--h:' + h + ";--c:" + c + '">' + esc(text) + "</span>";
}
function bsStavChip(z){
  const s = bsStav(z.stav);
  const caka = z.stav === "vysvetlene" && !z.vysvetlenie_prijate;
  return bsChipHtml(s[1] + (caka ? " · čaká na prijatie" : ""), s[2], s[3], "st" + (caka ? " caka" : ""));
}
function bsUrovenChip(nastavenia, z){
  const f = BS_UROVNE_FARBY[+z.uroven] || [250, 0.06];
  return bsChipHtml(bsUrovenNazov(nastavenia, z.typ, +z.uroven), f[0], f[1]);
}

// ═══════════════════════════════════════════════════════════════
//  STAV MODULU A NAČÍTANIE
//  Projekt a osoby sú zo skupiny B2B (B2B.pid, B2B.d.osoby); záznamy BUGstation
//  číta modul sám. Realtime zámerne nie (spec 43.33): obnova po vlastnom
//  zápise, pri návrate na kartu a tlačidlom.
// ═══════════════════════════════════════════════════════════════
const BS = { pid: null, d: null, nacitavam: false, pohlad: "prehlad", split: null, detail: null, det: null,
  filtre: {}, menu: false, rail: false, hladat: "", zoradit: {}, nastavenia: null };
let _bsPoradie = 0;
const BS_STLPCE = "id,projekt_id,typ,cislo,kluc,nazov,uroven,stav,rozlisenie,duplikat,is_id,modul_id,prostredie_id,release_id," +
  "scenar,pripad,poziadavka_id,identifikovane,termin,suvisi,riesitel_osoba,riesitel_tim,ziadatel,data,nahlasil," +
  "vysvetlenie_prijal,vysvetlenie_prijate,verzia,vytvoril,vytvorene,upravil,upravene,zmazane," +
  "sla_rezim,sla_reakcia_min,sla_vyriesenie_min,sla_triaz_do,sla_reakcia_do,sla_reakcia_kedy,sla_vyriesenie_do,sla_zostava_min,sla_upozornene";

function bsJa(){
  const o = typeof b2bMojaOsoba === "function" ? b2bMojaOsoba() : null;
  return o ? { osoba: o.id, roly: o.bs_role || [], spravca: !!o.spravca } : { osoba: null, roly: [], spravca: false };
}
// Osoby s prístupom do BUGstation (admin_89, BS0). Pred migráciou projekt moduly nemá
// a BUGstation vidí každý aktívny člen (admin_88).
function bsOsoby(){
  const P = (B2B.d && B2B.d.projekt) || {};
  return ((B2B.d && B2B.d.osoby) || []).filter(o => o.aktivny && (!P.moduly || typeof b2bOsobaMaModul !== "function" || b2bOsobaMaModul(o, "bugstation")));
}
function bsMeno(osobaId){
  if (!osobaId) return "";
  const o = ((B2B.d && B2B.d.osoby) || []).find(x => x.id === osobaId);
  return o ? o.meno : "";
}
function bsMenoUctu(uid){
  const o = ((B2B.d && B2B.d.osoby) || []).find(x => x.user_id && x.user_id === uid);
  return o ? o.meno : "";
}
function bsRiesitelText(z){
  if (z.riesitel_osoba) return bsMeno(z.riesitel_osoba);
  if (z.riesitel_tim) return bsCiselnikNazov(BS.d && BS.d.projekt && BS.d.projekt.nastavenia, "timy", z.riesitel_tim);
  return "";
}
function bsNast(){ return (BS.d && BS.d.projekt && BS.d.projekt.nastavenia) || {}; }
function bsZaznamy(){ return ((BS.d && BS.d.zaznamy) || []).filter(z => !z.zmazane); }
function bsNajdi(id){ return ((BS.d && BS.d.zaznamy) || []).find(z => z.id === id); }

async function bsNacitajData(){
  const pid = B2B.pid, poradie = ++_bsPoradie;
  BS.nacitavam = true;
  try {
    const vsetky = (q) => b2bVsetky(q).then(data => ({ data }), error => ({ error }));
    const r = await Promise.all([
      sb.from("b2b_bs_projekty").select("*").eq("projekt_id", pid).maybeSingle(),
      vsetky(() => sb.from("b2b_bs_zaznamy").select(BS_STLPCE).eq("projekt_id", pid).order("typ").order("cislo")),
      vsetky(() => sb.from("b2b_bs_historia").select("id,zaznam_id,kto,kedy,udalost,akcia,z,na,data").eq("projekt_id", pid).order("kedy").order("id")),
      sb.from("b2b_bs_poziadavky").select("*").eq("projekt_id", pid).order("kod"),
      sb.from("b2b_bs_moje").select("upozornenia").eq("projekt_id", pid).maybeSingle()   // admin_90 (BS1b)
    ]);
    if (poradie !== _bsPoradie) return;
    const e = r.map(x => x.error).find(Boolean);
    if (e && b2bChybaTabulky(e)) BS.d = { pid, bezMigracie: true };
    else if (e) throw e;
    else BS.d = { pid, projekt: r[0].data, zaznamy: r[1].data || [], historia: r[2].data || [], poziadavky: r[3].data || [],
      upozornenia: (r[4].data || {}).upozornenia || "okamzite" };
    bsOtvorCiel();
  } catch (e) {
    if (poradie !== _bsPoradie) return;
    console.error("BUGstation: načítanie projektu", e);
    BS.d = { pid, chyba: (e && e.message) || String(e) };
  }
  BS.nacitavam = false;
  if (BS.detail && BS.d && BS.d.zaznamy && bsNajdi(BS.detail)) bsNacitajDetail(BS.detail);
  bsPrekresli();
}
async function bsObnov(){ BS.d = null; BS.det = null; bsPrekresli(); }
// Návrat na kartu = čerstvé dáta (iný člen tímu mohol medzitým zapisovať).
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && typeof modulNaObrazovke === "function" && modulNaObrazovke() === "b2b_bugstation" && BS.d && !BS.nacitavam) bsNacitajData();
});

async function bsNacitajDetail(id){
  try {
    const r = await Promise.all([
      sb.from("b2b_bs_zaznamy").select("popis").eq("id", id).maybeSingle(),
      sb.from("b2b_bs_komentare").select("id,kto,osoba_id,text,kedy,stiahnute").eq("zaznam_id", id).order("kedy"),
      sb.from("b2b_bs_prilohy").select("id,nazov,typ,velkost,nahral,nahrane,zmazane").eq("zaznam_id", id).order("nahrane"),
      sb.from("b2b_bs_historia").select("id,kto,kedy,udalost,akcia,z,na,dovod,data").eq("zaznam_id", id).order("kedy").order("id"),
      sb.from("b2b_bs_sledovatelia").select("osoba_id,zdroj").eq("zaznam_id", id)
    ]);
    const e = r.map(x => x.error).find(Boolean);
    if (e) throw e;
    if (BS.detail !== id) return;
    BS.det = { id, popis: (r[0].data || {}).popis || "", komentare: r[1].data || [], prilohy: (r[2].data || []).filter(p => !p.zmazane), historia: r[3].data || [],
      sledovatelia: r[4].data || [] };
  } catch (e) {
    console.error("BUGstation: detail", e);
    BS.det = { id, chyba: (e && e.message) || String(e) };
  }
  bsPrekresli();
}

// Prekreslenie celého modulu so zachovaním posunu obsahu aj detailu.
function bsPrekresli(){
  if (typeof modulNaObrazovke !== "function" || modulNaObrazovke() !== "b2b_bugstation") return;
  const pos = {};
  document.querySelectorAll("[data-bs-scroll]").forEach(el => { pos[el.getAttribute("data-bs-scroll")] = el.scrollTop; });
  appB2bBugstation();
  bsVyska();
  document.querySelectorAll("[data-bs-scroll]").forEach(el => { const k = el.getAttribute("data-bs-scroll"); if (pos[k]) el.scrollTop = pos[k]; });
}
// Shell s vlastným posunom vyplní okno pod hlavičkou appky (desktop); na mobile
// roluje celá stránka ako inde v appke (CSS pod 900 px výšku ruší).
function bsVyska(){
  const k = document.getElementById("bsKoren");
  if (!k) return;
  if (window.innerWidth < 900) { k.style.height = ""; return; }
  const hore = k.getBoundingClientRect().top + window.scrollY;
  k.style.height = Math.max(520, window.innerHeight - hore - 16) + "px";
}
if (typeof window !== "undefined") window.addEventListener("resize", () => { if (typeof modulNaObrazovke === "function" && modulNaObrazovke() === "b2b_bugstation") bsVyska(); });

// RPC s odmietnutím „kto a kedy“ (b2b_bs_odmietnutie) ako čitateľnou chybou.
async function bsRpc(fn, params){
  const r = await sb.rpc(fn, params);
  if (r.error) throw r.error;
  const v = r.data;
  if (v && v.ok === false) {
    const e = new Error(v.kod === "konflikt"
      ? "Záznam medzitým upravil(a) " + (v.upravil_meno || "iný člen tímu") + (v.upravene ? " (" + bsKedy(v.upravene) + ")" : "") + ". Načítajte ho znova a zopakujte zmenu."
      : "Server zmenu odmietol: " + (v.kod || "neznámy dôvod"));
    e.bs = v; throw e;
  }
  return v;
}
function bsChyba(e, co){
  console.error("BUGstation " + co, e);
  alert(co + ": " + String((e && e.message) || e).replace(/^.*?ERROR:\s*/, ""));
}

// ── časy a dátumy ───────────────────────────────────────────────
function bsDva(n){ return String(n).padStart(2, "0"); }
function bsDM(ts){ if (!ts) return ""; const d = new Date(ts); return isNaN(d) ? "" : bsDva(d.getDate()) + ". " + bsDva(d.getMonth() + 1) + "."; }
function bsDMR(ts){ if (!ts) return ""; const d = new Date(String(ts).length === 10 ? ts + "T00:00:00" : ts); return isNaN(d) ? "" : bsDva(d.getDate()) + ". " + bsDva(d.getMonth() + 1) + ". " + d.getFullYear(); }
function bsKedy(ts, teraz){
  const d = new Date(ts), t = teraz != null ? teraz : Date.now();
  if (isNaN(d)) return "";
  const min = Math.round((t - d.getTime()) / 60000);
  const hm = bsDva(d.getHours()) + ":" + bsDva(d.getMinutes());
  if (min < 1) return "práve teraz";
  if (min < 60) return "pred " + min + " min";
  const dnes = new Date(t); dnes.setHours(0, 0, 0, 0);
  if (d >= dnes) return "pred " + Math.round(min / 60) + " h";
  if (d >= new Date(dnes.getTime() - BS_DEN)) return "včera " + hm;
  return bsDMR(ts) + ", " + hm;
}

// ═══════════════════════════════════════════════════════════════
//  SHELL — rail, horná lišta, obsah, detail (README_HANDOFF „Shell“)
// ═══════════════════════════════════════════════════════════════
function bsZalozkaHtml(){
  bsStyly();
  if (BS.pid !== B2B.pid) { BS.pid = B2B.pid; BS.d = null; BS.detail = null; BS.det = null; BS.split = null; BS.filtre = {}; BS.menu = false; BS.nastavenia = null; }
  if (!BS.d) { if (!BS.nacitavam) setTimeout(bsNacitajData, 0); return '<div class="aempty">Načítavam BUGstation…</div>'; }
  if (BS.d.bezMigracie) return '<div class="card" style="padding:12px 14px"><b>BUGstation ešte nie je v databáze</b><div class="csub">Chýba migrácia admin_88 — po jej spustení sa modul otvorí.</div></div>';
  if (BS.d.chyba) return '<div class="card" style="padding:12px 14px;border-color:var(--neg)"><b style="color:var(--neg)">BUGstation sa nenačítal</b><div class="csub" style="margin:4px 0 8px">' + esc(BS.d.chyba) + '</div><button class="aabtn" onclick="bsObnov()">Skúsiť znova</button></div>';
  if (!BS.d.projekt) return bsZapnutieHtml();
  // Odkaz z e-mailu pri už načítanom projekte (bez nového načítania): záznam a detail hneď.
  if (typeof _b2bBsCiel !== "undefined" && _b2bBsCiel && _b2bBsCiel.pid === BS.d.pid) { bsOtvorCiel(); if (BS.detail) setTimeout(() => bsNacitajDetail(BS.detail), 0); }
  setTimeout(bsVyska, 0);   // prvé kreslenie ide cez renderApp, nie bsPrekresli
  return bsShellHtml();
}
function bsZapnutieHtml(){
  const ja = bsJa();
  return '<div class="card" style="padding:14px 16px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
    BS_LOGO.replace('fill="#fff"', 'fill="#2f4260"').replace('fill="#fff"', 'fill="#2f4260"') +
    '<b>BUGstation v projekte nie je zapnutý</b></div><div class="csub" style="margin-bottom:10px">Evidencia úloh, defektov, incidentov a zmenových požiadaviek pre tím projektu. ' +
    (ja.spravca ? "Zapnete ho jedným tlačidlom; roly testovania potom pridelíte v nastaveniach." : "Zapína ho správca projektu.") + '</div>' +
    (ja.spravca ? '<button class="aabtn pri" onclick="bsZapni()">Zapnúť BUGstation</button>' : "") + "</div>";
}
async function bsZapni(){
  // Zapnutie pridá projektu modul bugstation (admin_89) a zvýši verziu projektu — bez jej
  // prevzatia by ďalšia úprava projektu vo Výkaze hlásila konflikt. Zoznam a záložky znova.
  try {
    const v = await bsRpc("b2b_bs_zapni", { p_projekt: B2B.pid });
    const P = B2B.d && B2B.d.projekt;
    if (P && v && v.verzia != null) { P.verzia = v.verzia; P.moduly = v.moduly; }
    BS.pohlad = "nastavenia"; if (typeof b2bNacitajClenstvo === "function") await b2bNacitajClenstvo(); await bsObnov();
  }
  catch (e) { bsChyba(e, "BUGstation sa nepodarilo zapnúť"); }
}

const BS_REGISTRE = ["uloha", "defekt", "incident", "zmena"];
function bsNavPolozky(){
  const ja = bsJa(), zz = bsZaznamy();
  const otv = typ => zz.filter(z => z.typ === typ && bsOtvoreny(z)).length;
  const p = [
    ["prehlad", "Prehľad & progres", ""],
    ["caka", "Čaká na mňa", String(zz.filter(z => bsCakaNaMna(z, ja)).length)],
    ["uloha", "Úlohy", String(otv("uloha"))],
    ["defekt", "Defekty", String(otv("defekt"))],
    ["incident", "Incidenty", String(otv("incident"))],
    ["zmena", "Zmenové požiadavky", String(otv("zmena"))]
  ];
  // Nastavenia projektu len TM a správca; ostatní tu majú len Moje upozornenia (BS1b).
  p.push(["nastavenia", bsMaRolu(ja, ["tm"]) ? "Nastavenia" : "Moje upozornenia", ""]);
  return p;
}
const BS_IKONA_NAST = "M10 6.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8m0 1.8a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2M8.6 2h2.8l.4 2.1 1.5.8 2-.8 1.4 2.4-1.6 1.4v1.8l1.6 1.4-1.4 2.4-2-.8-1.5.8-.4 2.1H8.6l-.4-2.1-1.5-.8-2 .8-1.4-2.4 1.6-1.4V8.3L3.3 6.9l1.4-2.4 2 .8 1.5-.8z";
function bsIkona(id){
  const pth = id === "nastavenia" ? BS_IKONA_NAST : (BS_IKONY[id] || BS_IKONY.prehlad);
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="' + pth + '"/></svg>';
}
function bsShellHtml(){
  const ja = bsJa(), P = (B2B.d && B2B.d.projekt) || {};
  const on = BS.rail ? " on" : "";
  const nav = bsNavPolozky().map(([id, lab, n]) => {
    const akt = BS.pohlad === id;
    const c = n && n !== "0" ? n : "";
    return '<button type="button" class="' + (akt ? "on" : "") + '" onclick="bsChod(\'' + id + '\')" title="' + esc(lab) + '">' + bsIkona(id === "uloha" ? "uloha" : id) +
      '<span class="bs-nl bs-iba-on">' + esc(lab) + "</span>" + (c ? '<span class="bs-nc bs-iba-on">' + esc(c) + '</span><i class="bs-nd"></i>' : "") + "</button>";
  }).join("");
  const roly = ja.spravca ? ["Správca projektu"].concat((ja.roly || []).map(r => BS_ROLY[r])) : (ja.roly || []).map(r => BS_ROLY[r]);
  const proj = '<div class="bs-projw"><button type="button" class="bs-projb" onclick="bsMenu()" title="Moje projekty">' +
    '<span class="bs-kod">' + esc(P.kod || "") + '</span><span class="bs-projt bs-iba-on"><b>' + esc(P.nazov || "") + "</b><i>" + esc(roly.join(" · ") || "Čitateľ") + "</i></span>" +
    '<svg class="bs-iba-on" width="11" height="11" viewBox="0 0 20 20" style="flex:none;margin-left:auto"><path d="M4.6 7.4 10 12.8l5.4-5.4-1.5-1.5L10 9.8 6.1 5.9z" fill="#b0bacb"/></svg></button>' +
    (BS.menu ? bsMenuHtml() : "") + "</div>";
  const rel = (bsNast().releasy || []).find(r => r.stav === "aktivny");
  const pata = '<div class="bs-pata bs-iba-on">' + (rel ? '<span class="bs-pata-h">AKTÍVNY RELEASE</span><span class="bs-pata-t">' + esc(rel.nazov) + "</span>" : "") +
    '<button type="button" onclick="bsObnov()">↻ Obnoviť</button></div>';
  const ikPrep = BS.rail ? "M11.6 4.4 6 10l5.6 5.6 1.4-1.4L9.4 10l3.6-4.2zM4 4h1.8v12H4z" : "M8.4 4.4 14 10l-5.6 5.6L7 14.2 10.6 10 7 5.8zM14.2 4H16v12h-1.8z";
  const rail = '<aside class="bs-rail' + on + '"><div class="bs-rh">' + BS_LOGO + '<span class="bs-rh-nazov bs-iba-on">BUG<span>station</span></span>' +
    '<button type="button" class="bs-prep" onclick="bsRail()" title="Rozbaliť / zbaliť menu"><svg width="15" height="15" viewBox="0 0 20 20"><path d="' + ikPrep + '" fill="#c6cedd"/></svg></button></div>' +
    proj + '<nav class="bs-nav">' + nav + "</nav>" + pata + "</aside>";
  const [tit, pod] = bsTitulok();
  const lista = '<div class="bs-lista"><div class="bs-tit"><h2>' + esc(tit) + "</h2><span>" + esc(pod) + '</span></div><div class="bs-lista-a">' + bsListaAkcieHtml() + "</div></div>";
  const drawer = BS.detail && bsNajdi(BS.detail) ? '<aside class="bs-drawer" data-bs-scroll="detail">' + bsDetailHtml(bsNajdi(BS.detail)) + "</aside>" : "";
  return '<div class="bs' + (BS.komfortna ? " komf" : "") + '" id="bsKoren">' + rail + '<main class="bs-main">' + lista +
    '<div class="bs-telo"><div class="bs-obsah" data-bs-scroll="obsah"><div class="bs-sirka">' + bsObsahHtml() + "</div></div>" + drawer + "</div></main></div>";
}
function bsMenuHtml(){
  const sBs = (B2B.projekty || []).filter(p => typeof b2bMojeModuly !== "function" || !p.moje_moduly || b2bMojeModuly(p).includes("bugstation"));
  const riadky = sBs.map(p => {
    const on = p.id === B2B.pid;
    return '<button type="button" class="bs-menu-p' + (on ? " on" : "") + '" onclick="bsVyberProjekt(\'' + p.id + '\')"><span class="bs-kod">' + esc(p.kod) + '</span><span style="flex:1;min-width:0"><b>' +
      esc(p.nazov) + "</b><i>" + (p.spravca ? "správca" : "člen") + '</i></span><span class="bs-tick">✓</span></button>';
  }).join("");
  return '<div class="bs-menu"><div class="bs-menu-h">MOJE PROJEKTY</div>' + riadky +
    '<div class="bs-menu-f"><button type="button" onclick="bsMenu();b2bSpatZoznam()">Všetky projekty B2B</button></div></div>';
}
function bsTitulok(){
  const zz = bsZaznamy(), ja = bsJa(), P = (B2B.d && B2B.d.projekt) || {};
  const v = BS.pohlad;
  if (v === "prehlad") return ["Prehľad & progres review", (P.nazov || "") + " · " + bsPocet(zz.filter(bsOtvoreny).length, "otvorený záznam", "otvorené záznamy", "otvorených záznamov")];
  if (v === "caka") return ["Čaká na mňa", bsPocet(zz.filter(z => bsCakaNaMna(z, ja)).length, "záznam čaká", "záznamy čakajú", "záznamov čaká") + " na vašu akciu"];
  if (v === "nastavenia") return ["Nastavenia BUGstation", "číselníky, názvy úrovní, povinné polia a roly v projekte"];
  if (BS_TYPY[v]) {
    const vs = zz.filter(z => z.typ === v), o = vs.filter(bsOtvoreny);
    const tit = { uloha: "Úlohy", defekt: "Evidencia defektov", incident: "Evidencia incidentov", zmena: "Požiadavky na zmenu" }[v];
    return [tit, bsPocet(o.length, "otvorený", "otvorené", "otvorených") + " z " + vs.length + " v evidencii · " + o.filter(bsUZakaznika).length + " u zákazníka"];
  }
  return ["BUGstation", ""];
}
function bsListaAkcieHtml(){
  const ja = bsJa(), v = BS.pohlad, reg = BS_TYPY[v];
  const hl = '<label class="bs-hl" title="Hľadať podľa kľúča alebo textu (Ctrl+K)"><i></i><input id="bsHladat" type="text" placeholder="Hľadať" value="' + esc(BS.hladat) + '" oninput="bsHladaj(this.value)"><kbd>Ctrl K</kbd></label>';
  let chipy = "";
  if (reg || v === "caka") {
    const f = BS.filtre[v] || {};
    const st = f.stav === "otvorene" ? "Otvorené" : "Všetky";
    chipy += '<button type="button" class="bs-chipf' + (f.stav === "otvorene" ? " on" : "") + '" onclick="bsFilterStav()">Stav <b>' + st + "</b></button>";
    chipy += '<button type="button" class="bs-chipf' + (f.ja ? " on" : "") + '" onclick="bsFilterMoje()">Riešiteľ <b>' + (f.ja ? "Ja" : "Všetci") + "</b></button>";
    if (reg) chipy += '<button type="button" class="bs-chipf' + (f.uroven ? " on" : "") + '" onclick="bsFilterUroven()">' + esc(BS_TYPY[v].os) + " <b>" + esc(f.uroven ? bsUrovenNazov(bsNast(), v, f.uroven) : "Všetky") + "</b></button>";
    if (v !== "uloha") chipy += '<button type="button" class="bs-chipf' + (f.poSla ? " on" : "") + '" onclick="bsFilterSla()">SLA <b>' + (f.poSla ? "Po termíne" : "Všetky") + "</b></button>";
  }
  const split = reg ? '<button type="button" class="bs-btn mal bs-splitb' + (BS.split ? " on" : "") + '" onclick="bsSplit()">' + (BS.split ? "Zrušiť rozdelenie" : "Rozdeliť zobrazenie") + "</button>" : "";
  const smie = bsMaRolu(ja, BS_PRACOVNICI);
  const novy = smie ? '<button type="button" class="bs-btn pri" onclick="bsNovy()">+ Nový záznam</button>' : "";
  return hl + chipy + split + novy;
}

// ── navigácia a ovládanie ───────────────────────────────────────
function bsChod(v){ BS.pohlad = v; BS.detail = null; BS.det = null; if (!BS_TYPY[v]) BS.split = null; BS.menu = false; bsPrekresli(); }
function bsRail(){ BS.rail = !BS.rail; bsPrekresli(); }
function bsMenu(){ BS.menu = !BS.menu; bsPrekresli(); }
function bsVyberProjekt(pid){ BS.menu = false; if (pid !== B2B.pid) b2bOtvorProjekt(pid); else bsPrekresli(); }
function bsSplit(){
  if (BS.split) BS.split = null;
  else BS.split = BS_REGISTRE.find(t => t !== BS.pohlad && t !== "uloha") || "defekt";
  BS.detail = null; BS.det = null; bsPrekresli();
}
function bsSplitTab(ktory, typ){
  if (ktory === 0) { BS.pohlad = typ; } else { BS.split = typ; }
  BS.detail = null; BS.det = null; bsPrekresli();
}
function bsSplitZavri(ktory){
  if (ktory === 0) { BS.pohlad = BS.split; }
  BS.split = null; BS.detail = null; BS.det = null; bsPrekresli();
}
let _bsHladatCas = null;
function bsHladaj(t){
  BS.hladat = t;
  clearTimeout(_bsHladatCas);
  _bsHladatCas = setTimeout(() => {
    bsPrekresli();
    const el = document.getElementById("bsHladat");
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, 250);
}
if (typeof document !== "undefined") document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K") && typeof modulNaObrazovke === "function" && modulNaObrazovke() === "b2b_bugstation") {
    const el = document.getElementById("bsHladat"); if (el) { e.preventDefault(); el.focus(); }
  }
  if (e.key === "Escape" && BS.menu) { BS.menu = false; bsPrekresli(); }
});
function bsFilterStav(){ const v = BS.pohlad, f = BS.filtre[v] = BS.filtre[v] || {}; f.stav = f.stav === "otvorene" ? "" : "otvorene"; bsPrekresli(); }
function bsFilterMoje(){ const v = BS.pohlad, f = BS.filtre[v] = BS.filtre[v] || {}; f.ja = !f.ja; bsPrekresli(); }
function bsFilterSla(){ const v = BS.pohlad, f = BS.filtre[v] = BS.filtre[v] || {}; f.poSla = !f.poSla; bsPrekresli(); }
function bsFilterUroven(){
  const v = BS.pohlad, f = BS.filtre[v] = BS.filtre[v] || {};
  const u = bsUrovneTypu(bsNast(), v), i = u.indexOf(f.uroven);
  f.uroven = i < 0 ? u[0] : (i + 1 < u.length ? u[i + 1] : null);
  bsPrekresli();
}

// ═══════════════════════════════════════════════════════════════
//  OBRAZOVKY
// ═══════════════════════════════════════════════════════════════
function bsObsahHtml(){
  const v = BS.pohlad;
  if (v === "prehlad") return bsPrehladHtml();
  if (v === "caka") return bsCakaHtml();
  if (v === "nastavenia") return bsNastaveniaHtml();
  if (BS_TYPY[v]) return bsEvidencieHtml();
  return "";
}

// ── A. Prehľad (bez testových častí, §9) ───────────────────────
function bsPrehladHtml(){
  const zz = bsZaznamy(), O = bsOdvod(zz, BS.d.historia || []), nast = bsNast();
  const delta = O.deltaDefektov;
  const kpi = [
    ["OTVORENÉ DEFEKTY", O.poTypoch.defekt.otvorene, delta === 0 ? "bez zmeny za týždeň" : (delta > 0 ? "+" : "−") + Math.abs(delta) + " za týždeň", delta > 0 ? "neg" : delta < 0 ? "pos" : ""],
    ["BLOKUJÚCE", O.blokujuce, O.blokujuce ? bsPocet(O.blokujuce, "kritický defekt", "kritické defekty", "kritických defektov") + (O.blokujuceNad48 ? " · " + O.blokujuceNad48 + " nad 48 h" : "") : "žiadne blokujúce", O.blokujuce ? "neg" : "pos"],
    ["OTVORENÉ INCIDENTY", O.poTypoch.incident.otvorene, O.poTypoch.incident.uZakaznika + " u zákazníka", ""],
    ["ZMENY V OBEHU", O.zmenyVObehu, O.poTypoch.zmena.vsetky + " v evidencii", ""],
    ["OTVORENÉ ÚLOHY", O.poTypoch.uloha.otvorene, O.poTypoch.uloha.vsetky + " v evidencii", ""]
  ].map(([l, v, d, c]) => '<div><div class="bs-kpi-l">' + l + '</div><div class="bs-kpi-v">' + v + '</div><div class="bs-kpi-d ' + c + '">' + esc(d) + "</div></div>").join("");
  const max = Math.max(1, ...O.urovne);
  const urov = bsUrovneTypu(nast, "defekt").map(u => {
    const n = O.urovne[u - 1], f = BS_UROVNE_FARBY[u];
    return '<div class="bs-riadok"><span>' + esc(bsUrovenNazov(nast, "defekt", u)) + '</span><div class="bs-bar"><i style="--h:' + f[0] + ";--c:" + f[1] + ";width:" + Math.round(n / max * 100) + '%"></i></div><span class="bs-num">' + n + "</span></div>";
  }).join("");
  const poSla = (typ) => zz.filter(z => z.typ === typ && bsOtvoreny(z) && (bsSla(z) || {}).po).length;
  const typy = BS_TYPY_PORADIE.map(typ => {
    const x = O.poTypoch[typ], ps = typ === "uloha" ? 0 : poSla(typ);
    return '<div class="bs-riadok" style="grid-template-columns:150px 1fr 1fr 1fr"><span>' + esc(BS_TYPY[typ].mnozne) + '</span><span class="bs-num" style="text-align:left">' + x.otvorene + ' otvorených</span><span class="bs-num" style="text-align:left">' + x.uZakaznika + " u zákazníka</span>" +
      '<span class="bs-num' + (ps ? " neg" : "") + '" style="text-align:left">' + (typ === "uloha" ? "" : ps + " po SLA") + "</span></div>";
  }).join("");
  const akt = (BS.d.historia || []).slice(-6).reverse().map(h => {
    const z = bsNajdi(h.zaznam_id); if (!z) return "";
    const s = bsStav(h.na || z.stav);
    return '<div><i style="--h:' + s[2] + ";--c:" + Math.max(s[3], 0.04) + '"></i><p>' + esc(bsHistText(z, h)) + "<small>" + esc(bsKedy(h.kedy)) + "</small></p></div>";
  }).join("") || '<div class="bs-prazdne">Zatiaľ žiadna aktivita.</div>';
  const pmax = Math.max(1, ...O.priebeh.map(p => p[1]));
  const priebeh = O.priebeh.map(([k, n]) => { const s = bsStav(k);
    return '<div><span class="bs-pipe-s"><i style="--h:' + s[2] + ";--c:" + s[3] + '"></i>' + esc(s[1]) + '</span><span class="bs-pipe-n">' + n + '</span><span class="bs-pipe-b" style="--h:' + s[2] + ";--c:" + s[3] + ";width:" + Math.round(n / pmax * 100) + '%"></span></div>'; }).join("");
  const ulohy = O.ulohy.map(([k, n]) => esc(bsStav(k)[1]) + " " + n).join(" · ");
  return '<div class="bs-stlp"><div class="bs-kpi">' + kpi + "</div>" +
    '<div class="bs-dva"><div class="bs-panel"><div class="bs-ph"><h3>Otvorené podľa typu</h3><small>kto má loptičku · termín SLA</small></div>' + typy + "</div>" +
    '<div class="bs-panel"><div class="bs-ph"><h3>Otvorené defekty podľa závažnosti</h3></div>' + urov +
    '<div class="bs-mini"><div><span class="bs-kpi-l">PRIEM. ČAS OPRAVY</span><b>' + (O.casOpravy == null ? "—" : String(O.casOpravy).replace(".", ",") + " " + (O.casOpravy === 1 ? "deň" : "dňa")) + '</b></div><div><span class="bs-kpi-l">REOPEN RATE</span><b>' +
    (O.reopen == null ? "—" : String(O.reopen).replace(".", ",") + " %") + "</b></div></div></div></div>" +
    '<div class="bs-panel"><div class="bs-ph"><h3>Posledná aktivita</h3></div><div class="bs-akt">' + akt + "</div></div>" +
    '<div class="bs-panel"><div class="bs-ph"><h3>Priebeh stavov · všetky záznamy</h3><small>' + esc(bsPocet(O.otvorene, "záznam", "záznamy", "záznamov")) + ' v obehu</small></div><div class="bs-pipe">' + priebeh + "</div>" +
    '<div class="bs-mini"><div><span class="bs-kpi-l">ÚLOHY</span><b style="font-size:12px">' + ulohy + "</b></div></div></div></div>";
}
function bsHistText(z, h){
  const kl = z.kluc + " · ";
  if (h.udalost === "zalozenie") return kl + "založené · " + bsUrovenNazov(bsNast(), z.typ, +((h.data || {}).uroven || z.uroven));
  if (h.udalost === "stav") return kl + (h.akcia === "oprava" ? "stav opravený: " : "stav: ") + bsStav(h.na)[1] + (h.data && h.data.prijate ? " (prijaté)" : "");
  if (h.udalost === "prijatie") return kl + "vysvetlenie prijaté";
  if (h.udalost === "komentar") return kl + "nový komentár";
  if (h.udalost === "priloha") return kl + "príloha " + (h.na || "");
  if (h.udalost === "pole") return kl + "zmenené: " + ((BS_POLIA[h.akcia] || {}).nazov || ({ nazov: "Názov", uroven: BS_TYPY[z.typ].os, riesitel_osoba: "Riešiteľ", riesitel_tim: "Riešiteľ" })[h.akcia] || h.akcia);
  if (h.udalost === "zmazanie") return kl + "zmazané";
  return kl + h.udalost;
}

// ── Čaká na mňa ────────────────────────────────────────────────
function bsCakaHtml(){
  const ja = bsJa(), f = BS.filtre.caka || {};
  const zz = bsFilter(bsZaznamy(), { cakaNaMna: true, text: BS.hladat, stav: f.stav, riesitel: f.ja ? "ja" : null, poSla: !!f.poSla }, ja);
  if (!(ja.roly || []).length && !ja.spravca) return '<div class="bs-panel"><div class="bs-prazdne">Nemáte rolu v BUGstation — ste čitateľ. Rolu prideľuje správca projektu alebo Test manager.</div></div>';
  return bsTabulkaHtml(zz, "caka", false);
}

// ── B. Evidencie (taby, tabuľka, split) ────────────────────────
function bsEvidencieHtml(){
  const panely = BS.split ? [BS.pohlad, BS.split] : [BS.pohlad];
  return '<div class="bs-split' + (panely.length > 1 ? " dva" : "") + '">' + panely.map((typ, i) => bsPanelHtml(typ, i, panely)).join("") + "</div>";
}
function bsPanelHtml(typ, slot, panely){
  const zz = bsZaznamy(), ja = bsJa();
  const tabs = BS_REGISTRE.map(t => {
    const on = t === typ, zab = !on && panely.includes(t);
    const n = zz.filter(z => z.typ === t && bsOtvoreny(z)).length;
    return '<button type="button" class="bs-tab' + (on ? " on" : "") + (zab ? " zab" : "") + '"' + (zab || on ? "" : ' onclick="bsSplitTab(' + slot + ",'" + t + "')\"") + ">" + esc(BS_TYPY[t].mnozne) + " <small>" + n + "</small></button>";
  }).join("");
  const f = BS.filtre[typ] || {};
  const riadky = bsFilter(zz, { typy: [typ], text: BS.hladat, stav: f.stav, riesitel: f.ja ? "ja" : null, urovne: f.uroven ? [f.uroven] : null, poSla: !!f.poSla }, ja);
  return '<div><div class="bs-tabs">' + tabs + '<span class="bs-tabs-p">' + esc(bsPocet(riadky.length, "záznam", "záznamy", "záznamov")) +
    (panely.length > 1 ? ' <button type="button" class="bs-x" onclick="bsSplitZavri(' + slot + ')" title="Zavrieť panel">×</button>' : "") + "</span></div>" +
    bsTabulkaHtml(riadky, typ, panely.length > 1) + "</div>";
}
const BS_STLPCE_TYPU = {
  uloha: ["ID", "Úloha", "Modul", "Priorita", "Stav", "Riešiteľ", "Termín"],
  defekt: ["ID", "Popis defektu", "Modul", "Závažnosť", "Stav", "Riešiteľ", "Nahlásené"],
  incident: ["ID", "Popis incidentu", "Prostredie", "Dopad", "Stav", "Vlastník", "Dátum"],
  zmena: ["ID", "Požiadavka na zmenu", "Žiadateľ", "Rozsah", "Stav", "Posudzuje", "Dátum"],
  caka: ["ID", "Popis", "Typ", "Úroveň", "Stav", "Riešiteľ", "Dátum"]
};
function bsTabulkaHtml(riadky, druh, uzky){
  const nast = bsNast(), st = BS_STLPCE_TYPU[druh] || BS_STLPCE_TYPU.caka;
  if (!riadky.length) {
    const nic = druh === "caka" ? "Nič nečaká na vašu akciu." : "Zatiaľ žiadne záznamy" + (BS.hladat || Object.keys(BS.filtre[druh] || {}).some(k => (BS.filtre[druh] || {})[k]) ? " pre tento filter." : ". Nový založíte tlačidlom + Nový záznam.");
    return '<div class="bs-tw"><div class="bs-prazdne">' + esc(nic) + "</div></div>";
  }
  const zor = riadky.slice().sort((a, b) => new Date(b.identifikovane || b.vytvorene) - new Date(a.identifikovane || a.vytvorene) || b.cislo - a.cislo);
  const th = st.map((s, i) => '<th class="' + (i === 2 || i === 5 ? "uzke" : "") + '">' + esc(s) + "</th>").join("");
  const tr = zor.map(z => {
    const b = druh === "caka" ? BS_TYPY[z.typ].nazov
      : z.typ === "incident" ? bsCiselnikNazov(nast, "prostredia", z.prostredie_id)
      : z.typ === "zmena" ? (z.ziadatel || "") : bsCiselnikNazov(nast, "moduly", z.modul_id);
    const datum = z.typ === "uloha" && druh !== "caka" ? (z.termin ? bsDM(z.termin + "T00:00:00") : "") : bsDM(z.identifikovane || z.vytvorene);
    return '<tr class="r' + (BS.detail === z.id ? " on" : "") + (bsUzavrety(z) ? " uz" : "") + '" onclick="bsOtvor(\'' + z.id + '\')"><td class="id">' + esc(z.kluc) + '</td><td class="ti">' + esc(z.nazov) +
      '</td><td class="uzke">' + esc(b) + "</td><td>" + bsUrovenChip(nast, z) + "</td><td>" + bsStavChip(z) + bsSlaZnacka(z) + '</td><td class="uzke">' + esc(bsRiesitelText(z)) + '</td><td class="da">' + esc(datum) + "</td></tr>";
  }).join("");
  return '<div class="bs-tw"><table class="bs-t"><thead><tr>' + th + "</tr></thead><tbody>" + tr + "</tbody></table></div>";
}

// ── detail (drawer) ────────────────────────────────────────────
function bsOtvor(id){ BS.detail = id; BS.det = null; bsPrekresli(); bsNacitajDetail(id); }
// Odkaz z e-mailu (?b2b_bs=<kľúč>, BS1b): ezivnostnik.html vyberie projekt podľa kódu
// (_b2bBsCiel), tu sa po načítaní dát nastaví záznam — detail dotiahne bsNacitajData.
function bsOtvorCiel(){
  const c = typeof _b2bBsCiel !== "undefined" ? _b2bBsCiel : null;
  if (!c || !BS.d || c.pid !== BS.d.pid) return;
  _b2bBsCiel = null;
  const z = (BS.d.zaznamy || []).find(x => x.kluc === c.kluc && !x.zmazane);
  if (!z) { if (typeof oznamPas === "function") oznamPas("Záznam " + c.kluc + " sa v projekte nenašiel — mohol byť zmazaný."); return; }
  BS.pohlad = z.typ; BS.split = null; BS.detail = z.id; BS.det = null;
}
function bsSlaZnacka(z){
  const s = bsSla(z);
  if (!s || s.druh === "koniec") return "";
  if (s.po) return " " + bsChipHtml(s.druh === "triaz" ? "triáž po termíne" : "po SLA", 32, 0.14, "sla");
  if (s.blizko) return " " + bsChipHtml("SLA o chvíľu", 78, 0.13, "sla");
  return "";
}
async function bsSleduj(sledovat){
  try { await bsRpc("b2b_bs_sleduj", { p_zaznam: BS.detail, p_sledovat: !!sledovat }); bsNacitajDetail(BS.detail); }
  catch (e) { bsChyba(e, "Sledovanie sa nepodarilo zmeniť"); }
}
// @zmienka: meno vloží do komentára; server (trigger nad komentármi) z neho spraví
// upozornenie a sledovanie — v texte musí ostať presne „@Meno“.
function bsZmienka(sel){
  const o = bsOsoby().find(x => x.id === sel.value), el = document.getElementById("bsKomentar");
  sel.value = "";
  if (!o || !el) return;
  const pred = el.value && !/\s$/.test(el.value) ? " " : "";
  el.value += pred + "@" + o.meno + " "; el.focus();
}
function bsZavriDetail(){ BS.detail = null; BS.det = null; bsPrekresli(); }
function bsDetailHtml(z){
  const ja = bsJa(), nast = bsNast(), det = BS.det && BS.det.id === z.id ? BS.det : null;
  const akcie = bsAkcieZaznamu(z, ja);
  const tl = akcie.map((k, i) => '<button type="button" class="bs-btn' + (i === 0 ? " pri" : "") + '" onclick="bsAkcia(\'' + k + '\')">' + esc(BS_AKCIE[k].text) + "</button>").join("");
  const upravit = bsSmieUpravit(z, ja) ? '<button type="button" class="bs-btn" onclick="bsUpravit()">Upraviť</button>' : "";
  const oprava = bsSmieOpravu(ja) ? '<button type="button" class="bs-btn mal" onclick="bsOprava()" title="Zmeniť stav s dôvodom">Zmeniť stav…</button>' : "";
  const pole = (k, v) => v ? '<div><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + "</span></div>" : "";
  const T = BS_TYPY[z.typ];
  const pz = (BS.d.poziadavky || []).find(q => q.id === z.poziadavka_id);
  const sla = bsSla(z), slaHtml = sla ? '<div><span class="k">SLA</span><span class="v">' + (sla.po ? bsChipHtml(sla.text, 32, 0.14, "sla")
    : sla.blizko ? bsChipHtml(sla.text, 78, 0.13, "sla") : esc(sla.text)) + "</span></div>" : "";
  const polia = [
    pole("Stav", bsStav(z.stav)[1] + (z.stav === "vysvetlene" ? (z.vysvetlenie_prijate ? " · prijaté " + bsDMR(z.vysvetlenie_prijate) : " · čaká na prijatie") : "")),
    slaHtml,
    pole("Reakcia SLA", bsSlaReakcia(z)),
    pole(T.os, bsUrovenNazov(nast, z.typ, +z.uroven)),
    pole("Riešiteľ", bsRiesitelText(z) || "—"),
    pole("Nahlásil", bsMeno(z.nahlasil)),
    pole("IS", bsCiselnikNazov(nast, "is", z.is_id)),
    pole("Modul", bsCiselnikNazov(nast, "moduly", z.modul_id)),
    pole("Prostredie", bsCiselnikNazov(nast, "prostredia", z.prostredie_id)),
    pole("Scenár / prípad", [z.scenar, z.pripad].filter(Boolean).join(" / ")),
    pole("Biznis požiadavka", pz ? pz.kod + " " + pz.nazov : ""),
    pole("Identifikované", z.identifikovane ? bsDMR(z.identifikovane) + ", " + bsDva(new Date(z.identifikovane).getHours()) + ":" + bsDva(new Date(z.identifikovane).getMinutes()) : ""),
    pole("Požadovaný termín", z.termin ? bsDMR(z.termin) : ""),
    pole("Release", bsCiselnikNazov(nast, "releasy", z.release_id)),
    pole("Žiadateľ", z.ziadatel),
    pole("Rozlíšenie", z.rozlisenie ? ((BS_ROZLISENIA.find(r => r[0] === z.rozlisenie) || [0, z.rozlisenie])[1] + (z.duplikat ? " · " + z.duplikat : "")) : ""),
    pole("Súvisí s", (z.suvisi || []).join(", "))
  ].join("");
  let telo = '<div class="bs-prazdne">Načítavam detail…</div>';
  if (det && det.chyba) telo = '<div class="bs-chyba">Detail sa nenačítal: ' + esc(det.chyba) + "</div>";
  else if (det) {
    const pril = det.prilohy.map(p => '<button type="button" onclick="bsPrilohaStiahni(\'' + p.id + '\')" title="Stiahnuť">📎 ' + esc(p.nazov) + " · " + esc(typeof b2bVelkost === "function" ? b2bVelkost(p.velkost) : p.velkost + " B") + "</button>").join("");
    const pridaj = bsMaRolu(ja, BS_PRACOVNICI) ? '<label class="bs-btn mal" style="cursor:pointer">+ Príloha<input type="file" multiple style="display:none" onchange="bsPrilohyVyber(this.files)"></label>' : "";
    const hist = det.historia.map(h => '<div><i></i><p>' + esc(bsHistText(z, h).replace(z.kluc + " · ", "")) + (h.dovod ? " — " + esc(h.dovod) : "") + "<small>" + esc(bsMenoUctu(h.kto) || "") + " · " + esc(bsKedy(h.kedy)) + "</small></p></div>").join("");
    const kom = det.komentare.filter(k => !k.stiahnute).map(k => '<div class="bs-kom"><small>' + esc(bsMeno(k.osoba_id) || bsMenoUctu(k.kto)) + " · " + esc(bsKedy(k.kedy)) + "</small><p>" + esc(k.text) + "</p></div>").join("");
    const dataTyp = z.data || {};
    const kroky = z.typ === "defekt" && (dataTyp.kroky || dataTyp.ocakavane || dataTyp.skutocne)
      ? '<span class="bs-sek">Kroky na zopakovanie</span><p class="bs-opis">' + esc(dataTyp.kroky || "") + "</p>" +
        (dataTyp.ocakavane ? '<span class="bs-sek">Očakávaný výsledok</span><p class="bs-opis">' + esc(dataTyp.ocakavane) + "</p>" : "") +
        (dataTyp.skutocne ? '<span class="bs-sek">Skutočný výsledok</span><p class="bs-opis">' + esc(dataTyp.skutocne) + "</p>" : "") : "";
    const sled = det.sledovatelia || [], sledujem = !!ja.osoba && sled.some(s => s.osoba_id === ja.osoba);
    const sledMena = sled.map(s => bsMeno(s.osoba_id)).filter(Boolean).join(", ");
    const sledTl = ja.osoba ? '<button type="button" class="bs-btn mal" onclick="bsSleduj(' + (sledujem ? "false" : "true") + ')" title="Zmeny sledovaných záznamov prídu v dennom súhrne">' +
      (sledujem ? "✓ Sledujete" : "Sledovať") + "</button>" : "";
    const zmienky = bsOsoby().filter(o => o.user_id && o.id !== ja.osoba);
    const zmienkaSel = zmienky.length ? '<select class="bs-zmienka" onchange="bsZmienka(this)" title="Spomenúť osobu — dostane upozornenie"><option value="">@ Spomenúť…</option>' +
      zmienky.map(o => '<option value="' + o.id + '">' + esc(o.meno) + "</option>").join("") + "</select>" : "";
    telo = '<span class="bs-sek">Opis</span><p class="bs-opis">' + (det.popis ? esc(det.popis) : "—") + "</p>" + kroky +
      '<span class="bs-sek">Prílohy</span><div class="bs-pril">' + (pril || '<span class="bs-podobne">Bez príloh.</span>') + pridaj + "</div>" +
      '<span class="bs-sek">Sledujú</span><div class="bs-pril"><span class="bs-podobne">' + (sledMena ? esc(sledMena) : "nikto") + "</span>" + sledTl + "</div>" +
      '<span class="bs-sek">História</span><div class="bs-hist">' + hist + "</div>" +
      '<span class="bs-sek">Komentáre</span>' + kom +
      '<textarea id="bsKomentar" placeholder="Komentár k záznamu — @Meno spomenie osobu"></textarea><div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' +
      '<button type="button" class="bs-btn" onclick="bsKomentuj()">Pridať komentár</button>' + zmienkaSel + "</div>";
  }
  return '<div class="bs-dh"><span class="id">' + esc(z.kluc) + "</span>" + bsUrovenChip(nast, z) + '<button type="button" class="bs-x" onclick="bsZavriDetail()" title="Zavrieť">×</button></div>' +
    '<h3 class="bs-dt">' + esc(z.nazov) + "</h3>" + '<div class="bs-da">' + tl + upravit + oprava + "</div>" + '<div class="bs-pol">' + polia + "</div>" + telo;
}
function bsSmieUpravit(z, ja){
  if (!z || z.zmazane) return false;
  if (bsMaRolu(ja, ["tm", "ttl"])) return true;
  if (z.nahlasil && z.nahlasil === ja.osoba && (z.stav === "identifikovane" || z.stav === "nova")) return true;
  return bsMaRolu(ja, ["dmd"]);   // DMD: riešiteľ a release (server pustí len tie)
}

// ── akcie nad stavom ───────────────────────────────────────────
async function bsVykonajAkciu(z, k, o){
  const x = o || {};
  await bsRpc("b2b_bs_stav", { p_id: z.id, p_verzia: z.verzia, p_akcia: k, p_rozlisenie: x.rozlisenie || null, p_komentar: x.komentar || null,
    p_riesitel_osoba: x.osoba || null, p_riesitel_tim: x.tim || null, p_na: x.na || null, p_duplikat: x.duplikat || null });
}
function bsAkcia(k){
  const z = bsNajdi(BS.detail), a = BS_AKCIE[k];
  if (!z || !a) return;
  const ja = bsJa();
  const vyberRiesitela = k === "prevziat" && bsMaRolu(ja, ["dmd"]);
  if (!a.rozlisenie && !a.komentar && !vyberRiesitela) {
    bsVykonajAkciu(z, k).then(() => { oznamPas(a.text + " · " + z.kluc); bsNacitajData(); }).catch(e => bsChyba(e, a.text + " sa nepodarilo"));
    return;
  }
  const osoby = bsOsoby().filter(o => o.user_id && (o.bs_role || []).some(r => r === "riesitel" || r === "dmd"));
  const timy = bsNast().timy || [];
  const html = '<div class="bs-ok"><div class="bs-form">' +
    (vyberRiesitela ? '<label>Riešiteľ<select id="bsAkRies"><option value="">— ja —</option>' + osoby.map(o => '<option value="o:' + o.id + '">' + esc(o.meno) + "</option>").join("") +
      timy.map(t => '<option value="t:' + esc(t.id) + '">' + esc(t.nazov) + " (tím)</option>").join("") + "</select></label>" : "") +
    (a.rozlisenie ? '<label>Rozlíšenie<select id="bsAkRoz">' + BS_ROZLISENIA.map(r => '<option value="' + r[0] + '">' + esc(r[1]) + "</option>").join("") + "</select></label>" +
      '<label>Kľúč originálu (pri duplicite)<input type="text" id="bsAkDup" placeholder="napr. ' + esc(z.kluc.replace(/\d+$/, "1")) + '"></label>' : "") +
    (a.komentar ? '<label>Komentár<textarea id="bsAkKom" placeholder="Prečo — uvidí ho celý tím"></textarea></label>' : "") +
    (bsPrijateHned(k, ja) && a.na === "vysvetlene" ? '<div class="bs-podobne">Rozhodnutie strany zákazníka — záznam sa hneď uzavrie.</div>'
      : a.na === "vysvetlene" ? '<div class="bs-podobne">Záznam ostane otvorený, kým vysvetlenie neprijme Test manager alebo Test team leader.</div>' : "") +
    "</div></div>";
  openModal(a.text + " · " + z.kluc, html, async () => {
    const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
    const r = v("bsAkRies");
    const o = { rozlisenie: v("bsAkRoz") || null, komentar: v("bsAkKom") || null, duplikat: v("bsAkDup") || null,
      osoba: r.startsWith("o:") ? r.slice(2) : null, tim: r.startsWith("t:") ? r.slice(2) : null };
    if (a.komentar && (o.komentar || "").length < 3) return b2bVOkne("Napíšte komentár — aspoň pár slov, prečo.");
    if (o.rozlisenie === "duplicita" && !o.duplikat) return b2bVOkne("Pri duplicite uveďte kľúč originálu.");
    try { await bsVykonajAkciu(z, k, o); } catch (e) { return b2bVOkne(String((e && e.message) || e).replace(/^.*?ERROR:\s*/, "")); }
    oznamPas(a.text + " · " + z.kluc); bsNacitajData();
  }, null, null, a.text);
}
function bsOprava(){
  const z = bsNajdi(BS.detail); if (!z) return;
  const html = '<div class="bs-ok"><div class="bs-form"><label>Nový stav<select id="bsOpNa">' + bsStavy(z.typ).map(s => '<option value="' + s[0] + '"' + (s[0] === z.stav ? " selected" : "") + ">" + esc(s[1]) + "</option>").join("") +
    '</select></label><label>Dôvod (zapíše sa do histórie)<textarea id="bsOpDov"></textarea></label></div></div>';
  openModal("Zmeniť stav · " + z.kluc, html, async () => {
    const na = document.getElementById("bsOpNa").value, dov = document.getElementById("bsOpDov").value.trim();
    if (dov.length < 5) return b2bVOkne("Dôvod opravy stavu napíšte aspoň piatimi znakmi.");
    try { await bsVykonajAkciu(z, "oprava", { na, komentar: dov }); } catch (e) { return b2bVOkne(String((e && e.message) || e).replace(/^.*?ERROR:\s*/, "")); }
    oznamPas("Stav opravený · " + z.kluc); bsNacitajData();
  }, null, null, "Zmeniť stav");
}
async function bsKomentuj(){
  const el = document.getElementById("bsKomentar"), t = el ? el.value.trim() : "";
  if (!t) return;
  try { await bsRpc("b2b_bs_komentuj", { p_id: BS.detail, p_text: t }); bsNacitajData(); }
  catch (e) { bsChyba(e, "Komentár sa nepodarilo uložiť"); }
}

// ── formulár (§6.4–6.5): dve časti, predvyplnenie, povinné podľa nastavení ─
let _bsPrilohy = [];   // súbory čakajúce na uloženie nového záznamu (Ctrl+V, výber, fotoaparát)
// Posledné použité hodnoty (§6.5 b. 1) len v pamäti karty — nový kľúč zariadenia
// by bol nový údaj v zásadách (gpsUloz), pohodlie to nevyváži.
let _bsPosledne = {};
function bsPosledne(){ return _bsPosledne; }
function bsZapamataj(p){ _bsPosledne = { is_id: p.is_id, prostredie_id: p.prostredie_id, release_id: p.release_id, modul_id: p.modul_id }; }
function bsNovy(){ bsFormular(null, BS_TYPY[BS.pohlad] ? BS.pohlad : "defekt"); }
function bsUpravit(){ const z = bsNajdi(BS.detail); if (z) bsFormular(z, z.typ); }
function bsFormular(z, typ){
  const ja = bsJa(), nast = bsNast(), pov = ((nast.povinne || {})[typ]) || {}, pos = bsPosledne();
  const typy = BS_TYPY_PORADIE.filter(t => z ? t === typ : (t === "zmena" ? bsMaRolu(ja, ["tm", "ttl", "dmd"]) : bsMaRolu(ja, BS_PRACOVNICI)));
  const ak = (nast.releasy || []).find(r => r.stav === "aktivny");
  const h = z ? Object.assign({}, z, { popis: (BS.det && BS.det.id === z.id ? BS.det.popis : "") }) : {
    typ, uroven: typ === "defekt" ? 3 : bsUrovneTypu(nast, typ)[1] || bsUrovneTypu(nast, typ)[0],
    is_id: (nast.is || []).length === 1 ? nast.is[0].id : pos.is_id, prostredie_id: pos.prostredie_id, modul_id: pos.modul_id,
    release_id: ak ? ak.id : pos.release_id, identifikovane: new Date().toISOString() };
  _bsPrilohy = [];
  const vis = k => BS_POLIA[k].typy.includes(typ) && pov[k] !== "skryte";
  const hv = k => pov[k] === "povinne" ? " *" : "";
  const sel = (k, cis) => { const zoz = nast[cis] || [];
    if (!vis(k) || !zoz.length) return "";
    if (zoz.length === 1 && !z) return '<input type="hidden" id="bsF_' + k + '" value="' + esc(zoz[0].id) + '">';
    return '<label>' + esc(BS_POLIA[k].nazov) + hv(k) + '<select id="bsF_' + k + '"><option value=""></option>' + zoz.map(x => '<option value="' + esc(x.id) + '"' + (h[k] === x.id ? " selected" : "") + ">" + esc(x.nazov) + "</option>").join("") + "</select></label>"; };
  const txt = (k, ph) => vis(k) ? '<label>' + esc(BS_POLIA[k].nazov) + hv(k) + '<input type="text" id="bsF_' + k + '" value="' + esc(h[k] || "") + '" placeholder="' + esc(ph || "") + '"></label>' : "";
  const urov = bsUrovneTypu(nast, typ).map(u => '<option value="' + u + '"' + (+h.uroven === u ? " selected" : "") + ">" + esc(bsUrovenNazov(nast, typ, u)) + "</option>").join("");
  const osoby = bsOsoby().filter(o => o.user_id && (o.bs_role || []).length);
  const riesSel = vis("riesitel") ? '<label>' + esc(BS_POLIA.riesitel.nazov) + hv("riesitel") + '<select id="bsF_riesitel"><option value=""></option>' +
    osoby.map(o => '<option value="o:' + o.id + '"' + (h.riesitel_osoba === o.id ? " selected" : "") + ">" + esc(o.meno) + "</option>").join("") +
    (nast.timy || []).map(t => '<option value="t:' + esc(t.id) + '"' + (h.riesitel_tim === t.id ? " selected" : "") + ">" + esc(t.nazov) + " (tím)</option>").join("") + "</select></label>" : "";
  const idf = h.identifikovane ? new Date(h.identifikovane) : null;
  const idfVal = idf && !isNaN(idf) ? idf.getFullYear() + "-" + bsDva(idf.getMonth() + 1) + "-" + bsDva(idf.getDate()) + "T" + bsDva(idf.getHours()) + ":" + bsDva(idf.getMinutes()) : "";
  const pozz = (BS.d.poziadavky || []).filter(q => q.aktivna);
  const poz = vis("poziadavka_id") && pozz.length ? '<label>' + esc(BS_POLIA.poziadavka_id.nazov) + hv("poziadavka_id") + '<select id="bsF_poziadavka_id"><option value=""></option>' +
    pozz.map(q => '<option value="' + q.id + '"' + (h.poziadavka_id === q.id ? " selected" : "") + ">" + esc(q.kod + " " + q.nazov) + "</option>").join("") + "</select></label>" : "";
  const D = h.data || {};
  const suvislosti = [
    sel("is_id", "is"), sel("modul_id", "moduly"), sel("prostredie_id", "prostredia"),
    vis("scenar") ? '<div class="dva">' + txt("scenar", "TS-03") + txt("pripad", "TC-03-02") + "</div>" : "",
    poz,
    vis("identifikovane") ? '<label>' + esc(BS_POLIA.identifikovane.nazov) + hv("identifikovane") + '<input type="datetime-local" id="bsF_identifikovane" value="' + idfVal + '"></label>' : "",
    vis("suvisi") ? '<label>' + esc(BS_POLIA.suvisi.nazov) + hv("suvisi") + '<input type="text" id="bsF_suvisi" value="' + esc((h.suvisi || []).join(", ")) + '" placeholder="kľúče oddelené čiarkou, napr. ' + esc(((B2B.d.projekt || {}).kod || "PAY")) + '-B12"></label>' : "",
    vis("termin") ? '<label>' + esc(BS_POLIA.termin.nazov) + hv("termin") + '<input type="date" id="bsF_termin" value="' + esc(h.termin || "") + '"></label>' : "",
    sel("release_id", "releasy"), riesSel, txt("ziadatel", "útvar / meno")
  ].filter(Boolean).join("");
  const html = '<div class="bs-ok" data-scroll="bsForm"><div class="bs-form">' +
    (z ? "" : '<label>Typ<select id="bsF_typ" onchange="bsFormularTyp(this.value)">' + typy.map(t => '<option value="' + t + '"' + (t === typ ? " selected" : "") + ">" + esc(BS_TYPY[t].nazov) + "</option>").join("") + "</select></label>") +
    '<label>Názov *<input type="text" id="bsF_nazov" maxlength="200" value="' + esc(h.nazov || "") + '" oninput="bsPodobne(this.value)"></label><div id="bsPodobne" class="bs-podobne"></div>' +
    '<label>' + esc(BS_TYPY[typ].os) + ' *<select id="bsF_uroven">' + urov + "</select></label>" +
    (vis("popis") ? '<label>Opis' + hv("popis") + '<textarea id="bsF_popis" placeholder="Čo sa stalo, kde a ako to zopakovať">' + esc(h.popis || "") + "</textarea></label>" : "") +
    (typ === "defekt" ? '<details' + (D.kroky || D.ocakavane || D.skutocne ? " open" : "") + '><summary>Kroky a výsledky <small>nepovinné</small></summary><div class="bs-form" style="margin-top:8px">' +
      '<label>Kroky na zopakovanie<textarea id="bsF_kroky">' + esc(D.kroky || "") + '</textarea></label><label>Očakávaný výsledok<textarea id="bsF_ocakavane">' + esc(D.ocakavane || "") + '</textarea></label>' +
      '<label>Skutočný výsledok<textarea id="bsF_skutocne">' + esc(D.skutocne || "") + "</textarea></label></div></details>" : "") +
    (z ? "" : '<label>' + esc(BS_POLIA.priloha.nazov) + hv("priloha") + '<input type="file" id="bsF_subory" multiple accept="image/*,application/pdf,text/plain,.log,.zip" onchange="bsFormularSubory(this.files)"></label>' +
      '<div id="bsFPril" class="bs-podobne">Snímku obrazovky vložíte aj cez Ctrl+V do tohto okna.</div>') +
    (suvislosti ? '<details open><summary>Súvislosti <small>' + esc(bsSuhrnSuvislosti(h, nast)) + "</small></summary><div class=\"bs-form\" style=\"margin-top:8px\">" + suvislosti + "</div></details>" : "") +
    "</div></div>";
  openModal(z ? "Upraviť · " + z.kluc : "Nový záznam", html, () => bsFormularUloz(z, typ), null, null, z ? "Uložiť" : "Založiť");
  if (!z) document.getElementById("modalBody").onpaste = (e) => {
    const f = [...((e.clipboardData && e.clipboardData.files) || [])];
    if (f.length) { e.preventDefault(); bsFormularSubory(f); }
  };
}
function bsSuhrnSuvislosti(h, nast){
  return [bsCiselnikNazov(nast, "prostredia", h.prostredie_id), [h.scenar, h.pripad].filter(Boolean).join(" / "), bsCiselnikNazov(nast, "releasy", h.release_id)].filter(Boolean).join(" · ");
}
function bsFormularTyp(typ){ bsFormular(null, typ); }
function bsFormularSubory(files){
  const max = 10 * 1024 * 1024;
  [...files].forEach(f => { if (f.size > max) alert("Súbor " + f.name + " má viac ako 10 MB — príloha má strop 10 MB."); else _bsPrilohy.push(f); });
  const el = document.getElementById("bsFPril");
  if (el) el.textContent = _bsPrilohy.length ? "Priložené: " + _bsPrilohy.map(f => f.name || "snimka.png").join(", ") : "Snímku obrazovky vložíte aj cez Ctrl+V do tohto okna.";
}
function bsPodobne(t){
  const el = document.getElementById("bsPodobne"); if (!el) return;
  const slova = bsNorm(t).split(/[^a-z0-9]+/).filter(s => s.length > 3);
  if (slova.length < 2) { el.textContent = ""; return; }
  const zhody = bsZaznamy().filter(bsOtvoreny).map(z => ({ z, n: slova.filter(s => bsNorm(z.nazov).includes(s)).length })).filter(x => x.n >= 2)
    .sort((a, b) => b.n - a.n).slice(0, 3);
  el.textContent = zhody.length ? "Podobné otvorené: " + zhody.map(x => x.z.kluc + " " + x.z.nazov).join(" · ") : "";
}
function bsFormularHodnoty(typ){
  const v = id => { const el = document.getElementById("bsF_" + id); return el ? el.value.trim() : undefined; };
  const p = { nazov: v("nazov"), uroven: v("uroven") ? +v("uroven") : null };
  bsPoliaTypu(typ).forEach(k => {
    if (k === "priloha") return;
    if (k === "riesitel") { const r = v("riesitel"); if (r === undefined) return; p.riesitel_osoba = r && r.startsWith("o:") ? r.slice(2) : null; p.riesitel_tim = r && r.startsWith("t:") ? r.slice(2) : null; return; }
    const x = v(k); if (x === undefined) return;
    if (k === "suvisi") p.suvisi = x ? x.split(/[,;\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean) : [];
    else if (k === "identifikovane") p.identifikovane = x ? new Date(x).toISOString() : null;
    else p[k] = x || null;
  });
  if (typ === "defekt") {
    const d = {}; ["kroky", "ocakavane", "skutocne"].forEach(k => { const x = v(k); if (x) d[k] = x; });
    p.data = d;
  }
  return p;
}
async function bsFormularUloz(z, typ){
  const t = z ? typ : ((document.getElementById("bsF_typ") || {}).value || typ);
  const p = bsFormularHodnoty(t);
  const chyba = bsChybajucePovinne(t, z ? Object.assign({}, z, p) : p, bsNast());
  if (chyba.length) return b2bVOkne("Doplňte: " + chyba.join(", ") + ".");
  try {
    if (z) {
      // Posiela sa len zmenené; opis v zozname nie je, porovnáva sa s detailom.
      const povodne = Object.assign({}, z, { popis: BS.det && BS.det.id === z.id ? BS.det.popis || null : null });
      const norm = v => JSON.stringify(v == null || v === "" || (Array.isArray(v) && !v.length) ? null : v);
      const zmeny = {};
      Object.keys(p).forEach(k => {
        if (k === "data") { if (norm(p.data && Object.keys(p.data).length ? p.data : null) !== norm(z.data && Object.keys(z.data).length ? z.data : null)) zmeny.data = p.data; return; }
        if (k === "identifikovane") { if (norm(p[k] && new Date(p[k]).getTime()) !== norm(z[k] && Math.floor(new Date(z[k]).getTime() / 60000) * 60000)) zmeny[k] = p[k]; return; }
        if (norm(p[k]) !== norm(povodne[k])) zmeny[k] = p[k];
      });
      if (!Object.keys(zmeny).length) return true;
      await bsRpc("b2b_bs_uprav", { p_id: z.id, p_verzia: z.verzia, p_polia: zmeny });
      oznamPas("Uložené · " + z.kluc);
    } else {
      const r = await bsRpc("b2b_bs_zaloz", { p_projekt: B2B.pid, p_typ: t, p_polia: p });
      bsZapamataj(p);
      for (const f of _bsPrilohy) { try { await bsPrilohaNahraj(r.id, f); } catch (e) { bsChyba(e, "Príloha " + (f.name || "") + " sa nenahrala"); } }
      _bsPrilohy = [];
      oznamPas("Založené · " + r.kluc);
      BS.pohlad = t; BS.detail = r.id;
    }
  } catch (e) { return b2bVOkne(String((e && e.message) || e).replace(/^.*?ERROR:\s*/, "")); }
  bsNacitajData();
  return true;
}
// ── prílohy cez edge b2b (šifrované, §12) ──────────────────────
async function bsPrilohaNahraj(zaznamId, f){
  const nazov = f.name || ("snimka-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".png");
  return b2bEdgeSubor({ akcia: "bs_priloha_nahraj", zaznam: zaznamId, nazov }, f);
}
async function bsPrilohyVyber(files){
  const id = BS.detail; if (!id) return;
  for (const f of [...files]) {
    if (f.size > 10 * 1024 * 1024) { alert("Súbor " + f.name + " má viac ako 10 MB."); continue; }
    try { oznamPas("Nahrávam " + f.name + "…"); await bsPrilohaNahraj(id, f); } catch (e) { bsChyba(e, "Príloha sa nenahrala"); }
  }
  bsNacitajData();
}
async function bsPrilohaStiahni(id){
  try {
    const tok = await ziskajToken(); if (!tok) throw new Error(CHYBA_SESSION);
    const res = await fetch(SUPABASE_URL + "/functions/v1/b2b", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
      body: JSON.stringify({ akcia: "bs_priloha_stiahni", priloha: id }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.chyba || ("b2b odpovedal " + res.status)); }
    const u8 = new Uint8Array(await res.arrayBuffer()), sha = res.headers.get("x-b2b-sha256") || "";
    if (!sha || await b2bSha256(u8) !== sha) throw new Error("kontrolný súčet súboru nesedí — stiahnite ho znova");
    let nazov = "priloha"; try { nazov = decodeURIComponent(res.headers.get("x-b2b-nazov") || "priloha"); } catch (_) { /* názov je doplnok */ }
    downloadBlob(new Blob([u8], { type: res.headers.get("Content-Type") || "application/octet-stream" }), nazov);
  } catch (e) { bsChyba(e, "Prílohu sa nepodarilo stiahnuť"); }
}

// ═══════════════════════════════════════════════════════════════
//  NASTAVENIA (správca a Test manager, D18) — roly, číselníky, úrovne,
//  povinné polia, triáž, požiadavky
// ═══════════════════════════════════════════════════════════════
const BS_CISELNIKY = [["is", "Informačné systémy (IS)"], ["moduly", "Moduly"], ["prostredia", "Prostredia"], ["releasy", "Releasy"], ["timy", "Tímy riešiteľov"]];
const BS_UPOZORNENIA = [["okamzite", "Okamžite aj denný súhrn", "pridelenie, čaká na vás, najvyššia úroveň, @zmienka a termín SLA hneď; ráno v pracovný deň súhrn"],
  ["suhrn", "Len denný súhrn", "ráno v pracovný deň: čo čaká na vás, zmeny sledovaných záznamov, po termíne SLA"],
  ["nic", "Nič", "e-maily z BUGstation tohto projektu nechodia"]];
function bsMojeUpozorneniaHtml(){
  const akt = (BS.d && BS.d.upozornenia) || "okamzite";
  return '<div class="bs-panel"><div class="bs-ph"><h3>Moje upozornenia e-mailom</h3><small>len pre vás, v tomto projekte</small></div><div class="in">' +
    BS_UPOZORNENIA.map(([k, n, p]) => '<label style="display:flex;gap:8px;align-items:flex-start;font:400 12px/1.4 var(--bs-sans);margin:0 0 8px"><input type="radio" name="bsUpoz" value="' + k + '"' +
      (akt === k ? " checked" : "") + ' onchange="bsUpozorneniaUloz(this.value)"> <span><b>' + esc(n) + "</b><br><span class=\"bs-podobne\">" + esc(p) + "</span></span></label>").join("") +
    '<div class="bs-podobne">Upozornenia chodia na e-mail vášho účtu; prázdny súhrn sa neposiela.</div></div></div>';
}
async function bsUpozorneniaUloz(v){
  try { await bsRpc("b2b_bs_moje_uloz", { p_projekt: B2B.pid, p_upozornenia: v }); BS.d.upozornenia = v; oznamPas("Upozornenia uložené"); }
  catch (e) { bsChyba(e, "Nastavenie upozornení sa nepodarilo uložiť"); bsPrekresli(); }
}
// Pravidlá SLA (§10): typ × úroveň → reakcia a vyriešenie; deň = 8 h pracovného
// času (po–pi 8–16 bez sviatkov), pri 24 × 7 deň = 24 h. Prázdne = bez SLA.
function bsSlaPravidlaHtml(n){
  const sla = n.sla || {};
  const riadky = BS_TYPY_8.map(typ => bsUrovneTypu(n, typ).map(u => {
    const p = ((sla[typ] || {})[u]) || {}, ns = !!p.nonstop;
    return "<tr><td>" + esc(BS_TYPY[typ].nazov) + " · " + esc(bsUrovenNazov(n, typ, u)) + '</td>' +
      '<td><input type="text" class="bs-sla-m" value="' + esc(bsSlaZMin(p.reakcia, ns)) + '" placeholder="—" onchange="bsSlaUprav(\'' + typ + "'," + u + ',\'reakcia\',this.value)"></td>' +
      '<td><input type="text" class="bs-sla-m" value="' + esc(bsSlaZMin(p.vyriesenie, ns)) + '" placeholder="—" onchange="bsSlaUprav(\'' + typ + "'," + u + ',\'vyriesenie\',this.value)"></td>' +
      '<td><input type="checkbox"' + (ns ? " checked" : "") + ' onchange="bsSlaUprav(\'' + typ + "'," + u + ',\'nonstop\',this.checked)"></td></tr>';
  }).join("")).join("");
  const tr = n.triaz_min == null ? 480 : n.triaz_min;
  return '<div class="bs-panel"><div class="bs-ph"><h3>SLA</h3><small>termíny počíta server</small></div><div class="in" style="overflow-x:auto">' +
    '<table class="bs-mriezka"><thead><tr><th>Typ · úroveň</th><th>Reakcia</th><th>Vyriešenie</th><th>24 × 7</th></tr></thead><tbody>' + riadky + "</tbody></table>" +
    '<div class="bs-podobne">Napr. „4 h“, „2 d“, „90 min“. Deň = 8 h pracovného času (po–pi 8:00–16:00 bez sviatkov), pri 24 × 7 deň = 24 h. ' +
    "Hodiny bežia, kým je záznam u riešiteľa (Odoslané, Akceptované); v retestovaní a pri neprijatom vysvetlení stoja. Zmena platí pre nové odoslania.</div>" +
    '<label style="display:flex;gap:8px;align-items:center;font:400 12px/1.4 var(--bs-sans);margin-top:8px">Limit triáže <input type="text" class="bs-sla-m" value="' + esc(bsSlaZMin(tr, false)) +
    '" onchange="bsTriazUprav(this.value)"></label></div></div>';
}
function bsSlaUprav(typ, u, k, v){
  const sla = (BS.nastavenia.sla = BS.nastavenia.sla || {}), t = (sla[typ] = sla[typ] || {}), p = (t[u] = t[u] || {});
  if (k === "nonstop") { p.nonstop = !!v; bsPrekresli(); return; }
  const min = bsSlaMin(v, !!p.nonstop);
  if (Number.isNaN(min)) { alert("Zadajte napr. „4 h“, „2 d“ alebo „90 min“ (najviac rok)."); bsPrekresli(); return; }
  if (min == null) delete p[k]; else p[k] = min;
  if (p.reakcia == null && p.vyriesenie == null) delete t[u];
}
function bsTriazUprav(v){
  const min = bsSlaMin(v, false);
  if (Number.isNaN(min) || min == null) { alert("Limit triáže zadajte napr. „1 d“ alebo „4 h“."); bsPrekresli(); return; }
  BS.nastavenia.triaz_min = min;
}
// Pozvanie do BUGstation (D19): správca aj Test manager. Osoba dostane len modul
// BUGstation a vybrané roly — výkaz, zmluvu ani ceny projektu nevidí.
function bsPozvat(){
  const roly = Object.keys(BS_ROLY);
  const html = '<div class="bs-ok"><div class="bs-form">' +
    '<label>Meno a priezvisko<input type="text" id="bsPzMeno"></label>' +
    '<label>E-mail<input type="email" id="bsPzEmail" placeholder="na túto adresu príde pozvánka"></label>' +
    '<label>Organizácia (voliteľné)<input type="text" id="bsPzOrg"></label>' +
    '<div class="bs-podobne" style="margin:4px 0">Roly v BUGstation</div><div style="display:flex;flex-wrap:wrap;gap:10px">' +
    roly.map(r => '<label style="display:flex;gap:6px;align-items:center;font:400 12px var(--bs-sans)"><input type="checkbox" value="' + r + '" class="bsPzRola"' + (r === "tester" ? " checked" : "") + "> " + esc(BS_ROLY[r]) + "</label>").join("") +
    '</div><div class="bs-podobne" style="margin-top:8px">Osoba uvidí len BUGstation tohto projektu — nie Pracovný výkaz, zmluvu, ceny ani Reporting. Pozvánka platí 14 dní a prijať ju môže len účet s touto adresou.</div>' +
    "</div></div>";
  openModal("Pozvať do BUGstation", html, async () => {
    const v = id => (document.getElementById(id) || {}).value || "";
    const meno = v("bsPzMeno").trim(), email = v("bsPzEmail").trim(), org = v("bsPzOrg").trim();
    const role = [...document.querySelectorAll(".bsPzRola:checked")].map(x => x.value);
    if (!meno) return b2bVOkne("Zadajte meno.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return b2bVOkne("Zadajte platný e-mail.");
    let osoba;
    try { osoba = await bsRpc("b2b_bs_osoba_zaloz", { p_projekt: B2B.pid, p_meno: meno, p_email: email, p_organizacia: org || null, p_role: role }); }
    catch (e) { return b2bVOkne(String((e && e.message) || e).replace(/^.*?ERROR:\s*/, "")); }
    let token, mail = true;
    try { const r = await sb.rpc("b2b_pozvi", { p_osoba: osoba, p_email: email }); if (r.error) throw r.error; token = r.data; }
    catch (e) { bsChyba(e, "Osoba je založená, ale pozvánku sa nepodarilo vytvoriť"); if (typeof b2bObnov === "function") b2bObnov(); return; }
    try { await b2bEdge("pozvanka", { token }); } catch (e) { mail = false; console.error("BUGstation: e-mail pozvánky", e); }
    oznamPas(mail ? "Pozvánka odišla na " + email : "Pozvánka vytvorená, e-mail sa neodoslal — odkaz pošle správca z Tímu");
    if (typeof b2bObnov === "function") b2bObnov();
  }, null, null, "Pozvať");
}
function bsNastaveniaHtml(){
  const ja = bsJa();
  if (!bsMaRolu(ja, ["tm"])) return '<div class="bs-nast">' + bsMojeUpozorneniaHtml() + "</div>";
  const n = BS.nastavenia || (BS.nastavenia = JSON.parse(JSON.stringify(bsNast())));
  const osoby = bsOsoby().filter(o => o.user_id);
  const roly = Object.keys(BS_ROLY);
  const tabRol = '<table class="bs-mriezka"><thead><tr><th>Osoba</th>' + roly.map(r => "<th>" + esc(BS_ROLY[r]) + "</th>").join("") + "</tr></thead><tbody>" +
    osoby.map(o => "<tr><td>" + esc(o.meno) + (o.spravca ? " <small>(správca)</small>" : "") + "</td>" + roly.map(r => '<td><input type="checkbox"' + ((o.bs_role || []).includes(r) ? " checked" : "") +
      ' onchange="bsRolaPrepni(\'' + o.id + "','" + r + "',this.checked)\"></td>").join("") + "</tr>").join("") + "</tbody></table>";
  const cis = BS_CISELNIKY.map(([k, lab]) => '<div class="bs-panel"><div class="bs-ph"><h3>' + esc(lab) + '</h3><small>' + (n[k] || []).length + '</small></div><div class="in">' +
    (n[k] || []).map((x, i) => '<div class="bs-pol-r"><input type="text" value="' + esc(x.nazov) + '" onchange="bsCisUprav(\'' + k + "'," + i + ',this.value)">' +
      (k === "releasy" ? '<select onchange="bsCisStav(' + i + ',this.value)">' + [["planovany", "plánovaný"], ["aktivny", "aktívny"], ["nasadeny", "nasadený"]].map(s => '<option value="' + s[0] + '"' + (x.stav === s[0] ? " selected" : "") + ">" + s[1] + "</option>").join("") + "</select>" : "") +
      '<button type="button" class="bs-x" onclick="bsCisZmaz(\'' + k + "'," + i + ')" title="Odstrániť">×</button></div>').join("") +
    '<div class="bs-pol-r"><input type="text" id="bsNovy_' + k + '" placeholder="Nová položka"><button type="button" class="bs-btn mal" onclick="bsCisPridaj(\'' + k + '\')">Pridať</button></div></div></div>').join("");
  const urov = BS_TYPY_PORADIE.map(typ => '<tr><td>' + esc(BS_TYPY[typ].mnozne) + " · " + esc(BS_TYPY[typ].os) + "</td>" + [1, 2, 3, 4].map(u =>
    '<td><input type="text" style="width:110px" value="' + esc(((n.urovne || {})[typ] || {})[u] || "") + '" placeholder="nepoužité" onchange="bsUrovenUprav(\'' + typ + "'," + u + ',this.value)"></td>').join("") + "</tr>").join("");
  const povTyp = BS_TYPY_PORADIE.map(typ => '<tr><th colspan="2">' + esc(BS_TYPY[typ].mnozne) + "</th></tr>" + bsPoliaTypu(typ).map(k =>
    "<tr><td>" + esc(BS_POLIA[k].nazov) + '</td><td><select onchange="bsPovinneUprav(\'' + typ + "','" + k + '\',this.value)">' +
    [["volitelne", "voliteľné"], ["povinne", "povinné"], ["skryte", "skryté"]].map(s => '<option value="' + s[0] + '"' + ((((n.povinne || {})[typ] || {})[k] || "volitelne") === s[0] ? " selected" : "") + ">" + s[1] + "</option>").join("") + "</select></td></tr>").join("")).join("");
  const poz = (BS.d.poziadavky || []).map(q => "<tr><td class=\"mono\">" + esc(q.kod) + "</td><td>" + esc(q.nazov) + "</td></tr>").join("");
  return '<div class="bs-nast">' + bsMojeUpozorneniaHtml() +
    '<div class="bs-panel"><div class="bs-ph"><h3>Ľudia a roly v BUGstation</h3><small>ukladá sa hneď</small></div><div class="in" style="overflow-x:auto">' + tabRol +
      '<div class="bs-podobne">Člen bez roly je čitateľ. Testerov a riešiteľov len do BUGstation pozvete sami; prístup k výkazu a ďalším modulom prideľuje správca v karte Projekt → Osoby.</div>' +
      '<div style="margin-top:8px"><button type="button" class="bs-btn" onclick="bsPozvat()">+ Pozvať do BUGstation</button></div></div></div>' +
    '<div class="bs-panel"><div class="bs-ph"><h3>Triáž</h3></div><div class="in"><label style="display:flex;gap:8px;align-items:center;font:400 12px/1.4 var(--bs-sans)"><input type="checkbox"' + (n.triaz !== false ? " checked" : "") +
      ' onchange="BS.nastavenia.triaz=this.checked"> Nový defekt, incident a zmena čakajú v Identifikované na triáž Test managera alebo Test team leadera</label></div></div>' +
    bsSlaPravidlaHtml(n) +
    cis +
    '<div class="bs-panel"><div class="bs-ph"><h3>Názvy úrovní</h3><small>podľa zmluvy, napr. Kategória A / B / C</small></div><div class="in" style="overflow-x:auto"><table class="bs-mriezka"><thead><tr><th>Typ</th><th>1 · najvážnejšia</th><th>2</th><th>3</th><th>4</th></tr></thead><tbody>' + urov + "</tbody></table></div></div>" +
    '<div class="bs-panel"><div class="bs-ph"><h3>Povinné polia formulára</h3></div><div class="in" style="overflow-x:auto"><table class="bs-mriezka"><tbody>' + povTyp + "</tbody></table></div></div>" +
    '<div><button type="button" class="bs-btn pri" onclick="bsNastaveniaUloz()">Uložiť nastavenia</button> <button type="button" class="bs-btn" onclick="BS.nastavenia=null;bsPrekresli()">Zahodiť zmeny</button></div>' +
    '<div class="bs-panel"><div class="bs-ph"><h3>Biznis požiadavky</h3><small>' + (BS.d.poziadavky || []).length + '</small></div><div class="in">' +
      (poz ? '<table class="bs-mriezka"><tbody>' + poz + "</tbody></table>" : '<div class="bs-podobne">Zatiaľ žiadne.</div>') +
      '<label class="bs-podobne">Vložte zoznam z Excelu — dva stĺpce: kód a názov<textarea id="bsPozVloz" placeholder="BP-101&#9;Podanie žiadosti"></textarea></label>' +
      '<div><button type="button" class="bs-btn" onclick="bsPoziadavkyUloz()">Uložiť požiadavky</button></div></div></div></div>';
}
function bsIdZNazvu(k, nazov){
  const zaklad = bsNorm(nazov).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "x";
  const zoz = (BS.nastavenia[k] || []).map(x => x.id);
  let id = zaklad, i = 2; while (zoz.includes(id)) id = zaklad + "-" + (i++);
  return id;
}
function bsCisPridaj(k){
  const el = document.getElementById("bsNovy_" + k), nazov = el ? el.value.trim() : "";
  if (!nazov) return;
  const x = { id: bsIdZNazvu(k, nazov), nazov };
  if (k === "releasy") x.stav = "planovany";
  (BS.nastavenia[k] = BS.nastavenia[k] || []).push(x); bsPrekresli();
}
// Premenovanie nemení id — staré záznamy ukážu nový názov.
function bsCisUprav(k, i, v){ if (v.trim()) BS.nastavenia[k][i].nazov = v.trim(); }
function bsCisStav(i, v){ BS.nastavenia.releasy.forEach((r, j) => { if (j === i) r.stav = v; else if (v === "aktivny" && r.stav === "aktivny") r.stav = "planovany"; }); bsPrekresli(); }
function bsCisZmaz(k, i){
  const x = BS.nastavenia[k][i], pole = { is: "is_id", moduly: "modul_id", prostredia: "prostredie_id", releasy: "release_id", timy: "riesitel_tim" }[k];
  const n = bsZaznamy().filter(z => z[pole] === x.id).length;
  if (n && !confirm("Položku „" + x.nazov + "“ používa " + bsPocet(n, "záznam", "záznamy", "záznamov") + ". Odstrániť ju z ponuky aj tak? Záznamy si hodnotu nechajú, len sa nebude zobrazovať.")) return;
  BS.nastavenia[k].splice(i, 1); bsPrekresli();
}
function bsUrovenUprav(typ, u, v){
  const m = ((BS.nastavenia.urovne = BS.nastavenia.urovne || {})[typ] = BS.nastavenia.urovne[typ] || {});
  if (v.trim()) m[u] = v.trim(); else delete m[u];
}
function bsPovinneUprav(typ, k, v){ ((BS.nastavenia.povinne = BS.nastavenia.povinne || {})[typ] = BS.nastavenia.povinne[typ] || {})[k] = v; }
async function bsNastaveniaUloz(){
  const n = BS.nastavenia, g = BS.d.projekt;
  if (BS_TYPY_PORADIE.some(typ => !bsUrovneTypu(n, typ).length)) return alert("Každý typ musí mať aspoň jednu úroveň.");
  try {
    await bsRpc("b2b_bs_nastavenia_uloz", { p_projekt: B2B.pid, p_verzia: g.verzia,
      p_nastavenia: { triaz: n.triaz !== false, is: n.is || [], moduly: n.moduly || [], prostredia: n.prostredia || [], releasy: n.releasy || [], timy: n.timy || [], urovne: n.urovne || {}, povinne: n.povinne || {},
        sla: n.sla || {}, triaz_min: n.triaz_min == null ? 480 : n.triaz_min } });
    oznamPas("Nastavenia BUGstation uložené"); BS.nastavenia = null; bsNacitajData();
  } catch (e) { bsChyba(e, "Nastavenia sa nepodarilo uložiť"); }
}
async function bsRolaPrepni(osobaId, rola, zapni){
  const o = bsOsoby().find(x => x.id === osobaId); if (!o) return;
  const role = (o.bs_role || []).filter(r => r !== rola).concat(zapni ? [rola] : []);
  try { const r = await bsRpc("b2b_bs_role_nastav", { p_osoba: osobaId, p_role: role }); o.bs_role = r.role; oznamPas("Roly uložené · " + o.meno); bsPrekresli(); }
  catch (e) { bsChyba(e, "Rolu sa nepodarilo zmeniť"); bsPrekresli(); }
}
async function bsPoziadavkyUloz(){
  const el = document.getElementById("bsPozVloz"), t = el ? el.value : "";
  const riadky = t.split(/\r?\n/).map(r => r.split("\t")).filter(c => c[0] && c[0].trim() && c[1] && c[1].trim()).map(c => ({ kod: c[0].trim(), nazov: c[1].trim() }));
  if (!riadky.length) return alert("Nevidím žiadne riadky s kódom a názvom (stĺpce oddelené tabulátorom — skopírujte ich z Excelu).");
  try { const r = await bsRpc("b2b_bs_poziadavky_uloz", { p_projekt: B2B.pid, p_riadky: riadky }); oznamPas("Uložené požiadavky: " + r.pocet); bsNacitajData(); }
  catch (e) { bsChyba(e, "Požiadavky sa nepodarilo uložiť"); }
}
