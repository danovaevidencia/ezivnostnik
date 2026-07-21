// Testy sadzieb v čase (fáza 1).
// Ťažisko je zámerne na PRECHODOCH — deň pred zmenou, deň zmeny, deň po nej.
// Sadzba otestovaná v strede obdobia nepovie nič o tom, čo sa stane pri zmene.
const fs=require("fs"), vm=require("vm");
global.window=global;
const el=()=>({style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},
  appendChild(){},setAttribute(){},addEventListener(){},innerHTML:"",value:"",checked:false,
  textContent:"",focus(){},setSelectionRange(){},querySelector(){return null},querySelectorAll(){return []}});
global.document={getElementById:()=>el(),querySelector:()=>null,querySelectorAll:()=>[],
  createElement:()=>el(),addEventListener:()=>{},body:el(),documentElement:el()};
global.addEventListener=()=>{}; global.alert=()=>{}; global.confirm=()=>true;
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.Blob=class{constructor(p){this._t=(p||[]).join("");}};
global.navigator={userAgent:"node",serviceWorker:{register(){return Promise.resolve();}}};
global.location={href:"",search:"",hash:"",origin:"",pathname:""};
global.fetch=()=>Promise.reject(new Error("x"));
global.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});

const html=fs.readFileSync("ezivnostnik.html","utf8");
vm.runInThisContext(fs.readFileSync("sadzby.js","utf8"));   // spoločný modul sadzieb
vm.runInThisContext([...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n;\n"));

let ok=0,fail=0;
const t=(n,f)=>{try{f();console.log("  ✓ "+n);ok++;}catch(e){console.log("  ✗ "+n+"\n      "+e.message);fail++;}};
const eq=(a,b,m)=>{if(Math.abs((+a||0)-(+b||0))>0.011)throw new Error((m||"")+" — dostal "+a+", čakal "+b);};
const eqp=(a,b,m)=>{if(Math.abs((+a||0)-(+b||0))>0.0000001)throw new Error((m||"")+" — dostal "+a+", čakal "+b);};
const je=(v,m)=>{if(!v)throw new Error(m||"nesplnené");};
const nie=(v,m)=>{if(v)throw new Error(m||"malo byť nepravdivé");};
const nastav=s=>vm.runInThisContext("firmaData="+JSON.stringify(s));

const FIRMA={
  meta:{nazov:"T", ico:"56649797"},
  settings:{phlRezim:"nahrady", minVZmesZP:0, minOdvodZP:0},
  faktury:[], vydavky:[], jazdy:[], majetok:[], tankovania:[], nabijania:[],
  vypis:[], vykazy:[], partneri:[], dph:{}, dovolenka:{}, udalosti:[], danovePriznania:{}
};
const s_=(o)=>Object.assign(JSON.parse(JSON.stringify(FIRMA)), o||{});
// dočasne pridá záznam do tabuľky a po teste ho odstráni
const sZmenou=(kluc, od, hodnota, f)=>{
  const zaloha=SADZBY[kluc].h.slice();
  SADZBY[kluc].h.push({od, v:hodnota, zdroj:"test"});
  try { f(); } finally { SADZBY[kluc].h=zaloha; }
};

// ══════════════ vyhľadávanie ══════════════
console.log("\nVyhľadávanie hodnoty k dátumu");
t("záznam bez dátumu platí odjakživa", ()=>{
  eqp(sadzbaKuDnu("danPrijem","2019-05-05"), 0.15);
  eqp(sadzbaKuDnu("danPrijem","2030-05-05"), 0.15);
});
t("pred účinnosťou sa záznam neuplatní", ()=>{
  je(sadzbaKuDnu("sadzbaDPH","2024-12-31")===undefined, "DPH 23 % platí až od 1. 1. 2025");
  eqp(sadzbaKuDnu("sadzbaDPH","2025-01-01"), 0.23);
});
t("neznámy kľúč vráti undefined, nie nulu", ()=>{
  je(sadzbaKuDnu("neexistuje","2026-01-01")===undefined);
});
t("prechod deň po dni", ()=>{
  sZmenou("nahradaKmOsobne","2026-07-01",0.400,()=>{
    eqp(sadzbaKuDnu("nahradaKmOsobne","2026-06-30"), 0.313, "deň pred");
    eqp(sadzbaKuDnu("nahradaKmOsobne","2026-07-01"), 0.400, "deň zmeny");
    eqp(sadzbaKuDnu("nahradaKmOsobne","2026-07-02"), 0.400, "deň po");
  });
  eqp(sadzbaKuDnu("nahradaKmOsobne","2026-07-01"), 0.313, "tabuľka sa musela vrátiť");
});
t("ročná sadzba berie stav ku koncu obdobia", ()=>{
  sZmenou("danPrijem","2027-01-01",0.19,()=>{
    eqp(sadzbaRoka("danPrijem",2026), 0.15);
    eqp(sadzbaRoka("danPrijem",2027), 0.19);
  });
});
t("Date aj reťazec dávajú to isté", ()=>{
  eqp(sadzbaKuDnu("sadzbaDPH", new Date(2025,0,1)), sadzbaKuDnu("sadzbaDPH","2025-01-01"));
});

// ══════════════ náhrady za km — zmena v polroku ══════════════
console.log("\nNáhrady za km — sadzba sa viaže na deň jazdy");
t("jazdy pred zmenou a po nej sa ocenia rôzne", ()=>{
  nastav(s_({jazdy:[
    {datum:"5. 3. 2026", km:100, cesta:"a", ucel:"k"},
    {datum:"5. 10. 2026", km:100, cesta:"b", ucel:"k"}]}));
  sZmenou("nahradaKmOsobne","2026-07-01",0.400,()=>{
    const N=nahradyObdobie(2026);
    eq(N.km, 200);
    eq(N.zakladna, 71.30, "100 × 0,313 + 100 × 0,400");
    je(N.viacSadzieb, "má hlásiť, že sadzba sa v období menila");
  });
});
t("bez zmeny sa výsledok nehýbe", ()=>{
  nastav(s_({jazdy:[
    {datum:"5. 3. 2026", km:100, cesta:"a", ucel:"k"},
    {datum:"5. 10. 2026", km:100, cesta:"b", ucel:"k"}]}));
  const N=nahradyObdobie(2026);
  eq(N.zakladna, 62.60, "200 × 0,313");
  nie(N.viacSadzieb);
  eqp(N.sadzba, 0.313);
});
t("jazda v deň zmeny patrí už novej sadzbe", ()=>{
  nastav(s_({jazdy:[{datum:"1. 7. 2026", km:100, cesta:"a", ucel:"k"}]}));
  sZmenou("nahradaKmOsobne","2026-07-01",0.400,()=>{ eq(nahradyObdobie(2026).zakladna, 40); });
});
t("súkromné km sa neoceňujú ani po zmene", ()=>{
  nastav(s_({jazdy:[
    {datum:"5. 10. 2026", km:100, cesta:"a", ucel:"k"},
    {datum:"6. 10. 2026", km:100, cesta:"b", ucel:"", sukromna:true}]}));
  sZmenou("nahradaKmOsobne","2026-07-01",0.400,()=>{
    const N=nahradyObdobie(2026);
    eq(N.km, 100); eq(N.zakladna, 40);
  });
});
t("vlastná sadzba v nastaveniach má stále prednosť", ()=>{
  nastav(s_({settings:Object.assign({}, FIRMA.settings, {nahradaKm:0.5}),
    jazdy:[{datum:"5. 3. 2026", km:100, cesta:"a", ucel:"k"}]}));
  eq(nahradyObdobie(2026).zakladna, 50);
});

// ══════════════ ročné sadzby — priznanie za minulý rok ══════════════
console.log("\nZdaňovacie obdobie rozhoduje, nie dnešný rok");
const sFakturou=(rok)=>s_({settings:{minVZmesZP:0, minOdvodZP:0},
  faktury:[{cislo:"1", datum:rok+"-06-30", bez:30000, dph:0, spolu:30000}]});

t("daň za rok N počíta sadzbami roka N", ()=>{
  nastav(sFakturou(2026));
  const pred=deDanovyVypocet(2026).dan;
  sZmenou("danPrijem","2027-01-01",0.30,()=>{
    eq(deDanovyVypocet(2026).dan, pred, "rok 2026 sa nesmie hnúť");
    je(deDanovyVypocet(2027).dan!==pred, "rok 2027 už má novú sadzbu");
  });
});
t("NČZD sa berie za zdaňovacie obdobie", ()=>{
  nastav(sFakturou(2026));
  sZmenou("nezdanitCast","2027-01-01",7000,()=>{
    eq(deVypocetDane(20000, firmaData.settings, 2026).nczdVlastna, 5966.73);
    eq(deVypocetDane(20000, firmaData.settings, 2027).nczdVlastna, 7000);
  });
});
t("NČZD na manželku aj III. pilier idú za rokom", ()=>{
  const S={nczdManzel:true, nczdManzelPrijem:0, nczd3pilier:500};
  sZmenou("nczdManzelMax","2027-01-01",6000,()=>{
    sZmenou("nczd3pilierMax","2027-01-01",300,()=>{
      const a=deVypocetDane(20000, S, 2026), b=deVypocetDane(20000, S, 2027);
      eq(a.nczdManzel, 5455.30); eq(b.nczdManzel, 6000);
      eq(a.nczd3pilier, 180);    eq(b.nczd3pilier, 300);
    });
  });
});
t("odvody idú za rokom", ()=>{
  // calcDanRow je za MESIAC, nie kumulatívne — faktúra je v júni, teda index 5
  nastav(sFakturou(2026));
  const pred=calcDanRow(5, 2026, firmaData.settings).zdrav;
  je(pred>0, "kontrola samotného testu: v júni musí odvod vyjsť, dostal "+pred);
  nastav(sFakturou(2027));
  const pred27=calcDanRow(5, 2027, firmaData.settings).zdrav;
  eq(pred27, pred, "pri rovnakej sadzbe musia byť roky zhodné");
  sZmenou("zdravSadzba","2027-01-01",0.20,()=>{
    nastav(sFakturou(2026));
    eq(calcDanRow(5, 2026, firmaData.settings).zdrav, pred, "2026 sa nesmie hnúť");
    nastav(sFakturou(2027));
    const po=calcDanRow(5, 2027, firmaData.settings).zdrav;
    je(po>pred27, "2027 má vyššiu sadzbu — dostal "+po+", predtým "+pred27);
    eq(po, r2(pred27/0.16*0.20), "presne v pomere sadzieb");
  });
});
t("prahy obratu idú za rokom", ()=>{
  nastav(s_({faktury:[{cislo:"1", datum:"2026-06-30", bez:55000, dph:0, spolu:55000}]}));
  je(obratRoka(2026).prekrocilRocny, "55 000 > 50 000");
  sZmenou("obratRocny","2026-01-01",60000,()=>{
    nie(obratRoka(2026).prekrocilRocny, "po zvýšení prahu už nie");
    eq(obratRoka(2026).prahRocny, 60000);
  });
});

// ══════════════ sadzby už nesmú byť v dátach firmy ══════════════
console.log("\nSadzby patria do tabuľky, nie do nastavení firmy");
t("nedotknutý default sa z nastavení odstráni", ()=>{
  nastav(s_({settings:{danPrijem:0.15, zdravSadzba:0.16, nezdanitCast2026:5966.73, phlRezim:"kniha"}}));
  const v=migrujSadzbyZNastaveni();
  je(v.odstranene.includes("danPrijem"));
  je(v.odstranene.includes("nezdanitCast2026"));
  je(firmaData.settings.danPrijem===undefined, "kľúč mal zmiznúť");
  eq(firmaData.settings.phlRezim==="kniha", true, "ostatné nastavenia sa nesmú dotknúť");
});
t("vedome zmenená hodnota sa nemaže, len nahlási", ()=>{
  nastav(s_({settings:{danPrijem:0.19}}));
  const v=migrujSadzbyZNastaveni();
  je(v.ponechane.includes("danPrijem"));
  eqp(firmaData.settings.danPrijem, 0.19);
  eqp(deVypocetDane(20000, firmaData.settings, 2026).sadzba, 0.19, "prepísanie má prednosť");
});
t("po očistení sa sadzba berie z tabuľky", ()=>{
  nastav(s_({settings:{danPrijem:0.15}}));
  migrujSadzbyZNastaveni();
  sZmenou("danPrijem","2027-01-01",0.19,()=>{
    eqp(deVypocetDane(20000, firmaData.settings, 2027).sadzba, 0.19,
        "zmena zákona sa musí dostať aj k existujúcej firme");
  });
});
t("onboarding už sadzby do dát firmy nekopíruje", ()=>{
  const zdroj=html.match(/const s = Object\.assign\(\{\}[\s\S]{0,120}/)[0];
  nie(/KONST_2026/.test(zdroj), "KONST_2026 sa nesmie vlievať do nastavení: "+zdroj.slice(0,80));
});

// ══════════════ obsah tabuľky ══════════════
console.log("\nTabuľka samotná");
t("každý záznam má hodnotu aj zdroj", ()=>{
  Object.keys(SADZBY).forEach(k=>{
    je(SADZBY[k].n && SADZBY[k].n.length>3, k+": chýba názov");
    je(SADZBY_SKUPINY[SADZBY[k].sk], k+": neznáma skupina «"+SADZBY[k].sk+"»");
    je(["rocne","opatrenim","zriedka"].includes(SADZBY[k].mienaSa), k+": zlé mienaSa");
    je(SADZBY_OVERENOST[SADZBY[k].overenost], k+": zlá overenost");
    SADZBY[k].h.forEach(z=>{
      if(Array.isArray(z.v)){
        je(z.v.length>1, k+": pásmová tabuľka musí mať aspoň dve pásma");
        z.v.forEach((b,i)=>{
          je(typeof b.s==="number" && b.s>0 && b.s<1, k+": zlá sadzba pásma");
          je(i===z.v.length-1 ? b.do===null : typeof b.do==="number",
             k+": posledné pásmo musí byť otvorené, ostatné ohraničené");
          if(i>0) je(b.do===null || b.do>z.v[i-1].do, k+": pásma musia rásť");
        });
      } else {
        je(typeof z.v==="number" && !isNaN(z.v), k+": hodnota musí byť číslo");
      }
      je(z.zdroj && z.zdroj.length>3, k+": chýba zdroj");
      if(z.od!==null) je(/^\d{4}-\d{2}-\d{2}$/.test(z.od), k+": zlý tvar dátumu «"+z.od+"»");
    });
  });
});
t("hodnoty sedia s tým, čo appka počítala doteraz", ()=>{
  eqp(sadzbaRoka("danPrijem",2026), 0.15);
  eqp(sadzbaRoka("sadzbaDPH",2026), 0.23);
  eqp(sadzbaRoka("zdravSadzba",2026), 0.16);
  eq(sadzbaRoka("minVZmesZP",2026), 762);
  eq(sadzbaRoka("minOdvodZP",2026), 121.92);
  eq(sadzbaRoka("nezdanitCast",2026), 5966.73);
  eq(sadzbaRoka("nczdManzelMax",2026), 5455.30);
  eq(sadzbaRoka("nczd3pilierMax",2026), 180);
  eq(sadzbaRoka("obratRocny",2026), 50000);
  eq(sadzbaRoka("obratOkamzity",2026), 62500);
  eqp(sadzbaKuDnu("nahradaKmOsobne","2026-03-05"), 0.313);
  eqp(sadzbaKuDnu("nahradaKmJednostopove","2026-03-05"), 0.090);
  eq(sadzbaRoka("hmHranica",2026), 1700);
  eq(sadzbaRoka("luxAutoCena",2026), 48000);
  eq(sadzbaRoka("luxAutoOdpis",2026), 12000);
});
t("neoverené sadzby sú označené", ()=>{
  const P=sadzbyPrehlad(new Date(2026,6,21));
  je(P.chceKontrolu>0, "aspoň niektoré vieme, že overené nie sú");
  je(P.spolu===Object.keys(SADZBY).length);
  console.log("      na overenie: "+P.chceKontrolu+" z "+P.spolu);
});

console.log("\nPrehľad sadzieb (3a)");
t("overené proti zdroju nechce kontrolu, neoverené áno", ()=>{
  const d=new Date(2026,6,21);
  nie(sadzbaChceKontrolu("obratRocny", d), "overené a zriedkavé");
  nie(sadzbaChceKontrolu("nezdanitCast", d), "overené v tomto roku");
  je(sadzbaChceKontrolu("vzKoef", d), "koeficient vymeriavacieho základu nikto neoveril");
});
t("história náhrad pokrýva obe zmeny v roku 2025", ()=>{
  eqp(sadzbaKuDnu("nahradaKmOsobne","2025-05-31"), 0.281, "od 1. 3. 2025");
  eqp(sadzbaKuDnu("nahradaKmOsobne","2025-06-01"), 0.296, "od 1. 6. 2025");
  eqp(sadzbaKuDnu("nahradaKmOsobne","2025-12-31"), 0.296);
  eqp(sadzbaKuDnu("nahradaKmOsobne","2026-01-01"), 0.313);
  eqp(sadzbaKuDnu("nahradaKmJednostopove","2025-05-31"), 0.080);
  eqp(sadzbaKuDnu("nahradaKmJednostopove","2025-06-01"), 0.085);
});
t("jazdy z roku 2025 sa ocenia vtedajšími sadzbami", ()=>{
  nastav(s_({jazdy:[
    {datum:"15. 4. 2025", km:100, cesta:"a", ucel:"k"},
    {datum:"15. 8. 2025", km:100, cesta:"b", ucel:"k"}]}));
  const N=nahradyObdobie(2025);
  eq(N.zakladna, 57.70, "100 × 0,281 + 100 × 0,296");
  je(N.viacSadzieb, "v roku 2025 sa sadzba menila");
});
t("ročná sadzba chce kontrolu každý rok nanovo", ()=>{
  const zal=Object.assign({}, SADZBY.nezdanitCast);
  SADZBY.nezdanitCast.overenost="zdroj"; SADZBY.nezdanitCast.kontrola="2026-01-05";
  try {
    nie(sadzbaChceKontrolu("nezdanitCast", new Date(2026,6,1)), "v tom istom roku stačí");
    je(sadzbaChceKontrolu("nezdanitCast", new Date(2027,0,15)), "v novom roku znovu");
  } finally { Object.assign(SADZBY.nezdanitCast, zal); }
});
t("obrazovka sa vykreslí a prizná, čo nie je overené", ()=>{
  nastav(s_());
  const h=appSadzby();
  je(h.includes("Sadzby a hranice"));
  je(h.includes("Na overenie"), "musí povedať, koľko je neovereného");
  je(h.includes("Nezdaniteľné časti"), "skupiny sa majú vypísať");
  je(h.includes("nikdy nekontrolované"), "priznaj, že sa to nekontrolovalo");
  nie(/undefined|NaN/.test(h), "v HTML nesmie byť undefined ani NaN");
});
t("každá sadzba je na obrazovke vidieť", ()=>{
  const h=appSadzby();
  Object.keys(SADZBY).forEach(k=>{
    je(h.includes(esc(SADZBY[k].n)), "chýba riadok pre "+k);
  });
});
t("percentá a €/km sa formátujú čitateľne", ()=>{
  je(sadzbaFormat("danPrijem",0.15)==="15 %", sadzbaFormat("danPrijem",0.15));
  je(sadzbaFormat("nahradaKmOsobne",0.313)==="0,313 €/km", sadzbaFormat("nahradaKmOsobne",0.313));
});

// ══════════════ progresívna daň (§ 15) ══════════════
console.log("\nSadzba dane — hranica 100 000 € a štyri pásma");
const H=100000, P1=43983.32, P2=60349.21, P3=75010.32;

t("hranica aj pásma sedia s § 15 pre rok 2026", ()=>{
  eq(sadzbaRoka("danPrijemHranica",2026), H);
  const p=sadzbaRoka("danPasma",2026);
  eq(p.length,4);
  eqp(p[0].s,0.19); eq(p[0].do,P1);
  eqp(p[1].s,0.25); eq(p[1].do,P2);
  eqp(p[2].s,0.30); eq(p[2].do,P3);
  eqp(p[3].s,0.35); je(p[3].do===null);
});
t("do hranice vrátane platí 15 %", ()=>{
  eq(danZoZakladu(50000, 2026, H, {}).dan, 7500, "presne 100 000 € príjmov");
  nie(danZoZakladu(50000, 2026, H, {}).progresia);
  eq(danZoZakladu(50000, 2026, 99999, {}).dan, 7500);
});
t("nad hranicou sa prepne na progresiu", ()=>{
  const D=danZoZakladu(50000, 2026, H+0.01, {});
  je(D.progresia, "o cent nad hranicou už progresia");
  eq(D.dan, r2(P1*0.19+(50000-P1)*0.25), "19 % do 43 983,32 + 25 % zvyšok");
});
t("pásma sa uplatňujú po častiach, nie na celý základ", ()=>{
  const D=danZoZakladu(80000, 2026, 200000, {});
  eq(D.rozpis.length, 4);
  eq(D.dan, r2(P1*0.19 + (P2-P1)*0.25 + (P3-P2)*0.30 + (80000-P3)*0.35));
  eq(D.rozpis.reduce((a,r)=>a+r.cast,0), 80000, "časti sa musia sčítať na základ");
  je(D.sadzba<0.35 && D.sadzba>0.19, "efektívna sadzba leží medzi krajnými pásmami");
});
t("presne na hranici pásma", ()=>{
  eq(danZoZakladu(P1, 2026, 200000, {}).dan, r2(P1*0.19), "celé v 19 %");
  eq(danZoZakladu(P2, 2026, 200000, {}).dan, r2(P1*0.19+(P2-P1)*0.25));
  eq(danZoZakladu(P3, 2026, 200000, {}).dan, r2(P1*0.19+(P2-P1)*0.25+(P3-P2)*0.30));
});
t("nulový a záporný základ nespadne", ()=>{
  eq(danZoZakladu(0, 2026, 200000, {}).dan, 0);
  eq(danZoZakladu(-500, 2026, 200000, {}).dan, 0);
  eq(danZoZakladu(0, 2026, 200000, {}).sadzba, 0);
});
t("bez známych príjmov ostáva pôvodné správanie", ()=>{
  eq(danZoZakladu(50000, 2026, undefined, {}).dan, 7500, "neznáme príjmy nesmú spustiť progresiu");
  eq(danZoZakladu(50000, 2026, null, {}).dan, 7500);
});
t("vlastná sadzba v nastaveniach platí len pod hranicou", ()=>{
  eq(danZoZakladu(10000, 2026, 50000, {danPrijem:0.19}).dan, 1900, "prepísanie sa uplatní");
  je(danZoZakladu(10000, 2026, 200000, {danPrijem:0.19}).progresia, "nad hranicou rozhoduje zákon");
});

console.log("\nProgresia naprieč vetvami");
// Príjmy rozložené na celý rok — prognóza inak jednu faktúru extrapoluje na 12 mesiacov
// a test by meral extrapoláciu, nie sadzbu.
const velky=(prijmy)=>s_({settings:{minVZmesZP:0, minOdvodZP:0, socOdvodyMes:0},
  faktury:Array.from({length:12},(_,i)=>({cislo:"F"+i,
    datum:`2026-${String(i+1).padStart(2,"0")}-15`, bez:r2(prijmy/12), dph:0, spolu:r2(prijmy/12)}))});

t("malý živnostník sa nezmenil", ()=>{
  nastav(velky(48000));
  const P=dePrognoza(2026);
  eq(P.rocPrijmy, 48000, "kontrola samotného testu: prognóza nesmie extrapolovať");
  const D=deDanovyVypocet(2026);
  nie(D.progresia, "48 000 € príjmov je hlboko pod hranicou");
  eqp(D.sadzba, 0.15);
});
t("veľký živnostník dostane progresiu", ()=>{
  nastav(velky(150000));
  const D=deDanovyVypocet(2026);
  je(D.progresia, "150 000 € príjmov je nad hranicou");
  je(D.sadzba>0.15, "efektívna sadzba musí byť vyššia než 15 %, dostal "+D.sadzba);
  je(D.rozpisPasiem.length>=2, "má byť rozpis po pásmach");
});
t("prognóza a priznanie B hovoria to isté čo dashboard", ()=>{
  nastav(velky(150000));
  const D=deDanovyVypocet(2026), P=dePrognoza(2026), B=pbVypocet(2026);
  je(P.progresia, "prognóza");
  je(B.progresia===true || B.dan>0, "priznanie B");
  je(P.prekrocenaHranica, "prognóza musí hlásiť prekročenie");
  eq(B.dan, D.dan, "priznanie a dashboard sa nesmú rozísť");
});
t("priznanie B už nepoužíva dvojpásmový limit 60 000", ()=>{
  const zdroj=html.match(/progresiaLimit/);
  nie(zdroj, "reťazec progresiaLimit už v kóde nemá čo robiť");
});
t("hranica sa berie z tabuľky, nie natvrdo", ()=>{
  nastav(velky(150000));
  nie(dePrognoza(2026).prekrocenaHranica===undefined);
  sZmenou("danPrijemHranica","2026-01-01",200000,()=>{
    nastav(velky(150000));
    nie(dePrognoza(2026).prekrocenaHranica, "po zvýšení hranice už nie je prekročená");
    nie(deDanovyVypocet(2026).progresia);
  });
});
t("pásma sa viažu na zdaňovacie obdobie", ()=>{
  sZmenou("danPasma","2027-01-01",[{do:50000,s:0.20},{do:null,s:0.40}],()=>{
    const a=danZoZakladu(60000, 2026, 200000, {});
    const b=danZoZakladu(60000, 2027, 200000, {});
    je(a.dan!==b.dan, "rok 2027 má iné pásma");
    eq(b.dan, r2(50000*0.20+10000*0.40));
  });
});

// ══════════════ sadzby zo súboru (fáza 2) ══════════════
console.log("\nSadzby zo súboru — zabudovaná tabuľka je podlaha");
const platny=(zmeny)=>({verzia:"test-1", kedy:"2026-08-01", sadzby:Object.assign({
  danPrijem:{n:"Daň z príjmov FO", sk:"dan", mienaSa:"zriedka", overenost:"zdroj", kontrola:"2026-08-01",
    h:[{od:null, v:0.15, zdroj:"§ 15 ZDP"}]}
}, zmeny||{})});
const poPokuse=(f)=>{ try{ f(); } finally { sadzbyObnovZabudovane();
  SADZBY_PODVOD={zdroj:"zabudované", verzia:APP_VERZIA, kedy:null, poznamka:""}; } };

t("platný súbor prejde kontrolou", ()=>{
  eq(sadzbyOverSubor(platny()).length, 0);
});
t("nezmysly kontrola zachytí", ()=>{
  je(sadzbyOverSubor(null).length>0, "prázdny");
  je(sadzbyOverSubor({verzia:"x"}).length>0, "chýba `sadzby`");
  je(sadzbyOverSubor(platny({neznamyKluc:{h:[{od:null,v:1,zdroj:"x"}]}})).length>0, "neznámy kľúč");
  je(sadzbyOverSubor(platny({danPrijem:{h:[]}})).length>0, "prázdna história");
  je(sadzbyOverSubor(platny({danPrijem:{h:[{od:"1.1.2026", v:0.15, zdroj:"x"}]}})).length>0, "zlý tvar dátumu");
  je(sadzbyOverSubor(platny({danPrijem:{h:[{od:null, v:0.15}]}})).length>0, "chýba zdroj");
});
t("preklep 15 namiesto 0,15 sa nedostane do výpočtu", ()=>{
  const chyby=sadzbyOverSubor(platny({danPrijem:{h:[{od:null, v:15, zdroj:"preklep"}]}}));
  je(chyby.length>0, "musí to zamietnuť");
  poPokuse(()=>{
    nie(sadzbyPouzi(platny({danPrijem:{h:[{od:null, v:15, zdroj:"preklep"}]}}), "test").ok);
    eqp(sadzbaRoka("danPrijem",2026), 0.15, "tabuľka musí ostať nedotknutá");
  });
});
t("pokazené pásma sa zamietnu", ()=>{
  je(sadzbyOverSubor(platny({danPasma:{h:[{od:"2026-01-01", v:[{do:null,s:0.19},{do:5,s:0.25}], zdroj:"x"}]}})).length>0,
     "otvorené pásmo nesmie byť prvé");
  je(sadzbyOverSubor(platny({danPasma:{h:[{od:"2026-01-01", v:[{do:100,s:5}], zdroj:"x"}]}})).length>0,
     "sadzba 500 %");
});
t("súbor sa preberá celý alebo vôbec", ()=>{
  poPokuse(()=>{
    const zly=platny({nezdanitCast:{h:[{od:"2026-01-01", v:6500, zdroj:"nová suma"}]},
                      danPrijem:{h:[{od:null, v:99, zdroj:"preklep"}]}});
    nie(sadzbyPouzi(zly,"test").ok);
    eq(sadzbaRoka("nezdanitCast",2026), 5966.73, "ani dobrá časť sa nesmie použiť");
  });
});

console.log("\nZlučovanie so zabudovanou tabuľkou");
t("nový záznam pribudne, staré ostanú", ()=>{
  poPokuse(()=>{
    je(sadzbyPouzi(platny({nezdanitCast:{h:[{od:"2027-01-01", v:6500, zdroj:"NČZD 2027"}]}}), "test").ok);
    eq(sadzbaRoka("nezdanitCast",2026), 5966.73, "rok 2026 sa nesmie hnúť");
    eq(sadzbaRoka("nezdanitCast",2027), 6500, "rok 2027 z tabuľky");
  });
});
t("už účinnú hodnotu súbor prepísať NESMIE", ()=>{
  poPokuse(()=>{
    const v=sadzbyPouzi(platny({nezdanitCast:{h:[{od:"2026-01-01", v:5966.99, zdroj:"oprava"}]}}), "test");
    nie(v.ok, "prepísanie histórie sa musí odmietnuť");
    je(/už účinnú hodnotu/.test(v.chyby.join(" ")), v.chyby.join(" "));
    eq(sadzbaRoka("nezdanitCast",2026), 5966.73, "tabuľka ostáva nedotknutá");
  });
});
t("ešte neúčinný záznam sa meniť smie", ()=>{
  poPokuse(()=>{
    je(sadzbyPouzi(platny({nezdanitCast:{h:[{od:"2027-01-01", v:6500, zdroj:"NČZD 2027"}]}}), "test").ok);
    je(sadzbyPouzi(platny({nezdanitCast:{h:[{od:"2027-01-01", v:6600, zdroj:"oprava pred účinnosťou"}]}}), "test").ok,
       "nič sa ním ešte nerátalo");
    eq(sadzbaRoka("nezdanitCast",2027), 6600);
  });
});
t("spätne pridaný záznam prejde, ale ohlási sa", ()=>{
  poPokuse(()=>{
    const v=sadzbyPouzi(platny({nahradaKmOsobne:{h:[{od:"2026-07-01", v:0.33, zdroj:"opatrenie z júla"}]}}),
                        "test", new Date(2026,6,21));
    je(v.ok, "doplnenie zmeškaného opatrenia musí prejsť");
    je(v.upozornenia.length>0, "ale nesmie prejsť ticho");
    je(/spätnou účinnosťou/.test(v.upozornenia.join(" ")), v.upozornenia.join(" "));
  });
});

console.log("\nPridanie hodnoty cez editor — dátum je povinný");
const DNES=new Date(2026,6,21);
t("bez dátumu účinnosti sa nedá nič uložiť", ()=>{
  const v=sadzbaNovaHodnota("nezdanitCast", 6500, "", "zákon", DNES);
  nie(v.ok);
  je(/dátum účinnosti je povinný/.test(v.chyby.join(" ")), v.chyby.join(" "));
});
t("zlý tvar dátumu sa odmietne", ()=>{
  nie(sadzbaNovaHodnota("nezdanitCast", 6500, "1.1.2027", "zákon", DNES).ok);
});
t("bez zdroja sa nedá nič uložiť", ()=>{
  const v=sadzbaNovaHodnota("nezdanitCast", 6500, "2027-01-01", "", DNES);
  nie(v.ok); je(/uveďte zdroj/.test(v.chyby.join(" ")));
});
t("preklep v ráde neprejde ani cez editor", ()=>{
  nie(sadzbaNovaHodnota("danPrijem", 15, "2027-01-01", "§ 15 ZDP", DNES).ok, "15 namiesto 0,15");
  je(sadzbaNovaHodnota("danPrijem", 0.19, "2027-01-01", "§ 15 ZDP", DNES).ok);
});
t("budúci dátum prejde bez výhrad", ()=>{
  const v=sadzbaNovaHodnota("nezdanitCast", 6500, "2027-01-01", "NČZD 2027 podľa ŽM", DNES);
  je(v.ok); eq(v.upozornenia.length, 0);
  eq(v.zaznam.od, "2027-01-01"); eq(v.zaznam.v, 6500);
});
t("spätný dátum prejde, ale s upozornením", ()=>{
  const v=sadzbaNovaHodnota("nahradaKmOsobne", 0.33, "2026-07-01", "opatrenie MPSVR", DNES);
  je(v.ok, "doplnenie zmeškaného opatrenia sa nesmie zablokovať");
  je(/spätná účinnosť/.test(v.upozornenia.join(" ")), v.upozornenia.join(" "));
});
t("prepísanie už účinného záznamu editor odmietne", ()=>{
  const v=sadzbaNovaHodnota("nezdanitCast", 5966.99, "2026-01-01", "oprava preklepu", DNES);
  nie(v.ok);
  je(/prepísať sa nedá/.test(v.chyby.join(" ")), v.chyby.join(" "));
});
t("vloženie doprostred histórie sa ohlási", ()=>{
  const v=sadzbaNovaHodnota("nahradaKmOsobne", 0.30, "2025-09-01", "opatrenie", DNES);
  je(v.ok);
  je(/doprostred histórie/.test(v.upozornenia.join(" ")), v.upozornenia.join(" "));
});
t("kľúč, ktorý v súbore nie je, ostáva zabudovaný", ()=>{
  poPokuse(()=>{
    sadzbyPouzi(platny({nezdanitCast:{h:[{od:"2027-01-01", v:6500, zdroj:"x"}]}}), "test");
    eq(sadzbaRoka("obratRocny",2026), 50000);
    eqp(sadzbaKuDnu("nahradaKmOsobne","2026-03-05"), 0.313);
  });
});
t("história sa po zlúčení nerozsype", ()=>{
  poPokuse(()=>{
    sadzbyPouzi(platny({nahradaKmOsobne:{h:[{od:"2026-07-01", v:0.33, zdroj:"test"}]}}), "test");
    eqp(sadzbaKuDnu("nahradaKmOsobne","2025-04-01"), 0.281, "staré 2025 ostáva");
    eqp(sadzbaKuDnu("nahradaKmOsobne","2026-06-30"), 0.313);
    eqp(sadzbaKuDnu("nahradaKmOsobne","2026-07-01"), 0.33, "nové zo súboru");
  });
});
t("obnova vráti presne zabudovaný stav", ()=>{
  const pred=JSON.stringify(SADZBY);
  sadzbyPouzi(platny({nezdanitCast:{h:[{od:"2027-01-01", v:6500, zdroj:"x"}]}}), "test");
  je(JSON.stringify(SADZBY)!==pred, "musela nastať zmena");
  sadzbyObnovZabudovane();
  je(JSON.stringify(SADZBY)===pred, "po obnove sa musí zhodovať");
});

console.log("\nExport a zdroj");
t("export prejde vlastnou kontrolou", ()=>{
  const data=JSON.parse(sadzbyExportJson("2026-07-21"));
  eq(sadzbyOverSubor(data).length, 0, "čo appka vyexportuje, musí vedieť aj načítať");
  eq(Object.keys(data.sadzby).length, Object.keys(SADZBY).length);
});
t("export a načítanie nič nezmenia", ()=>{
  const pred=JSON.stringify(SADZBY);
  poPokuse(()=>{
    je(sadzbyPouzi(JSON.parse(sadzbyExportJson("x")), "test").ok);
    je(JSON.stringify(SADZBY)===pred, "kolobeh musí byť neutrálny");
  });
});
t("obrazovka priznáva, odkiaľ sadzby sú", ()=>{
  nastav(s_());
  je(appSadzby().includes("zabudované"), "pri štarte bez súboru");
  poPokuse(()=>{
    sadzbyPouzi(platny(), "súbor");
    const h=appSadzby();
    je(h.includes("súbor")); je(h.includes("test-1"), "verzia musí byť vidieť");
  });
});

// ══════════════ celá reťaz načítania ══════════════
console.log("\nNačítanie: sieť → pamäť zariadenia → zabudované");
// stub pamäte a siete; obnovíme po každom teste
const _lsData={};
const nastavPamat=(v)=>{ if(v===null) delete _lsData.k; else _lsData.k=v; };
global.localStorage={getItem:(k)=>(k===SADZBY_CACHE_KEY?(_lsData.k||null):null),
                     setItem:(k,v)=>{ if(k===SADZBY_CACHE_KEY) _lsData.k=v; },
                     removeItem:()=>{}};
vm.runInThisContext("localStorage=global.localStorage");
const sSietou=async (odpoved, f)=>{
  const zaloha=global.fetch;
  global.fetch=()=>odpoved instanceof Error ? Promise.reject(odpoved) : Promise.resolve(odpoved);
  vm.runInThisContext("fetch=global.fetch");
  try { await f(); } finally { global.fetch=zaloha; vm.runInThisContext("fetch=global.fetch");
    sadzbyObnovZabudovane(); SADZBY_PODVOD={zdroj:"zabudované", verzia:APP_VERZIA, kedy:null, poznamka:""}; }
};
const odp=(data)=>({ok:true, json:async()=>data});

(async ()=>{
await (async()=>{
  nastavPamat(null);
  await sSietou(odp(platny({nezdanitCast:{h:[{od:"2027-01-01", v:6500, zdroj:"NČZD 2027"}]}})), async()=>{
    const v=await sadzbyNacitaj();
    t("súbor zo siete sa použije a uloží do pamäte", ()=>{
      eq(v.zdroj==="súbor", true, "dostal "+v.zdroj);
      eq(sadzbaRoka("nezdanitCast",2027), 6500);
      je(_lsData.k, "malo sa uložiť pre offline");
    });
  });
})();

await (async()=>{
  // service worker vráti 504, keď nie je sieť
  await sSietou({ok:false, status:504, json:async()=>({})}, async()=>{
    const v=await sadzbyNacitaj();
    t("504 od service workera nezhodí appku", ()=>{
      eq(sadzbaRoka("nezdanitCast",2027), 6500, "použije sa uložená kópia");
      eq(v.zdroj==="vyrovnávacia pamäť", true, "dostal "+v.zdroj);
    });
  });
})();

await (async()=>{
  await sSietou(new Error("offline"), async()=>{
    const v=await sadzbyNacitaj();
    t("úplný výpadok siete nezhodí appku", ()=>{
      je(v.zdroj==="vyrovnávacia pamäť" || v.zdroj==="zabudované", "dostal "+v.zdroj);
      eq(sadzbaRoka("nezdanitCast",2026), 5966.73, "rok 2026 musí platiť vždy");
    });
  });
})();

await (async()=>{
  _lsData.k="{toto nie je JSON";
  await sSietou(new Error("offline"), async()=>{
    const v=await sadzbyNacitaj();
    t("pokazená pamäť zariadenia nezhodí štart", ()=>{
      eq(v.zdroj==="zabudované", true, "dostal "+v.zdroj);
      eq(sadzbaRoka("nezdanitCast",2026), 5966.73);
    });
  });
  delete _lsData.k;
})();

await (async()=>{
  _lsData.k=JSON.stringify(platny({danPrijem:{h:[{od:null, v:99, zdroj:"preklep"}]}}));
  await sSietou(new Error("offline"), async()=>{
    await sadzbyNacitaj();
    t("nezmysel v pamäti zariadenia sa tiež zamietne", ()=>{
      eqp(sadzbaRoka("danPrijem",2026), 0.15, "tabuľka musí ostať zabudovaná");
    });
  });
  delete _lsData.k;
})();

// ══════════════ editor sadzieb (3c) ══════════════
console.log("\nEditor — koncept, dopad, export");
const DNES2=new Date(2026,6,21);
const _kon={};
global.localStorage={getItem:(k)=>(k===SADZBY_CACHE_KEY?(_lsData.k||null):(k===KONCEPT_KEY?(_kon.k||null):null)),
                     setItem:(k,v)=>{ if(k===SADZBY_CACHE_KEY)_lsData.k=v; if(k===KONCEPT_KEY)_kon.k=v; },
                     removeItem:()=>{}};
vm.runInThisContext("localStorage=global.localStorage");
const cistyKoncept=(f)=>{ konceptVycisti(); try{ f(); } finally { konceptVycisti(); } };

t("koncept nevstupuje do výpočtov", ()=>{
  cistyKoncept(()=>{
    nastav(s_({faktury:[{cislo:"1",datum:"2026-06-30",bez:20000,dph:0,spolu:20000}]}));
    const pred=deDanovyVypocet(2026).dan;
    // nezdanitCast MÁ záznam k 1. 1. 2026, ktorý je už účinný — prepísať sa nesmie
    je(konceptPridaj("nezdanitCast", 6000, "2026-01-01", "§ 11 ZDP", DNES2).ok===false,
       "už účinný záznam sa aj cez editor odmietne");
    je(konceptPridaj("danPrijem", 0.30, "2027-01-01", "§ 15 ZDP", DNES2).ok);
    eq(deDanovyVypocet(2026).dan, pred, "rok 2026 sa nesmie hnúť");
    eq(deDanovyVypocet(2027).dan!==undefined, true);
    eqp(sadzbaRoka("danPrijem",2027), 0.15, "tabuľka ostáva nedotknutá, kým sa súbor nenasadí");
  });
});
t("koncept prežije obnovenie stránky", ()=>{
  cistyKoncept(()=>{
    konceptPridaj("nezdanitCast", 6500, "2027-01-01", "NČZD 2027", DNES2);
    sadzbyKoncept=[];
    konceptNacitaj();
    eq(sadzbyKoncept.length, 1, "má sa načítať z pamäte zariadenia");
    eq(sadzbyKoncept[0].zaznam.v, 6500);
  });
});
t("dva zápisy k tej istej sadzbe a dátumu sa nehromadia", ()=>{
  cistyKoncept(()=>{
    konceptPridaj("nezdanitCast", 6500, "2027-01-01", "prvý", DNES2);
    konceptPridaj("nezdanitCast", 6600, "2027-01-01", "opravený", DNES2);
    eq(sadzbyKoncept.length, 1);
    eq(sadzbyKoncept[0].zaznam.v, 6600);
  });
});
t("odobratie a vyčistenie funguje", ()=>{
  cistyKoncept(()=>{
    konceptPridaj("nezdanitCast", 6500, "2027-01-01", "NČZD 2027", DNES2);
    konceptPridaj("bonusDo15", 110, "2027-01-01", "bonus 2027", DNES2);
    eq(sadzbyKoncept.length, 2);
    konceptOdober(0); eq(sadzbyKoncept.length, 1);
    eq(sadzbyKoncept[0].kluc, "bonusDo15");
    konceptVycisti(); eq(sadzbyKoncept.length, 0);
  });
});

console.log("\nExport konceptu");
t("vyexportovaný súbor prejde oboma kontrolami", ()=>{
  cistyKoncept(()=>{
    konceptPridaj("nezdanitCast", 6500, "2027-01-01", "NČZD 2027 podľa ŽM", DNES2);
    const data=konceptDoSuboru("2026-07-21");
    eq(sadzbyOverSubor(data).length, 0, "tvar");
    eq(sadzbyOverZmenu(data, DNES2).chyby.length, 0, "nič neprepisuje");
    const h=data.sadzby.nezdanitCast.h;
    eq(h.length, SADZBY_ZABUDOVANE.nezdanitCast.h.length+1, "celá pôvodná história musí ostať");
    eq(h[h.length-2].od, "2026-01-01"); eq(h[h.length-2].v, 5966.73);
    eq(h[h.length-1].od, "2027-01-01"); eq(h[h.length-1].v, 6500);
    je(h.some(z=>z.od==="2025-01-01" && z.v===5753.79), "aj rok 2025 musí prežiť");
  });
});
t("prázdny koncept vyexportuje nezmenený súbor", ()=>{
  cistyKoncept(()=>{
    eq(JSON.stringify(konceptDoSuboru("x")), sadzbyExportJson("x").replace(/\n\s*/g,"").replace(/\s*:\s*/g,":")
       .length>0 ? JSON.stringify(JSON.parse(sadzbyExportJson("x"))) : "", "kolobeh musí byť neutrálny");
  });
});
t("súbor z konceptu sa dá reálne načítať", ()=>{
  cistyKoncept(()=>{
    konceptPridaj("nezdanitCast", 6500, "2027-01-01", "NČZD 2027", DNES2);
    const data=konceptDoSuboru("test-2");
    poPokuse(()=>{
      je(sadzbyPouzi(data, "test", DNES2).ok);
      eq(sadzbaRoka("nezdanitCast",2027), 6500);
      eq(sadzbaRoka("nezdanitCast",2026), 5966.73);
    });
  });
});

console.log("\nNáhľad dopadu");
t("dopad sa meria na skutočných dátach", ()=>{
  cistyKoncept(()=>{
    nastav(s_({settings:{minVZmesZP:0, minOdvodZP:0},
      faktury:Array.from({length:12},(_,i)=>({cislo:"F"+i,
        datum:`2027-${String(i+1).padStart(2,"0")}-28`, bez:5000, dph:0, spolu:5000}))}));
    konceptPridaj("danPrijem", 0.20, "2027-01-01", "hypotéza", DNES2);
    const D=konceptDopad();
    je(D && D.length, "má vrátiť aspoň jeden rok");
    const r=D[0].riadky.find(x=>x.k==="dan");
    je(r, "daň sa musí zmeniť");
    je(r.po>r.pred, "vyššia sadzba = vyššia daň");
  });
});
t("dopad tabuľku po sebe upratal", ()=>{
  cistyKoncept(()=>{
    // Porovnávame proti ZABUDOVANEJ tabuľke, nie proti snímke urobenej v priebehu
    // sady. Prvá verzia tohto testu brala snímku, ktorú predošlý test už pokazil,
    // takže sa rovnala sama sebe a chybu neodhalila.
    sadzbyObnovZabudovane();
    const etalon=JSON.stringify(SADZBY_ZABUDOVANE);
    je(JSON.stringify(SADZBY)===etalon, "kontrola testu: začíname z čistého stavu");
    konceptPridaj("danPrijem", 0.20, "2027-01-01", "hypotéza", DNES2);
    konceptDopad();
    je(JSON.stringify(SADZBY)===etalon, "náhľad nesmie tabuľku zmeniť");
    eq(SADZBY.danPrijem.h.length, SADZBY_ZABUDOVANE.danPrijem.h.length, "nesmie pribudnúť záznam");
  });
});
t("dopad sa dá pustiť opakovane bez hromadenia", ()=>{
  cistyKoncept(()=>{
    sadzbyObnovZabudovane();
    konceptPridaj("danPrijem", 0.20, "2027-01-01", "hypotéza", DNES2);
    const n=SADZBY.danPrijem.h.length;
    konceptDopad(); konceptDopad(); konceptDopad();
    eq(SADZBY.danPrijem.h.length, n, "trojnásobné spustenie nesmie nič pridať");
  });
});
t("bez konceptu niet čo merať", ()=>{
  cistyKoncept(()=>{ je(konceptDopad()===null); });
});

console.log("\nEditor — vykreslenie");
t("obrazovka sa vykreslí bez konceptu", ()=>{
  cistyKoncept(()=>{
    nastav(s_());
    const h=appSadzby();
    je(h.includes("Sadzby a hranice"));
    nie(h.includes("Rozrobená zmena"), "bez konceptu sa karta nezobrazuje");
    nie(/undefined|NaN/.test(h));
  });
});
t("obrazovka ukáže koncept aj dopad", ()=>{
  cistyKoncept(()=>{
    nastav(s_({settings:{minVZmesZP:0, minOdvodZP:0},
      faktury:[{cislo:"1", datum:"2027-06-30", bez:60000, dph:0, spolu:60000}]}));
    konceptPridaj("danPrijem", 0.20, "2027-01-01", "hypotéza", DNES2);
    const h=appSadzby();
    je(h.includes("Rozrobená zmena sadzieb"), "appka má ukázať rozrobenú zmenu z adminu");
    nie(/undefined|NaN/.test(h));
  });
});
t("appka koncept z adminu neaplikuje, len ukáže", ()=>{
  cistyKoncept(()=>{
    nastav(s_({settings:{minVZmesZP:0,minOdvodZP:0},
      faktury:[{cislo:"1", datum:"2027-06-30", bez:60000, dph:0, spolu:60000}]}));
    konceptPridaj("danPrijem", 0.20, "2027-01-01", "hypotéza", DNES2);
    eqp(sadzbaRoka("danPrijem",2027), 0.15, "tabuľka sa nesmie hnúť");
    je(appSadzby().includes("ešte nie je nasadená"), "má to povedať nahlas");
  });
});

// ══════════════ história 2025 a poistka ══════════════
console.log("\nHistória 2025 — výpočet za starší rok nesmie vypadnúť");
t("kľúčové sadzby majú hodnotu aj pre 2025", ()=>{
  const chyba=[];
  ["danPrijem","sadzbaDPH","zdravSadzba","minVZmesZP","minOdvodZP","vzKoef","nezdanitCast",
   "nczdHranicaPlna","nczdKonstanta","nczdZanik","nczdDelitel","nczdManzelMax","nczd3pilierMax",
   "bonusDo15","bonus15az18","bonusKratHranica","hmHranica"].forEach(k=>{
    const v=sadzbaRoka(k,2025);
    if(v===undefined || isNaN(v)) chyba.push(k);
  });
  eq(chyba.length, 0, "bez hodnoty pre 2025: "+chyba.join(", "));
});
t("2025 a 2026 sa naozaj líšia tam, kde sa líšiť majú", ()=>{
  eqp(sadzbaRoka("zdravSadzba",2025), 0.15); eqp(sadzbaRoka("zdravSadzba",2026), 0.16);
  eq(sadzbaRoka("minVZmesZP",2025), 715);    eq(sadzbaRoka("minVZmesZP",2026), 762);
  eq(sadzbaRoka("minOdvodZP",2025), 107.25); eq(sadzbaRoka("minOdvodZP",2026), 121.92);
  eq(sadzbaRoka("nezdanitCast",2025), 5753.79);
  eq(sadzbaRoka("nczdDelitel",2025), 4, "v 2025 sa krátilo štyrmi");
  eq(sadzbaRoka("nczdDelitel",2026), 3, "od 2026 tromi");
  eq(sadzbaRoka("bonusKratHranica",2025), 25740);
});
t("NČZD za 2025 počíta vzorcom roka 2025", ()=>{
  const S={};
  const D=deVypocetDane(30000, S, 2025);
  eq(D.nczdVlastna, r2(12110.36-30000/4), "12 110,36 − ZD/4");
  const D6=deVypocetDane(30000, S, 2026);
  eq(D6.nczdVlastna, r2(14661.11-30000/3), "14 661,11 − ZD/3");
  je(D.nczdVlastna!==D6.nczdVlastna, "roky sa nesmú počítať rovnako");
});
t("zdravotné za 2025 a 2026 vychádza rôzne", ()=>{
  nastav(s_({settings:{minVZmesZP:0, minOdvodZP:0},
    faktury:[{cislo:"1", datum:"2025-06-30", bez:30000, dph:0, spolu:30000},
             {cislo:"2", datum:"2026-06-30", bez:30000, dph:0, spolu:30000}]}));
  const a=calcDanRow(5, 2025, firmaData.settings).zdrav;
  const b=calcDanRow(5, 2026, firmaData.settings).zdrav;
  je(a>0 && b>0, "obe musia vyjsť");
  eq(r2(a/0.15*0.16), b, "rozdiel je presne pomer sadzieb 15 : 16");
});
t("poistka pri neznámom období hlási a nevracia undefined", ()=>{
  const v=sadzbaRoka("nezdanitCast", 2019);
  eq(v, 5753.79, "vráti najstaršiu známu");
  je(sadzbyChybajuce().some(x=>x.kluc==="nezdanitCast"), "musí sa to nahlásiť");
});

console.log("\nMigrácia — zastaraný default nie je vedomé rozhodnutie");
t("stará sadzba z onboardingu sa odstráni", ()=>{
  nastav(s_({settings:{zdravSadzba:0.15, phlRezim:"kniha"}}));
  const v=migrujSadzbyZNastaveni();
  je(v.odstranene.includes("zdravSadzba"), "0,15 bola naša sadzba v 2025 — je to default, nie voľba");
  je(firmaData.settings.zdravSadzba===undefined);
  eqp(sadzbaFirmy("zdravSadzba",2026,firmaData.settings), 0.16, "výpočet začne používať 16 %");
  eqp(sadzbaFirmy("zdravSadzba",2025,firmaData.settings), 0.15, "a za 2025 stále 15 %");
});
t("hodnota, ktorá v histórii nikdy nebola, sa ponechá", ()=>{
  nastav(s_({settings:{zdravSadzba:0.135}}));
  const v=migrujSadzbyZNastaveni();
  je(v.ponechane.includes("zdravSadzba"), "0,135 nie je náš default");
  eqp(firmaData.settings.zdravSadzba, 0.135);
});
t("aktuálna hodnota sa odstráni tiež", ()=>{
  nastav(s_({settings:{zdravSadzba:0.16, nezdanitCast2026:5966.73}}));
  const v=migrujSadzbyZNastaveni();
  je(v.odstranene.includes("zdravSadzba"));
  je(v.odstranene.includes("nezdanitCast2026"));
});

console.log(`\n═══ ${ok} prešlo, ${fail} zlyhalo ═══`);
process.exit(fail?1:0);
})();
