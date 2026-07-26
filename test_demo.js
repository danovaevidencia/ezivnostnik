// Ukážkové dáta musia prejsť tými istými funkciami ako reálne — demo, ktoré
// niekde ukáže NaN alebo prázdnu obrazovku, je horšie než žiadne demo.
const fs=require("fs");
const el=()=>({innerHTML:"",classList:{add(){},remove(){},contains(){return false}},style:{},
  addEventListener(){},appendChild(){},querySelectorAll(){return[]},dataset:{},textContent:"",value:""});
const EL={};
global.document={getElementById:id=>(EL[id]??=el()),querySelectorAll:()=>[],querySelector:()=>null,
  createElement:()=>el(),head:el(),body:el(),addEventListener(){}};
global.window={addEventListener(){},location:{search:"",href:""},matchMedia:()=>({matches:false,addEventListener(){}}),navigator:{},jspdf:{}};
global.navigator={serviceWorker:{register:()=>Promise.resolve()},userAgent:"node",language:"sk"};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.sessionStorage=global.localStorage;
global.alert=()=>{}; global.confirm=()=>true;
global.fetch=()=>Promise.resolve({ok:false,json:()=>Promise.resolve({})});
global.URL=Object.assign(function(){this.hostname="x"},{createObjectURL:()=>"",revokeObjectURL(){}});
global.Blob=function(){};global.FileReader=function(){};
global.location={search:"",href:"",hash:"",pathname:"/",reload(){}};
global.history={replaceState(){}};
global.URLSearchParams=class{get(){return null}has(){return false}};
global.__DEMO=JSON.parse(fs.readFileSync("firma_demo.json","utf8"));
global.__DEMO_ORIG=fs.readFileSync("firma_demo.json","utf8");
global.EL=EL;
process.on("unhandledRejection",()=>{});

const src=fs.readFileSync("sadzby.js","utf8")+"\n;\n"+fs.readFileSync("app_script.js","utf8")+`
;
firmaData=__DEMO; localMode=true; demoMode=true; migrujUhrady();
let ok=0,zle=0; const t=(n,p)=>{console.log((p?"  ✓ ":"  ✗ ")+n);p?ok++:zle++;};
const cislo=v=>typeof v==="number" && isFinite(v);

console.log("\\nÚplnosť ukážkových dát");
try{
  t("firma má meno aj IČ DPH", !!firmaData.meta.nazov && !!firmaData.meta.icdph);
  t("je platiteľ DPH", jePlatcaDPH()===true);
  t("faktúry, výdavky, pohyby aj jazdy sú naplnené",
    firmaData.faktury.length>=8 && firmaData.vydavky.length>=20 &&
    firmaData.vypis.length>=40 && firmaData.jazdy.length>=50);
  t("vozidlo je rozpoznané ako hybrid", kjJeHybrid()===true && kjMaElektro()===true);

  console.log("\\nStavy faktúr — je na čom ukázať všetky");
  const st=firmaData.faktury.map(f=>uhradaStav("faktura",f.cislo).stav);
  t("niektoré sú overené výpisom", st.filter(x=>x==="overene").length>=5);
  t("aspoň jedna je čiastočne uhradená", st.includes("ciastocne"));
  t("aspoň jedna je neuhradená", st.includes("neuhradene"));
  const poSplat=firmaData.faktury.filter(f=>
    !dokladJeUhradeny("faktura",f.cislo) && String(f.splatnost)<"2026-07-26");
  t("aspoň jedna je po splatnosti", poSplat.length>=1);

  console.log("\\nBanka — párovanie má čo robiť, ale nezahltí");
  const nesp=(firmaData.vypis||[]).filter(x=>!splitPohybStav(x).spar);
  t("nespárovaných pohybov je rozumne málo", nesp.length>0 && nesp.length<=12);
  t("súkromné prevody odfiltruje pravidlo",
    (firmaData.vypis||[]).filter(x=>jePohybIgnorovany(x)).length>=6);
  t("aspoň jeden pohyb má jednoznačný návrh", parPocetJednoznacnych()>=1);

  console.log("\\nDPH");
  const Z=dphZberMesiac("2026-05");
  const S=dphSumare(Z.doklady||Z);
  t("zber dokladov za máj vráti doklady", !!Z);
  t("sumáre DPH sú čísla", S && Object.values(S).every(v=>typeof v!=="number"||isFinite(v)));
  t("obdobia DPH sa ponúknu", dphDostupneObdobia().length>=5);
  t("saldo DPH za rok je číslo", cislo(dphSaldoRok(2026)) || typeof dphSaldoRok(2026)==="object");

  console.log("\\nDaňové priznanie");
  const V=pbVypocet(2026);
  t("príjmy sú kladné číslo", cislo(V.prijmy) && V.prijmy>0);
  t("výdavky sú číslo", cislo(V.vydavky));
  t("základ dane je číslo", cislo(V.zaklad6));
  t("daň je číslo a nie je záporná", cislo(V.dan) && V.dan>=0);
  const K=pbKontroly(2026);
  t("kontroly priznania nespadnú", Array.isArray(K.blok) && Array.isArray(K.upoz));

  console.log("\\nKniha jázd a sprievodca");
  t("mesiace knihy sa načítali", kjMesiace().length>=6);
  _kjW={krok:0, od:"2026-01-01", doD:"2026-07-31", hotovo:{}, navrh:null, navrhVik:null};
  const N=kjwDomaceNabijanie(_kjW.od,_kjW.doD);
  t("domáce nabíjanie vyjde kladné", N.domaceKWh>0 && N.suma>0);
  t("verejné nabíjanie sa našlo", N.pocetVerejnych>=5);
  const Vk=kjwVikendPrehlad(_kjW.od,_kjW.doD);
  t("víkendové jazdy existujú", Vk.spolu>=5);
  t("aspoň jedna víkendová jazda je krytá dokladom", Vk.chranene.length>=1);
  t("aspoň jedna sa dá presunúť", Vk.volne.length>=1);
  t("sprievodca má všetkých 7 krokov", kjwDostupneKroky().length===7);

  console.log("\\nMajetok a odpisy");
  t("majetok je naplnený", (firmaData.majetok||[]).length>=2);
  t("kontrola knihy jázd nespadne", Array.isArray(jazdyKontrola()));

  console.log("\\nUkážkový režim — UI");
  demoUpravUI();
  const btn=EL["userMenu"];
  t("odhlásenie je v deme nahradené registráciou",
    btn && btn.title==="Vytvoriť vlastný účet");
  t("prepínač firiem je skrytý", EL["firmaPrepinac"].style.display==="none");
  t("pás na domovskej sa v deme vykreslí", demoDomovPruh().indexOf("Vytvoriť účet")>0);
  demoMode=false;
  t("mimo dema je pás prázdny", demoDomovPruh()==="");
  demoMode=true;
  t("sprievodca ukážkou má tipy", Array.isArray(DEMO_TIPY) && DEMO_TIPY.length>=5);
  t("každý tip má akciu", DEMO_TIPY.every(x=>x.akcia && x.n && x.p));
  demoSprievodca();
  t("sprievodca sa otvorí a ponúka registráciu",
    String(EL["modalBody"].innerHTML).indexOf("demoNaRegistraciu")>0);
  let cielUrl=null;
  const povodne=Object.getOwnPropertyDescriptor(global,"location");
  global.location={pathname:"/app.html", search:"", set href(v){ cielUrl=v; }, get href(){ return cielUrl; }};
  demoNaRegistraciu();
  t("odchod z dema vedie na skutočnú registráciu", cielUrl==="/app.html?vstup=register");
  if(povodne) Object.defineProperty(global,"location",povodne);

  console.log("\\nVstavané dáta = súbor firma_demo.json");
  t("vstavaná kópia sa zhoduje so súborom",
    JSON.stringify(window.DEMO_DATA_EMBED)===JSON.stringify(JSON.parse(__DEMO_ORIG)));

  console.log("\\nŽiadne NaN v kľúčových číslach");
  const T=danTotals(2026, firmaData.settings||{});
  t("danTotals vracia samé čísla",
    Object.values(T.t||{}).every(v=>typeof v!=="number"||isFinite(v)));
}catch(e){ console.log("  ✗ VÝNIMKA:", e.message); zle++; }

console.log("\\n═══ "+ok+" prešlo, "+zle+" zlyhalo ═══");
process.exit(zle?1:0);
`;
eval(src);
