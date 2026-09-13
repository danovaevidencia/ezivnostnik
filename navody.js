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
knihy: {
  vJednejVete: "Kniha pohľadávok, kniha záväzkov a peňažný denník ako PDF alebo Excel",
  uvod: "Zostavy, ktoré ukážu, kto komu dlhoval k určitému dňu a kade tiekli peniaze — keď ich pýta účtovník alebo kontrola. Nič sa sem nezapisuje: appka ich skladá z [[app:faktury|faktúr]], [[app:vydavky|výdavkov]] a [[app:banka|výpisov z banky]].",
  ulohy: [
    {
      id: "kniha",
      nazov: "Stiahnuť knihu pohľadávok alebo záväzkov",
      kedy: "Účtovník alebo kontrola chce vedieť, čo bolo nezaplatené k určitému dňu — napríklad k 31. 12.",
      kroky: [
        { text: "V časti <b>Kniha pohľadávok a záväzkov</b> vyberte knihu, rok a deň, ku ktorému má stav platiť.", tlacidlo: "Kniha pohľadávok a záväzkov", snimka: "knihy-kniha-1",
          tip: "Úhrady po zvolenom dni sa do knihy nezapočítajú — kniha k 31. 12. ukáže ako dlh aj faktúru, ktorú vám zaplatili až v januári." },
        { text: "Otvorte krok <b>Kontrola</b> — upozorní na položky po splatnosti, bez splatnosti alebo potvrdené ručne.", tlacidlo: "Kontrola" },
        { text: "V kroku <b>Generovať</b> ťuknite na <b>📄 PDF</b> alebo <b>📊 XLSX</b>.", tlacidlo: "Generovať", snimka: "knihy-kniha-2" },
      ],
      tip: "Do knihy záväzkov idú len výdavky s druhom <b>Došlá faktúra</b> — bloček zaplatený na mieste záväzkom nebol.",
      podrobnosti: [
        { nadpis: "Doklady z minulého roka",
          html: "<p>Kniha nesie aj doklady zo starších rokov, ktoré k 1. januáru neboli vyrovnané — aby bolo vidieť, kedy sa doplatili.</p>" },
        { nadpis: "Úhrada označená ručne",
          html: "<p>Keď ste zaplatenie [[navod:faktury/uhrada|označili ručne]], kniha doklad započíta ako uhradený, ale stĺpec <b>Uhradené dňa</b> ostane prázdny — appka deň platby nepozná. Preto ho ako uhradený ukáže aj v knihe k skoršiemu dňu.</p><p>Deň úhrady nesie až platba spárovaná z [[app:banka|výpisu z banky]].</p>" },
        { nadpis: "Všetko v jednom súbore",
          html: "<p>[[app:data#xkBox|Kompletný export v nastaveniach]] obsahuje knihu pohľadávok aj záväzkov ako hárky jedného Excelu. Peňažný denník doň pridáte zaškrtnutím.</p>" },
      ],
    },
    {
      id: "dennik",
      nazov: "Zistiť, kde sú peniaze a odkiaľ prišli",
      kedy: "Chcete pohyb peňazí na účte a v pokladni za mesiac alebo rok, s priebežným zostatkom.",
      kroky: [
        { text: "V časti <b>Peňažný denník</b> vyberte rok alebo mesiac a či chcete banku, pokladňu, alebo oboje.", tlacidlo: "Peňažný denník", snimka: "knihy-dennik-1" },
        { text: "V kroku <b>Kontrola úplnosti</b> znamená <b>reťaz sedí</b>, že zostatky hlásené bankou zodpovedajú zapísaným pohybom.", tlacidlo: "reťaz sedí", snimka: "knihy-dennik-2" },
        { text: "V kroku <b>Generovať</b> ťuknite na <b>📄 PDF</b> alebo <b>📊 XLSX</b>." },
      ],
      tip: "Keď kontrola nájde chýbajúci pohyb, vytlačí ho aj do súboru — kto ho dostane, o medzere vie.",
      podrobnosti: [
        { nadpis: "Nie je to kniha jednoduchého účtovníctva",
          html: "<p>Denník odpovedá na otázku, kde sú peniaze a odkiaľ sa tam vzali — nie aký je základ dane.</p>" },
        { nadpis: "Čo je pokladňa",
          html: "<p>Príjmové doklady a doklady uhradené v hotovosti, ktoré neprešli účtom.</p>" },
        { nadpis: "Zostatok sa nedá overiť",
          html: "<p>Zostatok appka pozná len z výpisu alebo notifikácie, ktorá ho nesie. Staršie importy zostatky neukladali — [[app:banka|výpis naimportujte znova]].</p>" },
      ],
    },
  ],
},

majetok: {
  vJednejVete: "Evidovať veci, ktoré firme slúžia roky, a vidieť ich odpisy",
  uvod: "Auto, počítač či stroj sa do výdavkov nedávajú naraz, ale postupne — odpismi. Appka z ceny a odpisovej skupiny zostaví odpisový plán a pri skutočných výdavkoch ročný odpis sama pripočíta k výdavkom.",
  ulohy: [
    {
      id: "zaradit",
      nazov: "Zaradiť kúpu z výdavkov do majetku",
      kedy: "Kúpili ste vec, ktorá firme poslúži dlhšie, a doklad o kúpe už máte vo výdavkoch.",
      kroky: [
        { text: "V [[app:vydavky|zozname výdavkov]] otvorte doklad o kúpe a dole ťuknite na <b>⌂ Zaradiť do majetku</b>.", tlacidlo: "Zaradiť do majetku", snimka: "majetok-zaradit-1" },
        { text: "Skontrolujte názov, cenu bez DPH a dátum zaradenia a vyberte <b>Odpisovú skupinu</b>.", tlacidlo: "Odpisová skupina" },
        { text: "V poli <b>Režim</b> vyberte, či sa vec odpisuje, alebo je drobná, a ťuknite na <b>Uložiť</b>.", tlacidlo: "Režim", snimka: "majetok-zaradit-2" },
      ],
      tip: "Kúpu, ktorá je vo výdavkoch, zaraďte vždy takto, nie cez <b>＋ Pridať majetok</b> — ručne pridaná vec výdavok nevyníma a suma by išla do výdavkov dvakrát.",
      podrobnosti: [
        { nadpis: "Odpisovaný, alebo drobný",
          html: "<p><b>Odpisovaný</b> — appka doklad z výdavkov vyníme a nahradí ho odpismi po rokoch.</p><p><b>Drobný</b> — doklad ostane vo výdavkoch celý a v majetku sa vec len eviduje.</p>" },
        { nadpis: "Doklad nad 1 700 €",
          html: "<p>Pri výdavku nad 1 700 € sa appka spýta, či ide o majetok — tlačidlami <b>Zaradiť do majetku</b> a <b>Nie je majetok</b>. Rozhoduje aj doba použiteľnosti, preto to appka neurobí za vás. Kým nerozhodnete, doklad ostáva vo výdavkoch.</p>" },
        { nadpis: "Oprava veci, ktorú už odpisujete",
          html: "<p>Keď výdavok zvyšuje hodnotu veci, ktorá už v majetku je, vyberte v tom istom okne <b>Zhodnotenie majetku — …</b>. Suma sa pripočíta k tej veci a uplatní sa v jej odpisoch.</p>" },
      ],
    },
    {
      id: "pridat",
      nazov: "Pridať majetok, ktorý vo výdavkoch nie je",
      kedy: "Vec ste kúpili súkromne a do podnikania ju vkladáte teraz.",
      kroky: [
        { text: "Ťuknite na <b>＋ Pridať majetok</b>.", tlacidlo: "Pridať majetok", snimka: "majetok-pridat-1" },
        { text: "Vyplňte názov, vstupnú cenu bez DPH, dátum zaradenia a odpisovú skupinu.", tlacidlo: "počítače, elektronika, osobné auto",
          tip: "Pri každej skupine výber ukazuje, čo do nej patrí — napríklad <b>1 — počítače, elektronika, osobné auto</b>." },
        { text: "V <b>Náhľade odpisového plánu</b> skontrolujte ročný odpis a ťuknite na <b>Uložiť</b>.", tlacidlo: "Náhľad odpisového plánu", snimka: "majetok-pridat-2" },
      ],
      tip: "Vec ste mali súkromne už skôr? Rozbaľte <b>⏳ Kúpené súkromne skôr…</b> a zadajte dátum pôvodnej kúpy — appka ho do doby odpisovania započíta.",
      podrobnosti: [
        { nadpis: "Používam to aj súkromne",
          html: "<p>V poli <b>Používam aj súkromne</b> vyberte podiel — do výdavkov pôjde len táto časť odpisu. Pri aute je najbežnejší paušál 80 %.</p>" },
        { nadpis: "Režim Drobný majetok",
          html: "<p>Vec pridaná tu v režime <b>Drobný majetok</b> sa len zaeviduje — do výdavkov ju appka nepripočíta. Do výdavkov ide doklad o kúpe, ktorý je vo [[app:vydavky|výdavkoch]].</p>" },
      ],
    },
    {
      id: "odpisy",
      nazov: "Zistiť, koľko tento rok odpíšem",
      kedy: "Chcete vedieť, koľko z majetku pôjde tento rok do výdavkov, alebo odpisový plán pýta účtovník.",
      kroky: [
        { text: "Hore vidíte odpis za tento rok spolu a v priemere na mesiac.", tlacidlo: "Odpis/mes" },
        { text: "Pri každej veci je tabuľka po rokoch: odpis, zostatok a počet mesiacov.", snimka: "majetok-odpisy-1" },
      ],
      tip: "Prvý a posledný rok sa odpisuje len za mesiace od zaradenia — preto sú odpisy v nich menšie.",
      podrobnosti: [
        { nadpis: "Kam sa odpis započíta",
          html: "<p>Pri skutočných výdavkoch ho appka sama pripočíta k výdavkom v [[app:priznanieB|daňovom priznaní]]. Pri paušálnych výdavkoch sa odpis nepoužije.</p><p>Appka odpisuje rovnomerne — zrýchlené odpisovanie nepozná.</p>" },
        { nadpis: "Odpisy tento rok daň neznížia",
          html: "<p>Keď je základ dane pod nezdaniteľnou časťou, [[app:priznania|priznania]] ukážu kartu <b>Odpisy vám tento rok daň neznížia</b> s tlačidlom na prerušenie odpisovania. Prerušiť sa dá len celý rok a odpisy sa posunú, nestratia sa.</p>" },
        { nadpis: "Odpisový plán v Exceli",
          html: "<p>[[app:data#xkBox|Kompletný export v nastaveniach]] má hárok <b>Majetok a odpisy</b> s plánom každej veci.</p>" },
      ],
    },
    {
      id: "vyradit",
      nazov: "Vyradiť predanú alebo zlikvidovanú vec",
      kedy: "Vec ste predali, vyhodili, darovali alebo ju ďalej používate len súkromne.",
      kroky: [
        { text: "Pri veci ťuknite na <b>Vyradiť</b>.", tlacidlo: "Vyradiť", snimka: "majetok-vyradit-1" },
        { text: "Zadajte dátum a dôvod vyradenia, pri predaji aj predajnú cenu.", tlacidlo: "Preradenie do osobného užívania" },
        { text: "Pod formulárom skontrolujte, koľko pôjde do výdavkov, a ťuknite na <b>Uložiť</b>.", snimka: "majetok-vyradit-2" },
      ],
      tip: "Vyradenie sa v appke nedá vrátiť — dátum a dôvod skontrolujte ešte pred uložením.",
      podrobnosti: [
        { nadpis: "Predajná cena",
          html: "<p>Predaj zaevidujte aj [[navod:faktury/vystavit|faktúrou]] — appka predajnú cenu do príjmov sama nepridá.</p>" },
        { nadpis: "Auto predané lacnejšie",
          html: "<p>Pri aute, motorke, lodi, lietadle alebo budove zo 6. skupiny sa neodpísaný zvyšok uzná do výdavkov len do výšky predajnej ceny. Okno to prepočíta hneď, ako zadáte cenu.</p>" },
      ],
    },
  ],
},

dokumenty: {
  vJednejVete: "Zmluvy, poistky a certifikáty na jednom mieste aj s koncom platnosti",
  uvod: "Tu evidujete dôležité firemné papiere — zmluvy, dodatky, poistky, certifikáty, živnostenský list. Keď sa blíži koniec platnosti, appka pripomenie.",
  ulohy: [
    {
      id: "pridat",
      nazov: "Uložiť zmluvu alebo iný dokument",
      kedy: "Podpísali ste zmluvu alebo dostali poistku a chcete ju mať po ruke.",
      kroky: [
        { text: "Ťuknite na <b>＋ Dokument</b>.", tlacidlo: "＋ Dokument", snimka: "dokumenty-pridat-1" },
        { text: "Vyplňte názov a vyberte typ — zmluva, poistka, certifikát a podobne." },
        { text: "Pri <b>Súbor</b> vyberte PDF, obrázok alebo súbor Word či Excel.", snimka: "dokumenty-pridat-2" },
        { text: "Ťuknite na <b>Uložiť</b>." },
      ],
      tip: "Súbor sa uloží, len keď ste prihlásení do cloudu — v lokálnom režime appka uloží záznam bez súboru.",
      podrobnosti: [
        { nadpis: "Otvoriť, upraviť, zmazať",
          html: "<p>Ťuknite na dokument v zozname. V okne je <b>👁 Otvoriť súbor</b>, <b>✎ Upraviť</b> a <b>🗑 Zmazať</b> — zmazaním sa odstráni aj priložený súbor.</p>" },
        { nadpis: "Nová verzia súboru",
          html: "<p>Pri úprave dokumentu vyberte nový súbor — nahradí pôvodný.</p>" },
      ],
    },
    {
      id: "platnost",
      nazov: "Nezmeškať koniec zmluvy alebo poistky",
      kedy: "Zmluva alebo poistka platí do určitého dňa a treba ju včas predĺžiť alebo vypovedať.",
      kroky: [
        { text: "Pri dokumente vyplňte <b>Platnosť do</b>.", tlacidlo: "Platnosť do" },
        { text: "Od 60 dní pred koncom ho appka ukáže hore v zozname dokumentov.", tlacidlo: "Blížiaca sa expirácia", snimka: "dokumenty-platnost-1" },
        { text: "Od 30 dní pred koncom pripomenie aj v zvončeku a na úvodnej obrazovke." },
      ],
      tip: "V [[app:kalendar|kalendári]] je koniec platnosti vidieť už 90 dní vopred.",
      podrobnosti: [
        { nadpis: "Zmluvu ste predĺžili",
          html: "<p>Upravte dokument a zmeňte <b>Platnosť do</b> — pripomienky sa posunú na nový dátum.</p>" },
      ],
    },
  ],
},

dovolenka: {
  vJednejVete: "Koľko dní voľna ste si tento rok dali a koľko ešte ostáva",
  uvod: "Živnostník nárok na platenú dovolenku zo zákona nemá — tento prehľad je pre vás. Dni voľna zapíšete ručne alebo ich appka prevezme z [[app:vykazy|výkazov prác]].",
  ulohy: [
    {
      id: "zapisat",
      nazov: "Zapísať dni voľna",
      kedy: "Vrátili ste sa z dovolenky a chcete vedieť, koľko dní ešte ostáva.",
      kroky: [
        { text: "Pri <b>Ročný nárok:</b> nastavte, koľko dní voľna si na rok plánujete.", tlacidlo: "Ročný nárok:" },
        { text: "V tabuľke vpíšte pri mesiaci počet dní voľna.", snimka: "dovolenka-zapisat-1" },
        { text: "Hore uvidíte vyčerpané dni a zostatok." },
      ],
      tip: "Prázdne políčko berie dni z výkazov prác; číslo, ktoré vpíšete, má pred nimi prednosť.",
      podrobnosti: [
        { nadpis: "Ďalší rok",
          html: "<p>Tlačidlom <b>＋ Rok</b> pridáte ďalší rok; medzi rokmi prepínate hore.</p>" },
        { nadpis: "Prehľad v Exceli",
          html: "<p><b>📊 Export XLSX</b> stiahne čerpanie dovolenky do Excelu.</p>" },
      ],
    },
    {
      id: "vykaz",
      nazov: "Prevziať dovolenku z výkazu prác",
      kedy: "Vediete výkazy prác a deň voľna chcete zapísať len raz.",
      kroky: [
        { text: "Vo výkaze prác pri dni zaškrtnite <b>°</b> — deň dovolenky ([[navod:vykazy/novy|ako vyplniť výkaz]]).", tlacidlo: "Deň dovolenky", snimka: "dovolenka-vykaz-1" },
        { text: "V dovolenke sa deň sám započíta v stĺpci <b>Z výkazov</b>.", tlacidlo: "Z výkazov" },
      ],
      tip: "Deň so značkou ° sa vo výkaze nezapočíta do odpracovaných dní.",
      podrobnosti: [
        { nadpis: "Deň dovolenky s hodinami",
          html: "<p>Keď má deň so značkou ° zapísané hodiny, výkaz na to upozorní a ponúkne značku zrušiť — hodiny sa totiž počítajú do fakturácie.</p>" },
      ],
    },
  ],
},

zdielanie: {
  vJednejVete: "Pustiť do firmy účtovníka a určiť, čo smie",
  uvod: "Tu pozvete do firmy účtovníka alebo niekoho, kto má vaše čísla len vidieť. Zdieľanie funguje len s prihlásením do cloudu a prístupy spravuje vlastník firmy.",
  ulohy: [
    {
      id: "pozvat",
      nazov: "Pozvať účtovníka",
      kedy: "Chcete, aby účtovník videl vaše doklady a viedol agendu priamo v appke.",
      kroky: [
        { text: "Vpíšte <b>E-mail pozývaného</b> a vyberte rolu: <b>Účtovník</b> môže zapisovať, <b>Náhľad</b> len pozerá.", tlacidlo: "E-mail pozývaného" },
        { text: "Ťuknite na <b>＋ Vytvoriť pozvánku</b> — appka pošle na ten e-mail odkaz.", tlacidlo: "Vytvoriť pozvánku" },
        { text: "Pozvaný otvorí odkaz a prihlási sa účtom s tou istou e-mailovou adresou." },
      ],
      tip: "E-mail neprišiel? V časti <b>Čakajúce pozvánky</b> ho pošlete znova tlačidlom <b>✉</b> alebo odkaz skopírujete cez <b>Kopírovať odkaz</b>.",
      podrobnosti: [
        { nadpis: "Preposlaný odkaz nefunguje",
          html: "<p>Pozvánku prijme len účet s adresou, na ktorú bola vystavená — preposlanie odkazu inému človeku prístup neudelí.</p>" },
        { nadpis: "Čo sa zmení, keď máte účtovníka",
          html: "<p>Kým má firma človeka s rolou Účtovník, [[app:banka|banka]], [[app:dph|DPH]], [[app:priznania|priznania]], [[app:majetok|majetok]] a [[app:uzavierka|uzávierka]] sú pre vás len na čítanie — aby ste si navzájom neprepisovali prácu.</p><p>Ak chcete zapisovať aj vy, zaškrtnite tu <b>Chcem do tejto agendy zapisovať aj ja</b>.</p>" },
      ],
    },
    {
      id: "odvolat",
      nazov: "Odobrať prístup",
      kedy: "Spolupráca s účtovníkom skončila alebo ste pozvali nesprávnu adresu.",
      kroky: [
        { text: "V časti <b>Kto má prístup</b> ťuknite pri človeku na <b>Odvolať</b>.", tlacidlo: "Kto má prístup" },
        { text: "Potvrďte — prístup stratí okamžite." },
      ],
      tip: "Pozvánku, ktorú ešte nikto neprijal, zrušíte v časti <b>Čakajúce pozvánky</b> tlačidlom <b>✕</b> — odkaz prestane platiť.",
    },
  ],
},
// ───────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────── KNIHA JÁZD
// (miesto pre návody: jazdy)
// ───────────────────────────────────────────────────────────────────────

// ────────────────────────────────── KALENDÁR, ŠTATISTIKY, NASTAVENIA
// (miesto pre návody: kalendar, superdash, data)
// ───────────────────────────────────────────────────────────────────────

},
};
