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
jazdy: {
  vJednejVete: "Zapisovať jazdy autom a pripraviť knihu jázd na kontrolu",
  uvod: "Kniha jázd eviduje, kam, kedy a prečo ste autom išli a koľko kilometrov ste prešli. Jazdu zapíšete ručne, necháte si ju <b>zmerať</b> alebo ju načítate z auta — a pred odovzdaním knihu skontroluje sprievodca.",
  ulohy: [
    {
      id: "zapisat",
      nazov: "Zapísať jazdu ručne",
      kedy: "Po ceste, ktorú ste nemerali, alebo keď jazdy dopisujete dodatočne.",
      kroky: [
        { text: "Ťuknite na <b>＋ Nová</b>.", tlacidlo: "＋ Nová", snimka: "jazdy-zapisat-1" },
        { text: "Vyplňte trasu, účel, dátum a počet kilometrov.", snimka: "jazdy-zapisat-2",
          tip: "Účel appka navrhne sama, keď máte na ten deň [[app:vykazy|výkaz prác]]. Inak predvyplní [[app:data#set_kjUcel|predvolený účel z nastavení]]." },
        { text: "Skontrolujte <b>Stav tachometra na začiatku</b> — appka ho doplní z predchádzajúcej jazdy a koncový stav dopočíta.", tlacidlo: "Stav tachometra na začiatku", snimka: "jazdy-zapisat-3",
          tip: "Stav tachometra sa ukladá v celých kilometroch. Kilometre jazdy môžu mať aj desatinné miesto." },
        { text: "Ak cesta s podnikaním nesúvisela, zaškrtnite <b>Súkromná jazda</b>.", tlacidlo: "Súkromná jazda", snimka: "jazdy-zapisat-4" },
        { text: "Ťuknite na <b>Uložiť</b>.", tlacidlo: "Uložiť", snimka: "jazdy-zapisat-5" },
      ],
      tip: "Jazdíte často tú istú trasu? Zapíšte si ju ako [[app:data#set_kjTrasa|predvolenú trasu]] — každá nová jazda ju predvyplní.",
      podrobnosti: [
        { nadpis: "Kilometre z mapy",
          html: "<p>Tlačidlo <b>🗺️ Zistiť z mapy</b> vypočíta dĺžku cesty podľa miest v poli Trasa (aspoň dve, napríklad „Trnava – Bratislava“). Potrebuje cloudový účet a miesta sa mapovej službe pošlú až po stlačení.</p>" },
        { nadpis: "Opraviť alebo zmazať jazdu",
          html: "<p>Ťuknite na jazdu v zozname — otvorí sa na úpravu. Tlačidlo <b>Zmazať</b> ju odstráni hneď, bez ďalšej otázky.</p>" },
        { nadpis: "Musím knihu jázd viesť?",
          html: "<p>Závisí to od toho, ako uplatňujete pohonné hmoty. Nastavuje sa to v [[app:data|nastaveniach firmy]] v časti <b>Pohonné hmoty — daň z príjmov</b> a appka pri každej voľbe povie, čo znamená:</p><ul><li><b>Podľa knihy jázd</b> — uplatníte skutočnú spotrebu, knihu treba viesť.</li><li><b>Náhrady za km</b> — knihu viesť musíte, kilometre sú základ výpočtu.</li><li><b>Paušál 80 %</b> alebo <b>50 %</b> — knihu viesť nemusíte.</li></ul><p>Pri paušáli aj náhradách to appka pripomenie aj priamo tu, v Knihe jázd.</p>" },
      ],
    },
    {
      id: "merat",
      nazov: "Nechať si jazdu zmerať",
      kedy: "Pred vyrazením — kilometre sa spočítajú po trase a nemusíte ich odhadovať.",
      kroky: [
        { text: "Pred vyrazením ťuknite na <b>📍 Merať jazdu</b>.", tlacidlo: "Merať jazdu", snimka: "jazdy-merat-1" },
        { text: "Prvý raz appka vysvetlí, ako meranie funguje. Ťuknite na <b>Uložiť</b> a prehliadaču povoľte polohu.", tlacidlo: "Meranie jazdy", snimka: "jazdy-merat-2" },
        { text: "Počas jazdy nechajte appku otvorenú a displej rozsvietený — hore beží pás s kilometrami." },
        { text: "Na konci ťuknite v páse na <b>Ukončiť</b>.", tlacidlo: "Ukončiť" },
        { text: "Doplňte trasu, účel a stav tachometra na začiatku a ťuknite na <b>Uložiť</b>." },
      ],
      tip: "Ak sa appka počas jazdy zavrie, jazda sa nestratí — po návrate pokračuje a chýbajúci úsek dopočíta vzdušnou čiarou. Na konci povie, koľko kilometrov takto dopočítala.",
      podrobnosti: [
        { nadpis: "Prečo musí byť appka otvorená",
          html: "<p>Prehliadač odpojí polohu v momente, keď stránka stratí popredie. Je to obmedzenie webu, nie nastavenie, ktoré by sa dalo zapnúť.</p>" },
        { nadpis: "Čo sa ukladá",
          html: "<p>Súradnice zostávajú v telefóne. Do knihy jázd sa uloží len počet kilometrov, čas a názov trasy. Miesto, ktoré na konci jazdy raz pomenujete, appka nabudúce doplní sama.</p>" },
        { nadpis: "Spustil som jazdu omylom",
          html: "<p>V záverečnom okne je <b>Zahodiť jazdu</b> — nič sa nezapíše.</p>" },
      ],
    },
    {
      id: "sprievodca",
      nazov: "Pripraviť a stiahnuť knihu jázd za obdobie",
      kedy: "Na konci mesiaca alebo roka, keď chcete mať knihu v poriadku a stiahnuť ju.",
      kroky: [
        { text: "Ťuknite na <b>✨ Sprievodca</b>.", tlacidlo: "Sprievodca", snimka: "jazdy-sprievodca-1" },
        { text: "Vyberte obdobie — zobrazený mesiac, tento rok alebo celú knihu.", tlacidlo: "Zobrazený mesiac", snimka: "jazdy-sprievodca-2" },
        { text: "Ťuknite na <b>↳ Doplniť účel z výkazu</b> — jazdy dostanú účel podľa toho, čo ste v ten deň robili.", tlacidlo: "Doplniť účel z výkazu", snimka: "jazdy-sprievodca-3",
          tip: "Pôvodný účel sa uchová. Nesedí vám nový? V Knihe jázd ho pre zobrazený mesiac vrátite tlačidlom <b>↩ Vrátiť pôvodné</b>." },
        { text: "V kroku <b>Kontrola knihy</b> pozrite, čo appka našla, a opravte to.", tlacidlo: "Kontrola knihy", snimka: "jazdy-sprievodca-4" },
        { text: "Na konci ťuknite na <b>↧ Exportovať knihu jázd do XLS</b>.", tlacidlo: "Exportovať knihu jázd do XLS", snimka: "jazdy-sprievodca-5" },
      ],
      tip: "Bez sprievodcu knihu stiahnete hneď tlačidlom <b>↧ XLS mesiac</b> alebo <b>↧ XLS celá</b>.",
      podrobnosti: [
        { nadpis: "Domáce nabíjanie (elektromobil a plug-in hybrid)",
          html: "<p>Pri aute s elektrinou má sprievodca krok navyše. Porovná spotrebu podľa vozidla s tým, čo ste nabili verejne na staniciach ZSE — rozdiel ste nabili doma. Tlačidlom <b>+ Vytvoriť výdavok</b> z neho vznikne interný doklad s celým výpočtom v popise. Cenu za kWh zmeníte v [[app:data#set_kjCenaElektro|nastaveniach knihy jázd]].</p>" },
        { nadpis: "Krok Rozloženie a export",
          html: "<p>Appka ho sama označuje <b>Iba ukážka — na daňové účely sa nepoužíva</b>: prepisuje dátumy jázd a výsledok už nezodpovedá tomu, čo hlási vozidlo. Do knihy sa nič neuloží, kým návrh výslovne nepoužijete — vtedy sa najprv stiahne záloha a treba potvrdiť napísaním slova.</p>" },
        { nadpis: "Čo je v exporte",
          html: "<p>Súbor Excel s hárkom za každý mesiac: dátum a čas, trasa, účel, stav tachometra na začiatku a na konci, prejdené kilometre a spotreba. Do PDF appka knihu jázd neexportuje.</p>" },
      ],
    },
    {
      id: "import",
      nazov: "Načítať jazdy z auta",
      kedy: "Auto si jazdy zaznamenáva samo a nechcete ich prepisovať ručne.",
      kroky: [
        { text: "Ťuknite na <b>🚗 Z vozidla</b> a vyberte export jázd z auta (súbor .xlsx z VW TripStatistics).", tlacidlo: "Z vozidla", snimka: "jazdy-import-1" },
        { text: "Appka ukáže nájdené jazdy po mesiacoch. Odškrtnite tie, ktoré do knihy nepatria." },
        { text: "Ťuknite na <b>Uložiť</b>." },
      ],
      tip: "Jazdy, ktoré už v knihe sú, sa preskočia a dni, ktoré už vediete, sú vopred odznačené — väčší export tak môžete načítať aj cez mesiace, ktoré v knihe už máte.",
      podrobnosti: [
        { nadpis: "Kontrola oproti vozidlu",
          html: "<p>Pred uložením appka porovná stav tachometra vo vozidle so stavom v knihe a natankované litre podľa auta s litrami z bločkov. Keď litre chýbajú, chýbajú aj doklady za tankovanie.</p>" },
        { nadpis: "Krátke jazdy",
          html: "<p>Jazdy do limitu z [[app:data#set_kjAutoLimit|nastavení knihy jázd]] (predvolene 50 km) dostanú predvolenú trasu a účel. Kratšie ako 2 alebo 5 km môžete v náhľade skryť.</p>" },
        { nadpis: "Z GPX alebo CSV",
          html: "<p><b>📥 GPX/CSV</b> načíta trasy z GPS aplikácie (jedna trasa = jedna jazda) alebo tabuľku so stĺpcami dátum, km, trasa, účel. Jazdy pridá hneď, bez náhľadu a bez kontroly, či už v knihe sú — ten istý súbor preto nenačítavajte dvakrát.</p>" },
      ],
    },
    {
      id: "nabijanie",
      nazov: "Nahrať výpis nabíjaní ZSE",
      kedy: "Nabíjate na staniciach ZSE Drive a prišiel podrobný výpis nabíjaní.",
      kroky: [
        { text: "Ťuknite na <b>⚡ ZSE</b> a vyberte podrobný výpis nabíjaní zo ZSE Drive (PDF alebo text).", tlacidlo: "⚡ ZSE", snimka: "jazdy-nabijanie-1" },
        { text: "Nabíjania sa objavia v prehľade <b>Nabíjania (ZSE)</b>.", tlacidlo: "Nabíjania (ZSE)", snimka: "jazdy-nabijanie-2" },
      ],
      tip: "Ten istý výpis môžete načítať aj druhý raz — nabíjanie, ktoré už v knihe je, sa nepridá znova.",
      podrobnosti: [
        { nadpis: "Výpis som nahral medzi doklady",
          html: "<p>Keď výpis nahráte ako doklad do [[app:vydavky|výdavkov]], appka ho spozná a opýta sa, či ho má načítať medzi nabíjania. Faktúra za ten istý mesiac je samostatný doklad a do výdavkov patrí ona.</p>" },
        { nadpis: "Na čo sú nabíjania v knihe",
          html: "<p>Appka z nich porovná nabitú elektrinu so spotrebou podľa jázd a [[navod:jazdy/sprievodca|sprievodca]] z nich vypočíta domáce nabíjanie.</p>" },
      ],
    },
    {
      id: "miesto",
      nazov: "Overiť, že tankovanie sedí s jazdami",
      kedy: "Chcete mať istotu, že ku každému tankovaniu či nabíjaniu je v knihe jazda.",
      kroky: [
        { text: "V prehľade <b>Tankovania (PHM)</b> alebo <b>Nabíjania (ZSE)</b> ťuknite na riadok.", tlacidlo: "Tankovania (PHM)", snimka: "jazdy-miesto-1" },
        { text: "Napíšte obec, kde ste tankovali alebo nabíjali, a ťuknite na <b>Uložiť</b>.", tlacidlo: "Miesto tankovania", snimka: "jazdy-miesto-2" },
        { text: "Keď v ten deň cez to miesto nevedie žiadna jazda, appka to v okne povie a riadok dostane značku <b>⚠ mimo trasy</b>.", tlacidlo: "mimo trasy", snimka: "jazdy-miesto-3" },
      ],
      tip: "Boli ste tam naozaj po ceste? V okne ťuknite na <b>Je to po trase</b> — upozornenie pri tomto zázname zmizne.",
      podrobnosti: [
        { nadpis: "Ako appka porovnáva",
          html: "<p>Hľadá slová z miesta v trasách jázd z toho dňa, bez ohľadu na diakritiku a veľké písmená — „Senec“ sedí na trase „Bratislava – Senec – Trnava“. Miesto je nepovinné a prázdne pole nekontroluje nič.</p>" },
        { nadpis: "Odkiaľ sa tankovania berú",
          html: "<p>Tankovanie v Knihe jázd nepridáte — vznikne samo z dokladu za pohonné hmoty s vyplnenými litrami vo [[app:vydavky|výdavkoch]]. Sumu preto opravujte vo výdavku, nie tu.</p>" },
      ],
    },
  ],
},
// ───────────────────────────────────────────────────────────────────────

// ────────────────────────────────── KALENDÁR, ŠTATISTIKY, NASTAVENIA
// (miesto pre návody: kalendar, superdash, data)
// ───────────────────────────────────────────────────────────────────────

},
};
