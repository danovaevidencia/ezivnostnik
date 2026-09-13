// Návody v appke — OBSAH. Vykresľuje ich appNavody() v ezivnostnik.html,
// snímky a ich manifest (navody_snimky.js) vyrába dev/navody/snimky.js.
//
// Ako sa píše návod (nech ostanú zrozumiteľné aj ďalšie):
//
//  • Tri vrstvy. Modul = na čo je + zoznam úloh. Úloha = najviac 5 krokov,
//    každý jedna veta. Všetko ostatné ide do „podrobnosti" — kto ich
//    nepotrebuje, neuvidí ich.
//  • Píše sa, ČO človek chce dosiahnuť („Označiť, že faktúra je zaplatená"),
//    nie ako sa volá funkcia.
//  • Tlačidlo sa píše presne tak, ako je v appke, tučným písmom. Pole
//    `tlacidlo` nesie ten istý text a test_navody overuje, že ho appka naozaj
//    obsahuje — keď sa tlačidlo premenuje, test spadne skôr, než návod začne
//    klamať.
//  • KEĎ NÁVOD NA NIEČO ODKAZUJE, JE TO PREKLIK, nie popis cesty (Roman):
//      [[navod:modul/uloha|text]]    otvorí iný návod
//      [[app:modul|text]]            otvorí modul
//      [[app:modul#idPrvku|text]]    otvorí modul a prvok v ňom ukáže
//    Test overí, že cieľ existuje, a spadne na názve modulu bez odkazu.
//  • Tip (`tip` pri kroku alebo pri úlohe) je jedna veta, ktorá ušetrí prácu
//    alebo predíde omylu. Nie opakovanie kroku.
//  • Nesľubovať, čo appka nerobí. (Faktúru e-mailom neposiela; z výkazu
//    faktúru nevystaví — preto to návod hovorí priamo.)
//  • `snimka` je id scenára v dev/navody/scenare.js. Krok bez snímky sa
//    v ukážke vynechá, v zozname krokov ostane.

window.NAVODY = {
moduly: {

// ─────────────────────────────────────────────────────────────── FAKTÚRY
faktury: {
  vJednejVete: "Vystaviť faktúru, poslať ju a vidieť, kto zaplatil",
  uvod: "Tu vystavujete faktúry odberateľom a vidíte, ktoré sú zaplatené. Ak do appky nahrávate [[app:banka|výpisy z banky]], zaplatenie sa doplní <b>samo</b>.",
  ulohy: [
    {
      id: "vystavit",
      nazov: "Vystaviť faktúru",
      kedy: "Keď ste odviedli prácu alebo predali tovar a chcete dostať zaplatené.",
      kroky: [
        { text: "Ťuknite na <b>＋ Nová faktúra</b>.", tlacidlo: "Nová faktúra", snimka: "faktury-vystavit-1" },
        { text: "Začnite písať názov alebo IČO odberateľa a vyberte ho zo zoznamu.", snimka: "faktury-vystavit-2",
          tlacidlo: "— z histórie —",
          tip: "Stačia tri znaky. Názov, IČO a adresu doplní appka z registra právnických osôb — DIČ a IČ DPH tiež, ak ich register pozná. Komu ste už fakturovali, toho vyberiete aj zo zoznamu <b>— z histórie —</b>." },
        { text: "Doplňte, čo fakturujete: popis, množstvo a cenu.", snimka: "faktury-vystavit-3",
          tlacidlo: "Pridať položku", tip: "Ďalší riadok faktúry pridáte cez <b>＋ Pridať položku</b>." },
        { text: "Ťuknite na <b>Uložiť</b>.", tlacidlo: "Uložiť", snimka: "faktury-vystavit-4" },
      ],
      tip: "Číslo faktúry a variabilný symbol vyplní appka sama — ďalšie číslo v poradí.",
      podrobnosti: [
        { nadpis: "Čo appka nekontroluje",
          html: "<p>Faktúru uloží aj bez odberateľa alebo bez položky — nezastaví vás. Pred odoslaním si preto pozrite PDF.</p>" },
        { nadpis: "QR kód na platbu",
          html: "<p>PDF faktúry nesie QR kód PAY by square, keď máte v [[app:data#set_iban|nastaveniach firmy vyplnený IBAN]]. Odberateľ ho naskenuje v bankovej aplikácii a suma aj variabilný symbol sa vyplnia samy.</p>" },
      ],
    },
    {
      id: "poslat",
      nazov: "Poslať faktúru odberateľovi",
      kedy: "Faktúra je hotová a treba ju dostať k odberateľovi.",
      kroky: [
        { text: "Pri faktúre ťuknite na <b>PDF</b> — stiahne sa hotová faktúra.", tlacidlo: "PDF", snimka: "faktury-poslat-1" },
        { text: "Pošlite ju odberateľovi zo svojej e-mailovej schránky ako prílohu." },
      ],
      tip: "Keď máte v [[app:data#set_iban|nastaveniach firmy IBAN]], PDF nesie QR kód — odberateľ zaplatí naskenovaním v banke.",
      podrobnosti: [
        { nadpis: "Prečo appka neposiela e-mail sama",
          html: "<p>Faktúra odchádza z vašej schránky, takže odberateľ vidí známu adresu a odpoveď príde vám. Appka e-maily odberateľom neposiela.</p>" },
        { nadpis: "Od roku 2027: e-faktúra",
          html: "<p>Platitelia DPH budú od 1. 1. 2027 posielať faktúry sieťou Peppol, nie e-mailom — [[navod:efaktury/odoslat|ako odoslať faktúru sieťou Peppol]].</p>" },
      ],
    },
    {
      id: "uhrada",
      nazov: "Označiť, že faktúra je zaplatená",
      kedy: "Peniaze prišli a appka to ešte nevie — napríklad v hotovosti.",
      kroky: [
        { text: "Pri nezaplatenej faktúre ťuknite na <b>✓</b>.", snimka: "faktury-uhrada-1" },
        { text: "Vyberte, ako peniaze prišli — kartou, prevodom alebo v hotovosti.", tlacidlo: "Ako bol doklad uhradený?", snimka: "faktury-uhrada-2" },
      ],
      tip: "Ak nahrávate [[app:banka|výpisy z banky]], netreba nič označovať — appka platbu priradí k faktúre sama podľa sumy a variabilného symbolu. Ručne označujte len to, čo cez účet neprešlo.",
      podrobnosti: [
        { nadpis: "Viac faktúr naraz",
          html: "<p>Zaškrtnite faktúry v zozname — ukáže sa pás <b>✓ Označiť uhradené</b>.</p>" },
        { nadpis: "Označil som omylom",
          html: "<p>Pri faktúre s ručne zadanou úhradou je tlačidlo <b>✕</b>, ktoré úhradu zruší.</p>" },
      ],
    },
    {
      id: "oprava",
      nazov: "Opraviť vystavenú faktúru",
      kedy: "Odberateľ už faktúru má a treba zmeniť sumu alebo ju zrušiť.",
      kroky: [
        { text: "Pri faktúre ťuknite na <b>⋯</b>.", snimka: "faktury-oprava-1" },
        { text: "Vyberte <b>Dobropis</b> (znižuje sumu), <b>Ťarchopis</b> (zvyšuje) alebo <b>Storno</b> (ruší celú faktúru).", tlacidlo: "Dobropis", snimka: "faktury-oprava-2" },
        { text: "Appka predvyplní nový doklad s odkazom na pôvodnú faktúru. Upravte sumu a ťuknite na <b>Uložiť</b>.", snimka: "faktury-oprava-3" },
      ],
      tip: "Podobnú faktúru ako minule vytvoríte v tom istom menu cez <b>⧉ Kópia ako nová faktúra</b> — odberateľ aj položky sa prenesú.",
      podrobnosti: [
        { nadpis: "Prečo nie prepísať pôvodnú faktúru",
          html: "<p>Odberateľ má u seba pôvodnú faktúru. Keby ste ju u seba prepísali, každý z vás by mal inú. Oprava sa preto robí novým dokladom, ktorý sa na pôvodnú faktúru odvoláva.</p><p>Faktúru, ktorá [[navod:efaktury/odoslat|odišla sieťou Peppol]], appka zmeniť ani nedovolí.</p>" },
      ],
    },
    {
      id: "zaloha",
      nazov: "Pýtať zálohu vopred",
      kedy: "Chcete časť peňazí dostať skôr, než prácu odovzdáte.",
      kroky: [
        { text: "Ťuknite na <b>📄 Zálohová faktúra</b>.", tlacidlo: "Zálohová faktúra", snimka: "faktury-zaloha-1" },
        { text: "Vyplňte odberateľa a sumu zálohy a ťuknite na <b>Uložiť</b>.", snimka: "faktury-zaloha-2" },
        { text: "Keď prácu dokončíte, v časti <b>Zálohové faktúry</b> ťuknite na <b>Faktúra</b> — appka vystaví konečnú faktúru a zaplatenú zálohu v nej odpočíta.", tlacidlo: "Zálohové faktúry" },
      ],
      tip: "Časť Zálohové faktúry sa v zozname objaví, až keď prvú zálohu uložíte.",
      podrobnosti: [
        { nadpis: "Zálohová faktúra nie je daňový doklad",
          html: "<p>Je to výzva na zaplatenie. Do príjmov sa nepočíta — tie vzniknú až konečnou faktúrou.</p>" },
      ],
    },
  ],
},

// ─────────────────────────────────────────────────────────────── VÝKAZY
vykazy: {
  vJednejVete: "Zapísať odpracované dni a stiahnuť výkaz pre klienta",
  uvod: "Výkaz prác je zoznam dní a hodín, ktoré ste pre klienta odpracovali. Stiahnete ho ako Word alebo Excel a priložíte k faktúre.",
  ulohy: [
    {
      id: "novy",
      nazov: "Vyplniť výkaz prác",
      kedy: "Na konci mesiaca, keď fakturujete prácu podľa dní alebo hodín.",
      kroky: [
        { text: "Ťuknite na <b>＋ Nový výkaz</b>.", tlacidlo: "Nový výkaz", snimka: "vykazy-novy-1" },
        { text: "Vyplňte projekt a obdobie.", snimka: "vykazy-novy-2" },
        { text: "Pridávajte odpracované dni cez <b>＋ Pridať deň</b> a ťuknite na <b>Uložiť</b>.", tlacidlo: "Pridať deň", snimka: "vykazy-novy-3" },
      ],
      tip: "Máte dni v Google alebo Outlook kalendári? <b>📅 Import z kalendára</b> ich načíta zo súboru .ics — len vyberiete, ktoré boli práca pre klienta.",
      podrobnosti: [
        { nadpis: "Človekodeň podľa hodín alebo pevná sadzba",
          html: "<p>Vo výkaze si vyberiete, či sa človekodeň počíta z hodín (napr. 8 hodín = 1 deň), alebo platí pevná denná sadzba bez ohľadu na hodiny.</p>" },
      ],
    },
    {
      id: "export",
      nazov: "Stiahnuť výkaz a vyfakturovať ho",
      kedy: "Klient chce k faktúre výkaz alebo akceptačný protokol.",
      kroky: [
        { text: "Na karte výkazu ťuknite na <b>↧ Výkaz (Word)</b> alebo <b>↧ Výkaz (XLSX)</b>.", tlacidlo: "Výkaz (Word)", snimka: "vykazy-export-1" },
        { text: "Faktúru vystavte vo Faktúrach — [[navod:faktury/vystavit|ako vystaviť faktúru]]. Z výkazu ju appka sama nevystaví." },
      ],
      tip: "Na karte výkazu appka ukáže, či počet dní sedí s faktúrou za ten mesiac — preklep v počte dní tak nájdete skôr než klient.",
      podrobnosti: [
        { nadpis: "Akceptačný protokol",
          html: "<p>Na karte je aj <b>↧ Akceptačný protokol (Word)</b> — potvrdenie, že klient prácu prevzal.</p>" },
        { nadpis: "Klient výkaz upravil",
          html: "<p>Upravený súbor vrátite tlačidlom <b>↥ Načítať upravený</b>.</p>" },
      ],
    },
  ],
},

// ─────────────────────────────────────────────────────────── POHĽADÁVKY
pohladavky: {
  vJednejVete: "Kto vám ešte nezaplatil a ako mu pripomenúť",
  uvod: "Pohľadávky sú faktúry, ktoré vám ešte nezaplatili. Appka ukáže, ktoré sú po splatnosti, a pripraví upomienku.",
  ulohy: [
    {
      id: "prehlad",
      nazov: "Zistiť, kto mi nezaplatil",
      kedy: "Keď na účte chýbajú peniaze, ktoré ste čakali.",
      kroky: [
        { text: "Hore vidíte, koľko vám dlhujú spolu a koľko z toho je po splatnosti.", snimka: "pohladavky-prehlad-1" },
        { text: "V zozname sú faktúry <b>po splatnosti</b> označené aj s počtom dní.", tlacidlo: "po splatnosti", snimka: "pohladavky-prehlad-2" },
      ],
      tip: "Keď appka nájde platbu vo [[app:banka|výpise z banky]], faktúra sa označí ako uhradená sama.",
      podrobnosti: [
        { nadpis: "Čo sú záväzky",
          html: "<p>Na záložke <b>Záväzky</b> je opak — [[app:vydavky|došlé faktúry]], ktoré ešte nemáte zaplatené vy.</p>" },
      ],
    },
    {
      id: "upomienka",
      nazov: "Poslať upomienku",
      kedy: "Faktúra je po splatnosti a odberateľ mlčí.",
      kroky: [
        { text: "Pri faktúre po splatnosti ťuknite na <b>📄 Upomienka</b> — stiahne sa PDF.", tlacidlo: "Upomienka", snimka: "pohladavky-upomienka-1" },
        { text: "Pošlite ho odberateľovi. Appka si zapamätá, že ste upomínali — ďalšia bude <b>2. upomienka</b>." },
      ],
      tip: "S odberateľom máte dohodnutý odklad? Ťuknite pri faktúre na <b>🔔</b> — upomínanie sa pre ňu vypne.",
    },
  ],
},

// ───────────────────────────────────────────────────── E-FAKTÚRY PEPPOL
efaktury: {
  vJednejVete: "Posielať a prijímať faktúry sieťou Peppol",
  uvod: "Od 1. 1. 2027 sa faktúry medzi firmami posielajú sieťou <b>Peppol</b> cez digitálneho poštára. <b>Prijímať</b> ich musí každý podnikateľ, <b>posielať</b> platitelia DPH.",
  ulohy: [
    {
      id: "zapnut",
      nazov: "Zapnúť odosielanie",
      kedy: "Raz, predtým než pošlete prvú e-faktúru.",
      kroky: [
        { text: "Otvorte [[app:data#set_postar|nastavenia — kartu E-faktúry]].", tlacidlo: "E-faktúry", snimka: "efaktury-zapnut-1" },
        { text: "Zaškrtnite <b>Odosielať faktúry sieťou Peppol</b> a nastavenia uložte.", tlacidlo: "sieťou Peppol", snimka: "efaktury-zapnut-2" },
      ],
      tip: "Voľba sa neponúkne, kým firma nemá vyplnené [[app:data#set_dic|DIČ]] — podľa neho vás sieť pozná.",
    },
    {
      id: "odoslat",
      nazov: "Odoslať faktúru sieťou Peppol",
      kedy: "Faktúra je hotová a odberateľ je v sieti Peppol.",
      kroky: [
        { text: "V [[app:faktury|zozname faktúr]] ťuknite pri faktúre na <b>📮</b>.", snimka: "efaktury-odoslat-1" },
        { text: "Appka overí, či je odberateľ v sieti a či doklad prejde kontrolou, a ukáže, čo presne sa odošle.", tlacidlo: "Odoslať sieťou Peppol", snimka: "efaktury-odoslat-2" },
        { text: "Keď všetko sedí, ťuknite na <b>📮 Odoslať</b> a počkajte na výsledok v okne.", snimka: "efaktury-odoslat-3" },
      ],
      tip: "Ak odberateľ v sieti nie je, okno to povie ešte pred odoslaním — vtedy mu [[navod:faktury/poslat|pošlite PDF ako doteraz]].",
      podrobnosti: [
        { nadpis: "Odoslanie sa nedá vrátiť",
          html: "<p>Doklad dostane odberateľ a poštár ho nahlási Finančnej správe. Faktúra sa v appke zamkne — opraviť ju môžete už len [[navod:faktury/oprava|dobropisom alebo ťarchopisom]].</p>" },
        { nadpis: "Čo pri overení odchádza",
          html: "<p>Pri otvorení okna ide poštárovi doklad na kontrolu a DIČ odberateľa na vyhľadanie v sieti. Nikomu sa tým nedoručí — doručí sa až po stlačení <b>Odoslať</b>.</p>" },
      ],
    },
    {
      id: "prijata",
      nazov: "Zaevidovať prijatú e-faktúru",
      kedy: "Dodávateľ vám poslal faktúru sieťou Peppol.",
      kroky: [
        { text: "V [[app:efaktury|module E-faktúry Peppol]] ťuknite na <b>Skontrolovať schránku</b>.", tlacidlo: "Skontrolovať schránku" },
        { text: "Pri faktúre v časti <b>Prijaté zo siete</b> ťuknite na <b>Zaevidovať</b>.", tlacidlo: "Zaevidovať" },
        { text: "Appka predvyplní výdavok. Skontrolujte ho a ťuknite na <b>Uložiť</b>." },
      ],
      tip: "Originál e-faktúry treba uchovať 10 rokov — appka ho pri zaevidovaní uloží sama, netreba ho odkladať zvlášť.",
      podrobnosti: [
        { nadpis: "Doklad je stále „nový“",
          html: "<p>Zaevidovaný je až vtedy, keď výdavok uložíte. Kým formulár len zavriete, ostane medzi novými.</p>" },
      ],
    },
  ],
},

// ════════════════════════════════════════════════════════════════════════
// Nižšie sú vyhradené miesta pre ďalšie skupiny. Každé vlákno nahradí LEN
// riadok „// (miesto pre návody …)" vo svojej sekcii; hlavičky a čiary medzi
// sekciami ostávajú nedotknuté, aby sa vetvy zlúčili bez konfliktu.
// ════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────── VÝDAVKY
// (miesto pre návody skupiny Výdavky: vydavky)
// ───────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────── BANKA
// (miesto pre návody skupiny Banka: banka)
// ───────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────── PODANIA
// (miesto pre návody skupiny Podania: dph, priznania, priznanieB, uzavierka)
// ───────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────── FIREMNÁ AGENDA
// (miesto pre návody skupiny Firemná agenda: knihy, majetok, dokumenty, dovolenka, zdielanie)
// ───────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────── KNIHA JÁZD
// (miesto pre návody: jazdy)
// ───────────────────────────────────────────────────────────────────────

// ────────────────────────────────── KALENDÁR, ŠTATISTIKY, NASTAVENIA
// (miesto pre návody: kalendar, superdash, data)
// ───────────────────────────────────────────────────────────────────────

},
};
