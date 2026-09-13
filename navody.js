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
kalendar: {
  vJednejVete: "Kedy čo zaplatiť a podať — a vlastné pripomienky",
  uvod: "Kalendár sám dopočíta daňové a odvodové termíny z vašich [[app:data|nastavení]] — DPH, odvody, preddavky aj daňové priznanie. Pridať si môžete aj vlastné udalosti.",
  ulohy: [
    {
      id: "terminy",
      nazov: "Zistiť, čo ma v najbližších týždňoch čaká",
      kedy: "Keď chcete vedieť, čo treba zaplatiť alebo podať a dokedy.",
      kroky: [
        { text: "V zozname <b>Nadchádzajúce</b> je najbližší termín hore — s dátumom a počtom dní, ktoré zostávajú.", tlacidlo: "Nadchádzajúce", snimka: "kalendar-terminy-1" },
        { text: "Termín, ktorý sa opakuje, je zbalený do jedného riadka — ďalšie dátumy ukáže ťuknutie na <b>ďalších … v kalendári</b>.", tlacidlo: "v kalendári", snimka: "kalendar-terminy-2" },
      ],
      tip: "Termíny, ktoré sú do 14 dní, appka ukáže aj na ploche v časti <b>Vyžaduje pozornosť</b> — kalendár netreba otvárať každý deň.",
      podrobnosti: [
        { nadpis: "Prečo mi nejaký termín chýba",
          html: "<p>Termín sa ukáže, len keď k nemu appka má údaj: sociálne odvody pri vyplnených [[app:data#set_socOdvodyMes|mesačných sociálnych odvodoch]], preddavok na daň pri vyplnenom [[app:data#set_preddavokDanQ|štvrťročnom preddavku]] a DPH, keď má firma vyplnené [[app:data#set_icdph|IČ DPH]].</p>" },
        { nadpis: "Termín cez víkend a ako ďaleko dopredu",
          html: "<p>Keď lehota pripadne na sobotu alebo nedeľu, appka ju posunie na pondelok. Štátne sviatky nepozná. Kalendár ukazuje termíny na pol roka dopredu.</p>" },
      ],
    },
    {
      id: "udalost",
      nazov: "Pripomenúť si vlastnú vec",
      kedy: "Stretnutie s účtovníkom, koniec zmluvy, STK — čokoľvek, na čo nechcete zabudnúť.",
      kroky: [
        { text: "Ťuknite na <b>＋ Udalosť</b>.", tlacidlo: "＋ Udalosť", snimka: "kalendar-udalost-1" },
        { text: "Napíšte názov a vyberte dátum.", snimka: "kalendar-udalost-2" },
        { text: "Pri <b>Pripomienka</b> vyberte, koľko dní vopred sa má ozvať.", tlacidlo: "Pripomienka", snimka: "kalendar-udalost-3" },
        { text: "Ťuknite na <b>Uložiť</b>.", tlacidlo: "Uložiť", snimka: "kalendar-udalost-4" },
      ],
      tip: "Pripomienka sa ukáže na ploche v časti <b>Vyžaduje pozornosť</b> — e-mail ani notifikáciu do telefónu appka neposiela.",
      podrobnosti: [
        { nadpis: "Zmeniť alebo zmazať udalosť",
          html: "<p>Uloženú udalosť upraviť nejde. Zmažte ju krížikom <b>✕</b> v jej riadku a pridajte novú.</p>" },
      ],
    },
    {
      id: "fs",
      nazov: "Mať termíny priamo od Finančnej správy",
      kedy: "Chcete v zozname vidieť aj oficiálne termíny z kalendára Finančnej správy.",
      kroky: [
        { text: "Ťuknite na <b>↧ Načítať termíny FS</b>.", tlacidlo: "Načítať termíny FS", snimka: "kalendar-fs-1" },
        { text: "Oficiálne termíny sa pridajú do zoznamu so značkou 🏛." },
      ],
      tip: "Opätovné načítanie staré termíny FS nahradí — v zozname sa nezdvoja.",
      podrobnosti: [
        { nadpis: "Vlastný kalendár z Google alebo Outlooku",
          html: "<p>Súbor .ics z vlastného kalendára Kalendár nenačíta. Odpracované dni z neho vie načítať [[navod:vykazy/novy|výkaz prác]].</p>" },
        { nadpis: "Odstrániť termíny FS",
          html: "<p>Pod modrým rámčekom je pri počte načítaných termínov odkaz <b>Vymazať</b>.</p>" },
      ],
    },
  ],
},

superdash: {
  vJednejVete: "Ako sa vám darí — rok, porovnanie s minulým a odberatelia",
  uvod: "Štatistiky zhrnú doklady z appky do čísel a grafov: koľko ste zarobili, koľko z toho zoberú dane a odvody, ako sa rok líši od minulého a od koho peniaze chodia.",
  ulohy: [
    {
      id: "rok",
      nazov: "Zistiť, koľko mi z roka ostane",
      kedy: "Priebežne počas roka, keď chcete vedieť, koľko si odložiť na dane a odvody.",
      kroky: [
        { text: "Na ploche ťuknite na dlaždicu <b>Prehľad</b>.", tlacidlo: "Prehľad", snimka: "superdash-rok-1" },
        { text: "V pohľade <b>Rok</b> hore vidíte, koľko odložiť na dane, a čistý príjem.", tlacidlo: "Odložiť na dane", snimka: "superdash-rok-2" },
        { text: "Nižšie je graf príjmov a čistého zisku po mesiacoch a rozdelenie roka na odvody, daň a to, čo ostane.", tlacidlo: "Príjmy a čistý zisk po mesiacoch", snimka: "superdash-rok-3" },
        { text: "Iný rok vyberiete vpravo hore.", snimka: "superdash-rok-4" },
      ],
      tip: "Appka si v tomto prehliadači pamätá naposledy zvolený pohľad aj rok — nabudúce sa otvorí tam, kde ste skončili.",
      podrobnosti: [
        { nadpis: "Odkiaľ sú čísla",
          html: "<p>Z dokladov, ktoré v appke máte. Nezapísaný výdavok alebo nevystavená faktúra čísla skreslí — štatistika je odhad, nie daňové priznanie.</p>" },
        { nadpis: "Pohľad Dane",
          html: "<p>V platených plánoch je navyše pohľad <b>Dane</b> s daňou po mesiacoch a odhadom celého roka. V pláne Free sa neukáže — plány porovnáte v [[navod:data/predplatne|nastaveniach predplatného]].</p>" },
      ],
    },
    {
      id: "trend",
      nazov: "Porovnať rok s minulým",
      kedy: "Chcete vedieť, či rastiete, a v ktorých mesiacoch býva práce menej.",
      kroky: [
        { text: "Ťuknite na <b>Trend</b>.", tlacidlo: "Trend", snimka: "superdash-trend-1" },
        { text: "Hore vidíte, koľko ste za rok fakturovali a o koľko percent je to viac alebo menej než minulý rok; nižšie roky vedľa seba.", tlacidlo: "Rok po roku", snimka: "superdash-trend-2" },
      ],
      tip: "Priebeh roka proti minulému a sezónnosť sa ukážu, až keď máte v appke doklady aspoň za dva roky.",
    },
    {
      id: "odberatelia",
      nazov: "Zistiť, na kom som závislý a kto platí neskoro",
      kedy: "Keď väčšina príjmu chodí od jedného klienta alebo peniaze chodia pomaly.",
      kroky: [
        { text: "Ťuknite na <b>Odberatelia</b>.", tlacidlo: "Odberatelia", snimka: "superdash-odberatelia-1" },
        { text: "<b>Najväčší podiel</b> ukáže, koľko príjmu prišlo od jedného odberateľa, a <b>Priemerne platia</b>, za koľko dní od vystavenia vám platia.", tlacidlo: "Najväčší podiel", snimka: "superdash-odberatelia-2" },
      ],
      tip: "Keď od jedného odberateľa príde 60 % príjmu alebo viac, appka na to upozorní — pri 90 % pripomenie aj otázku, či nejde o závislú prácu.",
      podrobnosti: [
        { nadpis: "Podľa čoho sa počíta",
          html: "<p>Podľa dátumu úhrady a bez DPH — teda čo naozaj prišlo, nie čo bolo vystavené. Kto vám ešte nezaplatil, uvidíte v [[app:pohladavky|nezaplatených faktúrach]].</p>" },
      ],
    },
  ],
},

data: {
  vJednejVete: "Údaje firmy, predplatné a záloha dát",
  uvod: "Tu vyplníte údaje, ktoré appka dáva na faktúry a do daňových podaní, nastavíte odvody a preddavky a stiahnete si zálohu dát. Väčšinu stačí vyplniť raz — a uložiť tlačidlom <b>Uložiť všetky nastavenia</b> na konci stránky.",
  ulohy: [
    {
      id: "firma",
      nazov: "Vyplniť údaje firmy",
      kedy: "Raz na začiatku — a keď sa zmení adresa, účet v banke alebo sa stanete platiteľom DPH.",
      kroky: [
        { text: "V časti <b>Firemné údaje</b> napíšte IČO.", tlacidlo: "Firemné údaje", snimka: "data-firma-1" },
        { text: "Ťuknite na <b>Doplniť z registra</b> — appka doplní názov a adresu.", tlacidlo: "Doplniť z registra", snimka: "data-firma-2",
          tip: "DIČ a IČ DPH doplní len vtedy, keď ich register má — inak ich dopíšte sami." },
        { text: "Skontrolujte <b>DIČ</b> a <b>IČ DPH</b>; platiteľ DPH vyplní aj <b>Daňový úrad</b>.", tlacidlo: "Daňový úrad", snimka: "data-firma-3" },
        { text: "Nižšie vyplňte <b>IBAN</b> — faktúry dostanú QR kód na platbu.", tlacidlo: "IBAN (pre QR platbu na faktúre)", snimka: "data-firma-4" },
        { text: "Na konci stránky ťuknite na <b>Uložiť všetky nastavenia</b>.", tlacidlo: "Uložiť všetky nastavenia", snimka: "data-firma-5" },
      ],
      tip: "Kým neťuknete na <b>Uložiť všetky nastavenia</b>, vyplnené polia sa neuložia — ani to, čo doplnil register.",
      podrobnosti: [
        { nadpis: "Čo bez DIČ a IČ DPH nefunguje",
          html: "<p>Bez <b>DIČ</b> sa nedajú posielať faktúry sieťou Peppol — [[navod:efaktury/zapnut|ako zapnúť odosielanie]].</p><p>Bez <b>IČ DPH</b>, názvu a adresy appka nevytvorí [[app:dph|priznanie k DPH ani kontrolný výkaz]]. Priznanie k DPH a súhrnný výkaz potrebujú aj <b>Daňový úrad</b> — appka si ho nedomýšľa.</p>" },
        { nadpis: "IBAN a QR kód",
          html: "<p>Appka IBAN nekontroluje — preklep skončí v QR kóde. Po uložení si otvorte PDF [[navod:faktury/poslat|faktúry]] a QR kód skúšobne naskenujte v banke.</p>" },
        { nadpis: "Register neodpovedá",
          html: "<p>Údaje berie appka z registra právnických osôb Štatistického úradu. Keď neodpovie, vyplňte ich ručne — uložia sa rovnako.</p>" },
      ],
    },
    {
      id: "doklady",
      nazov: "Posielať doklady do appky e-mailom",
      kedy: "Faktúry od dodávateľov vám chodia e-mailom a nechcete ich sťahovať a nahrávať.",
      kroky: [
        { text: "V časti <b>Doklady e-mailom</b> skopírujte svoju prijímaciu adresu tlačidlom <b>⧉</b>.", tlacidlo: "Doklady e-mailom" },
        { text: "Doklad na ňu prepošlite ako prílohu e-mailu." },
        { text: "Ťuknite na <b>📨 Schránka dokladov</b> a pri doklade na <b>Spracovať →</b>.", tlacidlo: "Schránka dokladov" },
        { text: "Appka doklad prečíta a predvyplní [[app:vydavky|výdavok]] — skontrolujte ho a uložte." },
      ],
      tip: "Doklad, ktorý príde, sa do evidencie sám nedostane — vždy čaká na vaše potvrdenie.",
      podrobnosti: [
        { nadpis: "V ukážkovom režime časť chýba",
          html: "<p>Doklady e-mailom fungujú len s vlastným účtom prihláseným v cloude — bez neho sa časť Doklady e-mailom v nastaveniach nezobrazí.</p>" },
        { nadpis: "Adresa sa dostala k nesprávnemu človeku",
          html: "<p>V Schránke dokladov vytvoríte novú adresu tlačidlom <b>↻ Nová adresa</b> — stará okamžite prestane fungovať. Jednotlivých odosielateľov zablokujete cez <b>🚫 Blokované adresy</b>.</p>" },
      ],
    },
    {
      id: "predplatne",
      nazov: "Pozrieť si plán a čo v ňom je",
      kedy: "Narazili ste na limit alebo chcete modul, ktorý váš plán nemá.",
      kroky: [
        { text: "V časti <b>Predplatné</b> vidíte svoj plán a koľko faktúr a dokladov v ňom ešte zostáva. Ťuknite na <b>Zobraziť plány a ceny</b>.", tlacidlo: "Zobraziť plány a ceny", snimka: "data-predplatne-1" },
        { text: "Porovnajte plány a ťuknite na <b>Predplatiť</b> pri tom, ktorý chcete.", tlacidlo: "Predplatiť", snimka: "data-predplatne-2" },
      ],
      tip: "Kto už platený plán má, nájde na tom istom mieste tlačidlo <b>Zmeniť plán</b>.",
      podrobnosti: [
        { nadpis: "V ukážkovom režime",
          html: "<p>Plány si pozriete, ale predplatiť ich ide len s vlastným účtom prihláseným v cloude.</p>" },
      ],
    },
    {
      id: "zaloha",
      nazov: "Zálohovať si dáta",
      kedy: "Raz za mesiac — appka vám to pripomenie.",
      kroky: [
        { text: "Hore na stránke ťuknite na <b>⬇ Stiahnuť zálohu</b>.", tlacidlo: "Stiahnuť zálohu", snimka: "data-zaloha-1" },
        { text: "Súbor .json sa uloží medzi stiahnuté súbory — presuňte si ho na disk alebo do vlastného úložiska." },
      ],
      tip: "Keď zálohu 30 dní nestiahnete, ukáže sa na ploche upozornenie s tlačidlom <b>Stiahnuť zálohu</b> — stačí ťuknúť naň.",
      podrobnosti: [
        { nadpis: "Záloha a uloženie do cloudu",
          html: "<p><b>☁ Uložiť do cloudu</b> uloží dáta na server, aby ste ich mali na každom zariadení. Záloha je vaša vlastná kópia v súbore, ku ktorej sa viete vrátiť — [[navod:data/obnovit|ako obnoviť dáta zo zálohy]].</p>" },
      ],
    },
    {
      id: "obnovit",
      nazov: "Obnoviť dáta zo zálohy",
      kedy: "Potrebujete sa vrátiť k stavu, ktorý máte uložený v zálohe.",
      kroky: [
        { text: "Ťuknite na <b>📥 Importovať JSON</b> a vyberte súbor zálohy.", tlacidlo: "Importovať JSON", snimka: "data-obnovit-1" },
        { text: "Appka ukáže názov firmy a koľko faktúr, výdavkov a jázd v súbore je — potvrďte." },
        { text: "Ťuknite na <b>☁ Uložiť do cloudu</b> — až tým sa načítané dáta uložia.", tlacidlo: "Uložiť do cloudu", snimka: "data-obnovit-2" },
      ],
      tip: "Import nič nezlučuje — všetko, čo máte v appke teraz, nahradí obsahom súboru. Ak si nie ste istí, stiahnite si najprv zálohu terajšieho stavu.",
    },
    {
      id: "excel",
      nazov: "Odovzdať dáta účtovníkovi v Exceli",
      kedy: "Účtovník chce všetko za rok v jednom súbore.",
      kroky: [
        { text: "V sprievodcovi exportom ťuknite na <b>Čo exportovať</b> a vyberte rok.", tlacidlo: "Čo exportovať", snimka: "data-excel-1" },
        { text: "V kroku <b>Kontrola dát</b> si pozrite, čo appka našla.", tlacidlo: "Kontrola dát", snimka: "data-excel-2" },
        { text: "V kroku <b>Generovať</b> ťuknite na <b>📊 Stiahnuť kompletný export</b>.", tlacidlo: "Stiahnuť kompletný export", snimka: "data-excel-3" },
      ],
      tip: "Nálezy kontroly export nezastavia — sú tam, aby ste vedeli, čo je v súbore neisté, skôr než ho odovzdáte.",
      podrobnosti: [
        { nadpis: "Čo v súbore je",
          html: "<p>Jeden formátovaný Excel so záložkami. Koľko hárkov a čo v nich bude, ukáže krok <b>Náhľad</b>. Pribaliť môžete aj peňažný denník a jazdy rozdelené po mesiacoch.</p>" },
      ],
    },
  ],
},
// ───────────────────────────────────────────────────────────────────────

},
};
