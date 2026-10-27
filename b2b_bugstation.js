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
// f = { typy, stav: "vsetky"|"otvorene"|"uzavrete"|[stavy], urovne, is, moduly, prostredia,
//       releasy, riesitel: id osoby|"ja", riesitelia: [id] (meno z otázky viacerým osobám),
//       nahlasil: id|"ja", nahlasili: [id], cakaNaMna, poSla, blizkoSla, text,
//       vekDniMin, vekDniMax, bezZmenyDniMin, datumOd, datumDo (RRRR-MM-DD identifikovania) }
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
    if (ff.stav === "uzavrete" && !bsUzavrety(z)) return false;
    if (Array.isArray(ff.stav) && ff.stav.length && !ff.stav.includes(z.stav)) return false;
    if (!v(+z.uroven, ff.urovne)) return false;
    if (!v(z.is_id, ff.is) || !v(z.modul_id, ff.moduly) || !v(z.prostredie_id, ff.prostredia) || !v(z.release_id, ff.releasy)) return false;
    if (ff.riesitel) {
      const kto = ff.riesitel === "ja" ? (ja || {}).osoba : ff.riesitel;
      if (z.riesitel_osoba !== kto) return false;
    }
    if (Array.isArray(ff.riesitelia) && !ff.riesitelia.includes(z.riesitel_osoba)) return false;
    if (ff.nahlasil && z.nahlasil !== (ff.nahlasil === "ja" ? (ja || {}).osoba : ff.nahlasil)) return false;
    if (Array.isArray(ff.nahlasili) && !ff.nahlasili.includes(z.nahlasil)) return false;
    if (ff.cakaNaMna && !bsCakaNaMna(z, ja)) return false;
    if (ff.poSla) { const s = bsSla(z, t); if (!s || !s.po || s.druh === "koniec") return false; }
    if (ff.blizkoSla) { const s = bsSla(z, t); if (!s || !s.blizko) return false; }
    if (ff.vekDniMin != null || ff.vekDniMax != null) {
      const od = new Date(z.identifikovane || z.vytvorene).getTime();
      if (ff.vekDniMin != null && t - od < ff.vekDniMin * BS_DEN) return false;
      if (ff.vekDniMax != null && t - od > ff.vekDniMax * BS_DEN) return false;
    }
    if (ff.bezZmenyDniMin != null && t - new Date(z.upravene || z.vytvorene).getTime() < ff.bezZmenyDniMin * BS_DEN) return false;
    if (ff.datumOd || ff.datumDo) {
      const d = bsDatumDna(z.identifikovane || z.vytvorene);
      if (ff.datumOd && d < ff.datumOd) return false;
      if (ff.datumDo && d > ff.datumDo) return false;
    }
    if (text && !bsNorm(z.kluc + " " + z.nazov).includes(text)) return false;
    return true;
  });
}

// Dátum dňa RRRR-MM-DD v miestnom čase (dátum bez času ostane, ako je).
function bsDatumDna(ts){
  if (!ts) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(ts))) return String(ts);
  const d = new Date(ts);
  return isNaN(d) ? "" : d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// ── otázka v bežnej reči → filter (§15, §30, BS3a) ──────────────
// Server (edge b2b, akcia bs_otazka) vráti filter v tvare schémy BS_OTAZKA_SCHEMA;
// appka z neho zloží f pre bsFilter — tú istú funkciu ako ručné chipy. Mená osôb
// z otázky dohľadá appka (modelu mená ani záznamy nejdú): meno viacerým osobám =
// chip s výberom (kým sa nevyberie, filter platí na všetky), meno nikomu = chip
// s varovaním a prázdny výsledok — nie tichý filter na všetkých.
// Skloňovanie mien: slovo otázky sedí na slovo mena, keď majú spoločné aspoň
// 3 znaky a líšia sa najviac v posledných troch (Petrovi ~ Peter, Novákovej ~ Nováková).
function bsMenoZhoda(text, meno){
  const t = bsNorm(text).split(/\s+/).filter(Boolean), m = bsNorm(meno).split(/\s+/).filter(Boolean);
  const spol = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  return t.length > 0 && t.every(x => m.some(y => { const c = spol(x, y); return c >= 3 && c >= Math.min(x.length, y.length) - 3; }));
}
// Presná zhoda (každé slovo otázky je celé slovo mena) má prednosť pred skloňovanou:
// „Peter“ je Peter Novák, nie aj Petra Nováková; „Petrovi“ sedí na oboch → výber.
function bsOsobyPodlaMena(text, osoby){
  const t = bsNorm(text).split(/\s+/).filter(Boolean), zoz = osoby || [];
  const presne = zoz.filter(o => { const m = bsNorm(o.meno).split(/\s+/); return t.length > 0 && t.every(x => m.includes(x)); });
  return (presne.length ? presne : zoz.filter(o => bsMenoZhoda(text, o.meno))).map(o => o.id);
}
function bsOtazkaNaFilter(o, osoby){
  const f = {}, mena = {};
  if (!o) return { f, mena };
  if ((o.typy || []).length) f.typy = o.typy.slice();
  if (o.stav === "otvorene" || o.stav === "uzavrete") f.stav = o.stav;
  else if (o.stav === "zoznam" && (o.stavy || []).length) f.stav = o.stavy.slice();
  if ((o.urovne || []).length) f.urovne = o.urovne.slice();
  ["is", "moduly", "prostredia", "releasy"].forEach(k => { if ((o[k] || []).length) f[k] = o[k].slice(); });
  [["riesitel", "riesitelia", o.riesitel_text], ["nahlasil", "nahlasili", o.nahlasil_text]].forEach(([k, kk, text]) => {
    if (o.ja === k) { f[k] = "ja"; return; }
    if (!text) return;
    const ids = bsOsobyPodlaMena(text, osoby);
    mena[k] = { text, ids };
    if (ids.length === 1) f[k] = ids[0]; else f[kk] = ids;
  });
  if (o.caka_na_mna) f.cakaNaMna = true;
  if (o.sla === "po") f.poSla = true;
  if (o.sla === "blizko") f.blizkoSla = true;
  if (o.vek_dni_min != null) f.vekDniMin = o.vek_dni_min;
  if (o.vek_dni_max != null) f.vekDniMax = o.vek_dni_max;
  if (o.bez_zmeny_dni_min != null) f.bezZmenyDniMin = o.bez_zmeny_dni_min;
  if (o.datum_od) f.datumOd = o.datum_od;
  if (o.datum_do) f.datumDo = o.datum_do;
  if (o.text) f.text = o.text;
  return { f, mena };
}
function bsOtazkaDni(n, pred){
  if (pred) return n + " " + (n === 1 ? "dňom" : "dňami");
  return (n === 1 ? "posledný " : n < 5 ? "posledné " : "posledných ") + bsPocet(n, "deň", "dni", "dní");
}
// Chipy filtra z otázky: každý sa dá zrušiť (k = kľúč vo f).
function bsOtazkaChipy(f, mena, nast){
  const ch = [], typy = f.typy && f.typy.length ? f.typy : null;
  const zoz = (k, nazov) => ch.push({ k, text: nazov + " · " + f[k].map(id => bsCiselnikNazov(nast, k, id) || id).join(", ") });
  if (typy) ch.push({ k: "typy", text: typy.map(t => BS_TYPY[t].mnozne).join(", ") });
  if (f.stav === "otvorene") ch.push({ k: "stav", text: "Otvorené" });
  else if (f.stav === "uzavrete") ch.push({ k: "stav", text: "Uzavreté" });
  else if (Array.isArray(f.stav)) ch.push({ k: "stav", text: f.stav.map(s => bsStav(s)[1]).join(", ") });
  if (f.urovne) {
    const t1 = typy && typy.length === 1 ? typy[0] : null;
    const nazvy = [...new Set(f.urovne.map(u => t1 ? bsUrovenNazov(nast, t1, u) : (typy || BS_TYPY_PORADIE).map(t => bsUrovenNazov(nast, t, u)).filter(Boolean).join(" / ")))].filter(Boolean);
    ch.push({ k: "urovne", text: (t1 ? BS_TYPY[t1].os : "Úroveň") + " · " + (nazvy.join(", ") || f.urovne.join(", ")) });
  }
  if (f.is) zoz("is", "IS");
  if (f.moduly) zoz("moduly", "Modul");
  if (f.prostredia) zoz("prostredia", "Prostredie");
  if (f.releasy) zoz("releasy", "Release");
  [["riesitel", "riesitelia", "Riešiteľ"], ["nahlasil", "nahlasili", "Nahlásil"]].forEach(([k, kk, lab]) => {
    if (f[k] === "ja") ch.push({ k, text: lab + " · ja" });
    else if (f[k]) ch.push({ k, text: lab + " · " + bsMeno(f[k]) });
    else if (Array.isArray(f[kk])) {
      const m = (mena || {})[k] || {};
      if (!f[kk].length) ch.push({ k: kk, text: lab + " · „" + (m.text || "") + "“ — v projekte taká osoba nie je", varovanie: true });
      else ch.push({ k: kk, text: lab + " · " + f[kk].map(bsMeno).join(" alebo ") + "?", vyber: f[kk], cielK: k, nazov: lab });
    }
  });
  if (f.cakaNaMna) ch.push({ k: "cakaNaMna", text: "Čaká na mňa" });
  if (f.poSla) ch.push({ k: "poSla", text: "SLA po termíne" });
  if (f.blizkoSla) ch.push({ k: "blizkoSla", text: "SLA blízko termínu" });
  if (f.vekDniMin != null) ch.push({ k: "vekDniMin", text: "Identifikované pred viac ako " + bsOtazkaDni(f.vekDniMin, true) });
  if (f.vekDniMax != null) ch.push({ k: "vekDniMax", text: "Identifikované za " + bsOtazkaDni(f.vekDniMax) });
  if (f.bezZmenyDniMin != null) ch.push({ k: "bezZmenyDniMin", text: "Bez zmeny aspoň " + bsPocet(f.bezZmenyDniMin, "deň", "dni", "dní") });
  if (f.datumOd) ch.push({ k: "datumOd", text: "Identifikované od " + bsDMR(f.datumOd) });
  if (f.datumDo) ch.push({ k: "datumDo", text: "Identifikované do " + bsDMR(f.datumDo) });
  if (f.text) ch.push({ k: "text", text: "Text · „" + f.text + "“" });
  return ch;
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
  const s = bsNorm(text).replace(",", ".");   // bsNorm: malé písmená bez diakritiky („deň“ → „den“)
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(min|m|h|hod|d|dni|den)?$/);
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
  // dlhý kód (5–10 znakov): pilulka na celý kód; v zbalenom raile štvorec s kódom na dva riadky
  ".bs-kod.dlhy{width:auto;min-width:26px;padding:0 6px;white-space:nowrap}",
  ".bs-rail:not(.on) .bs-projb .bs-kod.dlhy{flex-direction:column;gap:1px;width:26px;min-width:0;padding:0;font-size:8px}",
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
  ".bs-ai{display:flex;align-items:center;gap:7px;padding:4px 9px;border:1px solid var(--bs-l30);border-radius:6px;background:var(--bs-vyb);font:400 11px/1 var(--bs-sans);color:var(--bs-t4);flex:1 1 220px;min-width:0;max-width:420px}",
  ".bs-ai b{font-weight:500;color:var(--bs-t3)}",
  ".bs-ai input{border:none;outline:none;background:transparent;font:inherit;color:var(--bs-t1);width:100%;min-width:0}",
  ".bs-otz{padding:12px 14px;display:flex;flex-direction:column;gap:8px;margin-bottom:10px}",
  ".bs-otz-h{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}",
  ".bs-otz-h small{display:block;font:500 10px/1.2 var(--bs-sans);color:var(--bs-t5);text-transform:uppercase;letter-spacing:.04em}",
  ".bs-otz-h b{font:500 13px/1.4 var(--bs-sans);color:var(--bs-t1);overflow-wrap:anywhere}",
  ".bs-otz-ch{display:flex;flex-wrap:wrap;gap:6px}",
  ".bs-chipq{display:inline-flex;align-items:center;gap:4px;padding:3px 4px 3px 9px;border:1px solid var(--bs-l30);border-radius:6px;background:var(--bs-vyb);font:400 11.5px/1.3 var(--bs-sans);color:var(--bs-t3);max-width:100%;overflow-wrap:anywhere}",
  ".bs-chipq.war{border-color:var(--neg,#b4442f);color:var(--neg,#b4442f);background:transparent}",
  ".bs-chipq select{font:inherit;color:var(--bs-t1);border:1px solid var(--bs-l16);border-radius:4px;background:var(--bs-main);max-width:180px}",
  ".bs-otz-p{font:500 12px/1 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-otz-chyba{color:var(--neg,#b4442f)}",
  ".bs-btn{display:inline-flex;align-items:center;gap:6px;flex:none;white-space:nowrap;padding:5px 11px;border:1px solid var(--bs-l18);border-radius:7px;background:var(--bs-panel);font:500 11.5px/1 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-btn.pri{border-color:transparent;background:var(--bs-ak);color:#fff}",
  "[data-tema=\"tmavy\"] .bs-btn.pri{background:#3d5680}",
  ".bs-btn.mal{padding:4px 9px;font-weight:400;font-size:11px;border-radius:6px;background:var(--bs-main);color:var(--bs-t3);border-color:var(--bs-l16)}",
  ".bs-btn.mal.on{background:var(--bs-vyb);border-color:var(--bs-l30)}",
  ".bs-btn[disabled]{opacity:.5;cursor:default}",
  ".bs-telo{flex:1;display:flex;min-height:0}",
  ".bs-obsah{flex:1;min-width:0;overflow:auto;padding:20px 22px 32px}",
  // Obsah v strede ako appka (okno cez celú obrazovku — Roman 27. 10. 2026: „obsah je
  // celý vľavo“); lišta zarovnaná s ním, pod 1224 px ostáva pôvodný okraj.
  ".bs-obsah>.bs-sirka{max-width:1180px;margin:0 auto}",
  ".bs-lista{padding-left:max(18px,calc((100% - 1180px) / 2));padding-right:max(18px,calc((100% - 1180px) / 2))}",
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
  ".bs-riadok.bs-typy{grid-template-columns:minmax(0,1fr) 64px 84px 56px}",
  // prijaté e-maily (BS3b): pruh nad obsahom a zoznam v okne
  ".bs-prij-b{display:flex;align-items:center;flex-wrap:wrap;gap:10px;justify-content:space-between;padding:9px 14px;margin-bottom:12px;border-color:var(--bs-okr)}",
  ".bs-prij-b span{flex:1 1 220px;font:400 12px/1.4 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-prij{display:flex;flex-direction:column;gap:10px}",
  ".bs-prij-m{border:1px solid var(--bs-l13);border-radius:8px;padding:10px 12px;background:var(--bs-panel)}",
  ".bs-prij-h{display:flex;flex-direction:column;gap:3px}",
  ".bs-prij-h b{font:500 12.5px/1.3 var(--bs-sans);color:var(--bs-t1);overflow-wrap:anywhere}",
  ".bs-prij-h small{font:400 10.5px/1.3 var(--bs-sans);color:var(--bs-t4);overflow-wrap:anywhere}",
  ".bs-prij-t{margin:8px 0 0;font:400 11.5px/1.45 var(--bs-sans);color:var(--bs-t2);white-space:pre-wrap;overflow-wrap:anywhere;max-height:9em;overflow:auto}",
  ".bs-prij-p{margin:6px 0 0;font:400 10.5px/1.4 var(--bs-sans);color:var(--bs-t3);overflow-wrap:anywhere}",
  ".bs-prij-a{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px}",
  ".bs-typy-h{padding-top:9px;padding-bottom:3px}",
  ".bs-typy-h span{font:500 9.5px/1.2 var(--bs-mono);letter-spacing:.5px;color:var(--bs-t5);text-align:right}",
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
  // BS2: testovací plán (C), scenáre (D), vykonanie, Prehľad s plánom
  ".bs-stat{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}",
  ".bs-stat>div{background:var(--bs-panel);border:1px solid var(--bs-l13);border-radius:9px;padding:13px 14px 12px;min-width:0}",
  ".bs-stat-v{font:500 21px/1.15 var(--bs-mono);letter-spacing:-.5px;color:var(--bs-t1);margin:6px 0 4px}",
  ".bs-bod9{width:9px;height:9px;border-radius:50%;flex:none;background:oklch(0.62 max(var(--c),.04) var(--h))}",
  ".bs-ph h3 small{font:400 10.5px/1 var(--bs-mono);color:var(--bs-t4);margin-left:8px}",
  ".bs-ph-tl{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}",
  ".bs-fp{display:flex;align-items:center;gap:8px}",
  ".bs-bar6,.bs-bar5{display:block;width:210px;height:6px;border-radius:4px;background:var(--bs-l08);overflow:hidden}",
  ".bs-bar5{width:84px;height:5px}",
  ".bs-bar6>i,.bs-bar5>i{display:block;height:100%;border-radius:4px;background:var(--bs-ak)}",
  ".bs-pr{display:grid;grid-template-columns:1fr 220px 140px;align-items:center;gap:10px;padding:9px 16px;border-top:1px solid var(--bs-l08)}",
  ".bs-pr.s{grid-template-columns:1fr 220px 140px 26px}",
  ".bs-pr-n{border:none;background:none;padding:0;text-align:left;font:400 12px/1.35 var(--bs-sans);color:var(--bs-t1);cursor:pointer;min-width:0}",
  ".bs-pr-n:hover{text-decoration:underline}",
  ".bs-pr-t{color:var(--bs-t4)}",
  ".bs-kodm{font:500 10.5px/1 var(--bs-mono);color:var(--bs-t4)}",
  ".bs-pocty{display:flex;gap:10px;font:500 10.5px/1 var(--bs-mono);white-space:nowrap}",
  ".bs-pocty b{font-weight:500}",
  ".bs-pocty .presiel{color:oklch(0.48 0.1 162)}.bs-pocty .nepresiel{color:oklch(0.5 0.13 32)}.bs-pocty .blokovany{color:oklch(0.5 0.11 78)}.bs-pocty .caka{color:var(--bs-t4)}",
  "[data-tema=\"tmavy\"] .bs-pocty .presiel{color:oklch(0.78 0.1 162)}[data-tema=\"tmavy\"] .bs-pocty .nepresiel{color:oklch(0.78 0.11 32)}[data-tema=\"tmavy\"] .bs-pocty .blokovany{color:oklch(0.8 0.1 78)}",
  ".bs-krit{border-top:1px solid var(--bs-l08);padding:10px 16px}",
  ".bs-krit summary{cursor:pointer;font:500 11.5px/1.3 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-krit summary small{font:400 10.5px/1 var(--bs-mono);color:var(--bs-t4);margin-left:6px}",
  ".bs-krit-r{display:flex;align-items:flex-start;gap:9px;padding:7px 0;font:400 11.5px/1.4 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-krit-r>span:nth-child(2){flex:1}.bs-krit-r small{display:block;color:var(--bs-t4)}",
  ".bs-krit-r .ok{color:oklch(0.48 0.1 162);font-weight:600}.bs-krit-r .nie{color:oklch(0.5 0.13 32);font-weight:600}",
  ".bs-sc{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:14px;align-items:start}",
  ".bs-sr{display:flex;align-items:center;gap:10px;width:100%;padding:11px 16px;border:none;border-top:1px solid var(--bs-l08);background:none;text-align:left;cursor:pointer}",
  ".bs-sr:hover{background:var(--bs-hover)}",
  ".bs-sr.on{background:var(--bs-vyb);box-shadow:inset 2px 0 0 var(--bs-ak)}",
  ".bs-sr-n{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;font:400 12px/1.35 var(--bs-sans);color:var(--bs-t1)}",
  ".bs-sr-v{display:flex;flex-direction:column;align-items:flex-end;gap:4px}",
  ".bs-sr-v small{font:400 10px/1 var(--bs-mono);color:var(--bs-t4)}",
  ".bs-scd{padding:16px 18px 18px}",
  ".bs-scd-h{display:flex;align-items:center;flex-wrap:wrap;gap:8px}",
  ".bs-scd h2{margin:8px 0 12px;font:600 15px/1.25 var(--bs-sans);color:var(--bs-t1)}",
  ".bs-scd-m{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px 14px;margin-bottom:12px}",
  ".bs-scd-m .k{display:block;font:500 10px/1.2 var(--bs-mono);letter-spacing:.5px;color:var(--bs-t4);margin-bottom:3px}",
  ".bs-scd-m .v{font:400 11.5px/1.35 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-scd-p{margin:0 0 12px;font:400 11.5px/1.5 var(--bs-sans);color:var(--bs-t3);white-space:pre-wrap}",
  ".bs-callout{display:flex;gap:9px;margin:0 0 12px;padding:10px 12px;border-radius:8px;background:oklch(0.96 0.03 38);border:1px solid oklch(0.87 0.05 38)}",
  ".bs-callout>i{width:7px;height:7px;border-radius:50%;flex:none;margin-top:5px;background:oklch(0.55 0.14 38)}",
  ".bs-callout b{font:500 11.5px/1.3 var(--bs-sans);color:oklch(0.4 0.12 38)}",
  ".bs-callout p{margin:3px 0 0;font:400 11px/1.5 var(--bs-sans);color:oklch(0.43 0.07 38)}",
  ".bs-callout button{border:none;background:none;padding:0;font:500 11px/1 var(--bs-mono);color:oklch(0.4 0.12 38);text-decoration:underline;cursor:pointer}",
  "[data-tema=\"tmavy\"] .bs-callout{background:oklch(0.3 0.05 38);border-color:oklch(0.42 0.07 38)}[data-tema=\"tmavy\"] .bs-callout b,[data-tema=\"tmavy\"] .bs-callout p,[data-tema=\"tmavy\"] .bs-callout button{color:oklch(0.88 0.06 38)}",
  ".bs-kroky-h{font:500 10px/1 var(--bs-mono);letter-spacing:.5px;color:var(--bs-t4);margin:4px 0 2px}",
  ".bs-krok{display:grid;grid-template-columns:22px minmax(120px,1fr) minmax(120px,1fr) 74px;gap:10px 12px;padding:11px 0;border-top:1px solid var(--bs-l09);align-items:start}",
  ".bs-kn{font:500 10.5px/1.5 var(--bs-mono);color:var(--bs-t4)}",
  ".bs-ka{font:400 11.5px/1.5 var(--bs-sans);color:var(--bs-t2);min-width:0}",
  ".bs-ka em{display:block;font-style:normal;color:var(--bs-t3);white-space:pre-wrap;margin-top:2px}",
  ".bs-ko{font:400 11.5px/1.5 var(--bs-sans);color:var(--bs-t4);white-space:pre-wrap;min-width:0}",
  ".bs-krok-tl{display:flex;gap:3px;margin-top:6px}",
  ".bs-krok-tl button{width:22px;height:22px;border:1px solid var(--bs-l16);border-radius:5px;background:var(--bs-panel);color:var(--bs-t4);font:400 11px/1 var(--bs-sans);cursor:pointer;padding:0}",
  ".bs-krok-tl button[disabled]{opacity:.35;cursor:default}",
  ".bs-beh{display:flex;flex-direction:column;gap:12px}",
  ".bs-beh-p{font:400 11px/1.3 var(--bs-sans);color:var(--bs-t4);display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
  ".bs-beh-h{font:400 13px/1.4 var(--bs-sans);color:var(--bs-t1)}",
  ".bs-beh-s p{margin:4px 0 0;font:400 12px/1.5 var(--bs-sans);color:var(--bs-t2);white-space:pre-wrap}",
  ".bs-beh-tl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}",
  ".bs-v{min-height:46px;border-radius:9px;border:1px solid var(--bs-l16);background:var(--bs-panel);font:600 13px/1.2 var(--bs-sans);cursor:pointer}",
  ".bs-v.presiel{color:oklch(0.42 0.1 162);border-color:oklch(0.8 0.08 162);background:oklch(0.97 0.03 162)}",
  ".bs-v.nepresiel{color:oklch(0.45 0.13 32);border-color:oklch(0.84 0.07 32);background:oklch(0.97 0.025 32)}",
  ".bs-v.blokovany{color:oklch(0.45 0.1 78);border-color:oklch(0.84 0.07 78);background:oklch(0.97 0.03 78)}",
  "[data-tema=\"tmavy\"] .bs-v{background:var(--bs-main)}[data-tema=\"tmavy\"] .bs-v.presiel{color:oklch(0.82 0.1 162)}[data-tema=\"tmavy\"] .bs-v.nepresiel{color:oklch(0.82 0.11 32)}[data-tema=\"tmavy\"] .bs-v.blokovany{color:oklch(0.85 0.1 78)}",
  ".bs-beh-def{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:10px 12px;border:1px solid var(--bs-l16);border-radius:8px;font:400 11.5px/1.4 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-beh-nav{display:flex;justify-content:space-between;gap:8px}",
  ".bs-chk{display:flex!important;flex-direction:row!important;align-items:center;gap:8px;font:400 12px/1.4 var(--bs-sans)!important;text-transform:none!important;letter-spacing:0!important;color:var(--bs-t2)!important}",
  ".bs-chk input[type=checkbox]{width:auto;flex:none}",
  ".bs-pp{display:flex;flex-direction:column;gap:4px;max-height:42vh;overflow:auto;border:1px solid var(--bs-l13);border-radius:8px;padding:8px 10px}",
  ".bs-pp label[hidden]{display:none!important}",
  ".bs-odkaz{border:none;background:none;padding:0;font:500 11.5px/1.4 var(--bs-mono);color:var(--bs-ak);text-decoration:underline;cursor:pointer}",
  ".bs-pata-p{display:flex;align-items:center;gap:8px}",
  ".bs-pata-p>span{flex:1;height:4px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden}",
  ".bs-pata-p>span>i{display:block;height:100%;background:#57a396}",
  ".bs-pata-p b{font:500 10px/1 var(--bs-mono);color:#dfe5ee}",
  ".bs-pata-d{font:400 10.5px/1 var(--bs-sans);color:#b0bacb}",
  ".bs-legw{display:flex;flex-wrap:wrap;gap:10px;margin-left:auto}",
  ".bs-leg{display:flex;align-items:center;gap:5px;font:400 10.5px/1 var(--bs-sans);color:var(--bs-t4)}",
  ".bs-leg i,.bs-stack i{display:block;background:var(--bs-l14)}",
  ".bs-leg i{width:8px;height:8px;border-radius:2px}",
  ".bs-leg i.presiel,.bs-stack i.presiel{background:oklch(0.62 0.1 162)}.bs-leg i.nepresiel,.bs-stack i.nepresiel{background:oklch(0.62 0.14 32)}.bs-leg i.blokovany,.bs-stack i.blokovany{background:oklch(0.62 0.12 78)}",
  ".bs-prog{display:grid;grid-template-columns:150px 1fr 56px;align-items:center;gap:12px;width:100%;padding:11px 16px;border:none;border-bottom:1px solid var(--bs-l08);background:none;text-align:left;cursor:pointer}",
  ".bs-prog:hover{background:var(--bs-hover)}",
  ".bs-prog-n{display:flex;flex-direction:column;gap:3px;min-width:0}",
  ".bs-prog-n b{font:500 12px/1.3 var(--bs-sans);color:var(--bs-t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
  ".bs-prog-n small{font:400 10px/1.2 var(--bs-mono);color:var(--bs-t4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
  ".bs-stack{display:flex;height:9px;border-radius:5px;background:var(--bs-l14);overflow:hidden}",
  ".bs-ms{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}",
  ".bs-ms>div{display:flex;flex-direction:column;gap:7px;padding:14px 16px;border-right:1px solid var(--bs-l09);min-width:0}",
  ".bs-ms>div:last-child{border-right:none}",
  ".bs-ms-n{display:flex;align-items:center;gap:7px;font:500 11.5px/1.3 var(--bs-sans);color:var(--bs-t2)}",
  ".bs-ms-n i{width:7px;height:7px;border-radius:50%;flex:none;background:oklch(0.62 0.11 var(--h))}",
  ".bs-ms-v{font:500 20px/1 var(--bs-mono);color:var(--bs-t1)}",
  ".bs-ms-p{font:400 10.5px/1.35 var(--bs-sans);color:var(--bs-t5)}",
  // úzke okno: split len od 1100 px, mobil pod 900 px (§4.4)
  "@media (max-width:1099px){.bs-split.dva{display:flex}.bs-splitb{display:none!important}}",
  "@media (max-width:899px){",
  ".bs{flex-direction:column;height:auto;min-height:0;overflow:visible;border-radius:0;border-left:0;border-right:0}",
  ".bs-rail,.bs-rail.on{width:auto;flex-direction:column}",
  ".bs-rh,.bs-rail.on .bs-rh{flex-direction:row;padding:8px 12px}",
  // aj s :not(.on) — inak vyhrá pravidlo zbaleného railu (vyššia špecificita) a na mobile
  // chýbal názov podprojektu, nadpis aj popisy záložiek s počtami
  ".bs-rail .bs-iba-on,.bs-rail:not(.on) .bs-iba-on{display:inline!important}",
  ".bs-rail .bs-projt,.bs-rail:not(.on) .bs-projt{display:flex!important}",
  ".bs-prep,.bs-pata,.bs-rail .bs-pata,.bs-rail:not(.on) .bs-pata{display:none!important}",
  ".bs-projw{padding:0 12px 8px}",
  ".bs-projb,.bs-rail.on .bs-projb{justify-content:flex-start;padding:7px 9px}",
  ".bs-rail:not(.on) .bs-projb .bs-kod.dlhy{flex-direction:row;gap:0;width:auto;min-width:26px;padding:0 6px;font-size:9px}",
  ".bs-nav{flex-direction:row;overflow-x:auto;padding:0 8px 8px;gap:4px}",
  ".bs-nav button,.bs-rail.on .bs-nav button{flex:none;width:auto;justify-content:flex-start;padding:8px 10px}",
  ".bs-nav .bs-nd{display:none}",
  ".bs-lista{padding:8px 12px}",
  ".bs-hl kbd{display:none}",
  ".bs-lista-a:has(.bs-ai){flex:1 1 100%}",
  ".bs-ai{flex-basis:100%;max-width:none;order:-1}",
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
  // BS2 na mobile: riadky plánu pod seba, kroky ako karty, veľké tlačidlá vykonania
  ".bs-sc{grid-template-columns:1fr}",
  ".bs-pr{grid-template-columns:1fr auto;gap:6px 10px}",
  ".bs-pr.s{grid-template-columns:1fr auto auto}",
  ".bs-ph h3 small{display:block;margin:3px 0 0}",
  ".bs-pr .bs-pr-n{grid-column:1/-1}",
  ".bs-bar6{width:90px}",
  ".bs-ph-tl{width:100%;margin-left:0}",
  ".bs-krok{grid-template-columns:22px 1fr auto}",
  ".bs-krok .bs-ko{grid-column:2/-1}",
  ".bs-krok>span:last-child{grid-column:3;grid-row:1}",
  ".bs-beh-tl{grid-template-columns:1fr}",
  ".bs-v{min-height:52px;font-size:15px}",
  ".bs-prog{grid-template-columns:1fr 46px}",
  ".bs-prog .bs-stack{grid-column:1/-1;order:3}",
  "}",
  // okno BUGstation (BS4b): prekrytie nad stránkou appky — pod modálnymi oknami (80)
  // a hláškami (60), nad bočným menu (45); na mobile roluje prekrytie
  ".bs-okno{position:fixed;inset:0;z-index:55;background:#eef1f6;padding:8px;overflow:hidden}",
  "[data-tema=\"tmavy\"] .bs-okno{background:#0b1019}",
  "html.bs-okno-on,html.bs-okno-on body{overflow:hidden}",
  ".bs-okno .bs{height:100%;min-height:0}",
  ".bs-spat{flex:none;display:flex;align-items:center;gap:2px;background:none;border:1px solid rgba(238,242,248,.28);color:#eef2f8;border-radius:7px;min-width:28px;height:28px;padding:0 7px;font:600 15px/1 var(--bs-sans)}",
  ".bs-spat span{font-size:11.5px;font-weight:500}",
  ".bs-spat:hover{background:rgba(255,255,255,.08)}",
  "@media (max-width:899px){.bs-okno{padding:0;overflow:auto;-webkit-overflow-scrolling:touch}.bs-okno .bs{height:auto;min-height:100%}}",
  // správa podprojektov v okne B2B
  ".bs-pp-kod{flex:none;display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:7px;background:#2f4260;color:#fff;font:600 11px/1 var(--bs-mono,ui-monospace,monospace);letter-spacing:.3px}",
  ".bs-sprava .bs-mriezka input{margin:0}"
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
// pp = id zvoleného podprojektu (admin_95, BS4a): v zákazke ich môže byť viac,
// modul pracuje vždy v jednom (BS.d.projekt je jeho riadok b2b_bs_podprojekty).
// okno = BUGstation otvorený v okne (prekrytie, BS4b); sprava = podprojekty
// zákazky pre záložku B2B (spravaOtvorene: karty s rozbalenými členmi).
const BS = { pid: null, pp: null, d: null, nacitavam: false, pohlad: "prehlad", split: null, detail: null, det: null,
  filtre: {}, menu: false, rail: false, hladat: "", zoradit: {}, nastavenia: null, otazka: null,
  okno: false, sprava: null, spravaNacitavam: false, spravaOtvorene: {} };
let _bsPoradie = 0;
const BS_STLPCE = "id,projekt_id,typ,cislo,kluc,nazov,uroven,stav,rozlisenie,duplikat,is_id,modul_id,prostredie_id,release_id," +
  "scenar,pripad,poziadavka_id,identifikovane,termin,suvisi,riesitel_osoba,riesitel_tim,ziadatel,data,nahlasil," +
  "vysvetlenie_prijal,vysvetlenie_prijate,verzia,vytvoril,vytvorene,upravil,upravene,zmazane," +
  "sla_rezim,sla_reakcia_min,sla_vyriesenie_min,sla_triaz_do,sla_reakcia_do,sla_reakcia_kedy,sla_vyriesenie_do,sla_zostava_min,sla_upozornene";

// Roly sú na podprojekte (admin_95, O3): b2b_bs_clenovia zvoleného podprojektu.
function bsJa(){
  const o = typeof b2bMojaOsoba === "function" ? b2bMojaOsoba() : null;
  if (!o) return { osoba: null, roly: [], spravca: false };
  const c = ((BS.d && BS.d.clenovia) || []).find(x => x.osoba_id === o.id);
  return { osoba: o.id, roly: (c && c.role) || [], spravca: !!o.spravca };
}
// Osoby podprojektu: členovia a správcovia zákazky, každá s rolami podprojektu
// v poli bs_role (riešiteľ, tester, @zmienka, tabuľka rolí).
function bsOsoby(){
  const roly = {};
  ((BS.d && BS.d.clenovia) || []).forEach(c => { roly[c.osoba_id] = c.role || []; });
  return ((B2B.d && B2B.d.osoby) || []).filter(o => o.aktivny && (o.spravca || roly[o.id]))
    .map(o => Object.assign({}, o, { bs_role: roly[o.id] || [] }));
}
function bsPodprojekty(){ return (BS.d && BS.d.podprojekty) || []; }
// Zvolený podprojekt: posledný zvolený, cieľ odkazu z e-mailu, predvolený, prvý aktívny.
function bsVyberPodprojektZo(zoz, chcem){
  return zoz.find(x => x.id === chcem) || zoz.find(x => x.predvoleny) || zoz.find(x => !x.archivovane) || zoz[0] || null;
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
    // Podprojekty zákazky, ktoré vidím (RLS: člen svoje, správca všetky — admin_95),
    // potom dáta zvoleného. BS.d.projekt = riadok podprojektu (nastavenia, verzia, kód).
    const rpp = await sb.from("b2b_bs_podprojekty").select("*").eq("projekt_id", pid).order("kod");
    if (poradie !== _bsPoradie) return;
    if (rpp.error && b2bChybaTabulky(rpp.error)) BS.d = { pid, bezMigracie: true };
    else if (rpp.error) throw rpp.error;
    else {
      const zoz = rpp.data || [];
      const ciel = typeof _b2bBsCiel !== "undefined" && _b2bBsCiel && _b2bBsCiel.pid === pid ? _b2bBsCiel.pp : null;
      const pp = bsVyberPodprojektZo(zoz, ciel || BS.pp);
      BS.pp = pp ? pp.id : null;
      if (!pp) BS.d = { pid, projekt: null, podprojekty: zoz, clenovia: [] };
      else {
        const planP = bsNacitajPlan(pp.id).catch(e => ({ plan: null, planChyba: (e && e.message) || String(e) }));   // BS2 (admin_91)
        // Prijaté e-maily podprojektu (BS3b, admin_96). Pred migráciou stĺpec chýba —
        // BUGstation beží bez nich; iná chyba nezhodí zvyšok, ukáže ju pruh.
        const prijP = sb.from("b2b_prijate").select("id,email_id,od_koho,predmet,telo,subor_nazov,subor_typ,subor_cesta,subor_bajtov,druh,stav,prijate")
          .eq("podprojekt_id", pp.id).eq("modul", "bugstation").eq("stav", "nove").order("prijate")
          .then(x => !x.error ? { prijate: x.data || [] } : bsBezPrijmu(x.error) ? { prijate: [] }
            : (console.error("BUGstation: prijaté e-maily", x.error), { prijate: [], prijateChyba: x.error.message || String(x.error) }));
        const r = await Promise.all([
          vsetky(() => sb.from("b2b_bs_zaznamy").select(BS_STLPCE).eq("podprojekt_id", pp.id).order("typ").order("cislo")),
          vsetky(() => sb.from("b2b_bs_historia").select("id,zaznam_id,kto,kedy,udalost,akcia,z,na,data").eq("podprojekt_id", pp.id).order("kedy").order("id")),
          sb.from("b2b_bs_poziadavky").select("*").eq("podprojekt_id", pp.id).order("kod"),
          sb.from("b2b_bs_moje").select("upozornenia").eq("podprojekt_id", pp.id).maybeSingle(),   // admin_90 (BS1b)
          sb.from("b2b_bs_clenovia").select("osoba_id,role").eq("podprojekt_id", pp.id)
        ]);
        const rp = await planP, rpr = await prijP;
        if (poradie !== _bsPoradie) return;
        const e = r.map(x => x.error).find(Boolean);
        if (e) throw e;
        BS.d = { pid, ppId: pp.id, projekt: pp, podprojekty: zoz, zaznamy: r[0].data || [], historia: r[1].data || [], poziadavky: r[2].data || [],
          upozornenia: (r[3].data || {}).upozornenia || "okamzite", clenovia: r[4].data || [], plan: rp.plan, planChyba: rp.planChyba || null,
          prijate: rpr.prijate, prijateChyba: rpr.prijateChyba || null };
      }
    }
    bsPlanZmenene();
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
// Návrat na kartu = čerstvé dáta (iný člen tímu mohol medzitým zapisovať):
// v okne BUGstation záznamy podprojektu, v záložke B2B správa podprojektov.
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (BS.okno) { if (BS.d && !BS.nacitavam) bsNacitajData(); }
  else if (typeof modulNaObrazovke === "function" && modulNaObrazovke() === "b2b_bugstation" && BS.sprava && !BS.spravaNacitavam) bsNacitajSpravu();
});

// Správa podprojektov zákazky (záložka BUGstation v okne B2B, BS4b): podprojekty,
// ktoré vidím (člen svoje, správca všetky), ich členovia a počty otvorených záznamov.
let _bsPoradieSpravy = 0;
async function bsNacitajSpravu(){
  const pid = B2B.pid, poradie = ++_bsPoradieSpravy;
  BS.spravaNacitavam = true;
  try {
    const rpp = await sb.from("b2b_bs_podprojekty").select("*").eq("projekt_id", pid).order("kod");
    if (poradie !== _bsPoradieSpravy) return;
    if (rpp.error && b2bChybaTabulky(rpp.error)) BS.sprava = { pid, bezMigracie: true };
    else if (rpp.error) throw rpp.error;
    else {
      const zoz = rpp.data || [], ids = zoz.map(x => x.id);
      const vsetky = (q) => b2bVsetky(q).then(data => ({ data }), error => ({ error }));
      const r = ids.length ? await Promise.all([
        sb.from("b2b_bs_clenovia").select("podprojekt_id,osoba_id,role").in("podprojekt_id", ids),
        vsetky(() => sb.from("b2b_bs_zaznamy").select("podprojekt_id,typ,stav,vysvetlenie_prijate,zmazane").eq("projekt_id", pid))
      ]) : [{ data: [] }, { data: [] }];
      if (poradie !== _bsPoradieSpravy) return;
      const e = r.map(x => x.error).find(Boolean);
      if (e) throw e;
      const otvorene = {};
      (r[1].data || []).forEach(z => { if (bsOtvoreny(z)) otvorene[z.podprojekt_id] = (otvorene[z.podprojekt_id] || 0) + 1; });
      // Adresa projektu pre záznamy e-mailom (+kód podprojektu, admin_96) — doplnok:
      // chyba adresy správu podprojektov nezhodí.
      const adr = await Promise.all([sb.from("prijem_adresy").select("alias").eq("projekt_id", pid).maybeSingle(),
        sb.from("b2b_prijem").select("token,povolene").eq("projekt_id", pid).maybeSingle()]).catch(e => [{ error: e }, {}]);
      if (poradie !== _bsPoradieSpravy) return;
      if (adr[0].error || adr[1].error) console.error("BUGstation: adresa projektu", adr[0].error || adr[1].error);
      const adresa = { alias: ((adr[0] && adr[0].data) || {}).alias || null, token: ((adr[1] && adr[1].data) || {}).token || null,
        povolene: ((adr[1] && adr[1].data) || {}).povolene !== false };
      BS.sprava = { pid, podprojekty: zoz, clenovia: r[0].data || [], otvorene, adresa };
    }
  } catch (e) {
    if (poradie !== _bsPoradieSpravy) return;
    console.error("BUGstation: podprojekty", e);
    BS.sprava = { pid, chyba: (e && e.message) || String(e) };
  }
  BS.spravaNacitavam = false;
  bsPrekresli();
}

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

// Prekreslenie so zachovaním posunu obsahu aj detailu: otvorené okno BUGstation
// (prekrytie #bsOkno), inak správa podprojektov v záložke B2B.
function bsPrekresli(){
  const vOkne = BS.okno;
  if (!vOkne && (typeof modulNaObrazovke !== "function" || modulNaObrazovke() !== "b2b_bugstation")) return;
  const pos = {};
  document.querySelectorAll("[data-bs-scroll]").forEach(el => { pos[el.getAttribute("data-bs-scroll")] = el.scrollTop; });
  if (vOkne) bsOknoKresli(); else appB2bBugstation();
  bsVyska();
  document.querySelectorAll("[data-bs-scroll]").forEach(el => { const k = el.getAttribute("data-bs-scroll"); if (pos[k]) el.scrollTop = pos[k]; });
}
// Shell s vlastným posunom vyplní priestor pod hlavičkou appky (desktop); v okne
// BUGstation výšku dáva CSS prekrytia; na mobile roluje stránka (CSS pod 900 px).
function bsVyska(){
  const k = document.getElementById("bsKoren");
  if (!k) return;
  if (window.innerWidth < 900 || (k.closest && k.closest(".bs-okno"))) { k.style.height = ""; return; }
  const hore = k.getBoundingClientRect().top + window.scrollY;
  k.style.height = Math.max(520, window.innerHeight - hore - 16) + "px";
}
if (typeof window !== "undefined") window.addEventListener("resize", () => { if (BS.okno || (typeof modulNaObrazovke === "function" && modulNaObrazovke() === "b2b_bugstation")) bsVyska(); });

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
//  OKNO BUGstation a SPRÁVA PODPROJEKTOV (BS4b, NAVRH §31.2, O1 a O4)
//  Záložka BUGstation v skupine B2B je správa: podprojekty zákazky, ich
//  členovia a roly, predvolený a archív. Samotný BUGstation beží v okne: na
//  počítači nová karta s ?bugstation=<podprojekt>, na telefóne a v appke
//  z Google Play to isté okno cez celú obrazovku s tlačidlom späť (nové okno
//  by v obale stratilo prihlásenie). Okno = prekrytie #bsOkno nad stránkou
//  appky — prihlásenie, dáta skupiny B2B aj modálne okná ostávajú.
// ═══════════════════════════════════════════════════════════════
function bsZmenaZakazky(){
  if (BS.pid === B2B.pid) return;
  BS.pid = B2B.pid; BS.pp = null; BS.d = null; BS.sprava = null; BS.spravaOtvorene = {}; BS.detail = null; BS.det = null; BS.split = null;
  BS.filtre = {}; BS.menu = false; BS.nastavenia = null; if (BS.pohlad === "otazka") BS.pohlad = "prehlad"; BS.otazka = null;
}
function bsOknoNaMieste(){
  return bsBezKariet() || (typeof window !== "undefined" && window.innerWidth < 900);
}
// Okno appky bez kariet prehliadača: obal z Google Play alebo PWA v samostatnom
// okne. Nie jeNainstalovana — tá berie aj značku inštalácie v localStorage, ktorú
// vidí aj obyčajná karta toho istého prehliadača (Roman 27. 10. 2026: na PC
// s nainštalovanou appkou sa BUGstation otvoril v tej istej karte).
function bsBezKariet(){
  try {
    if (typeof jeNativnyObal === "function" && jeNativnyObal()) return true;
    if (typeof window !== "undefined" && window.matchMedia
      && (window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: minimal-ui)").matches)) return true;
    return !!(typeof navigator !== "undefined" && navigator.standalone);   // iOS Safari
  } catch (e) { console.error("BUGstation: režim okna", e); return false; }
}
function bsOknoAdresa(ppId){ return location.pathname + "?bugstation=" + encodeURIComponent(ppId); }
function bsOknoOtvor(ppId, o){
  o = o || {};
  if (!ppId) return;
  if (o.novaKarta && !bsOknoNaMieste() && typeof window !== "undefined" && typeof window.open === "function") {
    if (window.open(bsOknoAdresa(ppId), "_blank")) return;   // zablokované okno = otvoriť na mieste
  }
  if (BS.pp !== ppId) { BS.pp = ppId; BS.d = null; BS.detail = null; BS.det = null; BS.split = null; BS.filtre = {}; BS.nastavenia = null; BS.otazka = null; if (BS.pohlad === "otazka") BS.pohlad = "prehlad"; }
  const bolo = BS.okno;
  BS.okno = true; BS.menu = false;
  if (!o.bezHistorie) { try { (bolo ? history.replaceState : history.pushState).call(history, { bsOkno: ppId }, "", bsOknoAdresa(ppId)); } catch (e) { console.error("BUGstation: adresa okna", e); } }
  bsPrekresli();
}
function bsOknoZavri(zHistorie){
  BS.okno = false; BS.menu = false; BS.detail = null; BS.det = null;
  if (typeof document !== "undefined" && document.body) {
    const el = document.getElementById("bsOkno"); if (el) el.remove();
    document.documentElement.classList.remove("bs-okno-on");
  }
  if (!zHistorie) { try { if (/[?&]bugstation=/.test(location.search)) history.replaceState({}, "", location.pathname); } catch (e) { console.error("BUGstation: adresa okna", e); } }
  BS.sprava = null;   // počty a členstvo sa v okne mohli zmeniť
  if (typeof modulNaObrazovke === "function" && modulNaObrazovke() === "b2b_bugstation") appB2bBugstation();
  else if (typeof otvorApp === "function") otvorApp("b2b_bugstation");
}
// Späť v telefóne (alebo v prehliadači) zavrie okno otvorené na mieste.
if (typeof window !== "undefined") window.addEventListener("popstate", () => {
  if (BS.okno && !/[?&]bugstation=/.test(location.search)) bsOknoZavri(true);
});
function bsOknoKresli(){
  if (typeof document === "undefined" || !document.body) return;
  bsStyly();
  let el = document.getElementById("bsOkno");
  if (!el) { el = document.createElement("div"); el.id = "bsOkno"; el.className = "bs-okno"; document.body.appendChild(el); }
  document.documentElement.classList.add("bs-okno-on");
  el.innerHTML = bsShellObsahHtml();
}

// Záložka BUGstation v okne B2B = správa podprojektov.
function bsZalozkaHtml(){
  bsStyly();
  bsZmenaZakazky();
  // Okno z adresy (?bugstation=, nová karta) alebo z odkazu v e-maile (?b2b_bs=) → otvoriť ho.
  const okno = typeof _b2bBsOkno !== "undefined" && _b2bBsOkno && _b2bBsOkno.pid === B2B.pid ? _b2bBsOkno : null;
  const ciel = typeof _b2bBsCiel !== "undefined" && _b2bBsCiel && _b2bBsCiel.pid === B2B.pid && _b2bBsCiel.pp ? _b2bBsCiel : null;
  if (okno) { _b2bBsOkno = null; setTimeout(() => bsOknoOtvor(okno.pp, { bezHistorie: true }), 0); }
  else if (ciel && !ciel.otvorene) { ciel.otvorene = true; setTimeout(() => bsOknoOtvor(ciel.pp, {}), 0); }
  if (!BS.sprava || BS.sprava.pid !== B2B.pid) { if (!BS.spravaNacitavam) setTimeout(bsNacitajSpravu, 0); return '<div class="aempty">Načítavam BUGstation…</div>'; }
  if (BS.sprava.bezMigracie) return '<div class="card" style="padding:12px 14px"><b>BUGstation ešte nie je v databáze</b><div class="csub">Chýba migrácia admin_95 (podprojekty) — po jej spustení sa modul otvorí.</div></div>';
  if (BS.sprava.chyba) return '<div class="card" style="padding:12px 14px;border-color:var(--neg)"><b style="color:var(--neg)">BUGstation sa nenačítal</b><div class="csub" style="margin:4px 0 8px">' + esc(BS.sprava.chyba) + '</div><button class="aabtn" onclick="BS.sprava=null;bsPrekresli()">Skúsiť znova</button></div>';
  if (!BS.sprava.podprojekty.length) return bsZapnutieHtml();
  return bsSpravaHtml();
}
function bsJaVZakazke(){ const o = typeof b2bMojaOsoba === "function" ? b2bMojaOsoba() : null; return { osoba: o ? o.id : null, spravca: !!(o && o.spravca) }; }
// Roly osoby v podprojekte zo správy; null = nie je členom.
function bsRolyV(ppId, osobaId){
  const c = ((BS.sprava && BS.sprava.clenovia) || []).find(x => x.podprojekt_id === ppId && x.osoba_id === osobaId);
  return c ? (c.role || []) : null;
}
function bsSpravaHtml(){
  const S = BS.sprava, ja = bsJaVZakazke(), P = (B2B.d && B2B.d.projekt) || {};
  const somTm = S.clenovia.some(c => c.osoba_id === ja.osoba && (c.role || []).includes("tm"));
  return '<div class="bs-ok bs-sprava"><div class="csub" style="margin:0 2px 10px">Podprojekty BUGstation projektu ' + esc(P.nazov || "") + ". " +
    "BUGstation sa otvára v samostatnom okne" + (bsOknoNaMieste() ? " cez celú obrazovku" : " (nová karta prehliadača)") + "; tu sa spravujú podprojekty, ich členovia a roly.</div>" +
    S.podprojekty.map(x => bsSpravaKartaHtml(x, ja)).join("") +
    (ja.spravca || somTm ? '<button type="button" class="aabtn" onclick="bsPodprojektFormular()">+ Založiť podprojekt</button>' : "") +
    '<details class="csub" style="margin:12px 2px 0"><summary>Záznamy e-mailom</summary><div style="margin-top:6px">' +
      (bsAdresaProjektu("") ? "Člen podprojektu s rolou, ktorá smie zakladať záznamy, pošle e-mail na adresu podprojektu (pri karte). Predmet „Defekt: …“, „Incident: …“, „Úloha: …“ alebo „Zmena: …“ určí typ; " +
        "adresa projektu bez kódu s takým predmetom ide do predvoleného podprojektu. E-mail čaká v BUGstation, kým ho niekto prevezme ako záznam alebo odmietne — sám sa nezaloží." +
        (S.adresa && !S.adresa.povolene ? " <b>Príjem e-mailov projektu je teraz vypnutý.</b>" : "")
      : "Projekt zatiaľ nemá prijímaciu adresu — vytvorí ju správca v Pracovnom výkaze → Projekt.") + "</div></details></div>";
}
// Adresa projektu s podadresou kódu podprojektu (alias@posta…, inak stará b2b-…@doklady…).
function bsAdresaProjektu(kod){
  const a = BS.sprava && BS.sprava.adresa, k = kod ? "+" + bsNorm(kod) : "";
  if (!a) return "";
  if (a.alias && typeof POSTA_DOMENA !== "undefined") return a.alias + k + "@" + POSTA_DOMENA;
  if (a.token && typeof DOKLADY_DOMENA !== "undefined") return a.token + k + "@" + DOKLADY_DOMENA;
  return "";
}
function bsSpravaKartaHtml(x, ja){
  const roly = bsRolyV(x.id, ja.osoba), smie = ja.spravca || (roly || []).includes("tm"), otv = !!(BS.spravaOtvorene || {})[x.id];
  const n = (BS.sprava.otvorene || {})[x.id] || 0, pocetCl = BS.sprava.clenovia.filter(c => c.podprojekt_id === x.id).length;
  const moje = (ja.spravca ? ["Správca projektu"] : []).concat((roly || []).map(r => BS_ROLY[r])).join(" · ") || (roly ? "Čitateľ" : "");
  return '<div class="card bs-pp" style="padding:12px 14px;margin-bottom:10px">' +
    '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="bs-pp-kod">' + esc(x.kod) + '</span><b style="font-size:15px">' + esc(x.nazov) + "</b>" +
      (x.predvoleny ? ' <small class="csub">predvolený</small>' : "") + (x.archivovane ? ' <small class="csub">archivovaný — len na čítanie</small>' : "") +
      '<span class="csub" style="margin-left:auto">' + esc(bsPocet(n, "otvorený záznam", "otvorené záznamy", "otvorených záznamov")) + "</span></div>" +
    (moje ? '<div class="csub" style="margin:4px 0 0">Vaše roly: ' + esc(moje) + "</div>" : "") +
    (!x.archivovane && bsAdresaProjektu(x.kod) ? '<div class="csub" style="margin:4px 0 0">Záznamy e-mailom: <span style="font-family:ui-monospace,monospace;word-break:break-all">' +
      esc(bsAdresaProjektu(x.kod)) + "</span>" + (x.predvoleny ? ' <small>(aj <span style="font-family:ui-monospace,monospace;word-break:break-all">' + esc(bsAdresaProjektu("")) + "</span> s predmetom „Defekt: …“)</small>" : "") + "</div>" : "") +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
      '<button type="button" class="aabtn pri" onclick="bsOknoOtvor(\'' + x.id + '\',{novaKarta:true})">Otvoriť BUGstation</button>' +
      (smie ? '<button type="button" class="aabtn" onclick="bsSpravaRozbal(\'' + x.id + '\')">' + (otv ? "Skryť členov" : "Členovia a roly (" + pocetCl + ")") + "</button>" : "") +
      (ja.spravca && !x.predvoleny && !x.archivovane ? '<button type="button" class="aabtn" onclick="bsPodprojektUprav(\'' + x.id + '\',{predvoleny:true})">Nastaviť ako predvolený</button>' : "") +
      (ja.spravca ? '<button type="button" class="aabtn" onclick="bsPodprojektUprav(\'' + x.id + "',{archivovat:" + !x.archivovane + '})">' + (x.archivovane ? "Obnoviť" : "Archivovať") + "</button>" : "") +
    "</div>" + (otv && smie ? bsClenoviaHtml(x) : "") + "</div>";
}
function bsSpravaRozbal(id){ BS.spravaOtvorene = BS.spravaOtvorene || {}; BS.spravaOtvorene[id] = !BS.spravaOtvorene[id]; bsPrekresli(); }
// Ľudia zákazky a ich členstvo v podprojekte: členovia hore, potom ostatné aktívne
// osoby — tých pridá zaškrtnutie Člen alebo niektorej roly. V archive len na čítanie.
function bsClenoviaHtml(x){
  const cl = {};
  BS.sprava.clenovia.filter(c => c.podprojekt_id === x.id).forEach(c => { cl[c.osoba_id] = c.role || []; });
  const osoby = ((B2B.d && B2B.d.osoby) || []).filter(o => o.aktivny)
    .sort((a, b) => (cl[b.id] || b.spravca ? 1 : 0) - (cl[a.id] || a.spravca ? 1 : 0) || String(a.meno).localeCompare(String(b.meno), "sk"));
  const roly = Object.keys(BS_ROLY), dis = x.archivovane ? " disabled" : "";
  const tab = '<table class="bs-mriezka"><thead><tr><th>Osoba</th><th>Člen</th>' + roly.map(r => "<th>" + esc(BS_ROLY[r]) + "</th>").join("") + "</tr></thead><tbody>" +
    osoby.map(o => "<tr><td>" + esc(o.meno) + (o.spravca ? " <small>(správca)</small>" : "") + (o.user_id ? "" : " <small>(bez účtu)</small>") + "</td>" +
      (o.spravca ? '<td title="Správca projektu vidí každý podprojekt">vždy</td>' : '<td><input type="checkbox"' + (cl[o.id] ? " checked" : "") + dis + ' onchange="bsClenPrepni(\'' + o.id + "',this.checked,'" + x.id + "')\"></td>") +
      roly.map(r => '<td><input type="checkbox"' + ((cl[o.id] || []).includes(r) ? " checked" : "") + dis +
      ' onchange="bsRolaPrepni(\'' + o.id + "','" + r + "',this.checked,'" + x.id + "')\"></td>").join("") + "</tr>").join("") + "</tbody></table>";
  return '<div style="overflow-x:auto;margin-top:10px">' + tab + "</div>" +
    '<div class="csub" style="margin-top:6px">Členstvo a roly platia len v podprojekte ' + esc(x.kod) + ". Člen bez roly je čitateľ. Prístup k výkazu a ďalším modulom prideľuje správca v karte Projekt → Osoby." +
    (x.archivovane ? " Archivovaný podprojekt sa nemení — najprv ho obnovte." : "") + "</div>" +
    (x.archivovane ? "" : '<div style="margin-top:8px"><button type="button" class="aabtn" onclick="bsPozvat(\'' + x.id + '\')">+ Pozvať do podprojektu</button></div>');
}

// Obsah okna BUGstation (shell zvoleného podprojektu).
function bsShellObsahHtml(){
  bsZmenaZakazky();
  // Odkaz z e-mailu na záznam iného podprojektu tej istej zákazky = načítať ten podprojekt.
  if (BS.d && typeof _b2bBsCiel !== "undefined" && _b2bBsCiel && _b2bBsCiel.pid === BS.d.pid && _b2bBsCiel.pp && _b2bBsCiel.pp !== BS.d.ppId) { BS.d = null; BS.detail = null; BS.det = null; }
  if (!BS.d) { if (!BS.nacitavam) setTimeout(bsNacitajData, 0); return '<div class="aempty" style="padding:24px">Načítavam BUGstation…</div>'; }
  if (BS.d.bezMigracie) return '<div class="card" style="padding:12px 14px"><b>BUGstation ešte nie je v databáze</b><div class="csub">Chýba migrácia admin_95 (podprojekty) — po jej spustení sa modul otvorí.</div></div>';
  if (BS.d.chyba) return '<div class="card" style="padding:12px 14px;border-color:var(--neg)"><b style="color:var(--neg)">BUGstation sa nenačítal</b><div class="csub" style="margin:4px 0 8px">' + esc(BS.d.chyba) + '</div><button class="aabtn" onclick="bsObnov()">Skúsiť znova</button> <button class="aabtn" onclick="bsOknoZavri()">Späť do B2B</button></div>';
  if (!BS.d.projekt) return '<div class="card" style="padding:12px 14px"><b>Podprojekt BUGstation sa nenašiel</b><div class="csub" style="margin:4px 0 8px">Nie ste jeho členom alebo bol zrušený.</div><button class="aabtn" onclick="bsOknoZavri()">Späť do B2B</button></div>';
  // Odkaz z e-mailu pri už načítanom podprojekte (bez nového načítania): záznam a detail hneď.
  if (typeof _b2bBsCiel !== "undefined" && _b2bBsCiel && _b2bBsCiel.pid === BS.d.pid) { bsOtvorCiel(); if (BS.detail) setTimeout(() => bsNacitajDetail(BS.detail), 0); }
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
    const v = await bsRpc("b2b_bs_zapni", { p_projekt: B2B.pid /* zákazka */ });
    const P = B2B.d && B2B.d.projekt;
    if (P && v && v.verzia != null) { P.verzia = v.verzia; P.moduly = v.moduly; }
    if (typeof b2bNacitajClenstvo === "function") await b2bNacitajClenstvo();
    BS.sprava = null; BS.d = null; bsPrekresli();   // správa ukáže prvý podprojekt (admin_95)
  }
  catch (e) { bsChyba(e, "BUGstation sa nepodarilo zapnúť"); }
}

const BS_REGISTRE = ["uloha", "defekt", "incident", "zmena"];
function bsNavPolozky(){
  const ja = bsJa(), zz = bsZaznamy(), O = bsPlanO();
  const otv = typ => zz.filter(z => z.typ === typ && bsOtvoreny(z)).length;
  const p = [
    ["prehlad", "Prehľad & progres", ""],
    ["caka", "Čaká na mňa", String(zz.filter(z => bsCakaNaMna(z, ja)).length + bsMojeScenare(O, ja).length)],
    ["uloha", "Úlohy", String(otv("uloha"))],
    ["defekt", "Defekty", String(otv("defekt"))],
    ["incident", "Incidenty", String(otv("incident"))],
    ["zmena", "Zmenové požiadavky", String(otv("zmena"))]
  ];
  // BS2: plán a scenáre, keď server tabuľky má (admin_91) alebo treba ukázať chybu.
  if (O || (BS.d && BS.d.planChyba)) p.push(["plan", "Testovací plán", ""], ["scenare", "Testovacie scenáre", O ? String(O.scenare.length) : ""]);
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
  const ja = bsJa(), P = (BS.d && BS.d.projekt) || {};   // podprojekt (kód = kľúč záznamov)
  const on = BS.rail ? " on" : "";
  const nav = bsNavPolozky().map(([id, lab, n]) => {
    const akt = BS.pohlad === id;
    const c = n && n !== "0" ? n : "";
    return '<button type="button" class="' + (akt ? "on" : "") + '" onclick="bsChod(\'' + id + '\')" title="' + esc(lab) + '">' + bsIkona(id === "uloha" ? "uloha" : id) +
      '<span class="bs-nl bs-iba-on">' + esc(lab) + "</span>" + (c ? '<span class="bs-nc bs-iba-on">' + esc(c) + '</span><i class="bs-nd"></i>' : "") + "</button>";
  }).join("");
  const roly = ja.spravca ? ["Správca projektu"].concat((ja.roly || []).map(r => BS_ROLY[r])) : (ja.roly || []).map(r => BS_ROLY[r]);
  const proj = '<div class="bs-projw"><button type="button" class="bs-projb" onclick="bsMenu()" title="' + esc((P.kod ? P.kod + " · " + (P.nazov || "") + " — " : "") + "prepnúť podprojekt") + '">' +
    bsKodHtml(P.kod) + '<span class="bs-projt bs-iba-on"><b>' + esc(P.nazov || "") + "</b><i>" + esc(roly.join(" · ") || "Čitateľ") + "</i></span>" +
    '<svg class="bs-iba-on" width="11" height="11" viewBox="0 0 20 20" style="flex:none;margin-left:auto"><path d="M4.6 7.4 10 12.8l5.4-5.4-1.5-1.5L10 9.8 6.1 5.9z" fill="#b0bacb"/></svg></button>' +
    (BS.menu ? bsMenuHtml() : "") + "</div>";
  const rel = (bsNast().releasy || []).find(r => r.stav === "aktivny");
  const PO = bsPlanO(), af = PO && PO.maPlan && PO.aktivna;
  const pata = '<div class="bs-pata bs-iba-on">' + (af ? '<span class="bs-pata-h">AKTÍVNA FÁZA</span><span class="bs-pata-t">' + esc(af.f.nazov + (rel ? " · " + rel.nazov : "")) + "</span>" +
      '<span class="bs-pata-p"><span><i style="width:' + af.pct + '%"></i></span><b>' + af.pct + " %</b></span>" + (af.f.do ? '<span class="bs-pata-d">do ' + esc(bsDMR(af.f.do)) + "</span>" : "")
    : rel ? '<span class="bs-pata-h">AKTÍVNY RELEASE</span><span class="bs-pata-t">' + esc(rel.nazov) + "</span>" : "") +
    '<button type="button" onclick="bsObnov()">↻ Obnoviť</button></div>';
  const ikPrep = BS.rail ? "M11.6 4.4 6 10l5.6 5.6 1.4-1.4L9.4 10l3.6-4.2zM4 4h1.8v12H4z" : "M8.4 4.4 14 10l-5.6 5.6L7 14.2 10.6 10 7 5.8zM14.2 4H16v12h-1.8z";
  const spat = BS.okno ? '<button type="button" class="bs-spat" onclick="bsOknoZavri()" title="Späť do B2B — podprojekty, členovia a roly">‹<span class="bs-iba-on"> B2B</span></button>' : "";
  const rail = '<aside class="bs-rail' + on + '"><div class="bs-rh">' + spat + BS_LOGO + '<span class="bs-rh-nazov bs-iba-on">BUG<span>station</span></span>' +
    '<button type="button" class="bs-prep" onclick="bsRail()" title="Rozbaliť / zbaliť menu"><svg width="15" height="15" viewBox="0 0 20 20"><path d="' + ikPrep + '" fill="#c6cedd"/></svg></button></div>' +
    proj + '<nav class="bs-nav">' + nav + "</nav>" + pata + "</aside>";
  const [tit, pod] = bsTitulok();
  const lista = '<div class="bs-lista"><div class="bs-tit"><h2>' + esc(tit) + "</h2><span>" + esc(pod) + '</span></div><div class="bs-lista-a">' + bsListaAkcieHtml() + "</div></div>";
  const drawer = BS.detail && bsNajdi(BS.detail) ? '<aside class="bs-drawer" data-bs-scroll="detail">' + bsDetailHtml(bsNajdi(BS.detail)) + "</aside>" : "";
  const arch = P.archivovane ? '<div class="bs-panel" style="padding:8px 12px;margin-bottom:10px;border-color:#d8b26a"><b>Podprojekt je archivovaný</b> — záznamy sa dajú čítať, zapisovať nie. Obnoví ho správca projektu v Nastaveniach.</div>' : "";
  return '<div class="bs' + (BS.komfortna ? " komf" : "") + '" id="bsKoren">' + rail + '<main class="bs-main">' + lista +
    '<div class="bs-telo"><div class="bs-obsah" data-bs-scroll="obsah"><div class="bs-sirka">' + arch + bsPrijateBannerHtml() + bsObsahHtml() + "</div></div>" + drawer + "</div></main></div>";
}
// Odznak s kódom podprojektu (2–10 znakov, admin_95). Do štvorca sa zmestia 4 znaky;
// dlhší kód je pilulka a v zbalenom raile štvorec s kódom na dva riadky (CSS .bs-kod.dlhy).
function bsKodHtml(kod){
  kod = String(kod || "");
  if (kod.length <= 4) return '<span class="bs-kod">' + esc(kod) + "</span>";
  const m = Math.ceil(kod.length / 2);
  return '<span class="bs-kod dlhy"><span>' + esc(kod.slice(0, m)) + "</span><span>" + esc(kod.slice(m)) + "</span></span>";
}
// Menu v raile okna: podprojekty tejto zákazky (prepínač). Iné projekty a správa
// podprojektov sú v okne B2B (O4) — sem vedie tlačidlo Späť do B2B.
function bsMenuHtml(){
  const pps = bsPodprojekty().map(x => {
    const on = x.id === BS.pp;
    return '<button type="button" class="bs-menu-p' + (on ? " on" : "") + '" onclick="bsVyberPodprojekt(\'' + x.id + '\')">' + bsKodHtml(x.kod) + '<span style="flex:1;min-width:0"><b>' +
      esc(x.nazov) + "</b><i>" + (x.archivovane ? "archivovaný" : x.predvoleny ? "predvolený" : "podprojekt") + '</i></span><span class="bs-tick">✓</span></button>';
  }).join("");
  return '<div class="bs-menu"><div class="bs-menu-h">PODPROJEKTY</div>' + pps +
    '<div class="bs-menu-f"><button type="button" onclick="bsOknoZavri()">Späť do B2B — podprojekty, členovia a roly</button></div></div>';
}
function bsVyberPodprojekt(id){
  BS.menu = false;
  if (id === BS.pp) return bsPrekresli();
  if (BS.okno) return bsOknoOtvor(id, {});   // adresa okna nesie podprojekt
  BS.pp = id; BS.d = null; BS.detail = null; BS.det = null; BS.split = null; BS.filtre = {}; BS.nastavenia = null; BS.otazka = null;
  if (BS.pohlad === "otazka") BS.pohlad = "prehlad";
  bsPrekresli();
}
function bsTitulok(){
  const zz = bsZaznamy(), ja = bsJa(), P = (BS.d && BS.d.projekt) || {};
  const v = BS.pohlad;
  if (v === "prehlad") return ["Prehľad & progres review", (P.nazov || "") + " · " + bsPocet(zz.filter(bsOtvoreny).length, "otvorený záznam", "otvorené záznamy", "otvorených záznamov")];
  if (v === "caka") return ["Čaká na mňa", bsPocet(zz.filter(z => bsCakaNaMna(z, ja)).length, "záznam čaká", "záznamy čakajú", "záznamov čaká") + " na vašu akciu"];
  if (v === "nastavenia") return ["Nastavenia BUGstation", "podprojekty, číselníky, názvy úrovní, povinné polia a roly v podprojekte"];
  if (v === "otazka") return ["Otázka", "filter z otázky v bežnej reči — podmienky sa dajú zrušiť"];
  if (v === "plan" || v === "scenare") {
    const O = bsPlanO();
    if (!O) return [v === "plan" ? "Testovací plán" : "Testovacie scenáre", ""];
    if (v === "plan") return ["Testovací plán", (O.aktivna ? "prebieha " + O.aktivna.f.nazov + " · " : "") + bsPocet(O.fazy.length, "fáza", "fázy", "fáz") + " · " + O.vykonane + " z " + O.celkom + " prípadov vykonaných"];
    return ["Testovacie scenáre", bsPocet(O.scenare.length, "scenár", "scenáre", "scenárov") + " · " + bsPocet(O.scenare.reduce((a, x) => a + x.pripady.length, 0), "prípad", "prípady", "prípadov") + " v knižnici"];
  }
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
  // BS3a: otázka v bežnej reči, len keď ju správca v projekte zapol (súhlas, §15).
  const ai = bsNast().ai_otazky === true && (reg || v === "caka" || v === "prehlad" || v === "otazka")
    ? '<label class="bs-ai" title="Opýtajte sa v bežnej reči — appka z otázky nastaví filter (AI)"><b>✦</b><input id="bsOpytaj" type="text" maxlength="300" placeholder="Opýtaj sa, napr. otvorené kritické defekty" value="' +
      esc(v === "otazka" && BS.otazka ? BS.otazka.text : "") + '" onkeydown="if(event.key===\'Enter\'){event.preventDefault();bsOpytaj(this.value)}"></label>' : "";
  if (v === "otazka") return ai;
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
  // BS2: v Pláne a Scenároch hlavná akcia TM/TTL namiesto záznamu.
  if ((v === "plan" || v === "scenare") && bsPlan() && bsMaRolu(ja, BS_PLAN_ROLY))
    return hl + (v === "plan" ? '<button type="button" class="bs-btn pri" onclick="bsFazaFormular()">+ Nová fáza</button>' : '<button type="button" class="bs-btn pri" onclick="bsScenarFormular()">+ Nový scenár</button>');
  const novy = smie ? '<button type="button" class="bs-btn pri" onclick="bsNovy()">+ Nový záznam</button>' : "";
  return hl + ai + chipy + split + novy;
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
  if (v === "otazka") return bsOtazkaHtml();
  if (v === "plan") return bsPlanHtml();
  if (v === "scenare") return bsScenareHtml();
  if (BS_TYPY[v]) return bsEvidencieHtml();
  return "";
}

// ── A. Prehľad (bez testových častí, §9) ───────────────────────
function bsPrehladHtml(){
  const zz = bsZaznamy(), O = bsOdvod(zz, BS.d.historia || []), nast = bsNast();
  const delta = O.deltaDefektov;
  const PO = bsPlanO(), sPlanom = !!(PO && PO.maPlan);
  const kpi = sPlanom ? bsPrehladKpiPlan(PO, O, zz) : [
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
  // Tabuľka so stĺpcami: hlavička raz, v bunkách len čísla zarovnané doprava —
  // text pri každom čísle („7 otvorených“) sa v úzkom paneli zalamoval a stĺpce sa rozišli.
  const typy = '<div class="bs-riadok bs-typy bs-typy-h"><span></span><span>OTVORENÉ</span><span>U ZÁKAZNÍKA</span><span>PO SLA</span></div>' + BS_TYPY_PORADIE.map(typ => {
    const x = O.poTypoch[typ], ps = typ === "uloha" ? 0 : poSla(typ);
    return '<div class="bs-riadok bs-typy"><span>' + esc(BS_TYPY[typ].mnozne) + '</span><span class="bs-num">' + x.otvorene + '</span><span class="bs-num">' + x.uZakaznika + "</span>" +
      '<span class="bs-num' + (ps ? " neg" : "") + '"' + (typ === "uloha" ? ' title="Úlohy nemajú SLA">—' : ">" + ps) + "</span></div>";
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
    '<div class="bs-dva">' + (sPlanom ? bsPrehladProgresHtml(PO) : "") + '<div class="bs-panel"><div class="bs-ph"><h3>Otvorené podľa typu</h3><small>kto má loptičku · termín SLA</small></div>' + typy + "</div>" +
    '<div class="bs-panel"><div class="bs-ph"><h3>Otvorené defekty podľa závažnosti</h3></div>' + urov +
    '<div class="bs-mini"><div><span class="bs-kpi-l">PRIEM. ČAS OPRAVY</span><b>' + (O.casOpravy == null ? "—" : String(O.casOpravy).replace(".", ",") + " " + (O.casOpravy === 1 ? "deň" : "dňa")) + '</b></div><div><span class="bs-kpi-l">REOPEN RATE</span><b>' +
    (O.reopen == null ? "—" : String(O.reopen).replace(".", ",") + " %") + "</b></div></div></div></div>" +
    '<div class="bs-panel"><div class="bs-ph"><h3>Posledná aktivita</h3></div><div class="bs-akt">' + akt + "</div></div>" +
    '<div class="bs-panel"><div class="bs-ph"><h3>Priebeh stavov · všetky záznamy</h3><small>' + esc(bsPocet(O.otvorene, "záznam", "záznamy", "záznamov")) + ' v obehu</small></div><div class="bs-pipe">' + priebeh + "</div>" +
    '<div class="bs-mini"><div><span class="bs-kpi-l">ÚLOHY</span><b style="font-size:12px">' + ulohy + "</b></div></div></div>" +
    (sPlanom ? bsPrehladMilnikyHtml(PO) : "") + "</div>";
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
  // BS2: scenáre pridelené mne v prebiehajúcej fáze, ktoré majú čakajúce prípady.
  const moje = bsMojeScenare(bsPlanO(), ja);
  const sc = moje.length ? '<div class="bs-panel" style="margin-bottom:14px"><div class="bs-ph"><h3>Moje scenáre na vykonanie</h3><small>' + esc(bsPocet(moje.length, "scenár", "scenáre", "scenárov")) + "</small></div>" +
    moje.map(({ faza, rr }) => '<div class="bs-pr"><button type="button" class="bs-pr-n" onclick="bsChodScenar(\'' + rr.s.id + '\')"><small class="bs-kodm">' + esc(rr.s.kod) + "</small> " + esc(rr.s.nazov) + '<small class="bs-pr-t"> · ' + esc(faza.f.nazov) + "</small></button>" +
      bsPocty(rr.pocty) + '<button type="button" class="bs-btn pri" onclick="bsSpustit(\'' + rr.r.id + '\')">' + (rr.pocty.caka === rr.celkom ? "Spustiť" : "Pokračovať") + "</button></div>").join("") + "</div>" : "";
  return sc + bsTabulkaHtml(zz, "caka", false);
}

// ── B. Evidencie (taby, tabuľka, split) ────────────────────────
// ── otázka v bežnej reči (BS3a): výsledok ako filter v chipoch ──
// BS.otazka = { text, caka, chyba, f, mena, vysvetlenie, spat (pohľad pred otázkou) }
async function bsOpytaj(text){
  const otazka = String(text || "").replace(/\s+/g, " ").trim();
  if (!otazka) return;
  const spat = BS.pohlad === "otazka" ? ((BS.otazka && BS.otazka.spat) || "prehlad") : BS.pohlad;
  const moja = BS.otazka = { text: otazka, caka: true, spat };
  BS.pohlad = "otazka"; BS.detail = null; BS.det = null; BS.split = null; BS.menu = false;
  bsPrekresli();
  try {
    const d = await b2bEdge("bs_otazka", { podprojekt: BS.pp, otazka });
    if (BS.otazka !== moja) return;            // medzitým iná otázka
    const r = bsOtazkaNaFilter(d.filter, bsOsoby());
    Object.assign(moja, { caka: false, f: r.f, mena: r.mena, vysvetlenie: (d.filter && d.filter.vysvetlenie) || "" });
  } catch (e) {
    if (BS.otazka !== moja) return;
    console.error("BUGstation: otázka", e);
    Object.assign(moja, { caka: false, chyba: (e && e.message) || String(e) });
  }
  bsPrekresli();
}
function bsOtazkaZrus(k){ const o = BS.otazka; if (!o || !o.f) return; delete o.f[k]; bsPrekresli(); }
function bsOtazkaVyber(k, kk, id){ const o = BS.otazka; if (!o || !o.f || !id) return; o.f[k] = id; delete o.f[kk]; bsPrekresli(); }
function bsOtazkaZavri(){ const spat = (BS.otazka && BS.otazka.spat) || "prehlad"; BS.otazka = null; bsChod(spat); }
function bsOtazkaHtml(){
  const o = BS.otazka;
  if (!o) return '<div class="bs-panel"><div class="bs-prazdne">Napíšte otázku do poľa Opýtaj sa.</div></div>';
  const hlav = '<div class="bs-otz-h"><div><small>Otázka</small><b>„' + esc(o.text) + '“</b></div><button type="button" class="bs-btn mal" onclick="bsOtazkaZavri()">Zavrieť</button></div>';
  if (o.caka) return '<div class="bs-panel bs-otz">' + hlav + '<div class="bs-prazdne">Prevádzam otázku na filter…</div></div>';
  if (o.chyba) return '<div class="bs-panel bs-otz">' + hlav + '<div class="bs-prazdne bs-otz-chyba">' + esc(o.chyba) + "</div></div>";
  const riadky = bsFilter(bsZaznamy(), o.f, bsJa());
  const chipy = bsOtazkaChipy(o.f, o.mena, bsNast()).map(c => '<span class="bs-chipq' + (c.varovanie ? " war" : "") + '">' + (c.vyber
      ? esc(c.nazov) + ' · <select onchange="bsOtazkaVyber(\'' + c.cielK + "','" + c.k + '\',this.value)" title="Meno z otázky sedí na viac osôb — vyberte"><option value="">' +
        esc(c.vyber.map(bsMeno).join(" alebo ")) + "?</option>" + c.vyber.map(id => '<option value="' + id + '">' + esc(bsMeno(id)) + "</option>").join("") + "</select>"
      : esc(c.text)) + '<button type="button" class="bs-x" title="Zrušiť túto podmienku" onclick="bsOtazkaZrus(\'' + c.k + '\')">×</button></span>').join("");
  return '<div class="bs-panel bs-otz">' + hlav +
    '<div class="bs-otz-ch">' + (chipy || '<span class="bs-podobne">Bez podmienok — všetky záznamy.</span>') + "</div>" +
    (o.vysvetlenie ? '<div class="bs-podobne bs-otz-v">' + esc(o.vysvetlenie) + "</div>" : "") +
    '<div class="bs-otz-p">' + esc(bsPocet(riadky.length, "záznam", "záznamy", "záznamov")) + "</div></div>" + bsTabulkaHtml(riadky, "otazka");
}
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
  const zmes = druh === "caka" || druh === "otazka";   // záznamy rôznych typov: stĺpec Typ
  if (!riadky.length) {
    const nic = druh === "caka" ? "Nič nečaká na vašu akciu." : druh === "otazka" ? "Otázke nezodpovedá žiadny záznam. Skúste zrušiť niektorú podmienku."
      : "Zatiaľ žiadne záznamy" + (BS.hladat || Object.keys(BS.filtre[druh] || {}).some(k => (BS.filtre[druh] || {})[k]) ? " pre tento filter." : ". Nový založíte tlačidlom + Nový záznam.");
    return '<div class="bs-tw"><div class="bs-prazdne">' + esc(nic) + "</div></div>";
  }
  const zor = riadky.slice().sort((a, b) => new Date(b.identifikovane || b.vytvorene) - new Date(a.identifikovane || a.vytvorene) || b.cislo - a.cislo);
  const th = st.map((s, i) => '<th class="' + (i === 2 || i === 5 ? "uzke" : "") + '">' + esc(s) + "</th>").join("");
  const tr = zor.map(z => {
    const b = zmes ? BS_TYPY[z.typ].nazov
      : z.typ === "incident" ? bsCiselnikNazov(nast, "prostredia", z.prostredie_id)
      : z.typ === "zmena" ? (z.ziadatel || "") : bsCiselnikNazov(nast, "moduly", z.modul_id);
    const datum = z.typ === "uloha" && !zmes ? (z.termin ? bsDM(z.termin + "T00:00:00") : "") : bsDM(z.identifikovane || z.vytvorene);
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
    // BS2: kód scenára sa nemení ani nepoužije znova — odkaz do Testovacích scenárov.
    z.scenar && bsPlan() && (bsPlan().scenare || []).some(s => s.kod === z.scenar && !s.zmazane)
      ? '<div><span class="k">Scenár / prípad</span><span class="v"><button type="button" class="bs-odkaz" onclick="bsChodScenarKod(\'' + esc(z.scenar) + '\')">' + esc([z.scenar, z.pripad].filter(Boolean).join(" / ")) + "</button></span></div>"
      : pole("Scenár / prípad", [z.scenar, z.pripad].filter(Boolean).join(" / ")),
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
// opts (BS2, defekt z vykonania): pred = predvyplnené polia, lenTyp = bez
// výberu typu, ostan = po založení ostať v pohľade, poUlozeni(r) = napojenie.
let _bsFormOpts = null;   // voľby otvoreného formulára nového záznamu (mail pri zmene typu)
function bsFormular(z, typ, opts){
  if (!z) _bsFormOpts = opts || null;
  const ja = bsJa(), nast = bsNast(), pov = ((nast.povinne || {})[typ]) || {}, pos = bsPosledne();
  const em = !z && opts && opts.email;
  const typy = BS_TYPY_PORADIE.filter(t => z ? t === typ : (t === "zmena" ? bsMaRolu(ja, ["tm", "ttl", "dmd"]) : bsMaRolu(ja, BS_PRACOVNICI)));
  const ak = (nast.releasy || []).find(r => r.stav === "aktivny");
  const h = z ? Object.assign({}, z, { popis: (BS.det && BS.det.id === z.id ? BS.det.popis : "") }) : Object.assign({
    typ, uroven: typ === "defekt" ? 3 : bsUrovneTypu(nast, typ)[1] || bsUrovneTypu(nast, typ)[0],
    is_id: (nast.is || []).length === 1 ? nast.is[0].id : pos.is_id, prostredie_id: pos.prostredie_id, modul_id: pos.modul_id,
    release_id: ak ? ak.id : pos.release_id, identifikovane: new Date().toISOString() },
    Object.fromEntries(Object.entries((opts && opts.pred) || {}).filter(([, v]) => v != null && v !== "")));
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
    (em ? '<div class="bs-podobne">E-mail od ' + esc(em.od || "(neznámy)") + " · " + esc(bsKedy(em.prijate)) + "</div>" : "") +
    (z || (opts && opts.lenTyp) ? "" : '<label>Typ<select id="bsF_typ" onchange="bsFormularTyp(this.value)">' + typy.map(t => '<option value="' + t + '"' + (t === typ ? " selected" : "") + ">" + esc(BS_TYPY[t].nazov) + "</option>").join("") + "</select></label>") +
    '<label>Názov *<input type="text" id="bsF_nazov" maxlength="200" value="' + esc(h.nazov || "") + '" oninput="bsPodobne(this.value)"></label><div id="bsPodobne" class="bs-podobne"></div>' +
    '<label>' + esc(BS_TYPY[typ].os) + ' *<select id="bsF_uroven">' + urov + "</select></label>" +
    (vis("popis") ? '<label>Opis' + hv("popis") + '<textarea id="bsF_popis" placeholder="Čo sa stalo, kde a ako to zopakovať">' + esc(h.popis || "") + "</textarea></label>" : "") +
    (typ === "defekt" ? '<details' + (D.kroky || D.ocakavane || D.skutocne ? " open" : "") + '><summary>Kroky a výsledky <small>nepovinné</small></summary><div class="bs-form" style="margin-top:8px">' +
      '<label>Kroky na zopakovanie<textarea id="bsF_kroky">' + esc(D.kroky || "") + '</textarea></label><label>Očakávaný výsledok<textarea id="bsF_ocakavane">' + esc(D.ocakavane || "") + '</textarea></label>' +
      '<label>Skutočný výsledok<textarea id="bsF_skutocne">' + esc(D.skutocne || "") + "</textarea></label></div></details>" : "") +
    (z ? "" : '<label>' + esc(BS_POLIA.priloha.nazov) + hv("priloha") + '<input type="file" id="bsF_subory" multiple accept="image/*,application/pdf,text/plain,.log,.zip" onchange="bsFormularSubory(this.files)"></label>' +
      '<div id="bsFPril" class="bs-podobne">Snímku obrazovky vložíte aj cez Ctrl+V do tohto okna.</div>') +
    (em && em.prilohy.length ? '<div class="bs-podobne">Prílohy z e-mailu do záznamu: ' + em.prilohy.map(x =>
      '<label class="bs-chk"><input type="checkbox" id="bsFEm_' + esc(x.id) + '" checked> ' + esc(x.subor_nazov) + "</label>").join(" ") + "</div>" : "") +
    (suvislosti ? '<details open><summary>Súvislosti <small>' + esc(bsSuhrnSuvislosti(h, nast)) + "</small></summary><div class=\"bs-form\" style=\"margin-top:8px\">" + suvislosti + "</div></details>" : "") +
    "</div></div>";
  openModal(z ? "Upraviť · " + z.kluc : em ? "Záznam z e-mailu" : opts && opts.pred ? "Nový defekt z testu · " + (opts.pred.pripad || "") : "Nový záznam", html, () => bsFormularUloz(z, typ, opts), null, null, z ? "Uložiť" : "Založiť");
  if (!z) document.getElementById("modalBody").onpaste = (e) => {
    const f = [...((e.clipboardData && e.clipboardData.files) || [])];
    if (f.length) { e.preventDefault(); bsFormularSubory(f); }
  };
}
function bsSuhrnSuvislosti(h, nast){
  return [bsCiselnikNazov(nast, "prostredia", h.prostredie_id), [h.scenar, h.pripad].filter(Boolean).join(" / "), bsCiselnikNazov(nast, "releasy", h.release_id)].filter(Boolean).join(" · ");
}
// Zmena typu: ručný formulár sa otvorí nanovo ako doteraz; formulár z e-mailu
// si mail aj rozpísaný názov a opis ponechá.
function bsFormularTyp(typ){
  const o = _bsFormOpts && _bsFormOpts.email ? _bsFormOpts : null;
  if (!o) return bsFormular(null, typ);
  const v = id => (document.getElementById("bsF_" + id) || {}).value;
  bsFormular(null, typ, Object.assign({}, o, { pred: Object.assign({}, o.pred, { nazov: v("nazov"), popis: v("popis") }) }));
}
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
async function bsFormularUloz(z, typ, opts){
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
      // Z e-mailu: záznam a spracovaný mail jedným krokom (admin_96), prílohy mailu podľa výberu.
      const em = opts && opts.email;
      const zMailu = em ? em.prilohy.filter(x => { const el = document.getElementById("bsFEm_" + x.id); return !el || el.checked; }) : [];
      const r = em ? await bsRpc("b2b_bs_zaloz_z_emailu", { p_prijate: em.id, p_typ: t, p_polia: p })
        : await bsRpc("b2b_bs_zaloz", { p_podprojekt: BS.pp, p_typ: t, p_polia: p });
      bsZapamataj(p);
      for (const f of _bsPrilohy) { try { await bsPrilohaNahraj(r.id, f); } catch (e) { bsChyba(e, "Príloha " + (f.name || "") + " sa nenahrala"); } }
      _bsPrilohy = [];
      if (zMailu.length) await bsPrijatePrilohyPreniest(r.id, zMailu);
      oznamPas("Založené · " + r.kluc);
      if (opts && opts.poUlozeni) { try { await opts.poUlozeni(r); } catch (e) { bsChyba(e, "Defekt " + r.kluc + " je založený, ale vykonanie sa nezapísalo"); } }
      if (!(opts && opts.ostan)) { BS.pohlad = t; BS.detail = r.id; }
    }
  } catch (e) { return b2bVOkne(String((e && e.message) || e).replace(/^.*?ERROR:\s*/, "")); }
  bsNacitajData();
  return true;
}
// ── E-mail → záznam (BS3b, admin_96, NAVRH §16 a §31 O5) ────────
// Mail na adresu projektu +KOD (alebo bez kódu s predmetom „Defekt: …“) od člena
// podprojektu s rolou na založenie čaká v b2b_prijate (modul bugstation,
// podprojekt_id). Nič sa nezaloží samo: človek ho prevezme ako záznam alebo odmietne.
// Predmet → typ a názov. Kópia edge doklady-mailom (bsZaznamZPredmetu) — zhodu stráži test_bs_email_ui.
const BS_PREDMET = /^\s*(?:(?:fwd?|pd|tr)\s*:\s*)*(incident|defekt|chyba|[uú]loha|zmena)\s*:\s*([\s\S]*)$/i;
const BS_PREDMET_TYP = { incident: "incident", defekt: "defekt", chyba: "defekt", uloha: "uloha", "úloha": "uloha", zmena: "zmena" };
function bsZaznamZPredmetu(predmet){
  const m = String(predmet == null ? "" : predmet).match(BS_PREDMET);
  if (!m) return null;
  return { typ: BS_PREDMET_TYP[bsNorm(m[1])], nazov: m[2].trim().slice(0, 200) };   // bsNorm („Úloha“ → uloha) = toLowerCase v edge nad tou istou tabuľkou
}
// Chyba „stĺpec chýba“ = admin_96 ešte nebeží (PostgREST 42703 / PGRST204).
function bsBezPrijmu(e){
  return !!e && (e.code === "42703" || e.code === "PGRST204" || /column .*(modul|podprojekt_id).* does not exist/i.test(e.message || ""));
}
// Riadky mailu (telo + prílohy) spolu; id = riadok tela, ten berie b2b_bs_zaloz_z_emailu.
function bsPrijateMaily(){
  const m = new Map();
  ((BS.d && BS.d.prijate) || []).forEach(x => {
    const g = m.get(x.email_id) || { email_id: x.email_id, id: null, od: x.od_koho || "", predmet: x.predmet || "", telo: "", prijate: x.prijate, prilohy: [] };
    if (x.subor_nazov) g.prilohy.push(x); else { g.id = x.id; g.telo = x.telo || ""; }
    if (String(x.prijate) < String(g.prijate)) g.prijate = x.prijate;
    m.set(x.email_id, g);
  });
  return [...m.values()].sort((a, b) => String(a.prijate).localeCompare(String(b.prijate)));
}
// Prevziať smie ten, kto smie zakladať (roly b2b_bs_roly_zalozenia), v aktívnom podprojekte.
function bsSmiePrevziat(){
  return !((BS.d && BS.d.projekt) || {}).archivovane && bsMaRolu(bsJa(), BS_PRACOVNICI);
}
function bsPrijateBannerHtml(){
  if (!BS.d || !["prehlad", "caka"].concat(Object.keys(BS_TYPY)).includes(BS.pohlad)) return "";
  if (BS.d.prijateChyba) return '<div class="bs-panel bs-prij-b"><span><b>Prijaté e-maily sa nenačítali</b> — ' + esc(BS.d.prijateChyba) + "</span></div>";
  const n = bsPrijateMaily().length;
  if (!n || !bsSmiePrevziat()) return "";
  return '<div class="bs-panel bs-prij-b"><span><b>Prijaté e-maily (' + n + ")</b> — čakajú, kým ich niekto prevezme ako záznam alebo odmietne.</span>" +
    '<button type="button" class="bs-btn pri" onclick="bsPrijateOtvor()">Pozrieť</button></div>';
}
function bsPrijateOtvor(){
  const maily = bsPrijateMaily(), P = (BS.d && BS.d.projekt) || {};
  const kb = b => b >= 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round((b || 0) / 1024)) + " kB";
  const html = '<div class="bs-ok" data-scroll="bsPrijate"><div class="bs-prij">' + (maily.map(m => {
    const pr = bsZaznamZPredmetu(m.predmet), tl = m.telo.trim();
    return '<div class="bs-prij-m"><div class="bs-prij-h"><b>' + esc(m.predmet || "(bez predmetu)") + "</b><small>" + esc(m.od) + " · " + esc(bsKedy(m.prijate)) +
      (pr ? " · " + esc(BS_TYPY[pr.typ].nazov) : "") + "</small></div>" +
      (tl ? '<p class="bs-prij-t">' + esc(tl.length > 600 ? tl.slice(0, 600) + "…" : tl) + "</p>" : "") +
      (m.prilohy.length ? '<p class="bs-prij-p">Prílohy: ' + m.prilohy.map(x => esc(x.subor_nazov) + " (" + kb(x.subor_bajtov) + ")").join(", ") + "</p>" : "") +
      '<div class="bs-prij-a"><button type="button" class="bs-btn pri"' + (m.id ? "" : " disabled") + ' onclick="bsPrijatePrevziat(\'' + esc(m.email_id) + '\')">Prevziať ako záznam</button>' +
      '<button type="button" class="bs-btn" onclick="bsPrijateOdmietnut(\'' + esc(m.email_id) + '\')">Odmietnuť</button></div></div>';
  }).join("") || '<div class="bs-prazdne">Žiadny e-mail nečaká.</div>') + "</div></div>";
  openModal("Prijaté e-maily · " + (P.kod || ""), html, null, null, "siroky");
}
function bsPrijatePrevziat(emailId){
  const m = bsPrijateMaily().find(x => x.email_id === emailId);
  if (!m || !m.id) return;
  const ja = bsJa(), pr = bsZaznamZPredmetu(m.predmet);
  const typy = BS_TYPY_PORADIE.filter(t => t === "zmena" ? bsMaRolu(ja, ["tm", "ttl", "dmd"]) : bsMaRolu(ja, BS_PRACOVNICI));
  const typ = pr && typy.includes(pr.typ) ? pr.typ : typy.includes("defekt") ? "defekt" : typy[0];
  if (!typ) return;
  bsFormular(null, typ, { email: m, pred: { nazov: (pr ? pr.nazov : m.predmet).slice(0, 200), popis: m.telo.trim() } });
}
async function bsPrijateOdmietnut(emailId){
  const m = bsPrijateMaily().find(x => x.email_id === emailId);
  if (!m) return;
  const dovod = prompt("Odmietnuť e-mail „" + (m.predmet || "bez predmetu") + "“? Ostane v histórii prijatých. Dôvod (nepovinný):", "");
  if (dovod === null) return;
  try {
    await bsRpc("b2b_prijate_stav", { p_id: m.id || m.prilohy[0].id, p_stav: "odmietnute", p_poznamka: dovod.trim() || null });
    oznamPas("E-mail odmietnutý");
  } catch (e) { return bsChyba(e, "E-mail sa nepodarilo odmietnuť"); }
  if (BS.d) BS.d.prijate = (BS.d.prijate || []).filter(x => x.email_id !== emailId);
  if (bsPrijateMaily().length) bsPrijateOtvor(); else closeModal();
  bsNacitajData();
}
// Prílohy mailu do šifrovaných príloh záznamu: stiahnuť z b2b-prijate (RLS: člen
// podprojektu) a nahrať tou istou cestou ako ručnú prílohu (edge b2b, strop 10 MB).
async function bsPrijatePrilohyPreniest(zaznamId, prilohy){
  for (const x of prilohy) {
    try {
      const { data, error } = await sb.storage.from("b2b-prijate").download(x.subor_cesta);
      if (error) throw error;
      await bsPrilohaNahraj(zaznamId, new File([data], x.subor_nazov, { type: x.subor_typ || data.type || "application/octet-stream" }));
    } catch (e) { bsChyba(e, "Príloha " + x.subor_nazov + " z e-mailu sa do záznamu nepreniesla"); }
  }
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
  ["nic", "Nič", "e-maily z BUGstation tohto podprojektu nechodia"]];
function bsMojeUpozorneniaHtml(){
  const akt = (BS.d && BS.d.upozornenia) || "okamzite";
  return '<div class="bs-panel"><div class="bs-ph"><h3>Moje upozornenia e-mailom</h3><small>len pre vás, v tomto podprojekte</small></div><div class="in">' +
    BS_UPOZORNENIA.map(([k, n, p]) => '<label style="display:flex;gap:8px;align-items:flex-start;font:400 12px/1.4 var(--bs-sans);margin:0 0 8px"><input type="radio" name="bsUpoz" value="' + k + '"' +
      (akt === k ? " checked" : "") + ' onchange="bsUpozorneniaUloz(this.value)"> <span><b>' + esc(n) + "</b><br><span class=\"bs-podobne\">" + esc(p) + "</span></span></label>").join("") +
    '<div class="bs-podobne">Upozornenia chodia na e-mail vášho účtu; prázdny súhrn sa neposiela.</div></div></div>';
}
async function bsUpozorneniaUloz(v){
  try { await bsRpc("b2b_bs_moje_uloz", { p_podprojekt: BS.pp, p_upozornenia: v }); BS.d.upozornenia = v; oznamPas("Upozornenia uložené"); }
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
function bsPozvat(ppId){
  const pp = ppId || BS.pp, roly = Object.keys(BS_ROLY);
  const html = '<div class="bs-ok"><div class="bs-form">' +
    '<label>Meno a priezvisko<input type="text" id="bsPzMeno"></label>' +
    '<label>E-mail<input type="email" id="bsPzEmail" placeholder="na túto adresu príde pozvánka"></label>' +
    '<label>Organizácia (voliteľné)<input type="text" id="bsPzOrg"></label>' +
    '<div class="bs-podobne" style="margin:4px 0">Roly v podprojekte</div><div style="display:flex;flex-wrap:wrap;gap:10px">' +
    roly.map(r => '<label style="display:flex;gap:6px;align-items:center;font:400 12px var(--bs-sans)"><input type="checkbox" value="' + r + '" class="bsPzRola"' + (r === "tester" ? " checked" : "") + "> " + esc(BS_ROLY[r]) + "</label>").join("") +
    '</div><div class="bs-podobne" style="margin-top:8px">Osoba uvidí len tento podprojekt BUGstation — nie Pracovný výkaz, zmluvu, ceny ani Reporting. Pozvánka platí 14 dní a prijať ju môže len účet s touto adresou.</div>' +
    "</div></div>";
  openModal("Pozvať do BUGstation", html, async () => {
    const v = id => (document.getElementById(id) || {}).value || "";
    const meno = v("bsPzMeno").trim(), email = v("bsPzEmail").trim(), org = v("bsPzOrg").trim();
    const role = [...document.querySelectorAll(".bsPzRola:checked")].map(x => x.value);
    if (!meno) return b2bVOkne("Zadajte meno.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return b2bVOkne("Zadajte platný e-mail.");
    let osoba;
    try { osoba = await bsRpc("b2b_bs_osoba_zaloz", { p_podprojekt: pp, p_meno: meno, p_email: email, p_organizacia: org || null, p_role: role }); }
    catch (e) { return b2bVOkne(String((e && e.message) || e).replace(/^.*?ERROR:\s*/, "")); }
    let token, mail = true;
    try { const r = await sb.rpc("b2b_pozvi", { p_osoba: osoba, p_email: email }); if (r.error) throw r.error; token = r.data; }
    catch (e) { bsChyba(e, "Osoba je založená, ale pozvánku sa nepodarilo vytvoriť"); if (typeof b2bObnov === "function") b2bObnov(); return; }
    try { await b2bEdge("pozvanka", { token }); } catch (e) { mail = false; console.error("BUGstation: e-mail pozvánky", e); }
    oznamPas(mail ? "Pozvánka odišla na " + email : "Pozvánka vytvorená, e-mail sa neodoslal — odkaz pošle správca z Tímu");
    BS.sprava = null;   // nový člen v správe podprojektov
    if (typeof b2bObnov === "function") b2bObnov();
  }, null, null, "Pozvať");
}
function bsNastaveniaHtml(){
  const ja = bsJa();
  if (!bsMaRolu(ja, ["tm"])) return '<div class="bs-nast">' + bsMojeUpozorneniaHtml() + "</div>";
  const n = BS.nastavenia || (BS.nastavenia = JSON.parse(JSON.stringify(bsNast())));
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
  // Členov a roly spravuje správca a TM podprojektu v okne B2B (štruktúra, O4); tu sú pravidlá podprojektu.
  return '<div class="bs-nast">' + bsMojeUpozorneniaHtml() +
    '<div class="bs-panel"><div class="bs-ph"><h3>Ľudia a roly</h3><small>v okne B2B</small></div><div class="in"><div class="bs-podobne">Členov podprojektu ' + esc((BS.d.projekt || {}).kod || "") + ' a ich roly, pozvanie do podprojektu, predvolený podprojekt a archív spravuje správca projektu a Test manager v okne B2B (BUGstation → Členovia a roly).</div>' +
      '<div style="margin-top:8px"><button type="button" class="bs-btn" onclick="bsOknoZavri()">Späť do B2B</button></div></div></div>' +
    '<div class="bs-panel"><div class="bs-ph"><h3>Triáž</h3></div><div class="in"><label style="display:flex;gap:8px;align-items:center;font:400 12px/1.4 var(--bs-sans)"><input type="checkbox"' + (n.triaz !== false ? " checked" : "") +
      ' onchange="BS.nastavenia.triaz=this.checked"> Nový defekt, incident a zmena čakajú v Identifikované na triáž Test managera alebo Test team leadera</label></div></div>' +
    bsSlaPravidlaHtml(n) +
    bsAiOtazkyHtml(ja) +
    cis +
    '<div class="bs-panel"><div class="bs-ph"><h3>Názvy úrovní</h3><small>podľa zmluvy, napr. Kategória A / B / C</small></div><div class="in" style="overflow-x:auto"><table class="bs-mriezka"><thead><tr><th>Typ</th><th>1 · najvážnejšia</th><th>2</th><th>3</th><th>4</th></tr></thead><tbody>' + urov + "</tbody></table></div></div>" +
    '<div class="bs-panel"><div class="bs-ph"><h3>Povinné polia formulára</h3></div><div class="in" style="overflow-x:auto"><table class="bs-mriezka"><tbody>' + povTyp + "</tbody></table></div></div>" +
    '<div><button type="button" class="bs-btn pri" onclick="bsNastaveniaUloz()">Uložiť nastavenia</button> <button type="button" class="bs-btn" onclick="BS.nastavenia=null;bsPrekresli()">Zahodiť zmeny</button></div>' +
    '<div class="bs-panel"><div class="bs-ph"><h3>Biznis požiadavky</h3><small>' + (BS.d.poziadavky || []).length + '</small></div><div class="in">' +
      (poz ? '<table class="bs-mriezka"><tbody>' + poz + "</tbody></table>" : '<div class="bs-podobne">Zatiaľ žiadne.</div>') +
      '<label class="bs-podobne">Vložte zoznam z Excelu — dva stĺpce: kód a názov<textarea id="bsPozVloz" placeholder="BP-101&#9;Podanie žiadosti"></textarea></label>' +
      '<div><button type="button" class="bs-btn" onclick="bsPoziadavkyUloz()">Uložiť požiadavky</button></div></div></div></div>';
}
// Súhlas s otázkami cez AI (BS3a, admin_92): zapína a vypína LEN správca projektu
// — prevádzkovateľ dát projektu (D12). Ukladá sa hneď, samostatne od ostatných
// nastavení (server zmenu od Test managera odmietne).
function bsAiOtazkyHtml(ja){
  const zap = bsNast().ai_otazky === true;
  return '<div class="bs-panel"><div class="bs-ph"><h3>Otázky cez AI</h3><small>' + (ja.spravca ? "ukladá sa hneď" : "zapína správca projektu") + '</small></div><div class="in">' +
    '<label style="display:flex;gap:8px;align-items:flex-start;font:400 12px/1.4 var(--bs-sans)"><input type="checkbox"' + (zap ? " checked" : "") + (ja.spravca ? "" : " disabled") +
      ' onchange="bsAiOtazkyNastav(this.checked)"> Členovia sa môžu pýtať v bežnej reči, napríklad „otvorené incidenty kategórie B staršie ako 2 týždne“, a appka z otázky nastaví filter</label>' +
    '<div class="bs-podobne" style="margin-top:6px">Text otázky a názvy číselníkov projektu (typy, stavy, úrovne, IS, moduly, prostredia, releasy) odchádzajú spoločnosti Anthropic (model Claude), ktorá z nich vráti filter. Obsah záznamov ani mená osôb tam nejdú; meno z otázky dohľadá appka.</div></div></div>';
}
async function bsAiOtazkyNastav(zapnut){
  try {
    await bsRpc("b2b_bs_nastavenia_uloz", { p_podprojekt: BS.pp, p_verzia: BS.d.projekt.verzia, p_nastavenia: { ai_otazky: !!zapnut } });
    oznamPas(zapnut ? "Otázky cez AI zapnuté" : "Otázky cez AI vypnuté");
    if (BS.nastavenia) BS.nastavenia.ai_otazky = !!zapnut;
    bsNacitajData();
  } catch (e) { bsChyba(e, "Otázky cez AI sa nepodarilo " + (zapnut ? "zapnúť" : "vypnúť")); bsPrekresli(); }
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
    await bsRpc("b2b_bs_nastavenia_uloz", { p_podprojekt: BS.pp, p_verzia: g.verzia,
      p_nastavenia: { triaz: n.triaz !== false, is: n.is || [], moduly: n.moduly || [], prostredia: n.prostredia || [], releasy: n.releasy || [], timy: n.timy || [], urovne: n.urovne || {}, povinne: n.povinne || {},
        sla: n.sla || {}, triaz_min: n.triaz_min == null ? 480 : n.triaz_min } });
    oznamPas("Nastavenia BUGstation uložené"); BS.nastavenia = null; bsNacitajData();
  } catch (e) { bsChyba(e, "Nastavenia sa nepodarilo uložiť"); }
}
// Členstvo a roly v podprojekte (admin_95, b2b_bs_clen_nastav) — zo správy v okne B2B
// (BS4b) aj z okna (bez ppId = otvorený podprojekt): rola nečlenovi ho pridá, Člen
// bez roly = čitateľ, odškrtnutie Člen ho odoberie.
function bsClen(osobaId, ppId){
  const pp = ppId || BS.pp;
  const zo = ((BS.sprava && BS.sprava.clenovia) || []).filter(c => c.podprojekt_id === pp);
  const zd = BS.d && BS.d.ppId === pp ? (BS.d.clenovia || []) : [];
  return zo.concat(zd).find(x => x.osoba_id === osobaId);
}
async function bsRolaPrepni(osobaId, rola, zapni, ppId){
  const c = bsClen(osobaId, ppId);
  await bsClenNastav(osobaId, ((c && c.role) || []).filter(r => r !== rola).concat(zapni ? [rola] : []), ppId);
}
async function bsClenPrepni(osobaId, zapni, ppId){
  const c = bsClen(osobaId, ppId);
  if (!zapni && c && c.role && c.role.length && !confirm("Odobrať osobu z podprojektu? Stratí prístup k jeho záznamom aj roly v ňom.")) return bsPrekresli();
  await bsClenNastav(osobaId, zapni ? ((c && c.role) || []) : null, ppId);
}
async function bsClenNastav(osobaId, role, ppId){
  const pp = ppId || BS.pp, o = ((B2B.d && B2B.d.osoby) || []).find(x => x.id === osobaId);
  try {
    const r = await bsRpc("b2b_bs_clen_nastav", { p_podprojekt: pp, p_osoba: osobaId, p_role: role });
    const uprav = (zoz, sPp) => {
      const i = zoz.findIndex(x => x.osoba_id === osobaId && (!sPp || x.podprojekt_id === pp));
      if (r.role == null) { if (i >= 0) zoz.splice(i, 1); }
      else if (i >= 0) zoz[i].role = r.role;
      else zoz.push(sPp ? { podprojekt_id: pp, osoba_id: osobaId, role: r.role } : { osoba_id: osobaId, role: r.role });
    };
    if (BS.sprava && BS.sprava.clenovia) uprav(BS.sprava.clenovia, true);
    if (BS.d && BS.d.ppId === pp) uprav(BS.d.clenovia || (BS.d.clenovia = []), false);
    oznamPas((r.role == null ? "Odobratá z podprojektu · " : "Roly uložené · ") + (o ? o.meno : ""));
    bsPrekresli();
  } catch (e) { bsChyba(e, "Členstvo v podprojekte sa nepodarilo zmeniť"); bsPrekresli(); }
}
// Podprojekty zákazky (admin_95, O7): zakladá správca aj Test manager niektorého
// podprojektu; predvolený a archív mení správca. Kód sa po založení nemení — nesie
// ho každý kľúč záznamu. Zakladá sa zo správy v okne B2B.
function bsPodprojektyZoznam(){ return (BS.sprava && BS.sprava.podprojekty) || bsPodprojekty(); }
function bsPodprojektFormular(){
  const zoz = bsPodprojektyZoznam().filter(x => !x.archivovane);
  const html = '<div class="bs-ok"><div class="bs-form">' +
    '<label>Kód (kľúč záznamov, 2–10 veľkých písmen alebo číslic)<input type="text" id="bsPpKod" maxlength="10" placeholder="PORTAL" style="text-transform:uppercase"></label>' +
    '<label>Názov<input type="text" id="bsPpNazov" maxlength="300" placeholder="Klientsky portál"></label>' +
    '<label>Nastavenia (číselníky, úrovne, povinné polia, SLA) prevziať z<select id="bsPpVzor"><option value="">— predvolené nastavenia —</option>' +
      zoz.map(x => '<option value="' + esc(x.id) + '"' + (x.predvoleny ? " selected" : "") + ">" + esc(x.kod + " · " + x.nazov) + "</option>").join("") + "</select></label>" +
    '<div class="bs-podobne" style="margin-top:6px">Kód sa po založení nemení. Členov a roly pridáte v správe podprojektov' + (bsJaVZakazke().spravca ? "" : " — vy v ňom budete Test manager") + ".</div></div></div>";
  openModal("Založiť podprojekt BUGstation", html, async () => {
    const kod = String((document.getElementById("bsPpKod") || {}).value || "").trim().toUpperCase();
    const nazov = String((document.getElementById("bsPpNazov") || {}).value || "").trim();
    const vzor = String((document.getElementById("bsPpVzor") || {}).value || "") || null;
    if (!/^[A-Z0-9]{2,10}$/.test(kod)) return b2bVOkne("Kód má 2 až 10 veľkých písmen alebo číslic — bez medzier a pomlčky.");
    if (!nazov) return b2bVOkne("Zadajte názov podprojektu.");
    let r;
    try { r = await bsRpc("b2b_bs_podprojekt_zaloz", { p_projekt: B2B.pid, p_kod: kod, p_nazov: nazov, p_vzor: vzor }); }
    catch (e) { return b2bVOkne(String((e && e.message) || e).replace(/^.*?ERROR:s*/, "")); }
    oznamPas("Podprojekt " + r.kod + " založený — pridajte doň členov");
    BS.sprava = null; BS.spravaOtvorene = Object.assign({}, BS.spravaOtvorene, { [r.id]: true });
    bsPrekresli();
  }, null, null, "Založiť");
}
async function bsPodprojektUprav(id, polia){
  const x = bsPodprojektyZoznam().find(p => p.id === id); if (!x) return;
  if (polia.archivovat && !confirm("Archivovať podprojekt " + x.kod + "? Záznamy ostanú na čítanie, zapisovať sa do neho nebude dať.")) return;
  try {
    await bsRpc("b2b_bs_podprojekt_uprav", { p_id: id, p_verzia: x.verzia, p_polia: polia });
    oznamPas(polia.predvoleny ? "Predvolený podprojekt: " + x.kod : polia.archivovat ? "Podprojekt " + x.kod + " archivovaný" : "Podprojekt " + x.kod + " obnovený");
    BS.nastavenia = null; BS.sprava = null;
    if (BS.okno) bsNacitajData(); else bsPrekresli();
  } catch (e) { bsChyba(e, "Podprojekt sa nepodarilo upraviť"); }
}
async function bsPoziadavkyUloz(){
  const el = document.getElementById("bsPozVloz"), t = el ? el.value : "";
  const riadky = t.split(/\r?\n/).map(r => r.split("\t")).filter(c => c[0] && c[0].trim() && c[1] && c[1].trim()).map(c => ({ kod: c[0].trim(), nazov: c[1].trim() }));
  if (!riadky.length) return alert("Nevidím žiadne riadky s kódom a názvom (stĺpce oddelené tabulátorom — skopírujte ich z Excelu).");
  try { const r = await bsRpc("b2b_bs_poziadavky_uloz", { p_podprojekt: BS.pp, p_riadky: riadky }); oznamPas("Uložené požiadavky: " + r.pocet); bsNacitajData(); }
  catch (e) { bsChyba(e, "Požiadavky sa nepodarilo uložiť"); }
}

// ═══════════════════════════════════════════════════════════════
//  BS2 — testovací plán a scenáre (NAVRH §14, kontrakt §29, admin_91)
//  Server ukladá fázy, scenáre, prípady, plán a vykonania; každé číslo
//  (výsledok prípadu, scenára a fázy, pass rate, pokrytie, exit kritériá)
//  počíta jedno odvodenie bsPlanOdvod — z neho kreslí Plán, Scenáre, KPI,
//  míľniky, päta railu aj „Čaká na mňa“.
// ═══════════════════════════════════════════════════════════════
const BS_VYSLEDKY = {
  presiel:   ["Prešiel", 162, 0.11, "✓"],
  nepresiel: ["Neprešiel", 32, 0.14, "✕"],
  blokovany: ["Blokovaný", 78, 0.12, "⊘"],
  caka:      ["Čaká", 255, 0.06, "·"]
};
const BS_VYSLEDKY_PORADIE = ["presiel", "nepresiel", "blokovany", "caka"];
const BS_FAZA_STAVY = { naplanovana: ["Naplánovaná", 255, 0.06], prebieha: ["Prebieha", 78, 0.12], ukoncena: ["Ukončená", 162, 0.11] };
const BS_PRIPADY_DEN = 16;            // odhad dní v štatistikách plánu (balíček C)
const BS_PLAN_ROLY = ["tm", "ttl"];   // plán, scenáre a prípady (§5.3)
const BS_VYKON_ROLY = ["tm", "ttl", "tester"];
const BS_KRITERIA_AUTO = [
  ["otvorene_u1", "Žiadny otvorený defekt najvyššej úrovne"],
  ["pass_rate", "Pass rate fázy aspoň {x} %"],
  ["p1_vykonane", "Vykonané všetky prípady scenárov priority 1"],
  ["incidenty_sla", "Žiadny otvorený incident po termíne SLA"]
];

function bsDenStr(t){ const d = new Date(t); return d.getFullYear() + "-" + bsDva(d.getMonth() + 1) + "-" + bsDva(d.getDate()); }
function bsFazaStav(f, teraz){
  if (f.uzavreta) return "ukoncena";
  return f.od && bsDenStr(teraz != null ? teraz : Date.now()) < String(f.od).slice(0, 10) ? "naplanovana" : "prebieha";
}
// Výsledok scenára z výsledkov jeho prípadov (§14): Neprešiel, ak neprešiel
// niektorý; inak Blokovaný; inak Čaká, ak niektorý čaká (alebo nemá prípady);
// inak Prešiel.
function bsVysledokScenara(c){
  if (c.nepresiel) return "nepresiel";
  if (c.blokovany) return "blokovany";
  if (c.caka || !c.presiel) return "caka";
  return "presiel";
}
function bsPassRate(presiel, vykonane){ return vykonane ? Math.round(presiel / vykonane * 1000) / 10 : null; }
function bsPct(a, b){ return b ? Math.round(a / b * 100) : 0; }
function bsDes(x){ return String(x).replace(".", ","); }
// Otvorené incidenty po termíne SLA — to isté číslo pre KPI aj exit kritérium.
function bsIncidentyPoSla(zaznamy, t){
  return (zaznamy || []).filter(z => !z.zmazane && z.typ === "incident" && bsOtvoreny(z) && (bsSla(z, t) || {}).po).length;
}

// P = { fazy, scenare, pripady, plan, vykonania }; doCasu = stav k času T
// (delta pass rate za týždeň). Nič sa neukladá.
function bsPlanOdvod(P, zaznamy, teraz, poziadavky, doCasu){
  if (!P) return null;
  const t = teraz != null ? teraz : Date.now(), hranica = doCasu != null ? doCasu : Infinity;
  const scen = (P.scenare || []).filter(s => !s.zmazane), sMap = {};
  scen.forEach(s => { sMap[s.id] = s; });
  const prip = {};
  (P.pripady || []).filter(p => !p.zmazane && sMap[p.scenar_id]).forEach(p => { (prip[p.scenar_id] = prip[p.scenar_id] || []).push(p); });
  Object.keys(prip).forEach(k => prip[k].sort((x, y) => (x.poradie - y.poradie) || (x.cislo - y.cislo)));
  const vyk = {};
  (P.vykonania || []).filter(v => new Date(v.kedy).getTime() <= hranica).forEach(v => {
    const k = v.plan_id + "|" + v.pripad_id; (vyk[k] = vyk[k] || []).push(v);
  });
  Object.keys(vyk).forEach(k => vyk[k].sort((x, y) => (new Date(x.kedy) - new Date(y.kedy)) || String(x.id).localeCompare(String(y.id))));
  const nula = () => ({ presiel: 0, nepresiel: 0, blokovany: 0, caka: 0 });
  const pripocitaj = (a, b) => { BS_VYSLEDKY_PORADIE.forEach(k => { a[k] += b[k]; }); return a; };
  const fazy = (P.fazy || []).filter(f => !f.zmazane)
    .sort((a, b) => ((a.poradie || 0) - (b.poradie || 0)) || String(a.od || "").localeCompare(String(b.od || ""))).map(f => {
      const riadky = (P.plan || []).filter(r => r.faza_id === f.id && !r.odobrate && sMap[r.scenar_id])
        .sort((a, b) => ((a.poradie || 0) - (b.poradie || 0)) || (sMap[a.scenar_id].cislo - sMap[b.scenar_id].cislo)).map(r => {
          const pocty = nula(); let posledne = null;
          const pripady = (prip[r.scenar_id] || []).map(p => {
            const vv = vyk[r.id + "|" + p.id] || [], v = vv[vv.length - 1] || null;
            pocty[v ? v.vysledok : "caka"]++;
            if (v && (!posledne || new Date(v.kedy) > new Date(posledne.kedy))) posledne = v;
            return { p, vykonania: vv, posledne: v, vysledok: v ? v.vysledok : "caka" };
          });
          const celkom = pripady.length, vykonane = celkom - pocty.caka;
          return { r, s: sMap[r.scenar_id], pripady, pocty, celkom, vykonane, pct: bsPct(vykonane, celkom), vysledok: bsVysledokScenara(pocty), posledne };
        });
      const pocty = riadky.reduce((a, x) => pripocitaj(a, x.pocty), nula());
      const celkom = riadky.reduce((a, x) => a + x.celkom, 0), vykonane = celkom - pocty.caka;
      return { f, stav: bsFazaStav(f, t), riadky, pocty, celkom, vykonane, pct: bsPct(vykonane, celkom), passRate: bsPassRate(pocty.presiel, vykonane) };
    });
  const pocty = fazy.reduce((a, x) => pripocitaj(a, x.pocty), nula());
  const celkom = fazy.reduce((a, x) => a + x.celkom, 0), vykonane = celkom - pocty.caka;
  const aktivna = fazy.find(x => x.stav === "prebieha") || null;
  // Scenár v D: riadok aktívnej fázy, inak poslednej fázy, v ktorej je.
  const vPlane = {};
  fazy.forEach(x => x.riadky.forEach(rr => { vPlane[rr.s.id] = { faza: x, riadok: rr }; }));
  if (aktivna) aktivna.riadky.forEach(rr => { vPlane[rr.s.id] = { faza: aktivna, riadok: rr }; });
  const scenare = scen.slice().sort((a, b) => a.cislo - b.cislo).map(s => ({ s, pripady: prip[s.id] || [], v: vPlane[s.id] || null }));
  const akt = (poziadavky || []).filter(q => q.aktivna !== false), kryte = new Set();
  Object.keys(prip).forEach(k => prip[k].forEach(p => { if (p.poziadavka_id) kryte.add(p.poziadavka_id); }));
  const pokryte = akt.filter(q => kryte.has(q.id)).length;
  const O = {
    fazy, scenare, pocty, celkom, vykonane, zostava: celkom - vykonane, pct: bsPct(vykonane, celkom),
    passRate: bsPassRate(pocty.presiel, vykonane), dni: Math.round((celkom - vykonane) / BS_PRIPADY_DEN * 10) / 10,
    aktivna, pocetScenarov: Object.keys(vPlane).length,
    pokrytie: akt.length ? { pokryte, vsetky: akt.length, pct: bsPct(pokryte, akt.length), bez: akt.length - pokryte } : null,
    // Bez fázy so scenárom sa nič testové nekreslí (§9).
    maPlan: celkom > 0
  };
  fazy.forEach(x => { x.kriteria = bsKriteria(x, zaznamy, t); });
  return O;
}
// Exit kritériá fázy (§29.4): automatické z tých istých čísel ako Prehľad.
function bsKriteria(x, zaznamy, t){
  const K = x.f.kriteria || {}, A = K.auto || {}, out = [];
  if (A.otvorene_u1) {
    const n = bsOdvod(zaznamy, [], t).blokujuce;
    out.push({ id: "otvorene_u1", auto: true, text: BS_KRITERIA_AUTO[0][1], splnene: n === 0,
      detail: n ? bsPocet(n, "otvorený defekt", "otvorené defekty", "otvorených defektov") + " najvyššej úrovne" : "" });
  }
  if (A.pass_rate != null && A.pass_rate !== false && A.pass_rate !== "") {
    const prah = +A.pass_rate;
    out.push({ id: "pass_rate", auto: true, text: BS_KRITERIA_AUTO[1][1].replace("{x}", bsDes(prah)), splnene: x.passRate != null && x.passRate >= prah,
      detail: x.passRate == null ? "zatiaľ nič vykonané" : "teraz " + bsDes(x.passRate) + " %" });
  }
  if (A.p1_vykonane) {
    const zost = x.riadky.filter(rr => +rr.s.priorita === 1).reduce((a, rr) => a + rr.pocty.caka, 0);
    out.push({ id: "p1_vykonane", auto: true, text: BS_KRITERIA_AUTO[2][1], splnene: zost === 0,
      detail: zost ? bsPocet(zost, "prípad priority 1 čaká", "prípady priority 1 čakajú", "prípadov priority 1 čaká") : "" });
  }
  if (A.incidenty_sla) {
    const n = bsIncidentyPoSla(zaznamy, t);
    out.push({ id: "incidenty_sla", auto: true, text: BS_KRITERIA_AUTO[3][1], splnene: n === 0,
      detail: n ? bsPocet(n, "incident po termíne", "incidenty po termíne", "incidentov po termíne") : "" });
  }
  (K.rucne || []).forEach(k => out.push({ id: k.id, auto: false, text: k.text, splnene: !!k.splnene,
    detail: k.splnene && k.kedy ? "potvrdil(a) " + (bsMenoUctu(k.kto) || "Test manager") + " " + bsDMR(k.kedy) : "" }));
  return { polozky: out, splnene: out.filter(k => k.splnene).length, vsetky: out.length };
}

// ── stav plánu v appke ──────────────────────────────────────────
let _bsPlanCache = null;
function bsPlan(){ return (BS.d && BS.d.plan) || null; }
function bsPlanO(){
  const P = bsPlan(); if (!P) return null;
  const min = Math.floor(Date.now() / 60000);
  if (_bsPlanCache && _bsPlanCache.P === P && _bsPlanCache.min === min && _bsPlanCache.n === (P.vykonania || []).length && _bsPlanCache.z === BS.d.zaznamy) return _bsPlanCache.O;
  const O = bsPlanOdvod(P, bsZaznamy(), Date.now(), BS.d.poziadavky);
  _bsPlanCache = { P, min, n: (P.vykonania || []).length, z: BS.d.zaznamy, O };
  return O;
}
function bsPlanZmenene(){ _bsPlanCache = null; }
// Načítanie plánu je samostatné: pred admin_91 tabuľky nie sú a BUGstation
// beží ďalej bez plánu (plan = null), chyba servera sa ukáže v Pláne.
async function bsNacitajPlan(ppId){
  const vsetky = (q) => b2bVsetky(q).then(data => ({ data }), error => ({ error }));
  const r = await Promise.all([
    vsetky(() => sb.from("b2b_bs_fazy").select("*").eq("podprojekt_id", ppId).order("poradie")),
    vsetky(() => sb.from("b2b_bs_scenare").select("*").eq("podprojekt_id", ppId).order("cislo")),
    vsetky(() => sb.from("b2b_bs_pripady").select("*").eq("podprojekt_id", ppId).order("poradie")),
    vsetky(() => sb.from("b2b_bs_plan").select("*").eq("podprojekt_id", ppId).order("poradie")),
    vsetky(() => sb.from("b2b_bs_vykonania").select("id,plan_id,pripad_id,pripad_verzia,vysledok,skutocny,prostredie_id,defekty,tester_osoba,kto,kedy").eq("podprojekt_id", ppId).order("kedy"))
  ]);
  const e = r.map(x => x.error).find(Boolean);
  if (e && b2bChybaTabulky(e)) return { plan: null };
  if (e) { console.error("BUGstation: načítanie plánu", e); return { plan: null, planChyba: (e && e.message) || String(e) }; }
  return { plan: { fazy: r[0].data || [], scenare: r[1].data || [], pripady: r[2].data || [], plan: r[3].data || [], vykonania: r[4].data || [] } };
}

function bsVysledokChip(k){ const v = BS_VYSLEDKY[k] || BS_VYSLEDKY.caka; return bsChipHtml(v[0], v[1], v[2], "st"); }
function bsFazaChip(stav){ const s = BS_FAZA_STAVY[stav]; return bsChipHtml(s[0], s[1], s[2], "st"); }
function bsFazaOkno(f){ return (f.od ? bsDMR(f.od) : "") + (f.do ? " – " + bsDMR(f.do) : ""); }
function bsPocty(c){
  return '<span class="bs-pocty">' + BS_VYSLEDKY_PORADIE.map(k => '<b class="' + k + '">' + BS_VYSLEDKY[k][3] + " " + c[k] + "</b>").join("") + "</span>";
}
function bsNajdiRiadok(O, planId){
  for (const x of (O ? O.fazy : [])) { const rr = x.riadky.find(y => y.r.id === planId); if (rr) return { faza: x, rr }; }
  return null;
}
// Moje scenáre na vykonanie: pridelené mne v prebiehajúcej fáze s čakajúcim prípadom.
function bsMojeScenare(O, ja){
  if (!O || !ja || !ja.osoba) return [];
  const out = [];
  O.fazy.filter(x => x.stav === "prebieha").forEach(x => x.riadky.forEach(rr => {
    if (rr.r.tester_osoba === ja.osoba && rr.pocty.caka) out.push({ faza: x, rr });
  }));
  return out;
}

// ── C. Testovací plán ───────────────────────────────────────────
function bsPlanBezHtml(){
  if (BS.d.planChyba) return '<div class="bs-panel"><div class="bs-prazdne">Testovací plán sa nenačítal: ' + esc(BS.d.planChyba) + ' <button type="button" class="bs-btn mal" onclick="bsObnov()">Skúsiť znova</button></div></div>';
  return '<div class="bs-panel"><div class="bs-prazdne">Testovací plán v tomto projekte zatiaľ nie je k dispozícii.</div></div>';
}
function bsStatKarty(karty){
  return '<div class="bs-stat">' + karty.map(([l, v, d]) => '<div><div class="bs-kpi-l">' + l + '</div><div class="bs-stat-v">' + esc(String(v)) + '</div><div class="bs-kpi-d">' + esc(d) + "</div></div>").join("") + "</div>";
}
function bsDniText(d){ return Number.isInteger(d) ? bsPocet(d, "deň", "dni", "dní") : bsDes(d) + " dňa"; }
function bsPlanHtml(){
  const P = bsPlan(); if (!P) return bsPlanBezHtml();
  const O = bsPlanO(), ja = bsJa(), smie = bsMaRolu(ja, BS_PLAN_ROLY), tm = bsMaRolu(ja, ["tm"]);
  if (!O.fazy.length) return '<div class="bs-panel"><div class="bs-prazdne">Plán zatiaľ nemá žiadnu fázu (SIT, UAT…).' +
    (smie ? ' <button type="button" class="bs-btn pri" onclick="bsFazaFormular()">Založiť fázu</button>' : " Fázy zakladá Test manager alebo Test team leader.") + "</div></div>";
  const st = bsStatKarty([
    ["ROZSAH PLÁNU", O.celkom, bsPocet(O.fazy.length, "fáza", "fázy", "fáz") + " · " + bsPocet(O.pocetScenarov, "scenár", "scenáre", "scenárov")],
    ["VYKONANÉ", O.vykonane, O.pct + " % rozsahu"],
    ["ZOSTÁVA", O.zostava, O.zostava ? "≈ " + bsDniText(O.dni) + " pri " + BS_PRIPADY_DEN + " prípadoch denne" : "všetko vykonané"],
    ["POKRYTIE POŽIADAVIEK", O.pokrytie ? O.pokrytie.pct + " %" : "—", O.pokrytie ? (O.pokrytie.bez ? bsPocet(O.pokrytie.bez, "požiadavka bez prípadu", "požiadavky bez prípadu", "požiadaviek bez prípadu") : "každá požiadavka má prípad") : "bez registra požiadaviek"]
  ]);
  const fazy = O.fazy.map(x => {
    const s = BS_FAZA_STAVY[x.stav], f = x.f;
    const tl = smie ? '<span class="bs-ph-tl"><button type="button" class="bs-btn mal" onclick="bsPlanPridaj(\'' + f.id + '\')">+ Scenáre</button>' +
      '<button type="button" class="bs-btn mal" onclick="bsKriteriaFormular(\'' + f.id + '\')">Kritériá</button>' +
      '<button type="button" class="bs-btn mal" onclick="bsFazaFormular(\'' + f.id + '\')">Upraviť</button>' +
      (tm ? '<button type="button" class="bs-btn mal" onclick="bsFazaUzavri(\'' + f.id + '\',' + (f.uzavreta ? "false" : "true") + ')">' + (f.uzavreta ? "Znovu otvoriť" : "Uzavrieť") + "</button>" : "") + "</span>" : "";
    const hl = '<div class="bs-ph"><i class="bs-bod9" style="--h:' + s[1] + ";--c:" + s[2] + '"></i><h3>' + esc(f.nazov) + ' <small>' + esc(bsFazaOkno(f)) + "</small></h3>" + bsFazaChip(x.stav) +
      '<span class="bs-fp"><span class="bs-bar6"><i style="width:' + x.pct + '%"></i></span><span class="bs-num">' + x.pct + " %</span></span>" + tl + "</div>";
    const riadky = x.riadky.map(rr => {
      const tester = bsMeno(rr.r.tester_osoba);
      return '<div class="bs-pr' + (smie ? " s" : "") + '"><button type="button" class="bs-pr-n" onclick="bsChodScenar(\'' + rr.s.id + '\')"><small class="bs-kodm">' + esc(rr.s.kod) + "</small> " + esc(rr.s.nazov) +
        (tester ? '<small class="bs-pr-t"> · ' + esc(tester) + "</small>" : "") + "</button>" + bsPocty(rr.pocty) +
        '<span class="bs-fp"><span class="bs-bar5"><i style="width:' + rr.pct + '%"></i></span><span class="bs-num">' + rr.pct + " %</span></span>" +
        (smie ? '<button type="button" class="bs-x" onclick="bsPlanRiadok(\'' + rr.r.id + '\')" title="Tester, poradie, odobratie">⋯</button>' : "") + "</div>";
    }).join("") || '<div class="bs-prazdne">Fáza zatiaľ nemá scenáre.' + (smie ? " Pridajte ich tlačidlom „+ Scenáre“." : "") + "</div>";
    const K = x.kriteria;
    const krit = K.vsetky ? '<details class="bs-krit"><summary>Exit kritériá <small>' + K.splnene + " z " + K.vsetky + "</small></summary>" + K.polozky.map(k =>
      '<div class="bs-krit-r"><span class="' + (k.splnene ? "ok" : "nie") + '">' + (k.splnene ? "✓" : "✕") + "</span><span>" + esc(k.text) + (k.detail ? "<small>" + esc(k.detail) + "</small>" : "") + "</span>" +
      (!k.auto && tm && !f.uzavreta ? '<button type="button" class="bs-btn mal" onclick="bsKriteriumPotvrd(\'' + f.id + "','" + esc(k.id) + "'," + (k.splnene ? "false" : "true") + ')">' + (k.splnene ? "Zrušiť" : "Potvrdiť") + "</button>" : "") + "</div>").join("") + "</details>" : "";
    return '<div class="bs-panel">' + hl + riadky + krit + "</div>";
  }).join("");
  return '<div class="bs-stlp">' + st + fazy + "</div>";
}

// ── D. Testovacie scenáre ───────────────────────────────────────
function bsChodScenar(sid){ BS.scenar = sid; bsChod("scenare"); BS.scenar = sid; bsPrekresli(); }
function bsChodScenarKod(kod){
  const P = bsPlan(), s = P && (P.scenare || []).find(x => x.kod === kod && !x.zmazane);
  if (!s) return alert("Scenár " + kod + " v pláne projektu nie je.");
  BS.detail = null; bsChodScenar(s.id);
}
function bsVyberScenar(sid){ BS.scenar = sid; bsPrekresli(); }
function bsScenareHtml(){
  const P = bsPlan(); if (!P) return bsPlanBezHtml();
  const O = bsPlanO(), ja = bsJa(), smie = bsMaRolu(ja, BS_PLAN_ROLY), nast = bsNast();
  if (!O.scenare.length) return '<div class="bs-panel"><div class="bs-prazdne">Knižnica scenárov je prázdna. Scenár je súhrn prípadov jedného biznis toku (napr. „Žiadosť o dávku“).' +
    (smie ? ' <button type="button" class="bs-btn pri" onclick="bsScenarFormular()">Založiť scenár</button>' : "") + "</div></div>";
  const x = O.scenare.find(y => y.s.id === BS.scenar) || O.scenare[0]; BS.scenar = x.s.id;
  const zoznam = O.scenare.map(y => {
    const vys = y.v ? bsVysledokChip(y.v.riadok.vysledok) : bsChipHtml("Mimo plánu", 255, 0.02, "st");
    return '<button type="button" class="bs-sr' + (y === x ? " on" : "") + '" onclick="bsVyberScenar(\'' + y.s.id + '\')"><span class="bs-sr-n"><small class="bs-kodm">' + esc(y.s.kod) + "</small><span>" + esc(y.s.nazov) + "</span></span>" +
      '<span class="bs-sr-v">' + vys + "<small>" + bsPocet(y.pripady.length, "krok", "kroky", "krokov") + "</small></span></button>";
  }).join("");
  const rr = x.v && x.v.riadok, faza = x.v && x.v.faza;
  const vysP = {}; (rr ? rr.pripady : []).forEach(q => { vysP[q.p.id] = q; });
  const pos = rr && rr.posledne;
  const meta = [
    ["MODUL", bsCiselnikNazov(nast, "moduly", x.s.modul_id) || "—"], ["IS", bsCiselnikNazov(nast, "is", x.s.is_id) || "—"],
    ["PRIORITA", "P" + (x.s.priorita || 2)], ["FÁZA", faza ? faza.f.nazov : "mimo plánu"],
    ["TESTER", rr ? (bsMeno(rr.r.tester_osoba) || "nepridelený") : "—"],
    ["POSLEDNÉ VYKONANIE", pos ? bsKedy(pos.kedy) + (bsMeno(pos.tester_osoba) ? " · " + bsMeno(pos.tester_osoba) : "") : "—"],
    ["PROSTREDIE", pos ? (bsCiselnikNazov(nast, "prostredia", pos.prostredie_id) || "—") : "—"]
  ].map(([k, v]) => '<div><span class="k">' + k + '</span><span class="v">' + esc(v) + "</span></div>").join("");
  const mozeSpustit = rr && faza.stav !== "ukoncena" && rr.celkom && bsMaRolu(ja, BS_VYKON_ROLY);
  const tl = (mozeSpustit ? '<button type="button" class="bs-btn pri" onclick="bsSpustit(\'' + rr.r.id + '\')">' + (rr.pocty.caka === rr.celkom ? "Spustiť" : rr.pocty.caka ? "Pokračovať" : "Spustiť znova") + "</button>" : "") +
    (smie ? '<button type="button" class="bs-btn" onclick="bsPripadFormular(\'' + x.s.id + '\')">+ Prípad</button><button type="button" class="bs-btn" onclick="bsScenarFormular(\'' + x.s.id + '\')">Upraviť</button>' : "");
  const kroky = x.pripady.map((p, i) => {
    const q = vysP[p.id], vys = q ? q.vysledok : null;
    const nastroje = smie ? '<span class="bs-krok-tl"><button type="button" title="Vyššie" onclick="bsPripadPosun(\'' + p.id + '\',-1)"' + (i ? "" : " disabled") + '>↑</button><button type="button" title="Nižšie" onclick="bsPripadPosun(\'' + p.id + '\',1)"' + (i < x.pripady.length - 1 ? "" : " disabled") + '>↓</button>' +
      '<button type="button" title="Upraviť" onclick="bsPripadFormular(\'' + x.s.id + "','" + p.id + '\')">✎</button><button type="button" title="Presunúť do iného scenára" onclick="bsPripadPresun(\'' + p.id + '\')">⇄</button></span>' : "";
    return '<div class="bs-krok"><span class="bs-kn">' + (i + 1) + '</span><span class="bs-ka"><small class="bs-kodm">' + esc(p.kod) + "</small> " + esc(p.nazov) +
      (p.postup ? "<em>" + esc(p.postup) + "</em>" : "") + nastroje + '</span><span class="bs-ko">' + esc(p.ocakavane || "") + "</span><span>" + (vys ? bsVysledokChip(vys) : "") + "</span></div>";
  }).join("") || '<div class="bs-prazdne">Scenár zatiaľ nemá prípady.' + (smie ? " Pridajte ich tlačidlom „+ Prípad“." : "") + "</div>";
  let callout = "";
  if (rr && (rr.vysledok === "nepresiel" || rr.vysledok === "blokovany")) {
    const ids = [];
    rr.pripady.filter(q => q.vysledok === "nepresiel" || q.vysledok === "blokovany").forEach(q => (q.posledne.defekty || []).forEach(d => { if (!ids.includes(d)) ids.push(d); }));
    const def = ids.map(bsNajdi).filter(Boolean);
    callout = '<div class="bs-callout"><i></i><div><b>' + (def.length ? "Napojený defekt" : "Neprešlo bez napojeného defektu") + "</b><p>" +
      (def.length ? def.map(z => '<button type="button" onclick="bsOtvor(\'' + z.id + '\')">' + esc(z.kluc) + "</button> " + esc(z.nazov) + " · " + esc(bsStav(z.stav)[1])).join("<br>")
        : "Pri ďalšom vykonaní ho appka ponúkne založiť s vyplneným scenárom a prípadom.") + "</p></div></div>";
  }
  const detail = '<div class="bs-panel bs-scd"><div class="bs-scd-h"><small class="bs-kodm">' + esc(x.s.kod) + "</small>" + (rr ? bsVysledokChip(rr.vysledok) : "") + '<span class="bs-ph-tl">' + tl + "</span></div>" +
    "<h2>" + esc(x.s.nazov) + '</h2><div class="bs-scd-m">' + meta + "</div>" + (x.s.predpoklady ? '<p class="bs-scd-p">' + esc(x.s.predpoklady) + "</p>" : "") + callout +
    '<div class="bs-kroky-h">KROKY</div><div class="bs-kroky">' + kroky + "</div></div>";
  return '<div class="bs-sc"><div class="bs-panel"><div class="bs-ph"><h3>Scenáre</h3><small>' + O.scenare.length + " v knižnici · " + O.pocetScenarov + " v pláne</small></div>" + zoznam + "</div>" + detail + "</div>";
}

// ── Prehľad s plánom (balíček A, §9) ────────────────────────────
// KPI pás z balíčka; pass rate „za týždeň“ = rovnaké odvodenie k času pred 7 dňami.
function bsPrehladKpiPlan(PO, O, zz){
  const t = Date.now(), pred = bsPlanOdvod(bsPlan(), zz, t, BS.d.poziadavky, t - 7 * BS_DEN);
  const dp = PO.passRate != null && pred && pred.passRate != null ? Math.round((PO.passRate - pred.passRate) * 10) / 10 : null;
  const ips = bsIncidentyPoSla(zz, t);
  return [
    ["TESTOVACIE PRÍPADY", PO.celkom, PO.vykonane + " vykonaných · " + PO.pct + " %", ""],
    ["PASS RATE", PO.passRate == null ? "—" : bsDes(PO.passRate) + " %", dp == null ? "zatiaľ bez porovnania" : dp === 0 ? "bez zmeny za týždeň" : (dp > 0 ? "+" : "−") + bsDes(Math.abs(dp)) + " b. za týždeň", dp > 0 ? "pos" : dp < 0 ? "neg" : ""],
    ["OTVORENÉ DEFEKTY", O.poTypoch.defekt.otvorene, O.deltaDefektov === 0 ? "bez zmeny za týždeň" : (O.deltaDefektov > 0 ? "+" : "−") + Math.abs(O.deltaDefektov) + " za týždeň", O.deltaDefektov > 0 ? "neg" : O.deltaDefektov < 0 ? "pos" : ""],
    ["BLOKUJÚCE", O.blokujuce, O.blokujuce ? bsPocet(O.blokujuce, "kritický defekt", "kritické defekty", "kritických defektov") + (O.blokujuceNad48 ? " · " + O.blokujuceNad48 + " nad 48 h" : "") : "žiadne blokujúce", O.blokujuce ? "neg" : "pos"],
    ["INCIDENTY MIMO SLA", ips, O.poTypoch.incident.otvorene + " otvorených incidentov", ips ? "neg" : ""]
  ].map(([l, v, d, c]) => '<div><div class="bs-kpi-l">' + l + '</div><div class="bs-kpi-v">' + esc(String(v)) + '</div><div class="bs-kpi-d ' + c + '">' + esc(d) + "</div></div>").join("");
}
// Progres vykonávania podľa scenára: aktívna fáza, inak všetky fázy.
function bsPrehladProgresHtml(PO){
  const zdroj = PO.aktivna ? [PO.aktivna] : PO.fazy;
  const leg = BS_VYSLEDKY_PORADIE.map(k => '<span class="bs-leg"><i class="' + k + '"></i>' + (k === "caka" ? "Nevykonané" : k === "presiel" ? "Prešlo" : k === "nepresiel" ? "Neprešlo" : "Blokované") + "</span>").join("");
  const riadky = zdroj.flatMap(x => x.riadky.map(rr => {
    const c = rr.pocty, w = k => rr.celkom ? (c[k] / rr.celkom * 100).toFixed(2) : 0;
    return '<button type="button" class="bs-prog" onclick="bsChodScenar(\'' + rr.s.id + '\')"><span class="bs-prog-n"><b>' + esc(rr.s.nazov) + "</b><small>" + esc(rr.s.kod + " · " + bsPocet(rr.celkom, "prípad", "prípady", "prípadov") + " · " + x.f.nazov) + "</small></span>" +
      '<span class="bs-stack"><i class="presiel" style="width:' + w("presiel") + '%"></i><i class="nepresiel" style="width:' + w("nepresiel") + '%"></i><i class="blokovany" style="width:' + w("blokovany") + '%"></i></span>' +
      '<span class="bs-num">' + rr.pct + " %</span></button>";
  })).join("") || '<div class="bs-prazdne">Fáza zatiaľ nemá scenáre.</div>';
  return '<div class="bs-panel"><div class="bs-ph"><h3>Progres vykonávania podľa scenára</h3><span class="bs-legw">' + leg + "</span></div>" + riadky + "</div>";
}
function bsPrehladMilnikyHtml(PO){
  const sc = PO.scenare.filter(x => x.v), prip = sc.filter(x => x.pripady.length).length;
  const ms = [["Príprava testov", bsPct(prip, sc.length) + " %", bsPocet(PO.celkom, "prípad pripravený", "prípady pripravené", "prípadov pripravených"), prip === sc.length ? 162 : 78]]
    .concat(PO.fazy.map(x => [x.f.nazov, x.pct + " %", x.stav === "naplanovana" ? "Naplánovaná · od " + bsDMR(x.f.od) : x.vykonane + " z " + x.celkom + " vykonaných",
      x.stav === "ukoncena" || x.pct === 100 ? 162 : x.pct > 0 ? 78 : 255]));
  const K = PO.aktivna ? PO.aktivna.kriteria : null;
  if (K && K.vsetky) {
    const prve = K.polozky.find(k => !k.splnene);
    ms.push(["Exit kritériá", K.splnene + " z " + K.vsetky, prve ? (prve.detail || prve.text) : "všetky splnené", prve ? 32 : 162]);
  }
  return '<div class="bs-panel"><div class="bs-ph"><h3>Progres review · míľniky</h3></div><div class="bs-ms">' + ms.map(([n, v, p, h]) =>
    '<div><span class="bs-ms-n"><i style="--h:' + h + '"></i>' + esc(n) + '</span><span class="bs-ms-v">' + esc(v) + '</span><span class="bs-ms-p">' + esc(p) + "</span></div>").join("") + "</div></div>";
}

// ── vykonanie prípad po prípade (§14) ───────────────────────────
let _bsBeh = null;
function bsSpustit(planId){
  const n = bsNajdiRiadok(bsPlanO(), planId); if (!n) return;
  const i = n.rr.pripady.findIndex(q => q.vysledok === "caka");
  // Všetko vykonané = beh znova od prvého prípadu po poradí; inak len čakajúce.
  _bsBeh = { planId, i: i < 0 ? 0 : i, znova: i < 0, prostredie: (bsPosledne() || {}).prostredie_id || "" };
  bsBehOtvor();
}
function bsBehOtvor(){
  const n = _bsBeh && bsNajdiRiadok(bsPlanO(), _bsBeh.planId); if (!n) return;
  openModal("Vykonanie · " + n.rr.s.kod + " " + n.rr.s.nazov, bsBehHtml(), null, null, "siroky");
  const zr = document.getElementById("modalZrusit"); if (zr) zr.textContent = "Zavrieť";
}
function bsBehHtml(){
  const n = bsNajdiRiadok(bsPlanO(), _bsBeh.planId); if (!n) return "";
  const rr = n.rr, i = Math.max(0, Math.min(_bsBeh.i, rr.pripady.length - 1)), q = rr.pripady[i], p = q.p, nast = bsNast();
  const prost = (nast.prostredia || []).length ? '<label>Prostredie<select id="bsB_prost"><option value=""></option>' + nast.prostredia.map(x => '<option value="' + esc(x.id) + '"' + (_bsBeh.prostredie === x.id ? " selected" : "") + ">" + esc(x.nazov) + "</option>").join("") + "</select></label>" : "";
  const sekcia = (k, v) => v ? '<div class="bs-beh-s"><span class="bs-kpi-l">' + k + "</span><p>" + esc(v) + "</p></div>" : "";
  return '<div class="bs-ok bs-beh"><div class="bs-beh-p">Prípad ' + (i + 1) + " z " + rr.celkom + " · " + bsPocty(rr.pocty) + "</div>" +
    '<div class="bs-beh-h"><small class="bs-kodm">' + esc(p.kod) + "</small> <b>" + esc(p.nazov) + "</b> " + bsVysledokChip(q.vysledok) + "</div>" +
    sekcia("POSTUP", p.postup) + sekcia("VSTUPNÉ DÁTA", p.vstup) + sekcia("OČAKÁVANÝ VÝSLEDOK", p.ocakavane) +
    '<div class="bs-form"><label>Skutočný výsledok<textarea id="bsB_skut" placeholder="Čo sa naozaj stalo (pri ✕ a ⊘ ide aj do defektu)"></textarea></label>' + prost + "</div>" +
    '<div class="bs-beh-tl"><button type="button" class="bs-v presiel" onclick="bsBehVysledok(\'presiel\')">✓ Prešiel</button><button type="button" class="bs-v nepresiel" onclick="bsBehVysledok(\'nepresiel\')">✕ Neprešiel</button>' +
    '<button type="button" class="bs-v blokovany" onclick="bsBehVysledok(\'blokovany\')">⊘ Blokovaný</button></div><div id="bsBehDef"></div>' +
    '<div class="bs-beh-nav"><button type="button" class="bs-btn mal" onclick="bsBehKrok(-1)"' + (i ? "" : " disabled") + '>‹ Predošlý</button><button type="button" class="bs-btn mal" onclick="bsBehKrok(1)"' + (i < rr.celkom - 1 ? "" : " disabled") + ">Preskočiť ›</button></div></div>";
}
function bsBehKrok(d){ _bsBeh.i += d; document.getElementById("modalBody").innerHTML = bsBehHtml(); }
function bsBehVstup(){
  const s = document.getElementById("bsB_skut"), pr = document.getElementById("bsB_prost");
  return { skut: s ? s.value.trim() : "", prost: pr ? pr.value : (_bsBeh.prostredie || "") };
}
// ✕ a ⊘ najprv ukážu výber defektu: ⊘ bez otvoreného defektu nejde (callout
// „Napojený defekt“ je tak vždy pravdivý), ✕ ho ponúkne, ale nežiada.
function bsBehVysledok(k){
  const n = bsNajdiRiadok(bsPlanO(), _bsBeh.planId); if (!n) return;
  if (k === "presiel") return bsBehZapis(k, "");
  const q = n.rr.pripady[_bsBeh.i];
  const otv = bsZaznamy().filter(z => z.typ === "defekt" && bsOtvoreny(z))
    .sort((a, b) => ((b.pripad === q.p.kod) - (a.pripad === q.p.kod)) || (b.cislo - a.cislo));
  const el = document.getElementById("bsBehDef"); if (!el) return;
  el.innerHTML = '<div class="bs-beh-def"><b>' + (k === "blokovany" ? "Blokované — napojte otvorený defekt, ktorý test blokuje" : "Neprešlo — napojiť defekt?") + "</b>" +
    '<select id="bsB_def"><option value="novy">Založiť nový defekt (vyplnený z prípadu)</option>' + (k === "nepresiel" ? '<option value="">Bez defektu</option>' : "") +
    otv.map(z => '<option value="' + z.id + '">' + esc(z.kluc + " · " + z.nazov) + "</option>").join("") + "</select>" +
    '<button type="button" class="bs-btn pri" onclick="bsBehZapis(\'' + k + '\',document.getElementById(\'bsB_def\').value)">Zapísať ' + BS_VYSLEDKY[k][3] + "</button></div>";
}
function bsPredvyplnDefekt(rr, q, prost, skut){
  return {
    nazov: q.p.nazov + " — " + (skut ? skut.split(/\r?\n/)[0].slice(0, 120) : "neprešlo"),
    popis: skut || ("Prípad " + q.p.kod + " scenára " + rr.s.kod + " neprešiel."),
    scenar: rr.s.kod, pripad: q.p.kod, is_id: rr.s.is_id || null, modul_id: rr.s.modul_id || null,
    poziadavka_id: q.p.poziadavka_id || null, prostredie_id: prost || null, identifikovane: new Date().toISOString(),
    data: { kroky: q.p.postup || "", ocakavane: q.p.ocakavane || "", skutocne: skut || "" }
  };
}
async function bsBehZapis(k, def){
  const n = bsNajdiRiadok(bsPlanO(), _bsBeh.planId); if (!n) return false;
  const q = n.rr.pripady[_bsBeh.i], { skut, prost } = bsBehVstup();
  _bsBeh.prostredie = prost;
  if (k === "blokovany" && !def) return b2bVOkne("Blokovaný prípad potrebuje napojený otvorený defekt — vyberte ho alebo založte nový.");
  if (def === "novy") {
    const beh = Object.assign({}, _bsBeh);
    bsFormular(null, "defekt", { pred: bsPredvyplnDefekt(n.rr, q, prost, skut), lenTyp: true, ostan: true,
      poUlozeni: async (r) => {
        await bsVykonaj(n.rr, q, k, skut, prost, [r.id]);
        _bsBeh = beh; setTimeout(() => bsBehDalsi(), 0);
      } });
    return true;
  }
  try { await bsVykonaj(n.rr, q, k, skut, prost, def ? [def] : []); }
  catch (e) { return b2bVOkne(String((e && e.message) || e).replace(/^.*?ERROR:\s*/, "")); }
  bsBehDalsi();
  return true;
}
async function bsVykonaj(rr, q, k, skut, prost, defekty){
  const r = await bsRpc("b2b_bs_vykonaj", { p_plan: rr.r.id, p_pripad: q.p.id, p_vysledok: k, p_skutocny: skut || null, p_prostredie: prost || null, p_defekty: defekty || [] });
  const P = bsPlan(), ja = bsJa();
  // Hneď do zoznamu (čísla a ďalší krok bez čakania na načítanie).
  if (P) P.vykonania.push({ id: (r && r.id) || ("lok-" + Date.now()), plan_id: rr.r.id, pripad_id: q.p.id, pripad_verzia: q.p.verzia, vysledok: k, skutocny: skut || null,
    prostredie_id: prost || null, defekty: defekty || [], tester_osoba: ja.osoba, kto: null, kedy: new Date().toISOString() });
  bsPlanZmenene();
  if (prost) bsZapamataj(Object.assign({}, bsPosledne(), { prostredie_id: prost }));
  return r;
}
function bsBehDalsi(){
  const n = bsNajdiRiadok(bsPlanO(), _bsBeh.planId); if (!n) return;
  let dalsi = _bsBeh.znova ? (_bsBeh.i < n.rr.celkom - 1 ? _bsBeh.i + 1 : -1)
    : n.rr.pripady.findIndex((q, j) => j > _bsBeh.i && q.vysledok === "caka");
  if (dalsi < 0 && !_bsBeh.znova) dalsi = n.rr.pripady.findIndex(q => q.vysledok === "caka");
  if (dalsi < 0) {
    if (document.getElementById("modal") && document.getElementById("modal").classList.contains("on")) closeModal();
    oznamPas("Scenár " + n.rr.s.kod + ": ✓ " + n.rr.pocty.presiel + " ✕ " + n.rr.pocty.nepresiel + " ⊘ " + n.rr.pocty.blokovany + (n.rr.pocty.caka ? " · čaká " + n.rr.pocty.caka : ""));
    _bsBeh = null; bsNacitajData(); return;
  }
  _bsBeh.i = dalsi;
  const mb = document.getElementById("modalBody"), on = document.getElementById("modal") && document.getElementById("modal").classList.contains("on");
  if (on && mb && mb.querySelector(".bs-beh")) mb.innerHTML = bsBehHtml(); else bsBehOtvor();
  bsPrekresli();
}

// ── správa plánu (TM, TTL) ──────────────────────────────────────
function bsRpcChyba(e){ return b2bVOkne(String((e && e.message) || e).replace(/^.*?ERROR:\s*/, "")); }
function bsFazaFormular(id){
  const P = bsPlan(), f = id ? (P.fazy || []).find(x => x.id === id) : null, ja = bsJa();
  const html = '<div class="bs-ok"><div class="bs-form"><label>Názov fázy *<input type="text" id="bsFz_n" maxlength="120" placeholder="napr. SIT, UAT, Regresia" value="' + esc(f ? f.nazov : "") + '"></label>' +
    '<div class="dva"><label>Od *<input type="date" id="bsFz_od" value="' + esc(f ? String(f.od).slice(0, 10) : bsDenStr(Date.now())) + '"></label><label>Do *<input type="date" id="bsFz_do" value="' + esc(f && f.do ? String(f.do).slice(0, 10) : "") + '"></label></div></div></div>';
  const zmaz = f && bsMaRolu(ja, ["tm"]) ? async () => {
    const d = prompt("Fáza sa nevymaže, len skryje (vykonania ostanú v histórii). Dôvod:"); if (!d) return false; if (d.trim().length < 5) return b2bVOkne("Dôvod napíšte aspoň piatimi znakmi.");
    try { await bsRpc("b2b_bs_faza_zmaz", { p_id: f.id, p_dovod: d.trim() }); } catch (e) { return bsRpcChyba(e); }
    oznamPas("Fáza skrytá · " + f.nazov); bsNacitajData(); return true;
  } : null;
  openModal(f ? "Upraviť fázu" : "Nová fáza", html, async () => {
    const nazov = document.getElementById("bsFz_n").value.trim(), od = document.getElementById("bsFz_od").value, d = document.getElementById("bsFz_do").value;
    if (!nazov || !od || !d) return b2bVOkne("Vyplňte názov, začiatok aj koniec fázy.");
    if (d < od) return b2bVOkne("Koniec fázy je skôr než začiatok.");
    const polia = { nazov, od, do: d };
    if (!f) polia.poradie = ((P.fazy || []).reduce((m, x) => Math.max(m, x.poradie || 0), 0)) + 1;
    try { await bsRpc("b2b_bs_faza_uloz", { p_podprojekt: BS.pp, p_id: f ? f.id : null, p_verzia: f ? f.verzia : null, p_polia: polia }); } catch (e) { return bsRpcChyba(e); }
    oznamPas(f ? "Fáza uložená" : "Fáza založená · " + nazov); bsNacitajData(); return true;
  }, zmaz, null, f ? "Uložiť" : "Založiť");
}
async function bsFazaUzavri(id, uzavriet){
  const f = (bsPlan().fazy || []).find(x => x.id === id); if (!f) return;
  const x = bsPlanO().fazy.find(y => y.f.id === id), K = x && x.kriteria;
  if (uzavriet && !confirm("Uzavrieť fázu „" + f.nazov + "“? Po uzavretí sa v nej už nedá vykonávať." + (K && K.vsetky && K.splnene < K.vsetky ? "\n\nSplnené exit kritériá: " + K.splnene + " z " + K.vsetky + "." : ""))) return;
  try { await bsRpc("b2b_bs_faza_uzavri", { p_id: id, p_uzavriet: !!uzavriet }); oznamPas((uzavriet ? "Fáza uzavretá · " : "Fáza znovu otvorená · ") + f.nazov); bsNacitajData(); }
  catch (e) { bsChyba(e, "Fázu sa nepodarilo " + (uzavriet ? "uzavrieť" : "otvoriť")); }
}
function bsKriteriaFormular(id){
  const f = (bsPlan().fazy || []).find(x => x.id === id); if (!f) return;
  const K = f.kriteria || {}, A = K.auto || {};
  const auto = BS_KRITERIA_AUTO.map(([k, t]) => k === "pass_rate"
    ? '<label class="bs-chk"><input type="checkbox" id="bsKr_pass_rate"' + (A.pass_rate != null && A.pass_rate !== false && A.pass_rate !== "" ? " checked" : "") + '> Pass rate fázy aspoň <input type="text" id="bsKr_prah" inputmode="decimal" style="width:64px" value="' + esc(A.pass_rate != null && A.pass_rate !== false && A.pass_rate !== "" ? bsDes(A.pass_rate) : "95") + '"> %</label>'
    : '<label class="bs-chk"><input type="checkbox" id="bsKr_' + k + '"' + (A[k] ? " checked" : "") + "> " + esc(t) + "</label>").join("");
  const rucne = (K.rucne || []).map(k => k.text).join("\n");
  const html = '<div class="bs-ok"><div class="bs-form"><div class="bs-kpi-l">AUTOMATICKÉ (z čísel Prehľadu)</div>' + auto +
    '<label>Ručné kritériá — jedno na riadok (potvrdzuje Test manager)<textarea id="bsKr_rucne" placeholder="napr. Akceptačný protokol podpísaný">' + esc(rucne) + "</textarea></label></div></div>";
  openModal("Exit kritériá · " + f.nazov, html, async () => {
    const auto = {}; ["otvorene_u1", "p1_vykonane", "incidenty_sla"].forEach(k => { if (document.getElementById("bsKr_" + k).checked) auto[k] = true; });
    if (document.getElementById("bsKr_pass_rate").checked) {
      const prah = parseFloat(document.getElementById("bsKr_prah").value.replace(",", "."));
      if (!(prah > 0 && prah <= 100)) return b2bVOkne("Prah pass rate zadajte ako číslo od 1 do 100.");
      auto.pass_rate = prah;
    }
    const stare = K.rucne || [];
    const texty = [...new Set(document.getElementById("bsKr_rucne").value.split(/\r?\n/).map(s => s.trim()).filter(Boolean))];
    if (texty.length > 50 || texty.some(x => x.length > 500)) return b2bVOkne("Ručných kritérií je najviac 50, každé najviac 500 znakov.");
    const rucne = texty.map(text => {
      const st = stare.find(k => k.text === text); return st ? { id: st.id, text } : { id: "k" + Math.random().toString(36).slice(2, 10), text };
    });
    try { await bsRpc("b2b_bs_faza_uloz", { p_podprojekt: BS.pp, p_id: f.id, p_verzia: f.verzia, p_polia: { kriteria: { auto, rucne } } }); } catch (e) { return bsRpcChyba(e); }
    oznamPas("Exit kritériá uložené · " + f.nazov); bsNacitajData(); return true;
  }, null, null, "Uložiť");
}
async function bsKriteriumPotvrd(fazaId, kid, splnene){
  try { await bsRpc("b2b_bs_kriterium_potvrd", { p_faza: fazaId, p_kriterium: kid, p_splnene: !!splnene }); oznamPas(splnene ? "Kritérium potvrdené" : "Potvrdenie zrušené"); bsNacitajData(); }
  catch (e) { bsChyba(e, "Kritérium sa nepodarilo zmeniť"); }
}
function bsTesteriMoznosti(vybrany){
  return '<option value="">nepridelený</option>' + bsOsoby().filter(o => (o.bs_role || []).some(r => BS_VYKON_ROLY.includes(r)) || o.spravca)
    .map(o => '<option value="' + o.id + '"' + (vybrany === o.id ? " selected" : "") + ">" + esc(o.meno) + "</option>").join("");
}
function bsPlanPridaj(fazaId){
  const O = bsPlanO(), x = O.fazy.find(y => y.f.id === fazaId); if (!x) return;
  const uz = new Set(x.riadky.map(rr => rr.s.id)), nast = bsNast();
  const volne = O.scenare.filter(y => !uz.has(y.s.id));
  if (!volne.length) return alert(O.scenare.length ? "Všetky scenáre knižnice už sú v tejto fáze." : "Knižnica scenárov je prázdna — najprv založte scenár v Testovacích scenároch.");
  const opt = (cis) => '<option value="">všetky</option>' + (nast[cis] || []).map(c => '<option value="' + esc(c.id) + '">' + esc(c.nazov) + "</option>").join("");
  const html = '<div class="bs-ok"><div class="bs-form"><div class="dva"><label>IS<select id="bsPp_is" onchange="bsPlanPridajFilter()">' + opt("is") + '</select></label><label>Modul<select id="bsPp_mod" onchange="bsPlanPridajFilter()">' + opt("moduly") + "</select></label></div>" +
    '<div id="bsPp_zoz" class="bs-pp">' + volne.map(y => '<label class="bs-chk" data-is="' + esc(y.s.is_id || "") + '" data-mod="' + esc(y.s.modul_id || "") + '"><input type="checkbox" value="' + y.s.id + '" checked> <small class="bs-kodm">' + esc(y.s.kod) + "</small> " + esc(y.s.nazov) +
      " <small>(" + bsPocet(y.pripady.length, "prípad", "prípady", "prípadov") + ")</small></label>").join("") + "</div>" +
    '<label>Tester<select id="bsPp_tester">' + bsTesteriMoznosti(null) + "</select></label></div></div>";
  openModal("Pridať scenáre · " + x.f.nazov, html, async () => {
    const ids = [...document.querySelectorAll("#bsPp_zoz label:not([hidden]) input:checked")].map(i => i.value);
    if (!ids.length) return b2bVOkne("Vyberte aspoň jeden scenár.");
    try { const r = await bsRpc("b2b_bs_plan_pridaj", { p_faza: fazaId, p_scenare: ids, p_tester: document.getElementById("bsPp_tester").value || null });
      oznamPas("Pridané do fázy: " + bsPocet((r && ((r.pridane || 0) + (r.obnovene || 0))) || ids.length, "scenár", "scenáre", "scenárov")); } catch (e) { return bsRpcChyba(e); }
    bsNacitajData(); return true;
  }, null, null, "Pridať");
}
function bsPlanPridajFilter(){
  const is = document.getElementById("bsPp_is").value, mod = document.getElementById("bsPp_mod").value;
  document.querySelectorAll("#bsPp_zoz label").forEach(l => { l.hidden = (is && l.dataset.is !== is) || (mod && l.dataset.mod !== mod); });
}
function bsPlanRiadok(planId){
  const n = bsNajdiRiadok(bsPlanO(), planId); if (!n) return;
  const r = n.rr.r;
  const html = '<div class="bs-ok"><div class="bs-form"><label>Tester<select id="bsPr_tester">' + bsTesteriMoznosti(r.tester_osoba) + "</select></label>" +
    '<label>Poradie vo fáze<input type="text" id="bsPr_por" inputmode="numeric" value="' + esc(String(r.poradie || "")) + '"></label>' +
    '<div class="bs-podobne">Odobratím zo fázy sa vykonania nestratia — po opätovnom pridaní sa vrátia.</div></div></div>';
  openModal(n.rr.s.kod + " · " + n.faza.f.nazov, html, async () => {
    const por = document.getElementById("bsPr_por").value.trim();
    try { await bsRpc("b2b_bs_plan_uprav", { p_plan: r.id, p_tester: document.getElementById("bsPr_tester").value || null, p_poradie: por ? parseInt(por, 10) : null }); } catch (e) { return bsRpcChyba(e); }
    oznamPas("Uložené · " + n.rr.s.kod); bsNacitajData(); return true;
  }, async () => {
    if (!confirm("Odobrať " + n.rr.s.kod + " z fázy " + n.faza.f.nazov + "?")) return false;
    try { await bsRpc("b2b_bs_plan_odober", { p_plan: r.id }); } catch (e) { return bsRpcChyba(e); }
    oznamPas("Odobraté zo fázy · " + n.rr.s.kod); bsNacitajData(); return true;
  }, null, "Uložiť");
}
function bsScenarFormular(id){
  const P = bsPlan(), s = id ? (P.scenare || []).find(x => x.id === id) : null, nast = bsNast();
  const sel = (k, cis, v) => (nast[cis] || []).length ? '<label>' + (cis === "is" ? "IS" : "Modul") + '<select id="bsSc_' + k + '"><option value=""></option>' + nast[cis].map(c => '<option value="' + esc(c.id) + '"' + (v === c.id ? " selected" : "") + ">" + esc(c.nazov) + "</option>").join("") + "</select></label>" : "";
  const html = '<div class="bs-ok"><div class="bs-form"><label>Názov scenára *<input type="text" id="bsSc_n" maxlength="300" placeholder="napr. Žiadosť o dávku" value="' + esc(s ? s.nazov : "") + '"></label>' +
    '<div class="dva">' + sel("is", "is", s && s.is_id) + sel("mod", "moduly", s && s.modul_id) + "</div>" +
    '<label>Priorita<select id="bsSc_pr">' + [1, 2, 3].map(p => '<option value="' + p + '"' + ((s ? +s.priorita : 2) === p ? " selected" : "") + ">P" + p + (p === 1 ? " — kritický tok" : p === 3 ? " — doplnkový" : "") + "</option>").join("") + "</select></label>" +
    '<label>Predpoklady<textarea id="bsSc_pp" placeholder="Čo musí platiť pred testom (rola, dáta, nastavenie)">' + esc(s ? s.predpoklady || "" : "") + "</textarea></label>" +
    (s ? "" : '<div class="bs-podobne">Kód scenára (TS-…) pridelí server; nemení sa a znova sa nepoužije.</div>') + "</div></div>";
  const zmaz = s ? async () => {
    const d = prompt("Scenár sa skryje z knižnice aj z plánu (kód sa znova nepoužije). Dôvod:"); if (!d) return false; if (d.trim().length < 5) return b2bVOkne("Dôvod napíšte aspoň piatimi znakmi.");
    try { await bsRpc("b2b_bs_scenar_zmaz", { p_id: s.id, p_dovod: d.trim() }); } catch (e) { return bsRpcChyba(e); }
    oznamPas("Scenár zmazaný · " + s.kod); BS.scenar = null; bsNacitajData(); return true;
  } : null;
  openModal(s ? "Upraviť · " + s.kod : "Nový scenár", html, async () => {
    const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
    const polia = { nazov: v("bsSc_n"), is_id: v("bsSc_is") || null, modul_id: v("bsSc_mod") || null, priorita: +v("bsSc_pr") || 2, predpoklady: v("bsSc_pp") || null };
    if (!polia.nazov) return b2bVOkne("Napíšte názov scenára.");
    let r; try { r = await bsRpc("b2b_bs_scenar_uloz", { p_podprojekt: BS.pp, p_id: s ? s.id : null, p_verzia: s ? s.verzia : null, p_polia: polia }); } catch (e) { return bsRpcChyba(e); }
    if (r && r.id) BS.scenar = r.id;
    oznamPas(s ? "Uložené · " + s.kod : "Založený scenár · " + ((r && r.kod) || polia.nazov)); bsNacitajData(); return true;
  }, zmaz, null, s ? "Uložiť" : "Založiť");
}
function bsPripadFormular(scenarId, id){
  const P = bsPlan(), s = (P.scenare || []).find(x => x.id === scenarId), p = id ? (P.pripady || []).find(x => x.id === id) : null; if (!s) return;
  const pozz = (BS.d.poziadavky || []).filter(q => q.aktivna !== false);
  const html = '<div class="bs-ok"><div class="bs-form"><label>Názov prípadu *<input type="text" id="bsPc_n" maxlength="300" placeholder="napr. Vyplnenie poľa Dátum" value="' + esc(p ? p.nazov : "") + '"></label>' +
    '<label>Postup<textarea id="bsPc_po" placeholder="Čo tester urobí">' + esc(p ? p.postup || "" : "") + "</textarea></label>" +
    '<label>Vstupné dáta<textarea id="bsPc_vs">' + esc(p ? p.vstup || "" : "") + "</textarea></label>" +
    '<label>Očakávaný výsledok<textarea id="bsPc_oc">' + esc(p ? p.ocakavane || "" : "") + "</textarea></label>" +
    (pozz.length ? '<label>Biznis požiadavka<select id="bsPc_poz"><option value=""></option>' + pozz.map(q => '<option value="' + q.id + '"' + (p && p.poziadavka_id === q.id ? " selected" : "") + ">" + esc(q.kod + " " + q.nazov) + "</option>").join("") + "</select></label>" : "") +
    (p ? '<div class="bs-podobne">Zmena textu zvýši verziu prípadu (teraz v' + (p.verzia || 1) + "); staršie vykonania si pamätajú svoju.</div>" : "") + "</div></div>";
  const zmaz = p ? async () => {
    const d = prompt("Prípad " + p.kod + " sa skryje (kód sa znova nepoužije). Dôvod:"); if (!d) return false; if (d.trim().length < 5) return b2bVOkne("Dôvod napíšte aspoň piatimi znakmi.");
    try { await bsRpc("b2b_bs_pripad_zmaz", { p_id: p.id, p_dovod: d.trim() }); } catch (e) { return bsRpcChyba(e); }
    oznamPas("Prípad zmazaný · " + p.kod); bsNacitajData(); return true;
  } : null;
  openModal((p ? "Upraviť · " + p.kod : "Nový prípad") + " · " + s.kod, html, async () => {
    const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : ""; };
    const polia = { nazov: v("bsPc_n"), postup: v("bsPc_po") || null, vstup: v("bsPc_vs") || null, ocakavane: v("bsPc_oc") || null, poziadavka_id: v("bsPc_poz") || null };
    if (!polia.nazov) return b2bVOkne("Napíšte názov prípadu.");
    let r; try { r = await bsRpc("b2b_bs_pripad_uloz", { p_scenar: s.id, p_id: p ? p.id : null, p_verzia: p ? p.verzia : null, p_polia: polia }); } catch (e) { return bsRpcChyba(e); }
    oznamPas(p ? "Uložené · " + p.kod : "Založený prípad · " + ((r && r.kod) || polia.nazov)); bsNacitajData(); return true;
  }, zmaz, null, p ? "Uložiť" : "Založiť");
}
async function bsPripadPosun(id, smer){
  const P = bsPlan(), p = (P.pripady || []).find(x => x.id === id); if (!p) return;
  const zoz = (P.pripady || []).filter(x => x.scenar_id === p.scenar_id && !x.zmazane).sort((a, b) => (a.poradie - b.poradie) || (a.cislo - b.cislo)).map(x => x.id);
  const i = zoz.indexOf(id), j = i + smer; if (j < 0 || j >= zoz.length) return;
  [zoz[i], zoz[j]] = [zoz[j], zoz[i]];
  try { await bsRpc("b2b_bs_pripad_poradie", { p_scenar: p.scenar_id, p_ids: zoz }); bsNacitajData(); }
  catch (e) { bsChyba(e, "Poradie sa nepodarilo uložiť"); }
}
function bsPripadPresun(id){
  const P = bsPlan(), p = (P.pripady || []).find(x => x.id === id); if (!p) return;
  const ine = (P.scenare || []).filter(s => !s.zmazane && s.id !== p.scenar_id).sort((a, b) => a.cislo - b.cislo);
  if (!ine.length) return alert("Iný scenár v knižnici nie je.");
  const html = '<div class="bs-ok"><div class="bs-form"><label>Cieľový scenár<select id="bsPs_c">' + ine.map(s => '<option value="' + s.id + '">' + esc(s.kod + " " + s.nazov) + "</option>").join("") + "</select></label>" +
    '<div class="bs-podobne">Prípad dostane v cieľovom scenári nový kód; pôvodný ' + esc(p.kod) + " sa skryje s odkazom na nový.</div></div></div>";
  openModal("Presunúť · " + p.kod, html, async () => {
    let r; try { r = await bsRpc("b2b_bs_pripad_presun", { p_id: p.id, p_scenar: document.getElementById("bsPs_c").value }); } catch (e) { return bsRpcChyba(e); }
    oznamPas("Presunuté · " + p.kod + (r && r.kod ? " → " + r.kod : "")); bsNacitajData(); return true;
  }, null, null, "Presunúť");
}
