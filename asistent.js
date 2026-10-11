// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — ASISTENT (panel + nástroje čítania) · spec kap. 155, kolo A3
//
//  Klasický skript načítaný lenivo z ezivnostnik.html (`asistentNacitaj`,
//  vzor navody.js) — beží v TOM ISTOM globálnom rozsahu ako appka a volá jej
//  funkcie priamo. Register nástrojov (asistent_nastroje.js, ESM) si načíta
//  sám cez import(). Konverzácia žije len v premenných (nie localStorage).
//
//  Pravidlá R1–R8 (155.1): model nič nepočíta a nič neukladá — nástroje
//  čítania vracajú {preModel, preKartu}: modelu stručne (najviac 15 riadkov,
//  bez IBAN a adries), karte celé (kľúče pre otvorSVyberom, akcie ako funkcie).
//  Nástroj druhu „ukaz“ otvorí modul alebo výber; návrhy a zápisy prídu v A4.
//
//  Panel #asistent NIE JE vrstva okien (oknoJeVrstva: z-index ≤ 80): keď sa
//  otvorí editor (#modal, z 80), okno musí vyhrať — panel dostane `inert` a po
//  zatvorení okna sa vráti. Vrstva nad oknom by editor zamkla (155.18 b. 6,
//  overené v kóde oknoVrstvy: vrchná vrstva je vždy tá s najvyšším z-index).
// ═══════════════════════════════════════════════════════════════════════════

const ASISTENT_MAX_KOL = 8;                 // 155.3.1 — strop aj na serveri
const ASISTENT_RIADKOV = 15;                // preModel: najviac riadkov (155.3.4)
const ASISTENT_FAZA = 1;                    // F1 — čítanie a ukáž

// Demo (O2): nahraté odpovede — model sa nevolá, nástroje bežia naostro nad
// demo firmou. Čísla sú len na karte (R2), text je všeobecný.
const ASISTENT_DEMO = [
  { veta: "Nájdi nezaplatené faktúry", kroky: [{ nastroj: "doklady", vstup: { typ: "faktura", stav: "neuhradene" } }],
    text: "Toto sú faktúry, ku ktorým appka nevidí úhradu. Ťuknite na „Zobraziť v appke“ a uvidíte ich v module Pohľadávky." },
  { veta: "Koľko som minul na PHM v auguste?", kroky: [{ nastroj: "doklady", vstup: { typ: "vydavok", palivo: true, obdobie: "2026-08" } }],
    text: "Tankovania za august — suma na karte je z dokladov, do základu dane sa započíta podľa nastavenia auta." },
  { veta: "Skontroluj august", kroky: [{ nastroj: "kontrola", vstup: { rozsah: "mesiac", obdobie: "2026-08" } }],
    text: "Kontrola mesiaca je hotová. Pri nálezoch sú tlačidlá, ktorými ich opravíte." },
  { veta: "Koľko DPH zaplatím za august?", kroky: [{ nastroj: "dph", vstup: { obdobie: "2026-08" } }],
    text: "Takto vychádza DPH za august z dokladov v appke, aj s termínom podania." },
  { veta: "Čo mám tento týždeň urobiť?", kroky: [{ nastroj: "upozornenia", vstup: {} }, { nastroj: "terminy", vstup: { mesiacov: 1 } }],
    text: "Toto čaká na vás v appke a toto sú najbližšie termíny." },
];

// ── stav panelu ─────────────────────────────────────────────────────────────
const _as = { otvoreny: false, bezi: false, historia: [], vysledky: {}, akcie: {}, cislo: 0, register: null, vetaId: null, kolo: 0 };

// ── pomôcky ─────────────────────────────────────────────────────────────────
function asDnesISO() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function asId(predpona) { _as.cislo++; return (predpona || "v") + _as.cislo; }
function asUuid() { try { return crypto.randomUUID(); } catch (_) { return "v-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10); } }
function asPartnerFaktury(f) { return typeof f.odberatel === "string" ? f.odberatel : ((f.odberatel && f.odberatel.nazov) || ""); }
function asOrez(riadky) { return { riadky: riadky.slice(0, ASISTENT_RIADKOV), orezane: riadky.length > ASISTENT_RIADKOV, celkom: riadky.length }; }
function asSum(pole, f) { return r2(pole.reduce((a, x) => a + (+f(x) || 0), 0)); }
// Obdobie z tokenu — jedno pravidlo (asistentObdobie, A0). Budúce = otázka (R6).
function asObdobie(token) {
  if (!token) return { O: null };
  const O = asistentObdobie(token);
  if (!O) return { chyba: "neznáme obdobie „" + token + "“ — použi token ako minuly_mesiac, 2026-09 alebo 2026-Q3" };
  if (O.buduce) return { otazka: "Obdobie " + O.nazov + " sa ešte nezačalo. Myslíte iný rok?" };
  return { O };
}
function asVMesiacoch(O, mk) { return !O || O.mesiace.includes(String(mk || "").slice(0, 7)); }
function asPartnerSedi(hladany, nazov, ico) {
  const h = String(hladany || "").trim(); if (!h) return true;
  if (/^\d{6,8}$/.test(h.replace(/\s/g, ""))) return String(ico || "").replace(/\s/g, "") === h.replace(/\s/g, "");
  return parNazvySedia(nazov || "", h) || hladajZhoda(h, nazov || "");
}
// Výsledok nástroja: modelu stručne, karte celé; výsledok ostáva pod id.
function asVysledok(preModel, preKartu) {
  const id = asId("v");
  preModel = Object.assign({ vysledok_id: id }, preModel);
  if (preKartu) { preKartu.id = id; _as.vysledky[id] = preKartu; }
  return { preModel, preKartu: preKartu || null };
}

// ── NÁSTROJE (F1) ───────────────────────────────────────────────────────────
// Každý: (vstup) → {preModel, preKartu}. Nič nezapisuje, nič neodosiela,
// nečíta okno. Výnimka „ukaz“: otvára modul/výber/doklad (navigácia).
const ASISTENT_VYKONAJ = {
  doklady(v) {
    v = v || {};
    const typ = v.typ === "faktura" ? "faktura" : "vydavok";
    const P = asObdobie(v.obdobie); if (P.chyba || P.otazka) return asVysledok(P);
    const dnes = asDnesISO();
    const zdroj = typ === "faktura" ? (firmaData.faktury || []) : (firmaData.vydavky || []);
    const riadky = [];
    zdroj.forEach((x, idx) => {
      const kluc = dokladKluc(x); if (!kluc) return;
      const datum = typ === "faktura" ? String(faktDatumDodania(x) || "") : String(x.datum || "");
      if (!asVMesiacoch(P.O, datum)) return;
      const partner = typ === "faktura" ? asPartnerFaktury(x) : (x.partner || "");
      if (!asPartnerSedi(v.partner, partner, x.ico)) return;
      const uhr = dokladJeUhradeny(typ, kluc);
      const poSplat = !uhr && x.splatnost && String(x.splatnost).slice(0, 10) < dnes;
      if (v.stav === "neuhradene" && uhr) return;
      if (v.stav === "uhradene" && !uhr) return;
      if (v.stav === "po_splatnosti" && !poSplat) return;
      if (typ === "vydavok" && v.kategoria && String(x.kategoria || "") !== String(v.kategoria)) return;
      if (typ === "vydavok" && v.palivo && !jePHL(x)) return;
      if (v.text && !hladajZhoda(v.text, x.cislo, partner, x.popis, x.variabilny, x.spolu)) return;
      riadky.push({ idx, kluc, cislo: x.cislo || "", partner, datum: datum.slice(0, 10), suma: r2(+x.spolu || +x.bez || 0),
        stav: uhr ? "uhradene" : (poSplat ? "po_splatnosti" : "neuhradene"), zostatok: uhr ? 0 : dokladZostava(typ, kluc),
        doZakladu: typ === "vydavok" ? r2(vydavokDoZakladu(x)) : undefined });
    });
    riadky.sort((a, b) => b.datum.localeCompare(a.datum));
    const o = asOrez(riadky);
    const preModel = { typ, pocet: riadky.length, sucet: asSum(riadky, r => r.suma), zostatok: asSum(riadky, r => r.zostatok),
      riadky: o.riadky.map(r => ({ kluc: r.kluc, cislo: r.cislo, partner: r.partner, datum: r.datum, suma: r.suma, stav: r.stav })), orezane: o.orezane };
    if (typ === "vydavok") preModel.doZakladu = asSum(riadky, r => r.doZakladu);
    const popis = (typ === "faktura" ? "Faktúry" : "Výdavky") + (P.O ? " · " + P.O.nazov : "") + (v.partner ? " · " + v.partner : "")
      + (v.stav ? " · " + v.stav.replace("_", " ") : "") + (v.palivo ? " · PHM" : "") + (v.text ? " · „" + v.text + "“" : "");
    return asVysledok(preModel, { nazov: popis, modul: typ === "faktura" ? "pohladavky" : "vydavky", kluce: riadky.map(r => r.kluc), celkom: riadky.length,
      riadky: riadky.map(r => [r.datum, r.cislo, r.partner, eur(r.suma), r.stav.replace("_", " ")]), hlavicka: ["Dátum", "Číslo", "Partner", "Suma", "Stav"],
      suhrn: [["Počet", String(riadky.length)], ["Spolu", eur(preModel.sucet)], ["Zostáva uhradiť", eur(preModel.zostatok)]]
        .concat(typ === "vydavok" ? [["Do základu dane", eur(preModel.doZakladu)]] : []) });
  },

  banka(v) {
    v = v || {};
    const P = asObdobie(v.obdobie); if (P.chyba || P.otazka) return asVysledok(P);
    const vsetky = firmaData.vypis || [];
    // R7: skryté a ignorované sa hlásia zvlášť, nikdy sa nefiltrujú ticho
    const mimo = { skryte: vsetky.filter(t => t.skryty).length, ignorovane: vsetky.filter(t => !t.skryty && jePohybIgnorovany(t)).length };
    const riadky = [];
    vsetky.forEach(t => {
      const datum = String(t.datum || "").slice(0, 10);
      if (!asVMesiacoch(P.O, datum)) return;
      if (v.smer && t.smer !== v.smer) return;
      if (v.partner && !hladajZhoda(v.partner, t.proti, t.popis, t.partner)) return;
      const st = pohybStav(t);
      const stav = v.stav || "nesparovane";
      if (stav === "skryte" && !t.skryty) return;
      if (stav === "ignorovane" && !(jePohybIgnorovany(t) && !t.skryty)) return;
      if (stav === "nesparovane" && (st.spar || t.skryty || jePohybIgnorovany(t))) return;
      if (stav === "ciastocne" && st.kod !== "ciastocny") return;
      if (stav === "navrh" && st.kod !== "navrh" && st.kod !== "klasifikovany") return;
      riadky.push({ kluc: txId(t), datum, smer: t.smer, suma: r2(+t.suma || 0), proti: t.proti || t.partner || "", popis: String(t.popis || "").slice(0, 60), stav: st.kod });
    });
    riadky.sort((a, b) => b.datum.localeCompare(a.datum));
    const o = asOrez(riadky);
    const preModel = { pocet: riadky.length, prijmy: asSum(riadky.filter(r => r.smer === "prijem"), r => r.suma), vydavky: asSum(riadky.filter(r => r.smer === "vydaj"), r => r.suma),
      mimo, riadky: o.riadky.map(r => ({ kluc: r.kluc, datum: r.datum, smer: r.smer, suma: r.suma, proti: r.proti, stav: r.stav })), orezane: o.orezane };
    const popis = "Banka · " + (v.stav || "nespárované") + (P.O ? " · " + P.O.nazov : "") + (v.smer ? " · " + v.smer : "");
    return asVysledok(preModel, { nazov: popis, modul: "banka", kluce: riadky.map(r => r.kluc), celkom: riadky.length,
      riadky: riadky.map(r => [r.datum, (r.smer === "prijem" ? "+" : "−") + eur(r.suma), r.proti, r.stav]), hlavicka: ["Dátum", "Suma", "Protistrana", "Stav"],
      suhrn: [["Pohybov", String(riadky.length)], ["Príjmy", eur(preModel.prijmy)], ["Výdavky", eur(preModel.vydavky)], ["Skryté / ignorované (mimo)", mimo.skryte + " / " + mimo.ignorovane]] });
  },

  doklady_bez_platby(v) {
    v = v || {};
    const P = asObdobie(v.obdobie); if (P.chyba || P.otazka) return asVysledok(P);
    let zoznam = dokladyBezPlatby(P.O ? { od: P.O.od, do: P.O.do } : null);
    if (v.typ) zoznam = zoznam.filter(k => k.typ === v.typ);
    let sKandidatom = 0;
    zoznam.slice(0, 60).forEach(k => { try { if ((platbyPreDoklad(k.typ, k.kluc).kand || []).length) sKandidatom++; } catch (_) {} });
    const riadky = zoznam.map(k => ({ typ: k.typ, kluc: k.kluc, cislo: k.z.cislo || "", partner: k.nazov, datum: k.datum.slice(0, 10), suma: r2(k.suma) }));
    const o = asOrez(riadky);
    const preModel = { pocet: riadky.length, sucet: asSum(riadky, r => r.suma), sKandidatomPlatby: sKandidatom, riadky: o.riadky, orezane: o.orezane };
    return asVysledok(preModel, { nazov: "Doklady bez platby" + (P.O ? " · " + P.O.nazov : ""), riadky: riadky.map(r => [r.datum, r.typ, r.cislo, r.partner, eur(r.suma)]),
      hlavicka: ["Dátum", "Typ", "Číslo", "Partner", "Suma"], suhrn: [["Počet", String(riadky.length)], ["Spolu", eur(preModel.sucet)], ["S možnou platbou v banke", String(sKandidatom)]],
      akcie: [{ l: "Otvoriť párovanie", fn: () => otvorSplit("banka", "doklady") }] });
  },

  kontrola(v) {
    v = v || {};
    const P = asObdobie(v.obdobie || (v.rozsah === "rok" ? "tento_rok" : "minuly_mesiac")); if (P.chyba || P.otazka) return asVysledok(P);
    const akcie = [];
    let nalezy = [];
    if (v.rozsah === "rok") {
      nalezy = rocnaKontrola(P.O.kod.slice(0, 4)).filter(n => !nalezSkryty("rocna", n.k)).map(n => ({ k: n.k, typ: n.zavaznost, text: n.t, detail: n.d, priklady: n.priklady || [], akcia: n.akcia }));
      nalezy.forEach(n => (n.akcia || []).forEach(a => akcie.push({ l: a.l, fn: a.fn })));
    } else if (v.rozsah === "dph") {
      const mk = P.O.kod; const K = kontrolaPredPodanim(mk, "dp");
      nalezy = (K.chyby || []).map(x => ({ typ: "chyba", text: x.text, detail: x.detail, zdrojId: x.zdrojId, blokuje: !!x.blokuje }))
        .concat((K.podozrenia || []).map(x => ({ typ: "pozor", text: x.text, detail: x.detail, zdrojId: x.zdrojId })));
      nalezy.forEach(n => { if (n.zdrojId) akcie.push({ l: "Opraviť: " + String(n.text).slice(0, 40), fn: "kvOpravDoklad(" + JSON.stringify(n.zdrojId) + ")" }); });
    } else {
      nalezy = (P.O.mesiace.length === 1 ? P.O.mesiace : [P.O.mesiace[P.O.mesiace.length - 1]])
        .flatMap(mk => uzavierkaKontroly(mk).filter(n => !nalezSkryty("mesiac", n.k)).map(n => ({ k: n.k, typ: n.typ, text: n.t, detail: n.d, mesiac: mk })));
    }
    const chyb = nalezy.filter(n => n.typ === "chyba").length;
    const o = asOrez(nalezy);
    const preModel = { rozsah: v.rozsah, obdobie: P.O.kod, nalezov: nalezy.length, chyb, upozorneni: nalezy.length - chyb,
      nalezy: o.riadky.map(n => ({ typ: n.typ, text: n.text, detail: n.detail ? String(n.detail).slice(0, 160) : undefined })), orezane: o.orezane };
    return asVysledok(preModel, { nazov: "Kontrola · " + v.rozsah + " · " + P.O.nazov, riadky: nalezy.map(n => [n.typ === "chyba" ? "⚠" : "ℹ", n.text + (n.detail ? " — " + n.detail : "")]),
      hlavicka: ["", "Nález"], suhrn: [["Nálezov", String(nalezy.length)], ["Chýb", String(chyb)]], akcie });
  },

  dph(v) {
    v = v || {};
    if (!jePlatcaDPH()) return asVysledok({ dostupne: false, dovod: "firma nie je platiteľ DPH" }, { nazov: "DPH", nedostupne: true, modul: "dph" });
    const P = asObdobie(v.obdobie || "minuly_mesiac"); if (P.chyba || P.otazka) return asVysledok(P);
    const kod = P.O.kod;
    if (/^\d{4}$/.test(kod)) return asVysledok({ otazka: "DPH sa podáva za mesiac alebo štvrťrok — ktoré obdobie roka " + kod + "?" });
    if (dphJeStvrtrocny(kod) && !P.O.kod.includes("Q")) {
      const m = +kod.slice(5, 7), q = Math.floor((m - 1) / 3) + 1;
      return asVysledok({ otazka: "Firma podáva DPH štvrťročne — " + P.O.nazov + " patrí do " + kod.slice(0, 4) + "-Q" + q + ". Mám ukázať celý štvrťrok?" , navrh: kod.slice(0, 4) + "-Q" + q });
    }
    const zber = dphZberObdobie(kod), S = dphSumare(zber);
    const T = dphTermin(kod), dni = dphDniDoTerminu(kod);
    const D = (firmaData.dph || {})[kod] || {};
    const preModel = { obdobie: kod, danovaPovinnost: r2(S.danovaPovinnost), danNaVystupe: r2(S.vystupDanCelkom), danNaVstupe: r2(S.vstupDanCelkom), dokladov: zber.length,
      termin: T ? T.toISOString().slice(0, 10) : null, dniDoTerminu: dni, druhPodania: dphDruhPodania(kod), exportVytvoreny: !!D.export, podane: !!D.podanie,
      chybajuceUdaje: dphMetaChyba("dp") };
    return asVysledok(preModel, { nazov: "DPH · " + P.O.nazov, modul: "dph",
      suhrn: [["Daňová povinnosť", eur(preModel.danovaPovinnost)], ["Daň na výstupe", eur(preModel.danNaVystupe)], ["Daň na vstupe", eur(preModel.danNaVstupe)],
        ["Dokladov", String(zber.length)], ["Termín", preModel.termin ? fmtDatum(preModel.termin) + (dni != null ? " (o " + dni + " dní)" : "") : "—"],
        ["Export", preModel.exportVytvoreny ? "vytvorený" : "ešte nie"]],
      akcie: [{ l: "Otvoriť DPH", fn: () => otvorApp("dph") }] });
  },

  jazdy(v) {
    v = v || {};
    const P = asObdobie(v.obdobie); if (P.chyba || P.otazka) return asVysledok(P);
    let zoznam = (firmaData.jazdy || []).map((j, i) => ({ j, i })).filter(({ j }) => asVMesiacoch(P.O, jazdaMonthKey(j)));
    if (v.bez_trasy) zoznam = zoznam.filter(({ j }) => !String(j.cesta || j.trasa || "").trim());
    if (v.bez_ucelu) zoznam = zoznam.filter(({ j }) => !String(j.ucel || "").trim());
    const riadky = zoznam.map(({ j, i }) => ({ idx: i, datum: j.datum || "", km: r2(+j.km || 0), trasa: String(j.cesta || j.trasa || ""), ucel: String(j.ucel || ""), sukromna: !!jazdaSukromna(j) }));
    const o = asOrez(riadky);
    const nalezy = jazdyKontrola().filter(n => !n.info).map(n => n.text);
    const preModel = { pocet: riadky.length, km: asSum(riadky, r => r.km), riadky: o.riadky.map(r => ({ idx: r.idx, datum: r.datum, km: r.km, trasa: r.trasa, ucel: r.ucel })), orezane: o.orezane, nalezyKnihy: nalezy.slice(0, 8) };
    const mk = P.O && P.O.mesiace.length === 1 ? P.O.mesiace[0] : "";
    return asVysledok(preModel, { nazov: "Jazdy" + (P.O ? " · " + P.O.nazov : "") + (v.bez_trasy ? " · bez trasy" : "") + (v.bez_ucelu ? " · bez účelu" : ""),
      riadky: riadky.map(r => [r.datum, String(r.km).replace(".", ",") + " km", r.trasa || "—", r.ucel]), hlavicka: ["Dátum", "Km", "Trasa", "Účel"],
      suhrn: [["Jázd", String(riadky.length)], ["Km", String(preModel.km).replace(".", ",")]],
      akcie: [{ l: "Otvoriť knihu jázd", fn: () => { if (mk) kjMesiac = mk; otvorApp("jazdy"); } }]
        .concat(v.bez_trasy && riadky.length ? [{ l: "✎ Doplniť trasy", fn: () => jazdyDoplnTrasyOkno(mk || undefined) }] : []) });
  },

  vykazy(v) {
    v = v || {};
    const P = asObdobie(v.obdobie); if (P.chyba || P.otazka) return asVysledok(P);
    const riadky = [];
    (firmaData.vykazy || []).forEach((w, idx) => {
      const m = vykazMesiac(w);
      if (!asVMesiacoch(P.O, m)) return;
      if (v.zakazka && !hladajZhoda(v.zakazka, w.zakazka, w.projekt)) return;
      const fi = vykazFakturaIdx(w), f = fi >= 0 ? (firmaData.faktury || [])[fi] : null;
      riadky.push({ idx, id: w.id || null, mesiac: m, stav: vykazStav(w), cld: r2(vykazClovekodni(w)), odberatel: (vykazOdberatel(w) || {}).nazov || "", zakazka: w.zakazka || "", projekt: w.projekt || "", faktura: f ? (f.cislo || "") : null });
    });
    riadky.sort((a, b) => String(b.mesiac).localeCompare(String(a.mesiac)));
    const o = asOrez(riadky);
    const preModel = { pocet: riadky.length, riadky: o.riadky, orezane: o.orezane };
    return asVysledok(preModel, { nazov: "Výkazy" + (P.O ? " · " + P.O.nazov : ""), riadky: riadky.map(r => [r.mesiac, r.zakazka || r.projekt, r.odberatel, String(r.cld).replace(".", ","), r.stav, r.faktura || "—"]),
      hlavicka: ["Mesiac", "Zákazka", "Odberateľ", "Čld", "Stav", "Faktúra"], akcie: riadky.slice(0, 5).map(r => ({ l: "Otvoriť výkaz " + r.mesiac, fn: () => editVykaz(r.idx) })) });
  },

  odberatelia(v) {
    v = v || {};
    const text = String(v.text || "").trim();
    const kand = odberateliaHistoria().filter(o => !text || asPartnerSedi(text, o.nazov, o.ico));
    const riadky = kand.slice(0, 10).map(o => {
      const posl = (firmaData.faktury || []).filter(f => f.typ !== "dobropis" && !(typeof opravujeDoklad === "function" && opravujeDoklad(f)) && asPartnerSedi(o.nazov, asPartnerFaktury(f), f.ico))
        .sort((a, b) => String(faktDatumDodania(b) || "").localeCompare(String(faktDatumDodania(a) || "")))[0];
      return { nazov: o.nazov, ico: o.ico || "", icdph: o.icdph || "", posledna: posl ? { kluc: dokladKluc(posl), cislo: posl.cislo || "", datum: String(faktDatumDodania(posl) || "").slice(0, 10), suma: r2(+posl.spolu || +posl.bez || 0) } : null };
    });
    const preModel = { pocet: kand.length, kandidati: riadky, jednoznacny: riadky.length === 1 };
    return asVysledok(preModel, { nazov: "Odberatelia" + (text ? " · „" + text + "“" : ""), riadky: riadky.map(r => [r.nazov, r.ico, r.posledna ? r.posledna.cislo + " · " + fmtDatum(r.posledna.datum) + " · " + eur(r.posledna.suma) : "bez faktúry"]),
      hlavicka: ["Odberateľ", "IČO", "Posledná faktúra"], akcie: [{ l: "Otvoriť faktúry", fn: () => otvorApp("faktury") }] });
  },

  terminy(v) {
    v = v || {};
    const n = Math.min(Math.max(+v.mesiacov || 3, 1), 6);
    const dnes = new Date();
    let zoz = danoveTerminy(dnes, firmaData.settings || {}, n) || [];
    try { if (typeof terminyStav === "function") zoz = terminyStav(zoz, dnes); } catch (_) {}
    const riadky = zoz.map(t => ({ datum: t.d instanceof Date ? t.d.toISOString().slice(0, 10) : String(t.d || "").slice(0, 10), typ: t.typ, nazov: t.nazov, detail: t.detail || "", hotovo: !!(t.stav && t.stav.hotovo) }))
      .sort((a, b) => a.datum.localeCompare(b.datum));
    const o = asOrez(riadky);
    return asVysledok({ pocet: riadky.length, mesiacov: n, terminy: o.riadky, orezane: o.orezane, poznamka: "kalendár FS (udalostiFS) sem nevstupuje" },
      { nazov: "Termíny · ďalších " + n + " mes.", riadky: riadky.map(r => [fmtDatum(r.datum), r.nazov + (r.detail ? " — " + r.detail : ""), r.hotovo ? "✓" : ""]), hlavicka: ["Dátum", "Termín", ""],
        akcie: [{ l: "Otvoriť kalendár", fn: () => otvorApp("kalendar") }] });
  },

  upozornenia() {
    const zoz = zbierNotifikacie() || [];
    const riadky = zoz.map(x => ({ kluc: x.kluc, nazov: x.nazov, detail: x.detail || "", nal: x.nal }));
    const o = asOrez(riadky);
    return asVysledok({ pocet: riadky.length, upozornenia: o.riadky.map(r => ({ nazov: r.nazov, detail: String(r.detail).slice(0, 160), nal: r.nal })), orezane: o.orezane },
      { nazov: "Upozornenia", riadky: riadky.map(r => [r.nal === "warn" ? "⚠" : "ℹ", r.nazov + (r.detail ? " — " + r.detail : "")]), hlavicka: ["", "Upozornenie"],
        akcie: zoz.slice(0, 6).filter(x => typeof x.akcia === "function").map(x => ({ l: x.nazov, fn: x.akcia })) });
  },

  async navody(v) {
    v = v || {};
    await navodyNacitaj();
    const text = String(v.text || "").trim();
    const vsetky = [];
    const M = (window.NAVODY && NAVODY.moduly) || {};
    Object.keys(M).forEach(modul => (M[modul].ulohy || []).forEach(u => vsetky.push({ modul, uloha: u.id, nazov: nvBezHtml(u.nazov || ""), kedy: nvBezHtml(u.kedy || "") })));
    let zhody = text ? vsetky.filter(u => hladajZhoda(text, u.nazov, u.kedy, u.modul)) : vsetky;
    const vyber = zhody.length ? zhody : vsetky;   // bez zhody dostane model celý zoznam názvov — vyberie sám (155.4.1)
    return asVysledok({ pocet: zhody.length, zhoda: !!zhody.length, navody: vyber.slice(0, zhody.length ? ASISTENT_RIADKOV : 80).map(u => ({ modul: u.modul, uloha: u.uloha, nazov: u.nazov })) },
      { nazov: "Návody" + (text ? " · „" + text + "“" : ""), riadky: zhody.slice(0, ASISTENT_RIADKOV).map(u => [u.nazov, u.kedy]), hlavicka: ["Návod", "Kedy"],
        akcie: zhody.slice(0, 6).map(u => ({ l: "Otvoriť: " + u.nazov, fn: () => otvorNavod(u.modul, u.uloha) })) });
  },

  ukaz(v) {
    v = v || {};
    const nedostupne = (modul) => asVysledok({ dostupne: false, modul, dovod: "modul nie je v pláne alebo pre túto firmu" }, { nazov: "Nedostupné", nedostupne: true, modul });
    if (v.vysledok_id) {
      const V = _as.vysledky[v.vysledok_id];
      if (!V) return asVysledok({ chyba: "neznáme vysledok_id" });
      // otvorSVyberom nič nevracia — pri odmietnutí modulu vráti `vyber` na predošlý
      if (V.modul && V.kluce) { otvorSVyberom(V.modul, V.kluce, V.nazov, V.celkom); if (!(typeof vyber === "object" && vyber && vyber.modul === V.modul)) return nedostupne(V.modul); return asVysledok({ otvorene: V.modul, pocet: V.kluce.length }); }
      if (V.modul) { if (!otvorApp(V.modul)) return nedostupne(V.modul); return asVysledok({ otvorene: V.modul }); }
      const prva = (V.akcie || [])[0]; if (prva) { asSpustAkciu(prva.fn); return asVysledok({ otvorene: prva.l }); }
      return asVysledok({ chyba: "výsledok sa nedá otvoriť" });
    }
    if (v.doklad && v.doklad.typ) {
      const d = v.doklad, kluc = String(d.kluc || "");
      if (d.typ === "faktura") { const i = (firmaData.faktury || []).findIndex(f => dokladKluc(f) === kluc); if (i < 0) return asVysledok({ chyba: "faktúra sa nenašla" }); editFaktura(i); return asVysledok({ otvorene: "faktura " + kluc }); }
      if (d.typ === "vydavok") { const i = (firmaData.vydavky || []).findIndex(x => dokladKluc(x) === kluc); if (i < 0) return asVysledok({ chyba: "výdavok sa nenašiel" }); editVydavok(i); return asVysledok({ otvorene: "vydavok " + kluc }); }
      if (d.typ === "pohyb") { otvorKartuPohybu(kluc); return asVysledok({ otvorene: "pohyb " + kluc }); }
      if (d.typ === "jazda") { const i = +kluc; if (!(firmaData.jazdy || [])[i]) return asVysledok({ chyba: "jazda sa nenašla" }); editJazda(i); return asVysledok({ otvorene: "jazda " + i }); }
      if (d.typ === "vykaz") { const i = /^\d+$/.test(kluc) ? +kluc : (firmaData.vykazy || []).findIndex(w => w.id === kluc); if (!(firmaData.vykazy || [])[i]) return asVysledok({ chyba: "výkaz sa nenašiel" }); editVykaz(i); return asVysledok({ otvorene: "vykaz " + i }); }
    }
    if (v.modul) {
      if (!APPS[v.modul]) return asVysledok({ chyba: "neznámy modul " + v.modul, moduly: Object.keys(APPS) });
      if (!otvorApp(v.modul)) return nedostupne(v.modul);
      if (v.prvok && typeof nvOtvorModul === "function") try { nvOtvorModul(v.modul, v.prvok); } catch (_) {}
      return asVysledok({ otvorene: v.modul });
    }
    return asVysledok({ chyba: "ukaz potrebuje vysledok_id, modul alebo doklad" });
  },
};

// Akcia karty: funkcia alebo reťazec volania appky (z nálezov kontroly) —
// spúšťa ju ČLOVEK klikom, nie model (155.4.1).
function asSpustAkciu(fn) {
  try {
    if (typeof fn === "function") return fn();
    if (typeof fn === "string") return (new Function(fn))();
  } catch (e) { console.error("asistent — akcia karty:", e); alert("Akciu sa nepodarilo spustiť: " + (e && e.message || e)); }
}

// ── kontext pre model (155.3.3) — bez mien partnerov a súm ──────────────────
function asKontext() {
  const plan = aktualnyPlan();
  return {
    dnes: asDnesISO(), plan, planNazov: (PLANY[plan] || {}).nazov || plan,
    rola: mojaRolaVFirme(), zapis: Object.keys(APPS).filter(m => { try { return mozemPisat(m); } catch (_) { return false; } }),
    pravnaForma: jeSpolocnost() ? "spolocnost" : "szco",
    dph: dphRegistracia(), dphObdobie: ((firmaData.settings || {}).dphObdobie === "stvrtrocne") ? "stvrtrocne" : "mesacne",
    moduly: Object.keys(APPS).filter(m => modulPovolenyPreModul(m)),
    rezim: demoMode ? "demo" : (offlineRezim ? "offline" : "cloud"),
  };
}

// ── panel ───────────────────────────────────────────────────────────────────
const ASISTENT_CSS = `
#asistent{position:fixed;z-index:70;background:var(--paper);color:var(--ink);border-left:1px solid var(--line);box-shadow:-6px 0 18px rgba(0,0,0,.12);display:none;flex-direction:column;font-size:14px}
#asistent.on{display:flex}
@media (min-width:900px){#asistent{top:0;right:0;bottom:0;width:380px}}
@media (max-width:899px){#asistent{left:0;right:0;bottom:0;top:0;border-left:0;border-top:1px solid var(--line);border-radius:14px 14px 0 0}}
#asistent .asHlava{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--bg)}
#asistent .asHlava b{font-size:15px}
#asistent .asHlava .sp{flex:1}
#asistent .asX{border:0;background:transparent;font-size:20px;cursor:pointer;color:var(--ink-soft);padding:2px 6px}
#asistent .asLog{flex:1;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
#asistent .asSprava{max-width:92%;padding:8px 11px;border-radius:12px;line-height:1.4;white-space:pre-wrap;word-break:break-word}
#asistent .asSprava.ja{align-self:flex-end;background:var(--brand-lite);border:1px solid var(--line)}
#asistent .asSprava.on{align-self:flex-start;background:var(--bg);border:1px solid var(--line)}
#asistent .asSprava.chyba{align-self:flex-start;background:var(--sfc-warn);border:1px solid var(--line)}
#asistent .asKarta{align-self:stretch;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--bg)}
#asistent .asKarta b.asNazov{display:block;margin-bottom:4px;font-size:13.5px}
#asistent .asKarta .asSuhrn{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:var(--ink-soft);margin-bottom:6px}
#asistent .asKarta .asSuhrn b{color:var(--ink)}
#asistent .asKarta table{width:100%;border-collapse:collapse;font-size:12px}
#asistent .asKarta th,#asistent .asKarta td{text-align:left;padding:3px 4px;border-top:1px solid var(--line-soft);vertical-align:top}
#asistent .asKarta th{color:var(--ink-soft);font-weight:600;border-top:0}
#asistent .asAkcie{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
#asistent .asNavrhy{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}
#asistent .asNavrhy button{font-size:12px}
#asistent .asVstup{display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--line);background:var(--bg)}
#asistent .asVstup textarea{flex:1;min-height:40px;max-height:120px;resize:none;border:1.5px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;background:var(--paper);color:inherit}
#asistent .asPozn{font-size:11.5px;color:var(--ink-soft);padding:0 12px 8px}
`;

function asPrvok() { return document.getElementById("asistent"); }
function asVytvor() {
  if (asPrvok()) return asPrvok();
  if (!document.getElementById("asistentCss")) { const s = document.createElement("style"); s.id = "asistentCss"; s.textContent = ASISTENT_CSS; document.head.appendChild(s); }
  const el = document.createElement("div");
  el.id = "asistent"; el.setAttribute("role", "complementary"); el.setAttribute("aria-label", "Asistent");
  el.innerHTML = `
    <div class="asHlava"><span aria-hidden="true">✦</span><b>Asistent</b><span class="sp"></span>
      <button class="asX" onclick="ASISTENT.zavri()" title="Zavrieť" aria-label="Zavrieť asistenta">✕</button></div>
    <div class="asLog" id="asLog" role="log" aria-live="polite" data-scroll="asLog"></div>
    <div class="asNavrhy" id="asNavrhy"></div>
    <div class="asPozn" id="asPozn"></div>
    <div class="asVstup">
      <textarea id="asVstup" rows="1" placeholder="Napíšte, čo treba urobiť… (Enter odošle)" onkeydown="ASISTENT.klaves(event)"></textarea>
      <button class="aabtn pri" id="asPosli" onclick="ASISTENT.posliZPola()">Poslať</button>
    </div>`;
  document.body.appendChild(el);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && _as.otvoreny && !document.querySelector(".modal.on")) ASISTENT.zavri(); });
  return el;
}
function asPridaj(html, trieda) {
  const log = document.getElementById("asLog"); if (!log) return;
  const d = document.createElement("div"); d.className = trieda || "asKarta"; d.innerHTML = html; log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}
function asSprava(text, kto) { return asPridaj(esc(text), "asSprava " + (kto || "on")); }
function asKartaHtml(K) {
  if (!K) return "";
  if (K.nedostupne) return `<b class="asNazov">${esc(K.nazov)}</b><div style="font-size:12.5px">Tento modul nie je vo vašom pláne alebo pre túto firmu.</div>${typeof planyModuluHtml === "function" && K.modul ? `<div style="margin-top:6px">${planyModuluHtml(K.modul)}</div>` : ""}`;
  let h = `<b class="asNazov">${esc(K.nazov || "Výsledok")}</b>`;
  if (K.suhrn && K.suhrn.length) h += `<div class="asSuhrn">${K.suhrn.map(([l, v]) => `<span>${esc(l)}: <b>${esc(v)}</b></span>`).join("")}</div>`;
  if (K.riadky && K.riadky.length) {
    const vid = K.riadky.slice(0, ASISTENT_RIADKOV);
    h += `<table>${K.hlavicka ? `<tr>${K.hlavicka.map(x => `<th>${esc(x)}</th>`).join("")}</tr>` : ""}${vid.map(r => `<tr>${r.map(c => `<td>${esc(String(c == null ? "" : c))}</td>`).join("")}</tr>`).join("")}</table>`;
    if (K.riadky.length > vid.length) h += `<div style="font-size:12px;color:var(--ink-soft);margin-top:4px">Ukazujem ${vid.length} z ${K.riadky.length} — zvyšok v appke.</div>`;
  } else if (K.riadky) h += `<div style="font-size:12.5px;color:var(--ink-soft)">Nič sa nenašlo.</div>`;
  const akcie = [];
  if (K.modul && K.kluce && K.kluce.length) akcie.push({ l: "Zobraziť v appke (" + K.kluce.length + ")", fn: () => otvorSVyberom(K.modul, K.kluce, K.nazov, K.celkom) });
  else if (K.modul && !K.kluce) akcie.push({ l: "Otvoriť modul", fn: () => otvorApp(K.modul) });
  (K.akcie || []).forEach(a => akcie.push(a));
  if (akcie.length) h += `<div class="asAkcie">${akcie.map(a => { const id = asId("a"); _as.akcie[id] = a.fn; return `<button class="aabtn" style="padding:5px 9px;font-size:12px" onclick="ASISTENT.akcia('${id}')">${esc(a.l)}</button>`; }).join("")}</div>`;
  return h;
}
function asNavrhy() {
  const box = document.getElementById("asNavrhy"); if (!box) return;
  // N1 (155.13): návrhy bez modelu — z upozornení a termínov, a pár stálych
  let vety = [];
  if (demoMode) vety = ASISTENT_DEMO.map(d => d.veta);
  else {
    try { (zbierNotifikacie() || []).slice(0, 2).forEach(n => vety.push(n.nazov)); } catch (_) {}
    try { const T = danoveTerminy(new Date(), firmaData.settings || {}, 1) || []; if (T[0]) vety.push("Kedy mám " + String(T[0].nazov || "podať ďalší termín").toLowerCase() + "?"); } catch (_) {}
    ["Nájdi nezaplatené výdavky po splatnosti", "Skontroluj minulý mesiac", "Koľko mi dlhujú odberatelia?"].forEach(v => vety.push(v));
  }
  vety = [...new Set(vety)].slice(0, 5);
  box.innerHTML = vety.map(v => `<button class="aabtn" onclick="ASISTENT.posli(${JSON.stringify(v).replace(/"/g, "&quot;")})">${esc(v)}</button>`).join("");
  box.style.display = _as.historia.length ? "none" : "";
}
function asPoznamka() {
  const p = document.getElementById("asPozn"); if (!p) return;
  if (demoMode) p.textContent = "Ukážka: asistent vie tieto príkazy nad ukážkovou firmou, nič sa neposiela ani neukladá. Plný asistent je po registrácii.";
  else if (offlineRezim) p.textContent = "Asistent potrebuje internet. Zatiaľ použite hľadanie v appke.";
  else p.textContent = "Asistent číta vaše dáta len cez funkcie appky a nič neukladá — každý zápis potvrdíte vy. Čo sa posiela: Nastavenia → Ochrana údajov.";
}

// ── slučka s modelom (155.3) ────────────────────────────────────────────────
async function asKrokModelu(beh) {
  const telo = { veta_id: _as.vetaId, kolo: _as.kolo, historia: _as.historia, kontext: asKontext(), faza: ASISTENT_FAZA, register_verzia: _as.register ? _as.register.REGISTER_VERZIA : undefined };
  const r = await edgeFunkciaVolaj("asistent", "krok", telo);
  if (!beh.platny()) throw Object.assign(new Error("Medzitým ste otvorili inú firmu — asistent sa zastavil."), { kod: "firma" });
  return r;
}
async function asVykonajNastroje(bloky) {
  const vysledky = [];
  for (const b of bloky) {
    let out;
    try {
      const f = ASISTENT_VYKONAJ[b.name];
      if (!f) out = { preModel: { chyba: "nástroj " + b.name + " v tejto verzii nie je" } };
      else out = await f(b.input || {});
    } catch (e) { console.error("asistent — nástroj " + b.name + ":", e); out = { preModel: { chyba: "nástroj zlyhal: " + (e && e.message || e) } }; }
    if (out && out.preKartu) asPridaj(asKartaHtml(out.preKartu), "asKarta");
    vysledky.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out ? out.preModel : {}) });
  }
  return vysledky;
}
async function asBehCloud(veta) {
  const beh = behFirmy();
  if (!_as.register) {
    try { _as.register = await import("./asistent_nastroje.js?v=" + encodeURIComponent(APP_VERZIA)); }
    catch (e) { console.error("asistent — register:", e); asSprava("Register nástrojov sa nenačítal — skúste o chvíľu.", "chyba"); return; }
  }
  _as.vetaId = asUuid(); _as.kolo = 1;
  _as.historia.push({ role: "user", content: veta });
  const cakam = asSprava("…", "on");
  try {
    while (_as.kolo <= ASISTENT_MAX_KOL) {
      const r = await asKrokModelu(beh);
      const obsah = Array.isArray(r.obsah) ? r.obsah : [];
      _as.historia.push({ role: "assistant", content: obsah });
      obsah.filter(b => b.type === "text" && b.text && b.text.trim()).forEach(b => asSprava(b.text.trim(), "on"));
      if (r.stop === "refusal") { asSprava("Na toto asistent odpovedať nemôže. Skúste to povedať inak alebo použite appku priamo.", "chyba"); break; }
      const pouzitia = obsah.filter(b => b.type === "tool_use");
      if (!pouzitia.length || r.stop !== "tool_use") { if (r.stop === "max_tokens") asSprava("Odpoveď bola odseknutá — napíšte „pokračuj“.", "chyba"); break; }
      const vysledky = await asVykonajNastroje(pouzitia);
      if (!beh.platny()) throw Object.assign(new Error("Medzitým ste otvorili inú firmu — asistent sa zastavil."), { kod: "firma" });
      _as.historia.push({ role: "user", content: vysledky });
      _as.kolo++;
    }
    if (_as.kolo > ASISTENT_MAX_KOL) asSprava("Nedokončil som to v " + ASISTENT_MAX_KOL + " krokoch — tu je, kam som sa dostal. Skúste užšiu otázku.", "chyba");
  } catch (e) {
    console.error("asistent:", e);
    const kod = e && e.kod, stav = e && e.stav;
    let txt = "Asistent neodpovedal: " + (e && e.message || e);
    if (stav === 403) txt = "Asistent nie je vo vašom pláne.";
    else if (stav === 429) txt = /denn/i.test(e.message || "") ? "Dnešný limit viet je vyčerpaný — pokračujte zajtra." : "Rozpočet asistenta pre túto firmu je na 30 dní vyčerpaný.";
    else if (stav === 409) txt = "Asistent sa práve aktualizuje — obnovte stránku a skúste znova.";
    else if (stav === 413) txt = "Konverzácia je pridlhá — zavrite asistenta a začnite novú.";
    else if (kod === "firma") txt = e.message;
    asSprava(txt, "chyba");
  } finally { if (cakam && cakam.parentNode && cakam.textContent === "…") cakam.remove(); }
}
async function asBehDemo(veta) {
  _as.historia.push({ role: "user", content: veta });
  const d = ASISTENT_DEMO.find(x => x.veta.toLowerCase() === String(veta || "").trim().toLowerCase());
  if (!d) { asSprava("V ukážke viem tieto príkazy (tlačidlá hore). Plný asistent, ktorý rozumie vlastným vetám, je po registrácii.", "on"); return; }
  for (const k of d.kroky) {
    try { const out = await ASISTENT_VYKONAJ[k.nastroj](k.vstup || {}); if (out && out.preKartu) asPridaj(asKartaHtml(out.preKartu), "asKarta"); }
    catch (e) { console.error("asistent demo:", e); asSprava("Nástroj zlyhal: " + (e && e.message || e), "chyba"); }
  }
  asSprava(d.text, "on");
  _as.historia.push({ role: "assistant", content: d.text });
}

const ASISTENT = {
  otvor(veta) {
    const el = asVytvor();
    el.classList.add("on"); _as.otvoreny = true;
    asNavrhy(); asPoznamka();
    const v = document.getElementById("asVstup");
    if (veta) { v.value = veta; ASISTENT.posliZPola(); } else if (window.innerWidth >= 900) v.focus();
  },
  zavri() { const el = asPrvok(); if (el) el.classList.remove("on"); _as.otvoreny = false; },
  nova() { _as.historia = []; _as.vysledky = {}; _as.akcie = {}; const log = document.getElementById("asLog"); if (log) log.innerHTML = ""; asNavrhy(); },
  klaves(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ASISTENT.posliZPola(); } },
  posliZPola() { const v = document.getElementById("asVstup"); const t = (v.value || "").trim(); if (!t) return; v.value = ""; ASISTENT.posli(t); },
  async posli(veta) {
    veta = String(veta || "").trim(); if (!veta || _as.bezi) return;
    if (!_as.otvoreny) ASISTENT.otvor();
    const btn = document.getElementById("asPosli");
    _as.bezi = true; if (btn) btn.disabled = true;
    asSprava(veta, "ja");
    const nav = document.getElementById("asNavrhy"); if (nav) nav.style.display = "none";
    try {
      // Demo je zároveň lokálny režim (spustiDemo) — preto ide prvé.
      if (demoMode) await asBehDemo(veta);
      else if (localMode) asSprava("V lokálnom režime asistent nie je — nič sa neposiela na server.", "chyba");
      else if (offlineRezim) asSprava("Asistent potrebuje internet. Zatiaľ použite hľadanie v appke (lupa hore).", "chyba");
      else await asBehCloud(veta);
    } finally { _as.bezi = false; if (btn) btn.disabled = false; }
  },
  akcia(id) { const fn = _as.akcie[id]; if (fn) asSpustAkciu(fn); },
  // pre testy, e2e a eval: nástroj priamo (bez modelu)
  vykonaj(meno, vstup) { const f = ASISTENT_VYKONAJ[meno]; if (!f) throw new Error("neznámy nástroj " + meno); return f(vstup || {}); },
  kontext: asKontext,
  VYKONAJ: ASISTENT_VYKONAJ,
  stav: _as,
};
window.ASISTENT = ASISTENT;
