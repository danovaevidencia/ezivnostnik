// ═══════════════════════════════════════════════════════════════
//  sadzby.js — spoločný modul appky a admin panelu
//
//  Sadzby, ich história v čase, kontroly a export do sadzby.json.
//  Načítavajú ho OBA súbory:
//    · ezivnostnik.html — číta sadzby a zobrazuje ich prehľad
//    · admin.html       — edituje ich a vyrába sadzby.json
//
//  Preto tu NESMIE byť nič, čo závisí od appky: žiadne firmaData, žiadne
//  výpočty dane, žiadne pomocné funkcie z ezivnostnik.html. Modul si vystačí
//  sám. Dôvod je ten istý, ktorý nás v tomto projekte prenasledoval — jedno
//  pravidlo zapísané na dvoch miestach sa skôr či neskôr rozíde.
//
//  Čo do appky patrí a sem NIE: sadzbaFirmy() (prepísanie v nastaveniach
//  zákazníka), migrácia starých nastavení a náhľad dopadu na skutočné dáta.
//  Všetko tri potrebujú firmaData, ktoré admin nemá.
// ═══════════════════════════════════════════════════════════════

// Vlastný formát čísel. Appka aj admin majú svoje eur(), ale s inou presnosťou —
// admin zaokrúhľuje na celé eurá, čo by pri sadzbe 5 966,73 € klamalo.
function sadzbaCislo(v, des){
  const d=(des==null?2:des);
  return (+v||0).toLocaleString("sk-SK",{minimumFractionDigits:d, maximumFractionDigits:d});
}
function sadzbaEur(v){ return sadzbaCislo(v)+" €"; }
function sadzbaEsc(s){ return String(s==null?"":s).replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
function sadzbaDatum(d){ if(!d) return ""; const p=String(d).split("-"); return p.length===3 ? (+p[2])+". "+(+p[1])+". "+p[0] : String(d); }
const SADZBY_MODUL_VERZIA = "2026.07.20-BQ";

// ═══════════════════════════════════════════════════════════════
//  SADZBY V ČASE
//  Sadzby a hranice nie sú konštanty — menia sa novelou alebo opatrením.
//  Doteraz žili na dvoch miestach naraz: v KONST_2026 a v nastaveniach každej
//  firmy (onboarding tam celý objekt skopíroval). Dôsledok bol, že sadzby boli
//  zamrazené v deň registrácie a nová verzia appky ich k zákazníkovi nedoniesla.
//
//  Odteraz je zdrojom pravdy táto tabuľka. Každý záznam má dátum účinnosti,
//  takže výpočet za staršie obdobie ostane počítať vtedajšou sadzbou.
//    · `od:null` = platí od nepamäti, resp. dátum účinnosti sme neoverovali
//    · `overit:true` = dátum účinnosti nie je overený proti zdroju
//  Zámerne sa NEDOPĹŇAJÚ historické sadzby spätne — appka nemá dáta spred
//  svojho vzniku. Stačí to, čo platí dnes, a od tohto bodu ďalej pribúdajú zmeny.
//
//  Čo sem NEPATRÍ: zaraďovanie do oddielov výkazu, enumerácie zo schém FS
//  a vzorce. To nie sú sadzby, ale štruktúra a pravidlá — tie sa menia s kódom.
// ═══════════════════════════════════════════════════════════════
const SADZBY = {
  // dan · odvody · nczd · bonus · dph · auto · majetok
  // mienaSa: "rocne" (nová hodnota takmer každý 1. 1.) · "opatrenim" (kedykoľvek) · "zriedka"
  // overenost: "zdroj" (overené proti zákonu/oznámeniu) · "dokumentacia" (prevzaté
  //            z projektovej dokumentácie) · "kod" (prepísané z pôvodného kódu, neoverené)
  danPrijem:      {n:"Daň z príjmov FO", sk:"dan", mienaSa:"zriedka", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:null, v:0.15, zdroj:"§ 15 ZDP — 15 % pri zdaniteľných príjmoch z podnikania do 100 000 € vrátane"}]},
  danPrijemHranica:{n:"Hranica príjmov pre 15 % sadzbu", sk:"dan", mienaSa:"zriedka", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2025-01-01", v:100000, zdroj:"§ 15 ZDP — 15 % pri zdaniteľných príjmoch do 100 000 € vrátane"}]},
  danPasma:       {n:"Pásma progresívnej dane", sk:"dan", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:[{do:43983.32, s:0.19},{do:60349.21, s:0.25},{do:75010.32, s:0.30},{do:null, s:0.35}],
        zdroj:"§ 15 ZDP — štyri pásma od 1. 1. 2026 (154,8× / 212,4× / 264× ŽM)"}]},
  sadzbaDPH:      {n:"Základná sadzba DPH", sk:"dph", mienaSa:"zriedka", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2025-01-01", v:0.23, zdroj:"§ 27 zákona o DPH — 23 % od 1. 1. 2025"}]},
  zdravSadzba:    {n:"Zdravotné poistné SZČO", sk:"odvody", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:0.16, zdroj:"§ 38ezk zák. 580/2004 — 16 % prechodne pre roky 2026 a 2027 (predtým 15 %)"}]},
  minVZmesZP:     {n:"Min. mesačný vymeriavací základ ZP", sk:"odvody", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:762, zdroj:"50 % priemernej mzdy za 2024 (1 524 €)"}]},
  minOdvodZP:     {n:"Min. mesačný odvod ZP", sk:"odvody", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:121.92, zdroj:"16 % zo 762 € — potvrdzuje Dôvera aj Podnikajte.sk"}]},
  vzKoef:         {n:"Koeficient vymeriavacieho základu", sk:"odvody", mienaSa:"zriedka", overenost:"kod", kontrola:null,
    h:[{od:null, v:0.672948, zdroj:"koeficient na výpočet vymeriavacieho základu"}]},
  nezdanitCast:   {n:"NČZD na daňovníka", sk:"nczd", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:5966.73, zdroj:"§ 11 ZDP — 21-násobok ŽM 284,13 €"}]},
  nczdHranicaPlna:{n:"Hranica plnej NČZD", sk:"nczd", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:26083.13, zdroj:"91,8-násobok ŽM"}]},
  nczdKonstanta:  {n:"Konštanta vo vzorci NČZD", sk:"nczd", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:14661.11, zdroj:"51,6-násobok ŽM; krátenie deleno 3 (od 2026, predtým 5)"}]},
  nczdZanik:      {n:"Základ, pri ktorom NČZD zaniká", sk:"nczd", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:43983.32, zdroj:"154,8-násobok ŽM"}]},
  nczdManzelMax:  {n:"Max. NČZD na manžela/manželku", sk:"nczd", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:5455.30, zdroj:"19,2-násobok ŽM"}]},
  nczdManzelHranica:{n:"Hranica pre NČZD na manželku", sk:"nczd", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:43983.32, zdroj:"154,8-násobok ŽM — nad ním sa uplatní vzorec"}]},
  nczdManzelKonst:{n:"Konštanta NČZD na manželku", sk:"nczd", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:20116.40, zdroj:"vzorec 20 116,40 − ZD/3; nuluje sa pri 60 349,21 €"}]},
  nczd3pilierMax: {n:"Strop odpočtu III. piliera", sk:"nczd", mienaSa:"zriedka", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:null, v:180, zdroj:"§ 11 ods. 8 ZDP — 180 € ročne"}]},
  bonusDo15:      {n:"Daňový bonus do 15 rokov (mesačne)", sk:"bonus", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:100, zdroj:"§ 33 ZDP — 100 €/mes. do 15 rokov"}]},
  bonus15az18:    {n:"Daňový bonus 15–18 rokov (mesačne)", sk:"bonus", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:50, zdroj:"§ 33 ZDP — 50 €/mes. 15–18 rokov"}]},
  bonusKratHranica:{n:"Základ, od ktorého sa bonus kráti", sk:"bonus", mienaSa:"rocne", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2026-01-01", v:27432, zdroj:"1,5-násobok priem. mzdy = 2 286 €/mes. × 12"}]},
  obratRocny:     {n:"Obrat — platiteľom od nasl. roka", sk:"dph", mienaSa:"zriedka", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2025-01-01", v:50000, zdroj:"§ 4 zákona o DPH"}]},
  obratOkamzity:  {n:"Obrat — platiteľom dňom dodania", sk:"dph", mienaSa:"zriedka", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2025-01-01", v:62500, zdroj:"§ 4 zákona o DPH"}]},
  nahradaKmOsobne:{n:"Základná náhrada za km — osobné", sk:"auto", mienaSa:"opatrenim", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2025-03-01", v:0.281, zdroj:"oznámenie MPSVR platné od 1. 3. 2025"},
       {od:"2025-06-01", v:0.296, zdroj:"oznámenie MPSVR platné od 1. 6. 2025"},
       {od:"2026-01-01", v:0.313, zdroj:"oznámenie MPSVR č. 340/2025 Z. z."}]},
  nahradaKmJednostopove:{n:"Základná náhrada za km — jednostopové", sk:"auto", mienaSa:"opatrenim", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:"2025-03-01", v:0.080, zdroj:"oznámenie MPSVR platné od 1. 3. 2025"},
       {od:"2025-06-01", v:0.085, zdroj:"oznámenie MPSVR platné od 1. 6. 2025"},
       {od:"2026-01-01", v:0.090, zdroj:"oznámenie MPSVR č. 340/2025 Z. z."}]},
  hmHranica:      {n:"Hranica hmotného majetku", sk:"majetok", mienaSa:"zriedka", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:null, v:1700, zdroj:"§ 22 ZDP — v znení účinnom od 1. 1. 2026 stále 1 700 €"}]},
  luxAutoCena:    {n:"Limitovaná vstupná cena auta", sk:"majetok", mienaSa:"zriedka", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:null, v:48000, zdroj:"§ 17 ods. 34 ZDP"}]},
  luxAutoOdpis:   {n:"Ročný limit odpisu drahého auta", sk:"majetok", mienaSa:"zriedka", overenost:"zdroj", kontrola:"2026-07-21",
    h:[{od:null, v:12000, zdroj:"48 000 € / 4 roky"}]}
};
const SADZBY_SKUPINY={dan:"Daň z príjmov", odvody:"Odvody SZČO", nczd:"Nezdaniteľné časti",
  bonus:"Daňový bonus", dph:"DPH a obrat", auto:"Auto a náhrady", majetok:"Majetok"};

// Hodnota platná k dátumu. Berie posledný záznam, ktorého účinnosť už nastala.
function sadzbaKuDnu(kluc, datum){
  const zoz=(SADZBY[kluc]||{}).h;
  if(!zoz || !zoz.length) return undefined;
  const d = datum instanceof Date
    ? `${datum.getFullYear()}-${String(datum.getMonth()+1).padStart(2,"0")}-${String(datum.getDate()).padStart(2,"0")}`
    : String(datum||"").slice(0,10);
  let najdene;
  zoz.forEach(z=>{ if(!z.od || (d && z.od<=d)) { if(!najdene || !najdene.od || (z.od && z.od>=najdene.od)) najdene=z; } });
  return najdene ? najdene.v : undefined;
}
// Hodnota platná pre zdaňovacie obdobie. Ročné sadzby určuje zákon účinný v tom
// roku, preto sa pozeráme na jeho koniec — priznanie za rok N sa podáva v roku
// N+1 a musí počítať sadzbami roka N, nie tými, čo platia pri podávaní.
function sadzbaRoka(kluc, rok){
  const r=+rok || new Date().getFullYear();
  return sadzbaKuDnu(kluc, r+"-12-31");
}

// ═══════════════════════════════════════════════════════════════
//  SADZBY ZO SÚBORU (fáza 2)
//  `sadzby.json` leží vedľa appky na GitHub Pages. Zmena sadzby je potom commit
//  jedného malého súboru namiesto vydania celej appky. Backend na to netreba
//  a audit rieši git — kto, kedy a z čoho na čo, lepšie než vlastná tabuľka.
//
//  Tri pravidlá, ktoré sa nesmú porušiť:
//   1. Zabudovaná tabuľka je PODLAHA. Keď súbor nie je, je pokazený alebo sme
//      offline, appka počíta ďalej — nikdy nezablokuje a nikdy neukáže nič horšie.
//   2. Súbor sa PREBERÁ CELÝ ALEBO VÔBEC. Polovične načítaná tabuľka je horšia
//      než stará, lebo časť čísel by bola z jedného sveta a časť z druhého.
//   3. Každá hodnota musí prejsť rozsahovou kontrolou. Preklep 15 namiesto 0,15
//      sa nesmie dostať do výpočtu dane.
// ═══════════════════════════════════════════════════════════════
const SADZBY_ZABUDOVANE = JSON.parse(JSON.stringify(SADZBY));
const SADZBY_SUBOR = "sadzby.json";
const SADZBY_CACHE_KEY = "eziv_sadzby";
let SADZBY_PODVOD = {zdroj:"zabudované", verzia:SADZBY_MODUL_VERZIA, kedy:null, poznamka:""};

// Rozsahy, v ktorých hodnota vôbec dáva zmysel. Nie je to daňová kontrola,
// je to poistka proti preklepu a proti podvrhnutému súboru.
const SADZBY_ROZSAHY = {
  percento: {min:0, max:1},        // sadzby dane a poistného
  suma:     {min:0, max:1000000},  // hranice, limity, náhrady
};
function sadzbaJeRozumna(kluc, v){
  if(Array.isArray(v)){
    if(!v.length) return false;
    return v.every((b,i)=>typeof b.s==="number" && b.s>0 && b.s<1 &&
      (i===v.length-1 ? b.do===null : (typeof b.do==="number" && b.do>0)));
  }
  if(typeof v!=="number" || !isFinite(v)) return false;
  const jePercento = /Sadzba|sadzba|Koef|danPrijem$|zdravSadzba/.test(kluc);
  const R_ = jePercento ? SADZBY_ROZSAHY.percento : SADZBY_ROZSAHY.suma;
  return v>=R_.min && v<=R_.max;
}
// Overí tvar celého súboru. Vracia zoznam chýb — prázdny znamená, že sa dá použiť.
function sadzbyOverSubor(data){
  const chyby=[];
  if(!data || typeof data!=="object") return ["súbor nie je objekt"];
  if(!data.sadzby || typeof data.sadzby!=="object") return ["chýba kľúč `sadzby`"];
  if(!data.verzia) chyby.push("chýba `verzia`");
  Object.keys(data.sadzby).forEach(k=>{
    const S=data.sadzby[k];
    if(!SADZBY_ZABUDOVANE[k]){ chyby.push(k+": neznámy kľúč, appka ho nepoužíva"); return; }
    if(!S || !Array.isArray(S.h) || !S.h.length){ chyby.push(k+": chýba história `h`"); return; }
    S.h.forEach((z,i)=>{
      if(z.od!==null && !/^\d{4}-\d{2}-\d{2}$/.test(String(z.od))) chyby.push(k+"["+i+"]: zlý dátum «"+z.od+"»");
      if(!sadzbaJeRozumna(k, z.v)) chyby.push(k+"["+i+"]: hodnota mimo rozumného rozsahu ("+JSON.stringify(z.v)+")");
      if(!z.zdroj) chyby.push(k+"["+i+"]: chýba zdroj");
    });
  });
  return chyby;
}
// ── Čo súbor smie a čo nie ────────────────────────────────────────────────
// Rozhodujúce nie je, či je dátum v minulosti, ale či sa PREPISUJE niečo, čím
// sa už počítalo. Preto dve rôzne pravidlá:
//
//  · PRIDANIE nového záznamu je v poriadku aj so spätným dátumom. Opatrenie
//    MPSVR môže nadobudnúť účinnosť 1. júla a človek si to všimne 15. júla —
//    zakázať to by znamenalo, že správnu sadzbu nemá ako doplniť.
//  · ZMENA záznamu, ktorý už je účinný, je ZAKÁZANÁ. Tým sa
//    prepisuje história: uzávierky a podania spočítané starou hodnotou by sa
//    ticho zmenili. Preklep v už účinnej sadzbe je natoľko výnimočný, že patrí
//    do vydania appky s testami, nie do súboru.
//  · Zmena záznamu, ktorý ešte nie je účinný, je v poriadku — nič sa ním nerátalo.
function sadzbyOverZmenu(data, dnes){
  const chyby=[], upozornenia=[];
  const d=(dnes||new Date());
  const dnesISO=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const uzUcinny=(od)=>(od===null || String(od)<=dnesISO);
  Object.keys(data.sadzby||{}).forEach(k=>{
    const stara=SADZBY_ZABUDOVANE[k]; if(!stara) return;
    const nove={}; (data.sadzby[k].h||[]).forEach(z=>{ nove[String(z.od)]=z; });
    (stara.h||[]).forEach(z=>{
      const kluc=String(z.od), n=nove[kluc];
      if(!uzUcinny(z.od)) return;                    // budúci záznam sa smie meniť
      // Záznam, ktorý súbor neuvádza, ostáva zabudovaný — zlučovanie je aditívne
      // a zmazať sa cez súbor nedá nič. Kontrolujeme teda len PREPÍSANIE.
      if(n===undefined) return;
      if(JSON.stringify(n.v)!==JSON.stringify(z.v))
        chyby.push(`${k}: mení už účinnú hodnotu od ${z.od===null?"nepamäti":z.od} (${JSON.stringify(z.v)} → ${JSON.stringify(n.v)}) — tým by sa prepísali už spočítané obdobia`);
    });
    Object.keys(nove).forEach(kluc=>{
      const n=nove[kluc];
      const jeNovy=!(stara.h||[]).some(z=>String(z.od)===kluc);
      if(jeNovy && uzUcinny(n.od))
        upozornenia.push(`${k}: pridaný záznam so spätnou účinnosťou od ${n.od===null?"nepamäti":n.od} — prepočítajú sa ním obdobia, ktoré už možno boli uzavreté`);
    });
  });
  return {chyby, upozornenia};
}

// Zlúči súbor do tabuľky. Záznamy sa spájajú podľa dátumu účinnosti; zhodný
// dátum zo súboru prepíše zabudovaný (tak sa opraví preklep). Kľúče, ktoré
// v súbore nie sú, ostávajú zabudované.
function sadzbyZluc(data){
  Object.keys(data.sadzby).forEach(k=>{
    const cielova=SADZBY[k]; if(!cielova) return;
    const zo=data.sadzby[k];
    const mapa={};
    (SADZBY_ZABUDOVANE[k].h||[]).forEach(z=>{ mapa[String(z.od)]=Object.assign({}, z); });
    (zo.h||[]).forEach(z=>{ mapa[String(z.od)]=Object.assign({}, z); });
    cielova.h=Object.keys(mapa).map(x=>mapa[x])
      .sort((a,b)=>(a.od===null?"":a.od)<(b.od===null?"":b.od)?-1:1);
    ["overenost","kontrola","mienaSa"].forEach(pole=>{ if(zo[pole]!==undefined) cielova[pole]=zo[pole]; });
  });
}
function sadzbyObnovZabudovane(){
  Object.keys(SADZBY_ZABUDOVANE).forEach(k=>{
    SADZBY[k]=JSON.parse(JSON.stringify(SADZBY_ZABUDOVANE[k]));
  });
}
// Použije súbor, ak prejde kontrolou. Vracia {ok, chyby}.
function sadzbyPouzi(data, zdroj, dnes){
  const chyby=sadzbyOverSubor(data);
  if(chyby.length){
    console.warn("Sadzby zo zdroja «"+zdroj+"» zamietnuté:", chyby);
    return {ok:false, chyby, upozornenia:[]};
  }
  const Z=sadzbyOverZmenu(data, dnes);
  if(Z.chyby.length){
    console.warn("Sadzby zo zdroja «"+zdroj+"» zamietnuté — prepisujú históriu:", Z.chyby);
    return {ok:false, chyby:Z.chyby, upozornenia:Z.upozornenia};
  }
  if(Z.upozornenia.length) console.warn("Sadzby — spätná účinnosť:", Z.upozornenia);
  sadzbyObnovZabudovane();
  sadzbyZluc(data);
  SADZBY_PODVOD={zdroj, verzia:data.verzia||"?", kedy:data.kedy||null, poznamka:data.poznamka||"",
                 upozornenia:Z.upozornenia};
  return {ok:true, chyby:[], upozornenia:Z.upozornenia};
}

// ── Pridanie novej hodnoty (jadro budúceho editora) ───────────────────────
// Admin nesmie „opraviť číslo". Musí povedať, ČO sa mení a ODKEDY to platí —
// preto je dátum účinnosti povinný a bez neho funkcia nič nevráti.
function sadzbaNovaHodnota(kluc, hodnota, platiOd, zdroj, dnes){
  const chyby=[], upozornenia=[];
  const S=SADZBY[kluc];
  if(!S) return {ok:false, chyby:["neznáma sadzba «"+kluc+"»"], upozornenia};
  if(!platiOd) chyby.push("dátum účinnosti je povinný — bez neho sa nedá povedať, na ktoré obdobia sa hodnota vzťahuje");
  else if(!/^\d{4}-\d{2}-\d{2}$/.test(String(platiOd))) chyby.push("dátum musí byť v tvare RRRR-MM-DD");
  if(!sadzbaJeRozumna(kluc, hodnota)) chyby.push("hodnota je mimo rozumného rozsahu: "+JSON.stringify(hodnota));
  if(!zdroj || String(zdroj).trim().length<4) chyby.push("uveďte zdroj — paragraf, oznámenie alebo číslo predpisu");
  if(chyby.length) return {ok:false, chyby, upozornenia};

  const d=(dnes||new Date());
  const dnesISO=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const existuje=(S.h||[]).find(z=>String(z.od)===String(platiOd));
  if(existuje){
    if(String(platiOd)<=dnesISO)
      return {ok:false, upozornenia, chyby:["k dátumu "+platiOd+" už záznam existuje a je účinný — prepísať sa nedá, tým by sa zmenili už spočítané obdobia"]};
    upozornenia.push("k dátumu "+platiOd+" sa prepíše zatiaľ neúčinný záznam");
  }
  if(String(platiOd)<dnesISO)
    upozornenia.push("spätná účinnosť — prepočítajú sa aj obdobia pred dnešným dňom");
  const posledny=(S.h||[]).filter(z=>z.od!==null).map(z=>z.od).sort().slice(-1)[0];
  if(posledny && String(platiOd)<posledny)
    upozornenia.push("dátum je starší než posledný známy záznam ("+posledny+") — vkladá sa doprostred histórie");
  return {ok:true, chyby:[], upozornenia,
          zaznam:{od:String(platiOd), v:hodnota, zdroj:String(zdroj).trim()}};
}
// Vyrobí obsah sadzby.json z toho, čo je práve v tabuľke. Slúži na to, aby sa
// súbor nemusel písať ručne — vyexportuje sa, upraví jedno číslo a commitne.
function sadzbyExportJson(verzia){
  const out={verzia: verzia || new Date().toISOString().slice(0,10),
             kedy: new Date().toISOString().slice(0,10),
             poznamka:"Sadzby a hranice pre eživnostník. Staršie záznamy sa neprepisujú, nové sa pridávajú s dátumom účinnosti.",
             sadzby:{}};
  Object.keys(SADZBY).forEach(k=>{
    const S=SADZBY[k];
    out.sadzby[k]={n:S.n, sk:S.sk, mienaSa:S.mienaSa, overenost:S.overenost, kontrola:S.kontrola,
                   h:S.h.map(z=>({od:z.od, v:z.v, zdroj:z.zdroj}))};
  });
  return JSON.stringify(out, null, 2);
}
async function sadzbyNacitaj(){
  // 1) posledný známy dobrý súbor z pamäte zariadenia — appka je použiteľná offline
  try {
    const ls=localStorage.getItem(SADZBY_CACHE_KEY);
    if(ls) sadzbyPouzi(JSON.parse(ls), "vyrovnávacia pamäť");
  } catch(e){ /* pokazená pamäť nesmie zhodiť štart */ }
  // 2) čerstvý súbor zo servera, s krátkym limitom — na mobile nesmie brzdiť štart
  try {
    const ctrl=(typeof AbortController!=="undefined") ? new AbortController() : null;
    const tid=setTimeout(()=>{ try{ ctrl && ctrl.abort(); }catch(e){} }, 2500);
    const res=await fetch(SADZBY_SUBOR+"?v="+Date.now(), {cache:"no-store", signal:ctrl?ctrl.signal:undefined});
    clearTimeout(tid);
    if(res && res.ok){
      const data=await res.json();
      const v=sadzbyPouzi(data, "súbor");
      if(v.ok){ try{ localStorage.setItem(SADZBY_CACHE_KEY, JSON.stringify(data)); }catch(e){} }
    }
  } catch(e){ /* offline alebo súbor neexistuje — zabudovaná tabuľka platí ďalej */ }
  return SADZBY_PODVOD;
}


// ═══════════════════════════════════════════════════════════════
//  EDITOR SADZIEB (3c) — koncept, náhľad dopadu, export
//  Editor NEZAPISUJE do bežiacej tabuľky. Zmeny sa hromadia v koncepte a von
//  idú ako súbor sadzby.json, ktorý sa commitne. Znie to okľukou, ale má to
//  dôvod: git je audit, ktorý by som inak musel postaviť — kto, kedy, z čoho
//  na čo, s možnosťou vrátiť sa. A zmena prejde tým istým review ako kód.
//
//  Koncept sa drží v pamäti zariadenia, aby prežil obnovenie stránky, ale do
//  výpočtov nevstupuje. Do nich sa dostane až vtedy, keď je súbor nasadený.
// ═══════════════════════════════════════════════════════════════
const KONCEPT_KEY="eziv_sadzby_koncept";
let sadzbyKoncept=[];
function konceptNacitaj(){
  try { const ls=localStorage.getItem(KONCEPT_KEY); sadzbyKoncept = ls ? JSON.parse(ls) : []; }
  catch(e){ sadzbyKoncept=[]; }
  if(!Array.isArray(sadzbyKoncept)) sadzbyKoncept=[];
  return sadzbyKoncept;
}
function konceptUloz(){ try{ localStorage.setItem(KONCEPT_KEY, JSON.stringify(sadzbyKoncept)); }catch(e){} }
function konceptPridaj(kluc, hodnota, platiOd, zdroj, dnes){
  const v=sadzbaNovaHodnota(kluc, hodnota, platiOd, zdroj, dnes);
  if(!v.ok) return v;
  // Dva zápisy k tej istej sadzbe a dátumu nemajú zmysel — druhý nahradí prvý.
  sadzbyKoncept=sadzbyKoncept.filter(z=>!(z.kluc===kluc && z.zaznam.od===v.zaznam.od));
  sadzbyKoncept.push({kluc, zaznam:v.zaznam, upozornenia:v.upozornenia});
  konceptUloz();
  return v;
}
function konceptOdober(i){ sadzbyKoncept.splice(i,1); konceptUloz(); }
function konceptVycisti(){ sadzbyKoncept=[]; konceptUloz(); }

// Zloží súbor: aktuálna tabuľka + koncept.
function konceptDoSuboru(verzia){
  const data=JSON.parse(sadzbyExportJson(verzia));
  sadzbyKoncept.forEach(z=>{
    const S=data.sadzby[z.kluc]; if(!S) return;
    S.h=S.h.filter(x=>String(x.od)!==String(z.zaznam.od)).concat([z.zaznam])
        .sort((a,b)=>(a.od===null?"":a.od)<(b.od===null?"":b.od)?-1:1);
  });
  return data;
}


// ═══════════════════════════════════════════════════════════════
//  PREHĽAD SADZIEB (3a) — údržbová obrazovka, nie zákaznícka
//  Nie je to editor. Je to kontrolný zoznam pre legislatívnu revíziu:
//  čo appka používa, odkedy to platí, z čoho to je a či to niekto overil.
//  Príručka KROSu bola zastaraná na dvoch miestach a odhalilo sa to náhodou —
//  toto z toho robí úlohu so zoznamom namiesto náhody.
//  Sadzby nie sú tajomstvo (sú v bundli, ktorý si stiahne každý), takže
//  čítacia obrazovka nič neodhaľuje. Zápis sem zámerne nepatrí.
// ═══════════════════════════════════════════════════════════════
const SADZBY_OVERENOST={
  zdroj:        {n:"overené proti zdroju", ic:"✓", poradie:3},
  dokumentacia: {n:"prevzaté z dokumentácie", ic:"~", poradie:2},
  kod:          {n:"prepísané z kódu, neoverené", ic:"!", poradie:1}
};
// Čo si pýta pozornosť: nikdy neoverené, alebo ročné sadzby nekontrolované
// v tomto roku (menia sa takmer každý 1. januára).
function sadzbaChceKontrolu(kluc, dnes){
  const S=SADZBY[kluc]; if(!S) return false;
  const d=dnes||new Date();
  if(S.overenost!=="zdroj") return true;
  if(!S.kontrola) return true;
  if(S.mienaSa==="rocne" && String(S.kontrola).slice(0,4)!==String(d.getFullYear())) return true;
  return false;
}
function sadzbyPrehlad(dnes){
  const d=dnes||new Date();
  const polozky=Object.keys(SADZBY).map(k=>{
    const S=SADZBY[k], akt=S.h[S.h.length-1];
    return {kluc:k, nazov:S.n, skupina:S.sk, mienaSa:S.mienaSa, overenost:S.overenost,
            kontrola:S.kontrola, hodnota:akt.v, od:akt.od, zdroj:akt.zdroj,
            zmien:S.h.length, chceKontrolu:sadzbaChceKontrolu(k, d)};
  });
  return {polozky, chceKontrolu:polozky.filter(p=>p.chceKontrolu).length, spolu:polozky.length};
}
function sadzbaFormat(k, v){
  if(Array.isArray(v)) return v.map(b=>`${Math.round(b.s*100)} %${b.do!=null?" do "+sadzbaEur(b.do):""}`).join(" · ");
  if(/Sadzba|sadzba|Koef|danPrijem|zdravSadzba|vzKoef/.test(k) && v<1 && v>0)
    return (v*100).toFixed(v*100%1?4:0).replace(".",",")+" %";
  if(/nahradaKm/.test(k)) return String(v).replace(".",",")+" €/km";
  return sadzbaEur(v);
}

if (typeof module !== "undefined" && module.exports) module.exports = {};
