// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — REGISTER NÁSTROJOV ASISTENTA (spec kap. 155.4, kolo A3)
//
//  JEDEN súbor pre appku aj server: appka ho načíta lenivo (import() z
//  asistent.js), edge funkcia `asistent` cez esm.sh/gh. Súbor je VEREJNÝ —
//  žiadne ostré mená, príklady len z dema (Kaviareň Zrnko & Para…).
//
//  Tvar položky:
//    meno     — meno nástroja pre model (snake_case, stabilné)
//    druh     — "citanie" | "ukaz" | "navrh" | "zapis_karta"   (155.4)
//    faza     — 1 | 2 | 3                                          (155.12)
//    aktivny  — len aktívne nástroje idú modelu (F1 v kole A3; F2/F3 pribudnú)
//    model    — "rychly" | "silny" — ktorý model server použije (155.10)
//    moduly   — moduly, ktoré nástroj potrebuje (filter cez modulPovolenyPreModul)
//    zapis    — modul pre strazZapis/mozemPisat (len navrh a zapis_karta)
//    popis    — text pre model, po slovensky, krátko a presne
//    vstup    — JSON schéma (input_schema); additionalProperties:false dopĺňa
//               nastrojePreModel, aby model neposielal polia, ktoré nástroj nepozná
//
//  Implementácie (ASISTENT_VYKONAJ) sú v asistent.js — test_asistent_register
//  stráži zhodu oboch zoznamov. Bundler edge funkcie tento súbor ZMRAZÍ pri
//  nasadení: zmena = zvýšiť REGISTER_VERZIA a nasadiť `asistent` (155.18 b. 2).
// ═══════════════════════════════════════════════════════════════════════════

export const REGISTER_VERZIA = "2026-10-15.1";

const OBDOBIE = {
  type: "string",
  description:
    "Obdobie: tento_mesiac, minuly_mesiac, tento_stvrtrok, minuly_stvrtrok, tento_rok, minuly_rok, RRRR-MM, RRRR-Qn alebo RRRR. Dátum si nedomýšľaj — pošli token, appka ho prepočíta.",
};
const VYSLEDOK = { type: "string", description: "vysledok_id z predošlého výsledku nástroja" };

export const ASISTENT_NASTROJE = [
  // ── F1: čítanie ─────────────────────────────────────────────────────────
  {
    meno: "doklady", druh: "citanie", faza: 1, aktivny: true, model: "rychly",
    moduly: ["faktury", "vydavky"],
    popis:
      "Vyhľadá vystavené faktúry alebo výdavky podľa partnera, obdobia, stavu úhrady, kategórie alebo textu. Vráti počet, súčet, súčet zostatku a najviac 15 riadkov. Sumy a stavy počíta appka — nepočítaj ich sám.",
    vstup: {
      type: "object",
      properties: {
        typ: { type: "string", enum: ["faktura", "vydavok"] },
        partner: { type: "string", description: "názov alebo IČO odberateľa/dodávateľa" },
        obdobie: OBDOBIE,
        stav: { type: "string", enum: ["neuhradene", "po_splatnosti", "uhradene"] },
        kategoria: { type: "string", description: "kľúč kategórie výdavku (napr. sluzby, prevadzka)" },
        palivo: { type: "boolean", description: "len výdavky za pohonné hmoty (pravidlo appky, nie kategória)" },
        text: { type: "string" },
      },
      required: ["typ"],
    },
  },
  {
    meno: "banka", druh: "citanie", faza: 1, aktivny: true, model: "rychly", moduly: ["banka"],
    popis:
      "Bankové pohyby podľa obdobia a stavu párovania. Vždy vráti aj počet skrytých a ignorovaných pohybov zvlášť. Čísla účtov nevracia.",
    vstup: {
      type: "object",
      properties: {
        obdobie: OBDOBIE,
        stav: { type: "string", enum: ["nesparovane", "ciastocne", "navrh", "skryte", "ignorovane", "vsetky"] },
        smer: { type: "string", enum: ["prijem", "vydaj"] },
        partner: { type: "string" },
      },
    },
  },
  {
    meno: "doklady_bez_platby", druh: "citanie", faza: 1, aktivny: true, model: "rychly", moduly: ["banka"],
    popis: "Faktúry a výdavky, ku ktorým nie je úhrada, a koľko z nich má v banke možnú platbu.",
    vstup: { type: "object", properties: { obdobie: OBDOBIE, typ: { type: "string", enum: ["faktura", "vydavok"] } } },
  },
  {
    meno: "kontrola", druh: "citanie", faza: 1, aktivny: true, model: "rychly", moduly: [],
    popis:
      "Spustí kontroly appky: mesiac (uzávierka), rok (ročná kontrola) alebo dph (kontrola pred podaním). Vráti nálezy. Opravy robí človek tlačidlami na karte — ty ich nespúšťaš.",
    vstup: {
      type: "object",
      properties: { rozsah: { type: "string", enum: ["mesiac", "rok", "dph"] }, obdobie: OBDOBIE },
      required: ["rozsah"],
    },
  },
  {
    meno: "dph", druh: "citanie", faza: 1, aktivny: true, model: "rychly", moduly: ["dph"],
    popis:
      "Stav DPH za obdobie: povinnosť, daň na výstupe a vstupe, počty dokladov, termín podania, či je vygenerovaný export. Pri štvrťročnom platiteľovi mesiac nie je obdobie DPH — appka to povie.",
    vstup: { type: "object", properties: { obdobie: OBDOBIE }, required: ["obdobie"] },
  },
  {
    meno: "jazdy", druh: "citanie", faza: 1, aktivny: true, model: "rychly", moduly: ["jazdy"],
    popis: "Jazdy v knihe jázd za obdobie, voliteľne len bez trasy alebo bez účelu, a nálezy kontroly knihy.",
    vstup: {
      type: "object",
      properties: { obdobie: OBDOBIE, bez_trasy: { type: "boolean" }, bez_ucelu: { type: "boolean" } },
    },
  },
  {
    meno: "vykazy", druh: "citanie", faza: 1, aktivny: true, model: "rychly", moduly: ["vykazy"],
    popis: "Výkazy prác: kluc, obdobie od–do, stav (návrh, odoslaný, podpísaný, vyfakturovaný), človekodne, odberateľ, prepojená faktúra. Obdobie výkazu ber z od–do, nie z mesiaca.",
    vstup: { type: "object", properties: { obdobie: OBDOBIE, zakazka: { type: "string" } } },
  },
  {
    meno: "odberatelia", druh: "citanie", faza: 1, aktivny: true, model: "rychly", moduly: ["faktury"],
    popis:
      "Nájde odberateľov podľa časti názvu alebo IČO a ich poslednú faktúru. Ak vráti viac kandidátov, opýtaj sa človeka, ktorého myslí.",
    vstup: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    meno: "terminy", druh: "citanie", faza: 1, aktivny: true, model: "rychly", moduly: [],
    popis: "Najbližšie daňové a vlastné termíny (DPH, KV, preddavky, daň z motorových vozidiel).",
    vstup: { type: "object", properties: { mesiacov: { type: "integer", minimum: 1, maximum: 6 } } },
  },
  {
    meno: "upozornenia", druh: "citanie", faza: 1, aktivny: true, model: "rychly", moduly: [],
    popis: "Aktuálne upozornenia appky (zvonček): čo čaká, čo mešká, čo appka urobila.",
    vstup: { type: "object", properties: {} },
  },
  {
    meno: "navody", druh: "citanie", faza: 1, aktivny: true, model: "rychly", moduly: ["navody"],
    popis: "Nájde návod v appke k otázke typu „ako…“. Vráti modul, úlohu a názov; karta ponúkne otvorenie návodu.",
    vstup: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  },
  {
    meno: "ukaz", druh: "ukaz", faza: 1, aktivny: true, model: "rychly", moduly: [],
    popis:
      "Otvorí v appke výsledok predošlého nástroja (vysledok_id), modul alebo konkrétny doklad. Nič nemení.",
    vstup: {
      type: "object",
      properties: {
        vysledok_id: VYSLEDOK,
        modul: { type: "string" },
        prvok: { type: "string" },
        doklad: {
          type: "object",
          properties: {
            typ: { type: "string", enum: ["faktura", "vydavok", "pohyb", "jazda", "vykaz"] },
            kluc: { type: "string" },
          },
          required: ["typ", "kluc"],
        },
      },
    },
  },

  // ── F2: návrhy (otvoria formulár, uloží človek) — kolo A4 ───────────────
  {
    meno: "navrh_faktury", druh: "navrh", faza: 2, aktivny: false, model: "rychly", moduly: ["faktury"], zapis: "faktury",
    popis:
      "Pripraví novú faktúru ako kópiu vzoru (posledná faktúra odberateľa alebo zadané číslo) s úpravami a otvorí ju v editore. Uloží ju človek. Sumy prepočíta appka.",
    vstup: {
      type: "object",
      properties: {
        vzor: {
          type: "object",
          properties: { odberatel: { type: "string" }, cislo: { type: "string" } },
        },
        clovekodni: { type: "number", description: "počet do položky s mernou jednotkou človekodeň" },
        polozky: {
          type: "array",
          items: {
            type: "object",
            properties: { nazov: { type: "string" }, mn: { type: "number" }, mj: { type: "string" }, cena: { type: "number" } },
            required: ["mn"],
          },
        },
        vystavenie: { type: "string", description: "dnes alebo RRRR-MM-DD" },
        dodanie: { type: "string", description: "dnes, posledny_den_minuleho_mesiaca alebo RRRR-MM-DD" },
        splatnost_dni: { type: "integer", minimum: 0, maximum: 120 },
        popis: { type: "string" },
      },
      required: ["vzor"],
    },
  },
  {
    meno: "vykaz_z_kalendara", druh: "navrh", faza: 2, aktivny: false, model: "rychly", moduly: ["vykazy"], zapis: "vykazy",
    popis: "Z pripojeného kalendára (ICS) otvorí sprievodcu výkazu za mesiac. Stretnutia odškrtne a potvrdí človek.",
    vstup: { type: "object", properties: { subor_id: { type: "string" }, mesiac: OBDOBIE }, required: ["subor_id"] },
  },
  {
    meno: "protokol", druh: "zapis_karta", faza: 2, aktivny: true, model: "rychly", moduly: ["vykazy"], zapis: "vykazy",
    popis: "Ukáže náhľad akceptačného protokolu k výkazu (číslo, obdobie, človekodne, suma); zapíše ho človek tlačidlom na karte. Protokol je vždy za celé obdobie výkazu — za časť obdobia najprv rozdel_vykaz.",
    vstup: { type: "object", properties: { vykaz: { type: "string", description: "kluc výkazu z nástroja vykazy" } }, required: ["vykaz"] },
  },
  {
    meno: "faktura_z_vykazu", druh: "navrh", faza: 2, aktivny: true, model: "rychly", moduly: ["vykazy", "faktury"], zapis: "faktury",
    popis: "Otvorí editor faktúry predvyplnený z výkazu (človekodne × sadzba zákazky, dodanie = koniec obdobia výkazu). Uloží ho človek. Faktúra je vždy za celé obdobie výkazu — za časť obdobia najprv rozdel_vykaz.",
    vstup: { type: "object", properties: { vykaz: { type: "string", description: "kluc výkazu z nástroja vykazy" } }, required: ["vykaz"] },
  },
  {
    meno: "rozdel_vykaz", druh: "zapis_karta", faza: 2, aktivny: true, model: "rychly", moduly: ["vykazy"], zapis: "vykazy",
    popis: "Ukáže, ako by sa výkaz rozdelil k dátumu: dni do dátumu ostanú vo výkaze, dni po ňom prejdú do nového výkazu (polmesačná fakturácia). Rozdelí ho človek tlačidlom na karte; potom ponúkne faktúru a protokol za prvú časť.",
    vstup: {
      type: "object",
      properties: { vykaz: { type: "string", description: "kluc výkazu z nástroja vykazy" }, do: { type: "string", description: "posledný deň prvej časti, RRRR-MM-DD — z vety človeka, nedomýšľaj" } },
      required: ["vykaz", "do"],
    },
  },
  {
    meno: "email_k_vykazu", druh: "navrh", faza: 2, aktivny: false, model: "rychly", moduly: ["vykazy"], zapis: "vykazy",
    popis:
      "Otvorí okno e-mailu s výkazom, protokolom a faktúrou. Ak faktúra alebo adresát chýba, vráti, čo chýba, a okno neotvorí. Odoslanie robí človek.",
    vstup: { type: "object", properties: { vykaz: { type: "string" } }, required: ["vykaz"] },
  },
  {
    meno: "dokument", druh: "navrh", faza: 2, aktivny: false, model: "rychly", moduly: ["dokumenty"], zapis: "dokumenty",
    popis: "Otvorí formulár dokumentu s pripojeným súborom a predvyplnenými údajmi (aj zákazkový list). Uloží človek.",
    vstup: {
      type: "object",
      properties: {
        subor_id: { type: "string" },
        typ: { type: "string", description: "typ dokumentu z appky (napr. Zmluva, Zákazkový list)" },
        partner: { type: "string" },
        platnost_od: { type: "string" },
        platnost_do: { type: "string" },
        zakazka: {
          type: "object",
          properties: {
            cislo: { type: "string" }, projekt: { type: "string" }, sadzba: { type: "number" },
            ico: { type: "string" }, icdph: { type: "string" }, dic: { type: "string" },
            adresa: { type: "string" }, schvalil: { type: "string" }, email: { type: "string" },
          },
        },
      },
      required: ["subor_id", "typ"],
    },
  },
  {
    meno: "precitaj_subor", druh: "citanie", faza: 2, aktivny: false, model: "rychly", moduly: [],
    popis:
      "Vráti text pripojeného PDF (najviac 20 000 znakov). Jediný nástroj, ktorý ti pošle obsah dokumentu — použi ho len vtedy, keď ho úloha naozaj potrebuje.",
    vstup: { type: "object", properties: { subor_id: { type: "string" }, strany: { type: "string" } }, required: ["subor_id"] },
  },
  {
    meno: "dph_priprav", druh: "navrh", faza: 2, aktivny: false, model: "rychly", moduly: ["dph"], zapis: "dph",
    popis: "Otvorí náhľad priznania DPH alebo kontrolného výkazu za obdobie. Stiahnutie XML robí človek.",
    vstup: {
      type: "object",
      properties: { obdobie: OBDOBIE, typ: { type: "string", enum: ["dp", "kv"] } },
      required: ["obdobie", "typ"],
    },
  },

  // ── F2: zápis s kartou (človek potvrdí na karte s ukážkou) ──────────────
  {
    meno: "import_vypisu", druh: "zapis_karta", faza: 2, aktivny: false, model: "rychly", moduly: ["banka"], zapis: "banka",
    popis:
      "Ukáže náhľad pripojeného výpisu (obdobie, počet nových pohybov, duplicita). Obdobie určuje súbor; ak nesedí s tým, čo človek chcel, povedz to. Import spustí človek.",
    vstup: {
      type: "object",
      properties: { subor_id: { type: "string" }, ocakavane_obdobie: OBDOBIE },
      required: ["subor_id"],
    },
  },
  {
    meno: "doplnit_trasy", druh: "zapis_karta", faza: 2, aktivny: false, model: "rychly", moduly: ["jazdy"], zapis: "jazdy",
    popis: "Otvorí hromadný editor trás pre jazdy bez trasy za obdobie. Trasy vyplní a uloží človek.",
    vstup: { type: "object", properties: { obdobie: OBDOBIE } },
  },
];

// Nástroje, ktoré NIKDY nebudú (spec 155.4.4). test_asistent_register overí,
// že telo ASISTENT_VYKONAJ[meno] nevolá žiadne z týchto mien. Tlačidlá na
// karte (preKartu.akcie — klik človeka, R4) sú mimo tela nástroja a smú volať
// importujVypisSubory či zápis protokolu; test preto kontroluje telo nástroja,
// nie celý asistent.js.
export const ASISTENT_ZAKAZANE = [
  "faktOdosliSietou", "faktPeppolOdosli", "postarVolaj", "vykazPosli(",
  "dphStiahni", "dphUlozPodanie", "dphZaznamExport", "uzavriMesiac",
  "parSparujJednoznacne", "pridajUhradu", "odoberUhradu", "oznacDokladUhradeny",
  "zrusDokladUhradu", "zosuladPhmKategorie", "kjwPrepisKnihu", "gdprMoj",
  "poZmene(", "ulozFirmu", "importujVypisSubory", "vykazNaProtokol",
];

// Schéma pre model: additionalProperties:false na každej úrovni objektu —
// pole, ktoré nástroj nepozná, by inak ticho prešlo (155.18 b. 10).
function uzavri(schema) {
  if (!schema || typeof schema !== "object") return schema;
  const s = { ...schema };
  if (s.type === "object") {
    s.additionalProperties = false;
    if (s.properties) {
      s.properties = {};
      for (const k of Object.keys(schema.properties)) s.properties[k] = uzavri(schema.properties[k]);
    }
  }
  if (s.type === "array" && s.items) s.items = uzavri(s.items);
  return s;
}

// Definície pre model: len AKTÍVNE nástroje fázy ≤ faza, voliteľne len niektoré
// druhy (rola nahlad → citanie + ukaz). Tvar = Claude API tool definition.
export function nastrojePreModel(faza, povoleneDruhy) {
  return ASISTENT_NASTROJE
    .filter((n) => n.aktivny && n.faza <= faza && (!povoleneDruhy || povoleneDruhy.includes(n.druh)))
    .map((n) => ({ name: n.meno, description: n.popis, input_schema: uzavri(n.vstup) }));
}
