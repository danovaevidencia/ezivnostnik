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
  uvod: "Tu vystavujete faktúry odberateľom a vidíte, ktoré sú zaplatené. Ak do appky nahrávate [[navod:banka/vypis|výpisy z banky]], zaplatenie sa doplní <b>samo</b>.",
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
      tip: "Ak nahrávate [[navod:banka/vypis|výpisy z banky]], netreba nič označovať — appka platbu priradí k faktúre sama podľa sumy a variabilného symbolu. Ručne označujte len to, čo cez účet neprešlo.",
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
      tip: "Keď appka nájde platbu vo [[navod:banka/vypis|výpise z banky]], faktúra sa označí ako uhradená sama.",
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
        { text: "Appka predvyplní výdavok v tom istom okne ako pri [[navod:vydavky/fotka|doklade z fotky]]. Skontrolujte ho a ťuknite na <b>Uložiť</b>." },
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
        { nadpis: "Kúpili ste vec, ktorá poslúži roky",
          html: "<p>Počítač, auto či stroj po uložení výdavku zaraďte do majetku — [[navod:majetok/zaradit|ako zaradiť kúpu do majetku]].</p>" },
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
          html: "<p>Na adresu môžete poslať aj výpis z účtu. Pri ňom je namiesto <b>Spracovať →</b> tlačidlo <b>Importovať →</b> — [[navod:banka/email|ako posielať výpisy e-mailom]].</p>" },
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
      tip: "Ak nahrávate [[navod:banka/vypis|výpisy z banky]], platbu k výdavku appka priradí sama, keď je zhoda jednoznačná. Ručne označujte hlavne hotovosť.",
      podrobnosti: [
        { nadpis: "Čo znamenajú značky v stĺpci Stav",
          html: "<p>○ neuhradené · ◐ potvrdené ručne · ● overené výpisom · ◑ čiastočne uhradené · ✕ výpis úhradu nepotvrdzuje. Ťuknutím na značku (okrem ●) priradíte platbu z banky ručne — [[navod:banka/rucne|ako priradiť platbu k dokladu]].</p>" },
        { nadpis: "Viac výdavkov naraz",
          html: "<p>Zaškrtnite výdavky v zozname — ukáže sa pás <b>✓ Označiť uhradené</b>.</p>" },
        { nadpis: "Označil som omylom",
          html: "<p>Pri ručne potvrdenom výdavku je v riadku tlačidlo <b>✕</b>, ktoré úhradu zruší.</p>" },
        { nadpis: "Komu ešte dlžím",
          html: "<p>Nezaplatené došlé faktúry nájdete v pohľadávkach na záložke <b>Záväzky</b> — [[navod:pohladavky/prehlad|ako zistiť, kto komu dlží]].</p>" },
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
        { nadpis: "Adresa je tá istá ako na doklady",
          html: "<p>Na výpisy aj na faktúry od dodávateľov máte jednu adresu a jednu schránku. Blokovanie odosielateľov a novú adresu opisuje [[navod:vydavky/email|návod k dokladom e-mailom]].</p>" },
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
          html: "<p>Appka ponúka doklady, pri ktorých sedí suma alebo variabilný symbol, prípadne partner s dátumom do 30 dní. Zaplatené doklady vynecháva.</p><p>Ak doklad chýba, skontrolujte jeho sumu a dátum. Alebo ho nájdite vo [[app:faktury|faktúrach]] či [[app:vydavky|výdavkoch]] a ťuknite na jeho stav úhrady — appka ukáže platby, ktoré k nemu sedia.</p><p>Keď doklad v appke ešte vôbec nie je, najprv ho [[navod:vydavky/rucne|zapíšte]].</p>" },
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
      tip: "V platenom pláne overí, či nechýba jediná platba, [[navod:knihy/dennik|peňažný denník]] — porovná zostatky, ktoré hlási banka, so súčtom pohybov.",
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
dph: {
  vJednejVete: "Pripraviť kontrolný výkaz a priznanie k DPH na nahratie na portál",
  uvod: "Appka z vašich faktúr a výdavkov zostaví kontrolný výkaz a priznanie k DPH ako súbory XML. <b>Podávate ich sami</b> — nahráte ich na portál Finančnej správy. Za správnosť zodpovedá platiteľ.",
  ulohy: [
    {
      id: "podat",
      nazov: "Pripraviť kontrolný výkaz a priznanie k DPH",
      kedy: "Po skončení mesiaca alebo štvrťroka, keď máte zapísané faktúry aj výdavky.",
      kroky: [
        { text: "Na záložke <b>🧾 Kontrolný výkaz a priznanie</b> vyberte obdobie.", tlacidlo: "Kontrolný výkaz a priznanie", snimka: "dph-podat-1",
          tip: "Ak podávate štvrťročne, vo výbere pri obdobiach prepnite na <b>štvrťročný platiteľ</b>." },
        { text: "Prejdite rámček <b>Skontrolujte pred podaním</b> a opravte, čo appka našla.", tlacidlo: "Skontrolujte pred podaním", snimka: "dph-podat-2",
          tip: "Chýbajúce IČ DPH dodávateľov doplníte naraz tlačidlom <b>✨ Doplniť chýbajúce IČ DPH</b> — z uložených partnerov alebo z registra." },
        { text: "Ťuknite na <b>↧ Kontrolný výkaz (XML)</b>.", tlacidlo: "Kontrolný výkaz (XML)", snimka: "dph-podat-3" },
        { text: "Appka podanie ešte raz skontroluje. Keď niečo nájde, ukáže to v okne — súbor stiahnete potvrdením, alebo okno zatvoríte a doklad opravíte.", tlacidlo: "Kontrola pred podaním", snimka: "dph-podat-4" },
        { text: "Rovnako stiahnite <b>↧ Priznanie DPH (XML)</b> a oba súbory nahrajte na portál Finančnej správy.", tlacidlo: "Priznanie DPH (XML)", snimka: "dph-podat-5" },
      ],
      tip: "Vedľa voľby <b>Druh podania</b> appka ukazuje, koľko dní ostáva do termínu — 25. dňa po skončení obdobia, pri víkende alebo sviatku najbližšieho pracovného dňa.",
      podrobnosti: [
        { nadpis: "Appka za vás nepodáva",
          html: "<p>Stiahnutie súboru nie je podanie. Súbory nahráte na portáli Finančnej správy a potvrdenie o podaní nájdete v schránke na portáli.</p><p>Kópiu každého stiahnutého súboru si appka odloží na záložku <b>📁 Odoslané podania</b>.</p>" },
        { nadpis: "Kedy súbor nevznikne",
          html: "<p>Keď doklad nemá číslo, dátum alebo číslo opravovanej faktúry, ktoré tlačivo vyžaduje, okno napíše <b>Podanie sa nedá vygenerovať</b> — portál by taký súbor odmietol. Údaj doplňte cez <b>Opraviť doklad</b> a skúste znova.</p><p>Súbor nevznikne ani vtedy, keď firme chýba IČ DPH, názov alebo adresa — [[navod:dph/udaje|ako ich doplniť]].</p>" },
        { nadpis: "Náhľad pred podaním",
          html: "<p><b>▦ Náhľad pred podaním</b> ukáže výkaz aj priznanie v podobe tlačiva. Je to náhľad na kontrolu, nie oficiálne tlačivo.</p>" },
      ],
    },
    {
      id: "udaje",
      nazov: "Doplniť údaje firmy, bez ktorých súbor nevznikne",
      kedy: "Raz, pred prvým podaním — alebo keď appka napíše, že vo výkaze by chýbala identifikácia daňovníka.",
      kroky: [
        { text: "V [[app:data#set_adresa|nastaveniach firmy]] vyplňte adresu v tvare <b>Ulica číslo, PSČ Obec</b>.", snimka: "dph-udaje-1",
          tip: "Z tohto jedného riadku appka berie do XML ulicu (pred prvou čiarkou) a PSČ s obcou (za poslednou čiarkou)." },
        { text: "Vyplňte [[app:data#set_danovyUrad|daňový úrad]].", tlacidlo: "Daňový úrad", snimka: "dph-udaje-2",
          tip: "Kontrolný výkaz sa stiahne aj bez neho, priznanie k DPH a súhrnný výkaz nie." },
        { text: "Ťuknite na <b>Uložiť všetky nastavenia</b>.", tlacidlo: "Uložiť všetky nastavenia" },
      ],
      tip: "IČ DPH, názov firmy, ulicu, obec a PSČ appka overí pred každým stiahnutím — keď niečo chýba, povie čo.",
      podrobnosti: [
        { nadpis: "Ostatné údaje firmy",
          html: "<p>Tu sú len údaje, ktoré potrebujú podania k DPH. Doplnenie z registra, IBAN a ostatné opisuje [[navod:data/firma|návod k údajom firmy]].</p>" },
        { nadpis: "DIČ",
          html: "<p>Do priznania k DPH appka zapisuje aj [[app:data#set_dic|DIČ]]. Bez neho priznanie nestiahne a napíše, že chýba. Kontrolný a súhrnný výkaz ho nepotrebujú.</p>" },
        { nadpis: "Prečo si appka nič nedomýšľa",
          html: "<p>Údaje idú do dokumentu pre štát. Prázdne pole portál odmietne nahlas, cudzí údaj by prešiel ticho — preto appka chýbajúci údaj nedopĺňa.</p>" },
      ],
    },
    {
      id: "oprava",
      nazov: "Opraviť výkaz, ktorý ste už podali",
      kedy: "Po podaní ste v tom istom období zmenili alebo pridali doklad.",
      kroky: [
        { text: "Vyberte to isté obdobie — appka napíše, že sa doklady od posledného exportu zmenili.", tlacidlo: "Doklady sa od posledného exportu" },
        { text: "Pri <b>Druh podania</b> vyberte <b>Opravný</b> alebo <b>Dodatočný</b>.", tlacidlo: "Opravný", snimka: "dph-oprava-1",
          tip: "Keď termín uplynul, appka to aj s dátumom napíše pri druhu podania." },
        { text: "Stiahnite výkaz aj priznanie znova a nahrajte ich na portál Finančnej správy." },
      ],
      tip: "Podaný mesiac si [[navod:uzavierka/mesiac|uzavrite]] — doklad sa doňho potom omylom neuloží.",
      podrobnosti: [
        { nadpis: "Ako voľby opisuje appka",
          html: "<p><b>Riadny</b> — podávate prvýkrát za toto obdobie. <b>Opravný</b> — už ste podali, ale ešte je pred 25.; nahradí pôvodné podanie celé. <b>Dodatočný</b> — lehota už uplynula; pošle sa len to, čo sa zmenilo.</p>" },
      ],
    },
    {
      id: "suhrnny",
      nazov: "Podať súhrnný výkaz za dodania do EÚ",
      kedy: "Fakturovali ste tovar alebo službu firme s IČ DPH v inej krajine EÚ.",
      kroky: [
        { text: "Vo [[app:faktury|faktúre]] vyberte <b>Druh plnenia</b> „Dodanie tovaru do EÚ“ alebo „Služba pre firmu v EÚ“.", tlacidlo: "Druh plnenia" },
        { text: "Tu sa potom objaví záložka <b>⇄ Súhrnný výkaz</b> — vyberte obdobie a skontrolujte IČ DPH odberateľov.", tlacidlo: "Súhrnný výkaz" },
        { text: "Ťuknite na <b>↧ Súhrnný výkaz (XML)</b> a súbor nahrajte na portál Finančnej správy.", tlacidlo: "Súhrnný výkaz (XML)" },
      ],
      tip: "Kým nemáte faktúru s dodaním do EÚ, záložka sa neukazuje — za obdobie bez takého dodania sa súhrnný výkaz nepodáva.",
      podrobnosti: [
        { nadpis: "Vlastné obdobie",
          html: "<p>Súhrnný výkaz má vlastný výber <b>štvrťročne</b> / <b>mesačne</b>, nezávislý od obdobia DPH. Keď hodnota tovaru dodaného do EÚ prekročí limit, appka upozorní, že štvrťročné podávanie už použiť nemôžete.</p>" },
      ],
    },
    {
      id: "odlozit",
      nazov: "Zistiť, koľko si odložiť na dane a odvody",
      kedy: "Priebežne počas roka, aby vás priznanie neprekvapilo.",
      kroky: [
        { text: "Otvorte záložku <b>💶 Dane a odvody</b>.", tlacidlo: "Dane a odvody", snimka: "dph-odlozit-1" },
        { text: "Riadok <b>Odložiť na dane a odvody</b> je odhad z doterajších príjmov, výdavkov a zaplatených preddavkov.", tlacidlo: "Odložiť na dane a odvody", snimka: "dph-odlozit-2" },
      ],
      tip: "Daň sa tu počíta bez nezdaniteľnej časti — tá sa uplatní až v priznaní, takže skutočná daň býva nižšia.",
      podrobnosti: [
        { nadpis: "Daň z motorových vozidiel",
          html: "<p>Na tej istej záložke ju appka vypočíta — tlačidlo <b>＋ Pridať vozidlo a vypočítať daň</b>.</p>" },
      ],
    },
  ],
},

priznania: {
  vJednejVete: "Načítať podané priznania a porovnať roky vedľa seba",
  uvod: "Sem nahráte daňové priznania, ktoré ste už podali, a appka ich postaví vedľa seba spolu s odhadom tohto roka. Nič tu nepočíta do priznania ani nepodáva — je to prehľad.",
  ulohy: [
    {
      id: "nacitat",
      nazov: "Načítať podané priznanie",
      kedy: "Máte z portálu Finančnej správy XML súbor priznania typu B za niektorý rok.",
      kroky: [
        { text: "Ťuknite na <b>↥ Načítať priznanie (XML)</b>.", tlacidlo: "Načítať priznanie (XML)", snimka: "priznania-nacitat-1" },
        { text: "Vyberte súbor — appka napíše, za ktorý rok priznanie načítala a s akými príjmami." },
      ],
      tip: "Appka berie len XML priznania fyzickej osoby typu B, nie PDF. Iné XML, napríklad priznanie k DPH, odmietne.",
      podrobnosti: [
        { nadpis: "Ten istý rok druhýkrát",
          html: "<p>Keď je priznanie za ten rok už načítané, appka sa spýta, či ho má novým súborom nahradiť. Načítané priznanie odstránite tlačidlom <b>✕</b> v zozname načítaných priznaní.</p>" },
      ],
    },
    {
      id: "porovnat",
      nazov: "Porovnať roky",
      kedy: "Chcete vidieť, ako sa menili príjmy, výdavky, daň a odvody.",
      kroky: [
        { text: "V tabuľke <b>Porovnanie rokov</b> sú načítané roky vedľa seba.", tlacidlo: "Porovnanie rokov", snimka: "priznania-porovnat-1" },
        { text: "Stĺpec tohto roka je označený <b>(odhad)</b> — appka ho dopočíta z doterajších mesiacov na celý rok." },
      ],
      tip: "Pri načítanom roku otvorí <b>▦ formulár</b> priznanie v podobe tlačiva.",
      podrobnosti: [
        { nadpis: "Odhad nie je priznanie",
          html: "<p>Stĺpec s odhadom slúži na orientáciu. Appka pri ňom píše, že nenahrádza priznanie ani daňového poradcu.</p>" },
        { nadpis: "Archív vygenerovaných podaní",
          html: "<p>Návrhy stiahnuté zo [[navod:priznanieB/vyplnit|sprievodcu priznaním B]] sú tu tiež a znova ich stiahnete cez <b>↧ XML</b>. Nie sú potvrdením o podaní.</p>" },
      ],
    },
  ],
},

priznanieB: {
  vJednejVete: "Pripraviť návrh priznania typu B a stiahnuť ho ako XML",
  uvod: "Sprievodca v štyroch krokoch zostaví z vašej evidencie návrh daňového priznania fyzickej osoby typu B. Na konci stiahnete XML, ktoré <b>skontrolujete a podáte sami</b> cez portál Finančnej správy.",
  ulohy: [
    {
      id: "vyplnit",
      nazov: "Pripraviť priznanie typu B",
      kedy: "Po skončení roka, keď máte zapísané faktúry, výdavky a platby.",
      kroky: [
        { text: "Vyberte rok a začnite krokom <b>1. Príjmy a výdavky</b>.", tlacidlo: "Príjmy a výdavky", snimka: "priznanieB-vyplnit-1" },
        { text: "Vyberte <b>Spôsob výdavkov</b> — skutočné alebo paušálne.", tlacidlo: "Spôsob výdavkov", snimka: "priznanieB-vyplnit-2",
          tip: "Príjmy, výdavky aj zaplatené odvody appka doplní z evidencie. Ručne sa píšu len príjmy mimo živnosti — zo zamestnania, z prenájmu a podobne." },
        { text: "Prejdite kroky tlačidlom <b>Pokračovať →</b> a doplňte, čo sa vás týka, napríklad deti.", tlacidlo: "Pokračovať", snimka: "priznanieB-vyplnit-3" },
        { text: "V kroku <b>4. Zhrnutie</b> prejdite <b>Kontroly priznania</b>.", tlacidlo: "Kontroly priznania", snimka: "priznanieB-vyplnit-4" },
        { text: "Ťuknite na <b>↧ Exportovať XML</b> a súbor po kontrole podajte cez portál Finančnej správy.", tlacidlo: "Exportovať XML", snimka: "priznanieB-vyplnit-5" },
      ],
      tip: "Nad krokmi je <b>Ročná kontrola</b> — nálezy naprieč celou evidenciou. Pozrite si ju skôr, než priznanie stiahnete.",
      podrobnosti: [
        { nadpis: "Appka za vás nepodáva",
          html: "<p>Stiahnutý súbor je návrh. Appka pri stiahnutí píše, že ho treba skontrolovať, podať cez portál Finančnej správy a že nenahrádza daňového poradcu.</p><p>Stiahnuté návrhy nájdete aj v [[navod:priznania/porovnat|archíve priznaní]].</p>" },
        { nadpis: "Osobné údaje v súbore",
          html: "<p>Meno, priezvisko ani dátum narodenia appka v nastaveniach nepýta, takže ich súbor nemusí obsahovať. Pred podaním ich skontrolujte.</p>" },
        { nadpis: "Blokujúce kontroly",
          html: "<p>Keď kontroly našli niečo označené ⛔, appka sa pred stiahnutím spýta, či exportovať aj tak. Nie je to zámok.</p>" },
        { nadpis: "Opravné a dodatočné priznanie",
          html: "<p>Sprievodca vyrába riadne priznanie. Opravné ani dodatočné nevyrobí.</p>" },
        { nadpis: "Ako formulár",
          html: "<p><b>▦ Ako formulár</b> v poslednom kroku ukáže priznanie v podobe tlačiva. Je to náhľad na kontrolu, nie oficiálne tlačivo.</p>" },
        { nadpis: "Zamknutý rok",
          html: "<p>Sprievodca je v plánoch Neplatiteľ DPH a Platiteľ DPH, alebo sa dá odomknúť jednorazovo pre jeden rok. Zamknutý rok má pred sebou 🔒 a tlačidlo <b>Pozrieť plány a ceny</b>.</p>" },
      ],
    },
    {
      id: "podiel",
      nazov: "Poukázať podiel dane neziskovke alebo rodičom",
      kedy: "Chcete časť zaplatenej dane poslať organizácii alebo rodičom na dôchodku.",
      kroky: [
        { text: "V kroku <b>4. Zhrnutie</b> nájdite <b>Poukázanie podielu zaplatenej dane</b>.", tlacidlo: "Poukázanie podielu zaplatenej dane" },
        { text: "Zaškrtnite <b>Neziskovej organizácii (§ 50)</b>, napíšte jej IČO a ťuknite na <b>Dotiahnuť z RPO</b>.", tlacidlo: "Neziskovej organizácii (§ 50)", snimka: "priznanieB-podiel-1",
          tip: "Názov organizácie appka doplní z registra právnických osôb; keď ju nenájde, napíšete ho ručne." },
        { text: "Rodičom poukážete cez <b>Rodičovi/rodičom</b> — vyplňte meno, priezvisko a rodné číslo.", tlacidlo: "Rodičovi/rodičom" },
      ],
      tip: "Suma na poukázanie sa ukáže hneď pod organizáciou — keď je nulová, appka povie prečo.",
    },
  ],
},

uzavierka: {
  vJednejVete: "Označiť mesiac za hotový, aby sa doň doklad neuložil omylom",
  uvod: "Uzavretý mesiac znamená „toto je hotové“: doklady s dátumom v ňom sa nedajú pridať, upraviť ani zmazať, kým ho neodomknete. Pred uzavretím appka mesiac skontroluje.",
  ulohy: [
    {
      id: "mesiac",
      nazov: "Uzavrieť mesiac",
      kedy: "Máte za mesiac všetko zapísané — napríklad po stiahnutí výkazu DPH.",
      kroky: [
        { text: "Pri mesiaci si pozrite nálezy: ⛔ treba opraviť, ⚠ stačí pozrieť.", snimka: "uzavierka-mesiac-1" },
        { text: "Ťuknite na <b>Uzavrieť</b>.", tlacidlo: "Uzavrieť", snimka: "uzavierka-mesiac-2" },
        { text: "Ak má mesiac upozornenia, appka ich vypíše a spýta sa, či uzavrieť aj tak." },
      ],
      tip: "Upozornenie, ktoré je v poriadku, schováte zo zoznamu tlačidlom <b>🔕 Skryť nález</b>.",
      podrobnosti: [
        { nadpis: "Čo appka kontroluje",
          html: "<p>Doklady bez dátumu a pri platiteľovi DPH doklady zmenené po vygenerovaní výkazu — tieto dve veci uzavretie zastavia. Na pozretie ukáže výdavky s nulovou sumou, faktúry bez adresy odberateľa, [[navod:banka/rucne|nespárované pohyby na účte]], chýbajúci [[navod:dph/podat|výkaz DPH]] za mesiac a pri aute v majetku [[navod:jazdy/miesto|tankovanie bez jázd]].</p>" },
        { nadpis: "Nie je to zámok proti vám",
          html: "<p>Uzávierka je poistka proti dokladu, ktorý sa omylom uloží spätne do obdobia, za ktoré ste už podali. Keď sa to stane, appka zápis zastaví a povie, ktorý mesiac je uzavretý.</p>" },
        { nadpis: "Ročná kontrola",
          html: "<p>Karta nad mesiacmi hľadá veci naprieč celým rokom. Uzavretie mesiaca ani podanie neblokuje.</p>" },
      ],
    },
    {
      id: "odomknut",
      nazov: "Opraviť doklad v uzavretom mesiaci",
      kedy: "Treba zmeniť doklad v mesiaci, ktorý ste už uzavreli.",
      kroky: [
        { text: "Pri uzavretom mesiaci ťuknite na <b>Odomknúť</b>.", tlacidlo: "Odomknúť", snimka: "uzavierka-odomknut-1" },
        { text: "Napíšte krátko dôvod — uloží sa do histórie mesiaca." },
        { text: "Doklad opravte a mesiac uzavrite znova.", tlacidlo: "Uzavrieť" },
      ],
      tip: "Ak ste za mesiac už podali výkaz DPH, po oprave ho treba podať znova — [[navod:dph/oprava|ako na opravný alebo dodatočný výkaz]].",
      podrobnosti: [
        { nadpis: "Doklady sa zmenili po uzavretí",
          html: "<p>Keď sa doklady v uzavretom mesiaci zmenia inak, napríklad importom na inom zariadení, karta mesiaca napíše <b>Doklady sa po uzavretí zmenili</b>. Obdobie skontrolujte a mesiac uzavrite znova.</p>" },
      ],
    },
    {
      id: "rocna",
      nazov: "Stiahnuť ročnú uzávierku pre účtovníka",
      kedy: "Po skončení roka chcete súhrn na vytlačenie alebo pre účtovníka.",
      kroky: [
        { text: "Dole v module nájdite <b>📋 Ročná uzávierka ako dokument</b>.", tlacidlo: "Ročná uzávierka ako dokument", snimka: "uzavierka-rocna-1" },
        { text: "Prejdite kroky <b>Rok</b>, <b>Ročná kontrola</b> a <b>Náhľad</b>." },
        { text: "V kroku <b>Generovať</b> ťuknite na <b>📄 Stiahnuť ročnú uzávierku</b>.", tlacidlo: "Stiahnuť ročnú uzávierku" },
      ],
      tip: "Je to súhrn na čítanie, nie podanie — priznanie pripravíte v [[navod:priznanieB/vyplnit|sprievodcovi priznaním B]].",
    },
  ],
},
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
          html: "<p>Keď ste zaplatenie [[navod:faktury/uhrada|označili ručne]], kniha doklad započíta ako uhradený, ale stĺpec <b>Uhradené dňa</b> ostane prázdny — appka deň platby nepozná. Preto ho ako uhradený ukáže aj v knihe k skoršiemu dňu.</p><p>Deň úhrady nesie až platba spárovaná z [[navod:banka/vypis|výpisu z banky]].</p>" },
        { nadpis: "Všetko v jednom súbore",
          html: "<p>[[navod:data/excel|Kompletný export pre účtovníka]] obsahuje knihu pohľadávok aj záväzkov ako hárky jedného Excelu. Peňažný denník doň pridáte zaškrtnutím.</p>" },
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
          html: "<p>Zostatok appka pozná len z výpisu alebo notifikácie, ktorá ho nesie. Staršie importy zostatky neukladali — [[navod:banka/vypis|výpis naimportujte znova]].</p>" },
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
          html: "<p>Pri skutočných výdavkoch ho appka sama pripočíta k výdavkom v [[navod:priznanieB/vyplnit|daňovom priznaní]]. Pri paušálnych výdavkoch sa odpis nepoužije.</p><p>Appka odpisuje rovnomerne — zrýchlené odpisovanie nepozná.</p>" },
        { nadpis: "Odpisy tento rok daň neznížia",
          html: "<p>Keď je základ dane pod nezdaniteľnou časťou, [[app:priznania|priznania]] ukážu kartu <b>Odpisy vám tento rok daň neznížia</b> s tlačidlom na prerušenie odpisovania. Prerušiť sa dá len celý rok a odpisy sa posunú, nestratia sa.</p>" },
        { nadpis: "Odpisový plán v Exceli",
          html: "<p>[[navod:data/excel|Kompletný export pre účtovníka]] má hárok <b>Majetok a odpisy</b> s plánom každej veci.</p>" },
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
      tip: "V kalendári je koniec platnosti vidieť už 90 dní vopred — [[navod:kalendar/terminy|ako čítať termíny]].",
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
          html: "<p>Keď výpis nahráte [[navod:vydavky/fotka|ako doklad do výdavkov]], appka ho spozná a opýta sa, či ho má načítať medzi nabíjania. Faktúra za ten istý mesiac je samostatný doklad a do výdavkov patrí ona.</p>" },
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
          html: "<p>Tankovanie v Knihe jázd nepridáte — vznikne samo z dokladu za pohonné hmoty s vyplnenými litrami, ktorý [[navod:vydavky/rucne|zapíšete vo výdavkoch]]. Sumu preto opravujte vo výdavku, nie tu.</p>" },
      ],
    },
  ],
},
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
          html: "<p>Keď lehota pripadne na sobotu alebo nedeľu, appka ju posunie na pondelok. Termín DPH posunie aj cez sviatok, napríklad cez Vianoce; pri ostatných termínoch sviatky zatiaľ nepozná. Kalendár ukazuje termíny na pol roka dopredu.</p>" },
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
          html: "<p>Podľa dátumu úhrady a bez DPH — teda čo naozaj prišlo, nie čo bolo vystavené. Kto vám ešte nezaplatil, [[navod:pohladavky/prehlad|zistíte v pohľadávkach]].</p>" },
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
          html: "<p>Bez <b>DIČ</b> sa nedajú posielať faktúry sieťou Peppol — [[navod:efaktury/zapnut|ako zapnúť odosielanie]].</p><p>Bez <b>IČ DPH</b>, názvu, adresy a daňového úradu appka nevytvorí priznanie k DPH — čo presne podania potrebujú, opisuje [[navod:dph/udaje|návod k údajom pre DPH]].</p>" },
        { nadpis: "IBAN a QR kód",
          html: "<p>Pri uložení appka IBAN skontroluje podľa kontrolných číslic. Preklep v číslici alebo prehodené číslice odhalí — taký IBAN neuloží, ponechá pôvodný a pod poľom napíše, čo nesedí. Ostatné nastavenia sa uložia.</p><p>Kontrola nepozná, či je účet váš: platný IBAN cudzieho účtu prejde. Po uložení si preto otvorte PDF [[navod:faktury/poslat|faktúry]] a QR kód skúšobne naskenujte v banke.</p>" },
        { nadpis: "Register neodpovedá",
          html: "<p>Údaje berie appka z registra právnických osôb Štatistického úradu. Keď neodpovie, vyplňte ich ručne — uložia sa rovnako.</p>" },
      ],
    },
    {
      id: "doklady",
      nazov: "Posielať doklady do appky e-mailom",
      kedy: "Faktúry od dodávateľov vám chodia e-mailom a nechcete ich sťahovať a nahrávať.",
      // Postup so schránkou je opísaný RAZ — vo Výdavkoch (doklady) a v Banke
      // (výpisy). Tu je len miesto, kde adresa v nastaveniach je, a rozcestník.
      kroky: [
        { text: "V časti <b>Doklady e-mailom</b> skopírujte svoju prijímaciu adresu tlačidlom <b>⧉</b>.", tlacidlo: "Doklady e-mailom" },
        { text: "Doklady od dodávateľov na ňu preposielajte a spracujte ich podľa návodu [[navod:vydavky/email|doklady e-mailom]]; výpis z účtu podľa návodu [[navod:banka/email|výpisy e-mailom]]." },
      ],
      tip: "Doklad, ktorý príde, sa do evidencie sám nedostane — vždy čaká na vaše potvrdenie.",
      podrobnosti: [
        { nadpis: "V ukážkovom režime časť chýba",
          html: "<p>Doklady e-mailom fungujú len s vlastným účtom prihláseným v cloude — bez neho sa časť Doklady e-mailom v nastaveniach nezobrazí.</p>" },
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
        { text: "Appka ukáže názov firmy a koľko faktúr, výdavkov a jázd v súbore je — potvrďte. Pred nahradením stiahne zálohu terajších dát." },
        { text: "Appka načítané dáta hneď uloží a v okne napíše, či sa to podarilo. Keď nie, ťuknite na <b>☁ Uložiť do cloudu</b>.", tlacidlo: "Uložiť do cloudu", snimka: "data-obnovit-2" },
      ],
      tip: "Import nič nezlučuje — všetko, čo máte v appke teraz, nahradí obsahom súboru. Súbor so zálohou predošlých dát (…_pred_importom_….json) si nechajte, kým si nie ste istí, že je všetko v poriadku.",
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
