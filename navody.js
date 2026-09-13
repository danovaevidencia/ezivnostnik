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
vydavky: {
  vJednejVete: "Zapísať, čo ste za podnikanie zaplatili, a vidieť, koľko to je",
  uvod: "Sem patria bločky, došlé faktúry aj tankovanie. Doklad stačí <b>odfotiť alebo preposlať e-mailom</b> — appka z neho vytiahne sumu aj DPH a vy údaje len skontrolujete.",
  ulohy: [
    {
      id: "fotka",
      nazov: "Zapísať bloček alebo faktúru z fotky",
      kedy: "Máte v ruke bloček alebo faktúru v PDF a nechcete ju prepisovať.",
      kroky: [
        { text: "Ťuknite na <b>🧾 Odfotiť / načítať doklad</b>.", tlacidlo: "Odfotiť / načítať doklad", snimka: "vydavky-fotka-1" },
        { text: "Vyberte <b>📷 Odfotiť bloček / doklad</b>, alebo <b>🖼 Načítať zo súboru (PDF / foto)</b>, keď doklad už máte v telefóne či počítači.", tlacidlo: "Odfotiť bloček / doklad", snimka: "vydavky-fotka-2",
          tip: "Bloček z pokladnice má QR kód — appka podľa neho načíta údaje priamo z Finančnej správy a nemusí nič čítať z fotky." },
        { text: "Appka doklad prečíta a ukáže okno <b>Skontrolujte údaje z dokladu</b>. Prejdite dodávateľa, dátum a sumy a opravte, čo nesedí.", tlacidlo: "Skontrolujte údaje z dokladu", snimka: "vydavky-fotka-3" },
        { text: "Ťuknite na <b>Uložiť</b>.", tlacidlo: "Uložiť", snimka: "vydavky-fotka-4" },
      ],
      tip: "Ak ten istý doklad už máte zapísaný, okno to povie hneď hore — <b>⚠ Tento doklad už evidujete.</b> Vtedy ho zavrite, inak sa náklad do daní započíta dvakrát.",
      podrobnosti: [
        { nadpis: "Čo appka z dokladu prečíta",
          html: "<p>Dodávateľa, IČO, IČ DPH, číslo dokladu, dátumy, sumu bez DPH, DPH a sumu spolu. Text sa rozpoznáva priamo vo vašom prehliadači — prvýkrát si appka stiahne jazykové dáta (asi 15 MB).</p><p>Rozpoznanie z fotky nie je vždy presné, preto okno s kontrolou. Keď PDF nesie e-faktúru alebo ide o bloček s QR kódom, údaje sú presné a okno to napíše.</p>" },
        { nadpis: "Prečo appka pýta IČ DPH dodávateľa",
          html: "<p>Keď je na slovenskom doklade DPH, appka ho bez platného IČ DPH dodávateľa neuloží — bez neho si DPH neodpočítate. Nájdete ho na doklade, prípadne v okne pod <b>📄 Čo appka prečítala z dokladu</b>.</p>" },
        { nadpis: "Viac faktúr naraz",
          html: "<p>Viac došlých faktúr v PDF alebo XML načítate spolu cez <b>📥 Import faktúr (XML/PDF)</b>.</p>" },
      ],
    },
    {
      id: "rucne",
      nazov: "Zapísať výdavok ručne",
      kedy: "Doklad nemáte po ruke na odfotenie alebo je rýchlejšie ho prepísať.",
      kroky: [
        { text: "Ťuknite na <b>＋ Nový výdavok</b>.", tlacidlo: "Nový výdavok", snimka: "vydavky-rucne-1" },
        { text: "V časti <b>Rýchle vyplnenie</b> ťuknite na to, čo ste kúpili — appka predvyplní druh dokladu aj kategóriu.", tlacidlo: "Rýchle vyplnenie", snimka: "vydavky-rucne-2" },
        { text: "Doplňte dodávateľa a v poli <b>Do čoho to patrí</b> skontrolujte kategóriu.", tlacidlo: "Do čoho to patrí", snimka: "vydavky-rucne-3",
          tip: "Dodávateľa stačí začať písať a vybrať zo zoznamu — appka doplní jeho IČO z registra, IČ DPH vtedy, keď ho register pozná." },
        { text: "Vyplňte dátum dodania a sumu a ťuknite na <b>Uložiť</b>.", snimka: "vydavky-rucne-4" },
      ],
      tip: "Nájom, energie či predplatné, ktoré chodia každý mesiac, zaškrtnite v doklade ako <b>Tento doklad mi chodí pravidelne</b> — appka vám ich potom pripomenie pod <b>🔁 Opakované</b>.",
      podrobnosti: [
        { nadpis: "Kategória a daň",
          html: "<p>Kategória rozhoduje, či výdavok zníži daň. <b>Neovplyvňuje základ dane</b> je pre súkromné nákupy, splátky istiny úveru či prevody medzi vlastnými účtami — do daní nevstupuje. Ostatné bežné kategórie daň znižujú.</p><p>Vlastnú kategóriu pridať nejde, zoznam je pevný.</p>" },
        { nadpis: "Vec používate aj súkromne",
          html: "<p>Pri bežných kategóriách je vo formulári pole <b>Koľko z toho je na podnikanie</b>. Zadajte len podnikateľskú časť — do daní appka započíta len tú. Tankovanie a doklady k osobnému autu majú vlastné pravidlá.</p>" },
        { nadpis: "Odvody a preddavky",
          html: "<p>Preddavky na zdravotné a sociálne poistenie a platby dane zapisujete tiež sem, s kategóriou podľa platby. V prehľade sú na dlaždici <b>Odvody a dane</b>, mimo súčtu výdavkov.</p>" },
      ],
    },
    {
      id: "email",
      nazov: "Posielať doklady e-mailom",
      kedy: "Dodávateľ vám faktúru posiela e-mailom a nechcete ju sťahovať a nahrávať.",
      kroky: [
        { text: "Ťuknite na <b>🧾 Odfotiť / načítať doklad</b> a vyberte <b>📨 Doklady e-mailom</b>.", tlacidlo: "Doklady e-mailom", snimka: "vydavky-email-1" },
        { text: "Skopírujte adresu z poľa <b>Vaša prijímacia adresa</b> a faktúry na ňu preposielajte.", tlacidlo: "Vaša prijímacia adresa" },
        { text: "Keď doklad príde, v tom istom okne pri ňom ťuknite na <b>Spracovať →</b>.", tlacidlo: "Spracovať →" },
        { text: "Skontrolujte údaje a ťuknite na <b>Uložiť</b>. Ak doklad už evidujete, okno to povie hneď hore.", tlacidlo: "Tento doklad už evidujete", snimka: "vydavky-email-4" },
      ],
      tip: "Koľko dokladov čaká, ukazuje číslo pri <b>📨 Doklady e-mailom</b>. Adresu si uložte medzi kontakty — preposlať faktúru je potom otázka pár ťuknutí.",
      podrobnosti: [
        { nadpis: "Funguje po prihlásení",
          html: "<p>Doklady e-mailom potrebujú účet v cloude. V ukážkovom režime appka namiesto okna ukáže upozornenie. Adresu nájdete aj v [[app:data#dmKarta|nastaveniach]].</p>" },
        { nadpis: "Kto môže na adresu posielať",
          html: "<p>Ktokoľvek. Odosielateľa, od ktorého nič nechcete, zablokujete v tom istom okne cez <b>🚫 Blokované adresy</b>. Keď adresa unikne, <b>↻ Nová adresa</b> vám pridelí inú a stará prestane fungovať.</p>" },
        { nadpis: "Ako appka pozná, že doklad už máte",
          html: "<p>Rovnaké číslo dokladu, alebo rovnaká suma aj dátum od toho istého dodávateľa. Pri preposlaných faktúrach sa to stáva ľahko — napríklad keď ste ju predtým už odfotili.</p>" },
        { nadpis: "Výpis z banky e-mailom",
          html: "<p>Na adresu môžete poslať aj výpis z účtu. Pri ňom je namiesto <b>Spracovať →</b> tlačidlo <b>Importovať →</b> a pohyby pribudnú do [[app:banka|banky]].</p>" },
      ],
    },
    {
      id: "uhrada",
      nazov: "Označiť, že výdavok je zaplatený",
      kedy: "Zaplatili ste v hotovosti alebo appka platbu vo výpise nenašla.",
      kroky: [
        { text: "Pri nezaplatenom výdavku ťuknite na <b>✓</b>.", snimka: "vydavky-uhrada-1" },
        { text: "Vyberte, ako ste platili — kartou, prevodom, v hotovosti alebo inak.", tlacidlo: "Ako bol doklad uhradený?", snimka: "vydavky-uhrada-2",
          tip: "Pri karte a prevode appka ešte počká na výpis z banky a úhradu podľa neho overí; hotovosť ostane potvrdená ručne." },
      ],
      tip: "Ak nahrávate [[app:banka|výpisy z banky]], platbu k výdavku appka priradí sama, keď je zhoda jednoznačná. Ručne označujte hlavne hotovosť.",
      podrobnosti: [
        { nadpis: "Čo znamenajú značky v stĺpci Stav",
          html: "<p>○ neuhradené · ◐ potvrdené ručne · ● overené výpisom · ◑ čiastočne uhradené · ✕ výpis úhradu nepotvrdzuje. Ťuknutím na značku (okrem ●) priradíte platbu z banky ručne.</p>" },
        { nadpis: "Viac výdavkov naraz",
          html: "<p>Zaškrtnite výdavky v zozname — ukáže sa pás <b>✓ Označiť uhradené</b>.</p>" },
        { nadpis: "Označil som omylom",
          html: "<p>Pri ručne potvrdenom výdavku je v riadku tlačidlo <b>✕</b>, ktoré úhradu zruší.</p>" },
        { nadpis: "Komu ešte dlžím",
          html: "<p>Nezaplatené došlé faktúry nájdete v [[app:pohladavky|pohľadávkach]] na záložke <b>Záväzky</b>.</p>" },
      ],
    },
    {
      id: "prehlad",
      nazov: "Zistiť, koľko som minul za mesiac alebo rok",
      kedy: "Chcete vedieť, koľko ste minuli, alebo kontrolujete podklady k DPH.",
      kroky: [
        { text: "Hore vidíte výdavky bez DPH, pod nimi tú istú sumu s DPH a vedľa DPH na odpočet (ak ste platiteľ DPH).", snimka: "vydavky-prehlad-1" },
        { text: "Nad zoznamom vyberte rok a mesiac — predvolený je <b>celý rok</b>.", tlacidlo: "celý rok", snimka: "vydavky-prehlad-2" },
        { text: "V treťom výbere určte, podľa ktorého dátumu sa výdavky zaraďujú — predvolené je <b>podľa obdobia dane</b>.", tlacidlo: "podľa obdobia dane", snimka: "vydavky-prehlad-3",
          tip: "Pri kontrole DPH prepnite na <b>podľa dátumu dodania</b> — tak sa doklady zaraďujú do DPH." },
      ],
      tip: "Hľadáte konkrétny doklad? Do poľa s lupou napíšte partnera, číslo, popis alebo sumu.",
      podrobnosti: [
        { nadpis: "Tri dátumy, tri otázky",
          html: "<p><b>podľa obdobia dane</b> — mesiac, v ktorom ste doklad zaplatili; kým zaplatený nie je, mesiac dokladu. Tak appka počíta daň z príjmov a na to sedia súčty hore.</p><p><b>podľa dátumu dodania</b> — obdobie DPH, podľa neho sa kontroluje priznanie k DPH a kontrolný výkaz.</p><p><b>podľa dátumu úhrady</b> — len zaplatené doklady. Nezaplatené tu nie sú, v tom období peniaze neodišli.</p><p>Pri dodaní a úhrade idú súčty hore za zobrazené doklady, nie za základ dane.</p>" },
        { nadpis: "Prečo odvody nie sú vo výdavkoch",
          html: "<p>Preddavky na poistné a platby dane sú na dlaždici <b>Odvody a dane</b>, mimo súčtu výdavkov. Do dane vstupujú inou cestou než bežný nákup — keby boli aj medzi výdavkami, poistné by sa odpočítalo dvakrát.</p>" },
      ],
    },
  ],
},
// ───────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────── BANKA
banka: {
  vJednejVete: "Nahrať výpis z účtu a priradiť platby k dokladom",
  uvod: "Sem nahrávate výpisy z podnikateľského účtu. Appka z nich vezme pohyby a priradí platby k [[app:faktury|faktúram]] a [[app:vydavky|výdavkom]] tam, kde je zhoda jasná. Zvyšok nechá na vás — v zozname je podfarbený ako <b>nespárované</b>.",
  ulohy: [
    {
      id: "vypis",
      nazov: "Nahrať výpis z banky",
      kedy: "Keď banka vystaví mesačný výpis, alebo keď chcete mať platby v appke aktuálne.",
      kroky: [
        { text: "V internet bankingu si stiahnite výpis vo formáte <b>XML</b> (SEPA, camt.053). Býva vedľa PDF, niekedy zabalený v ZIP." },
        { text: "Ťuknite na <b>📥 Import výpisu</b> a vyberte stiahnutý súbor.", tlacidlo: "Import výpisu", snimka: "banka-vypis-1" },
        { text: "Appka povie, koľko pohybov pridala a koľko platieb rovno priradila k dokladom." },
        { text: "Čo sa nepriradilo, [[navod:banka/rucne|priradíte ručne]] alebo [[navod:banka/bez-dokladu|vybavíte bez dokladu]]." },
      ],
      tip: "Ten istý výpis nahratý druhýkrát nič nezdvojí — appka pozná pohyby, ktoré už má, a pridá len nové.",
      podrobnosti: [
        { nadpis: "Banka dáva len PDF",
          html: "<p>Výber súboru ponúka XML a ZIP. V internet bankingu hľadajte export označený „XML“, „SEPA“ alebo „camt.053“ — býva pri výpise hneď vedľa PDF.</p>" },
        { nadpis: "Výpis v zaheslovanom ZIP",
          html: "<p>Appka sa na heslo opýta. Heslo posiela banka, zvyčajne v sprievodnom e-maile. Keď sedí, ponúkne, že si ho zapamätá — len na tomto zariadení, do cloudu sa neposiela.</p>" },
        { nadpis: "Plán Free",
          html: "<p>Vo Free sú tri importy výpisu. Počíta sa len import, ktorý niečo pridal — omylom znova nahratý výpis limit neminie.</p>" },
      ],
    },
    {
      id: "email",
      nazov: "Posielať výpisy e-mailom",
      kedy: "Banka vám výpis posiela e-mailom a nechcete ho sťahovať a nahrávať ručne.",
      kroky: [
        { text: "V [[app:data#dmKarta|nastaveniach — Doklady e-mailom]] skopírujte svoju prijímaciu adresu." },
        { text: "Prepošlite na ňu e-mail s výpisom v prílohe (XML alebo ZIP)." },
        { text: "Ťuknite na <b>📨 Schránka dokladov</b> a pri výpise s ikonou 🏦 na <b>Importovať →</b>.", tlacidlo: "Importovať →" },
      ],
      tip: "ZIP appka spozná ako výpis vždy, XML len keď má v názve dlhé číslo, aké dáva banka — súbor preto nepremenúvajte.",
      podrobnosti: [
        { nadpis: "Nič sa nezapíše samo",
          html: "<p>Výpis čaká v schránke, kým ho neimportujete. Import ide tou istou cestou ako zo súboru — rovnaká kontrola, či pohyby už nemáte, aj rovnaký limit plánu.</p>" },
        { nadpis: "Potvrdenia o platbách z internet bankingu",
          html: "<p>Prepošlite aj e-maily, ktorými banka hlási jednotlivé platby. V schránke sú v časti <b>Pohyby na účte</b> a do Banky ich dostanete tlačidlom <b>Pridať</b>. V zozname pohybov majú značku ✉ — mesačný výpis ich neskôr nahradí.</p>" },
        { nadpis: "V ukážkovej firme to nejde",
          html: "<p>Schránka dokladov funguje len s vlastným účtom, nie v ukážke.</p>" },
      ],
    },
    {
      id: "automat",
      nazov: "Skontrolovať, čo appka priradila sama",
      kedy: "Zvonček hlási, že appka priradila platby k dokladom.",
      kroky: [
        { text: "Ťuknite na <b>🔔</b>.", snimka: "banka-automat-1" },
        { text: "Ťuknite na upozornenie <b>Priradených … platieb</b>.", tlacidlo: "Priradených", snimka: "banka-automat-2" },
        { text: "Banka ukáže presne tieto platby. Celý zoznam vrátite tlačidlom <b>Zobraziť celý zoznam</b>.", tlacidlo: "Zobraziť celý zoznam", snimka: "banka-automat-3" },
        { text: "Ak priradenie nesedí, ťuknite na platbu a pri doklade na <b>odobrať</b>.", tlacidlo: "odobrať", snimka: "banka-automat-4",
          tip: "Priradenie, ktoré odoberiete, už appka tej platbe sama nevráti." },
      ],
      tip: "Appka priradí platbu sama, len keď jeden doklad vychádza jasne najlepšie. Keď sedia dva podobne, nechá výber na vás.",
      podrobnosti: [
        { nadpis: "Podľa čoho appka páruje",
          html: "<p>Prijatú platbu s variabilným symbolom priradí rovno k faktúre s tým číslom.</p><p>Inak porovná doklady podľa <b>sumy</b>, <b>variabilného symbolu</b>, <b>čísla účtu</b>, <b>partnera</b> a <b>vzdialenosti dátumov</b>. Sama priradí len vtedy, keď sedí suma a k nej ešte niečo silné, dátumy nie sú ďaleko od seba a žiadny iný doklad nevychádza podobne. Napríklad dve rovnaké mesačné faktúry od toho istého dodávateľa nechá na vás.</p>" },
        { nadpis: "Kedy appka páruje",
          html: "<p>Pri importe výpisu, pri otvorení appky a pri uložení nového dokladu — ten si nájde svoju platbu, ak už je vo výpise.</p>" },
      ],
    },
    {
      id: "rucne",
      nazov: "Priradiť platbu k dokladu ručne",
      kedy: "Platba ostala nespárovaná, hoci doklad k nej máte.",
      kroky: [
        { text: "Ťuknite na <b>Nespárované</b>.", tlacidlo: "Nespárované", snimka: "banka-rucne-1" },
        { text: "Ťuknite na platbu v zozname.", snimka: "banka-rucne-2" },
        { text: "Ťuknite na doklad, ktorý bol touto platbou zaplatený. Ten, ktorý appka odporúča, má ⭐.", tlacidlo: "Ťuknite na doklad", snimka: "banka-rucne-3",
          tip: "Pri každom doklade appka píše, čo sedí — suma, VS, partner, dátum —, takže vidíte, prečo ho ponúka." },
      ],
      tip: "Na počítači je pohodlnejšia záložka <b>Párovanie</b>: platby a doklady v dvoch stĺpcoch. <b>⇄ Otočiť</b> prehodí smer — vyberiete doklad a hľadáte platbu.",
      podrobnosti: [
        { nadpis: "Jedna platba za viac dokladov",
          html: "<p>Po priradení prvého dokladu appka povie, koľko z platby ešte ostáva. Ťuknite na ďalší doklad.</p>" },
        { nadpis: "Doklad v ponuke nie je",
          html: "<p>Appka ponúka doklady, pri ktorých sedí suma alebo variabilný symbol, prípadne partner s dátumom do 30 dní. Zaplatené doklady vynecháva.</p><p>Ak doklad chýba, skontrolujte jeho sumu a dátum. Alebo ho nájdite vo [[app:faktury|faktúrach]] či [[app:vydavky|výdavkoch]] a ťuknite na jeho stav úhrady — appka ukáže platby, ktoré k nemu sedia.</p>" },
        { nadpis: "Priradil som omylom",
          html: "<p>V okne platby je pod <b>Touto platbou máte zaplatené</b> pri každom doklade <b>odobrať</b>. Platba sa vráti medzi nespárované.</p>" },
      ],
    },
    {
      id: "bez-dokladu",
      nazov: "Vybaviť platbu, ku ktorej doklad nie je",
      kedy: "Bankový poplatok, odvody, daň alebo súkromná platba — nič, k čomu máte faktúru.",
      kroky: [
        { text: "Ťuknite na platbu v zozname." },
        { text: "Výdavok podnikania bez faktúry? Ťuknite na <b>+ Vytvoriť výdavok z platby</b> — appka založí interný doklad a rovno ho priradí.", tlacidlo: "Vytvoriť výdavok z platby", snimka: "banka-bez-dokladu-1",
          tip: "Interný doklad je bez DPH. Keď k platbe máte faktúru s DPH, zvoľte radšej <b>✎ Výdavok s DPH…</b>." },
        { text: "Súkromná platba? Ťuknite na <b>🗄 Skryť pohyb</b> — zmizne z nespárovaných aj zo súčtov.", tlacidlo: "Skryť pohyb", snimka: "banka-bez-dokladu-2" },
        { text: "Opakuje sa to s tou istou protistranou? Ťuknite na <b>⊘ Vždy ignorovať takéto pohyby</b>.", tlacidlo: "Vždy ignorovať takéto pohyby", snimka: "banka-bez-dokladu-3" },
      ],
      tip: "Vklady a prevody zo súkromného účtu vybavíte naraz: dole v časti <b>Pravidlá ignorovania</b> pridajte jeho číslo cez <b>+ IBAN</b>.",
      podrobnosti: [
        { nadpis: "Kde nájdem skryté a ignorované",
          html: "<p>Nad zoznamom pribudnú filtre <b>⊘ ignorované</b> a <b>🗄 skryté</b>. Skrytú platbu vrátite v jej okne tlačidlom <b>↺ Obnoviť pohyb</b>. Pravidlo zmažete v časti <b>Pravidlá ignorovania</b> krížikom pri ňom.</p>" },
        { nadpis: "Skrytie zruší priradenie",
          html: "<p>Ak mala platba priradený doklad, skrytím sa priradenie zruší. Appka sa predtým opýta.</p>" },
        { nadpis: "Ako funguje „Vždy ignorovať“",
          html: "<p>Pridá pravidlo s názvom protistrany. Ignorovať sa budú všetky platby, v ktorých názve alebo popise sa ten text objaví — aj budúce.</p>" },
      ],
    },
    {
      id: "prehlad",
      nazov: "Pozrieť, koľko prišlo a odišlo a či nechýba výpis",
      kedy: "Pred daňovým priznaním, alebo keď chcete vedieť, ako na tom účet je.",
      kroky: [
        { text: "Hore vidíte príjmy, výdaje, saldo a koľko platieb je spárovaných. Pod tým je súhrn po mesiacoch.", snimka: "banka-prehlad-1" },
        { text: "Príjmy a výdaje v dvoch stĺpcoch ukáže <b>⇄ vedľa seba</b>.", tlacidlo: "vedľa seba", snimka: "banka-prehlad-2" },
        { text: "Dole v časti <b>Pokrytie výpismi</b> appka upozorní, ak medzi nahratými výpismi chýba mesiac.", tlacidlo: "Pokrytie výpismi", snimka: "banka-prehlad-3" },
      ],
      tip: "V platenom pláne overí, či nechýba jediná platba, [[app:knihy#dennikBox|peňažný denník]] — porovná zostatky, ktoré hlási banka, so súčtom pohybov.",
      podrobnosti: [
        { nadpis: "Prečo niektoré platby v súčtoch nie sú",
          html: "<p>Súčty sú bez skrytých a ignorovaných platieb. Appka to pod nimi napíše a odkazom <b>zobraziť</b> ich ukáže.</p>" },
        { nadpis: "Zoznam nahratých výpisov",
          html: "<p>Je v časti <b>Pokrytie výpismi</b> pod <b>Nahraté výpisy</b>. Pôvodný súbor stiahnete tlačidlom <b>⬇</b>, ak sa uchoval.</p>" },
      ],
    },
  ],
},
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
