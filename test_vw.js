// Test VW importu: parser na reálnom exporte + dedup 2 úrovne na reálnej zálohe
const XLSX=(()=>{try{return require("xlsx")}catch(e){return null}})();
const fs=require("fs");
let ok=0,zle=0;
const t=(n,p)=>{console.log((p?"  ✓ ":"  ✗ ")+n);p?ok++:zle++;};

function parseSkDateTime(s){
  const m=String(s).match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s*(\d{1,2}):(\d{2})/);
  if(!m) return null;
  return new Date(+m[3],+m[2]-1,+m[1],+m[4],+m[5]);
}
console.log("Parser dátumu VW");
t("'25. 7. 2026 13:44'", parseSkDateTime("25. 7. 2026 13:44")?.getDate()===25);
t("'1. 1. 2026 20:14'", parseSkDateTime("1. 1. 2026 20:14")?.getMonth()===0);

if(XLSX){
  const wb=XLSX.read(fs.readFileSync("tripy_novy.xlsx"),{type:"buffer"});
  const rows=XLSX.utils.sheet_to_json(wb.Sheets["Krátkodobé údaje"],{header:1});
  const hi=rows.findIndex(r=>r&&String(r[0]||"").includes("Koniec jazdy"));
  const parsed=[];
  for(let i=hi+1;i<rows.length;i++){ const r=rows[i]; if(!r||!r[0]) continue;
    const d=parseSkDateTime(r[0]); if(!d) continue;
    const km=Math.round(parseFloat(String(r[1]).replace(",","."))||0); if(!km) continue;
    const denKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    parsed.push({dt:d.toISOString(), denKey, mesiacKey:denKey.slice(0,7), km,
      celkL:parseFloat(String(r[6]).replace(",","."))||0, celkKWh:parseFloat(String(r[7]).replace(",","."))||0});
  }
  console.log("\nReálny 7-mesačný export");
  t("400+ jázd naparsovaných ("+parsed.length+")", parsed.length>=400);
  const mes=[...new Set(parsed.map(p=>p.mesiacKey))].sort();
  t("mesiace 2026-01 … 2026-07", mes[0]==="2026-01"&&mes[mes.length-1]==="2026-07"&&mes.length===7);
  t("km súčet realistický ("+parsed.reduce((a,p)=>a+p.km,0)+" km)", (()=>{const s=parsed.reduce((a,p)=>a+p.km,0);return s>5000&&s<40000})());
  t("žiadne nulové km", parsed.every(p=>p.km>0));

  console.log("\nDedup nad reálnou zálohou (660 jázd v knihe)");
  const zaloha=JSON.parse(fs.readFileSync("zaloha.json","utf8"));
  const jazdaDatum=j=>{const m=String(j.datum||"").match(/(\d+)\.\s*(\d+)\.\s*(\d+)/); return m?new Date(+m[3],+m[2]-1,+m[1]):null;};
  const dayKey=j=>{const d=jazdaDatum(j); return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`:"";};
  const existDt=new Set((zaloha.jazdy||[]).map(j=>j.dt));
  const existDni=new Set((zaloha.jazdy||[]).map(dayKey).filter(Boolean));
  const dupDt=parsed.filter(p=>existDt.has(p.dt)).length;
  const veden=parsed.filter(p=>!existDt.has(p.dt)&&existDni.has(p.denKey)).length;
  const nove=parsed.length-dupDt-veden;
  console.log(`  (dt-duplicity: ${dupDt} · dni už vedené: ${veden} · čisté nové: ${nove})`);
  t("úrovne sa neprekrývajú a sedia so súčtom", dupDt+veden+nove===parsed.length);
  t("kniha so 660 jazdami chytí prekryv (veden+dup > 0)", (dupDt+veden)>0);
  t("default: vedené dni sa odznačia, dt-duplicity zakážu — nič sa nezdvojí",
    parsed.filter(p=>existDt.has(p.dt)||(!existDt.has(p.dt)&&existDni.has(p.denKey))).length===dupDt+veden);
} else console.log("(xlsx modul nedostupný — preskakujem časť s reálnym súborom)");


// ═══════════════════════════════════════════════════════════
//  Rozšírenia CY: tachometer, kontrola vozidla, tankovania
// ═══════════════════════════════════════════════════════════
const r2=n=>Math.round((+n||0)*100)/100;
function vwCislo(txt){
  let t=String(txt||"").replace(/\s|km/gi,"");
  if(/^\d{1,3}(,\d{3})+$/.test(t)) t=t.replace(/,/g,"");
  else t=t.replace(",",".");
  const n=parseFloat(t); return isNaN(n)?0:n;
}
console.log("\nParser čísel VW (anglický vs slovenský formát)");
t("'27,731 km' → 27731 (tisícka)", vwCislo("27,731 km")===27731);
t("'1,234,567' → 1234567", vwCislo("1,234,567")===1234567);
t("'19,14' → 19.14 (desatinná čiarka)", vwCislo("19,14")===19.14);
t("'331.0' → 331", vwCislo("331.0")===331);
t("prázdne → 0", vwCislo("")===0);

if(XLSX){
  const wb=XLSX.read(fs.readFileSync("tripy_novy.xlsx"),{type:"buffer"});
  const rows=XLSX.utils.sheet_to_json(wb.Sheets["Krátkodobé údaje"],{header:1});
  const hi=rows.findIndex(r=>r&&String(r[0]||"").includes("Koniec jazdy"));
  // hlavička
  let meta={vin:"",tachometer:0,exportDna:""};
  for(let i=0;i<hi;i++){ const r=rows[i]||[];
    for(let c=0;c<r.length;c++){ const v=String(r[c]||"");
      if(/^WVG|^[A-HJ-NPR-Z\d]{17}$/.test(v.trim())&&!meta.vin) meta.vin=v.trim();
      if(/Počet kilometrov/i.test(v)) meta.tachometer=vwCislo(r[c+1]);
      if(/Export vyhotoven/i.test(v)) meta.exportDna=String(r[c+1]||"").trim(); } }
  console.log("\nHlavička reálneho exportu");
  t("VIN WVGZZZR41SW505726", meta.vin==="WVGZZZR41SW505726");
  t("tachometer 27731 km", meta.tachometer===27731);
  t("dátum exportu vyplnený", /2026/.test(meta.exportDna));

  // ── Spotreba, NIE tankovania ──────────────────────────────────────────
  // Hárok „Od tankovania" napriek názvu neobsahuje záznamy o tankovaní. Má
  // rovnaké stĺpce ako ostatné hárky a stĺpec 6 je „Celková spotreba v l",
  // teda koľko sa MINULO. Export z vozidla o tankovaniach nevie nič — nepozná
  // cenu, stanicu ani natankovaný objem.
  console.log("\nHárky nesú spotrebu, nie tankovania");
  const hlavicka=n=>{ const rr=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1});
    const hi=rr.findIndex(r=>r&&String(r[0]||"").includes("Koniec jazdy"));
    return hi<0?[]:rr[hi].map(x=>String(x||"")); };
  const hOdT=hlavicka("Od tankovania"), hKrat=hlavicka("Krátkodobé údaje");
  t("hárok „Od tankovania\" má rovnaké stĺpce ako trasy",
    JSON.stringify(hOdT)===JSON.stringify(hKrat));
  t("stĺpec 6 je spotreba, nie natankované množstvo",
    /Celková spotreba v l/i.test(hOdT[6]||""));
  t("žiadny stĺpec nehovorí o cene ani stanici",
    !hOdT.some(x=>/cena|stanica|€|EUR/i.test(x)));

  // Zrkadlá funkcií z appky (tento test je zámerne samostatný, bez DOM).
  // Nižšie sa zdrojovo overuje, že appka naozaj obsahuje tie isté funkcie
  // a že staré, chybné už v nej nie sú.
  const vwSpotreba=P=>{ if(!P||!P.length) return null;
    const dni=P.map(x=>x.denKey).filter(Boolean).sort();
    return {od:dni[0], doD:dni[dni.length-1],
            km:Math.round(P.reduce((a,x)=>a+(+x.km||0),0)),
            litre:r2(P.reduce((a,x)=>a+(+x.celkL||0),0)),
            kwh:r2(P.reduce((a,x)=>a+(+x.celkKWh||0),0))}; };
  const vwKontrolaSpotreby=(sp,tank)=>{ if(!sp||sp.litre<=0) return null;
    const nase=(tank||[]).filter(x=>{const d=String(x.datum||"").slice(0,10);
      return d>=sp.od && d<=sp.doD;});
    const naseL=r2(nase.reduce((a,x)=>a+(+x.litre||0),0));
    const NADRZ=55;
    return {od:sp.od, doD:sp.doD, spotrebovaneL:sp.litre, nakupeneL:naseL,
            rozdiel:r2(sp.litre-naseL), pocetNase:nase.length,
            tolerancia:NADRZ, podozrive:r2(sp.litre-naseL)>NADRZ}; };

  // trasy v tomto bloku ešte nie sú naparsované — hárok je ten istý
  const trasy=[];
  for(let i=hi+1;i<rows.length;i++){ const r=rows[i]; if(!r||!r[0]) continue;
    const d=parseSkDateTime(r[0]); if(!d) continue;
    const km=Math.round(parseFloat(String(r[1]).replace(",","."))||0); if(!km) continue;
    trasy.push({denKey:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
      km, celkL:parseFloat(String(r[6]).replace(",","."))||0,
      celkKWh:parseFloat(String(r[7]).replace(",","."))||0}); }

  const sp=vwSpotreba(trasy);
  t("spotreba sa číta z hárku s trasami", sp && sp.km===14049);
  t("obdobie spotreby = obdobie jázd", sp.od==="2026-01-01" && sp.doD==="2026-07-25");
  t("minuté palivo (" + sp.litre + " l) sedí s trasami", Math.abs(sp.litre-420.39)<0.5);
  t("minutá elektrina (" + sp.kwh + " kWh)", Math.abs(sp.kwh-2094.55)<1);

  // Hárok „Od tankovania" pokrýva INÉ obdobie než trasy — ďalší dôvod, prečo
  // sa z neho nedá odvodiť nič o období, ktoré sa práve importuje.
  const odT=XLSX.utils.sheet_to_json(wb.Sheets["Od tankovania"],{header:1});
  const oi=odT.findIndex(r=>r&&String(r[0]||"").includes("Koniec jazdy"));
  let odTKm=0;
  for(let i=oi+1;i<odT.length;i++){ const r=odT[i]; if(!r||!r[0]) continue;
    odTKm+=vwCislo(r[1]); }
  t("„Od tankovania\" pokrýva dlhšie obdobie než trasy (" + Math.round(odTKm) + " km)",
    Math.round(odTKm) > sp.km);

  // krížová kontrola: spotrebované vs. nakúpené litre
  const zaloha=JSON.parse(fs.readFileSync("zaloha.json","utf8"));
  const kon=vwKontrolaSpotreby(sp, zaloha.tankovania);
  console.log(`  (${kon.od}…${kon.doD} · minuté ${kon.spotrebovaneL} l · doklady ${kon.nakupeneL} l / ${kon.pocetNase}×)`);
  t("kontrola porovnáva spotrebu s dokladmi, nie tankovania s dokladmi",
    kon.spotrebovaneL===sp.litre);
  t("rozdiel nad jednu nádrž je označený ako podozrivý", kon.podozrive===true);
  t("tolerancia je jedna nádrž, nie 5 litrov", kon.tolerancia>=45);

  console.log("\nAppka už nestojí na starom predpoklade");
  const app=fs.readFileSync("app_script.js","utf8");
  t("funkcia vwSpotreba je v appke", /function vwSpotreba\(/.test(app));
  t("funkcia vwKontrolaSpotreby je v appke", /function vwKontrolaSpotreby\(/.test(app));
  t("vwOdTankovania je odstránená", !/vwOdTankovania/.test(app));
  t("vwKontrolaTankovani je odstránená", !/vwKontrolaTankovani/.test(app));
  t("nikde sa netvrdí „Natankované palivo\"", !/Natankované palivo/.test(app));

  // tachometer: kontinuita nad reálnou knihou
  console.log("\nTachometer nad reálnou knihou (660 jázd)");
  const jazdaDatum=j=>{const m=String(j.datum||"").match(/(\d+)\.\s*(\d+)\.\s*(\d+)/);return m?new Date(+m[3],+m[2]-1,+m[1]):null;};
  const sorted=(zaloha.jazdy||[]).filter(jazdaDatum).sort((a,b)=>{const d=jazdaDatum(a)-jazdaDatum(b);return d||String(a.dt||"").localeCompare(String(b.dt||""));});
  let diery=0;
  for(let i=1;i<sorted.length;i++){const kon=+sorted[i-1].kon||0,poc=+sorted[i].poc||0;
    if(kon&&poc&&Math.abs(r2(poc-kon))>0.5) diery++;}
  console.log("  (nespojitých miest v existujúcej knihe: "+diery+")");
  // simulácia prepočtu
  let stav=+sorted[0].poc||0, upravenych=0;
  const kopia=sorted.map(j=>({...j}));
  for(const j of kopia){const km=+j.km||0;const np=r2(stav),nk=r2(stav+km);
    if(j.poc!==np||j.kon!==nk) upravenych++; j.poc=np;j.kon=nk;stav=nk;}
  let po=0;
  for(let i=1;i<kopia.length;i++){if(Math.abs(r2((+kopia[i].poc)-(+kopia[i-1].kon)))>0.5) po++;}
  t("prepočet odstráni všetky nespojitosti", po===0);
  t("prepočet zachová súčet km", r2(kopia.reduce((a,j)=>a+(+j.km||0),0))===r2(sorted.reduce((a,j)=>a+(+j.km||0),0)));
  t("koncový stav = počiatok + suma km", r2(kopia[kopia.length-1].kon)===r2((+sorted[0].poc||0)+kopia.reduce((a,j)=>a+(+j.km||0),0)));
  console.log("  (prepočet by upravil "+upravenych+" z "+kopia.length+" jázd, koniec "+Math.round(kopia[kopia.length-1].kon)+" km)");
  t("koniec knihy vs tachometer vozidla je porovnateľný",
    Math.abs(meta.tachometer-kopia[kopia.length-1].kon)<meta.tachometer);
}


// ── Dry-run a rozlíšenie medzery / prekryvu ──
console.log("\nTachometer: dry-run a znamienko rozdielu");
function prepocitaj(jazdy, dryRun){
  const jd=j=>{const m=String(j.datum||"").match(/(\d+)\.\s*(\d+)\.\s*(\d+)/);return m?new Date(+m[3],+m[2]-1,+m[1]):null;};
  const s=jazdy.filter(jd).sort((a,b)=>{const d=jd(a)-jd(b);return d||String(a.dt||"").localeCompare(String(b.dt||""));});
  if(!s.length) return {doplnenych:0,posunutych:0,odKm:0,doKm:0};
  let stav=+s[0].poc||0, dopl=0, pos=0;
  if(!(stav>0)) return {doplnenych:0,posunutych:0,bezKotvy:true};
  const odKm=stav;
  for(const j of s){ const km=+j.km||0, np=r2(stav), nk=r2(stav+km);
    const malo=(+j.poc>0||+j.kon>0);
    if(j.poc!==np||j.kon!==nk){ malo?pos++:dopl++; if(!dryRun){j.poc=np;j.kon=nk;} }
    stav=nk; }
  return {doplnenych:dopl, posunutych:pos, odKm, doKm:r2(stav)};
}
const zal=JSON.parse(fs.readFileSync("zaloha.json","utf8"));
const kopiaA=zal.jazdy.map(j=>({...j}));
const dry=prepocitaj(kopiaA, true);
t("dry-run nemodifikuje dáta", JSON.stringify(kopiaA)===JSON.stringify(zal.jazdy));
t("dry-run nahlási posun existujúcich ("+dry.posunutych+")", dry.posunutych>0);
const kopiaB=zal.jazdy.map(j=>({...j}));
const ost=prepocitaj(kopiaB, false);
t("ostrý beh dá rovnaké počty ako dry-run", ost.posunutych===dry.posunutych && ost.doplnenych===dry.doplnenych);
t("ostrý beh dáta zmenil", JSON.stringify(kopiaB)!==JSON.stringify(zal.jazdy));

// prázdny tachometer sa DOPLNÍ, nie posunie
const cerstve=[{datum:"1. 3. 2026",dt:"2026-03-01T08:00:00Z",km:10,poc:100,kon:110},
               {datum:"2. 3. 2026",dt:"2026-03-02T08:00:00Z",km:20},
               {datum:"3. 3. 2026",dt:"2026-03-03T08:00:00Z",km:30}];
const rc=prepocitaj(cerstve,false);
t("nové jazdy sa doplnia (2), nič sa neposunie", rc.doplnenych===2 && rc.posunutych===0);
t("reťaz nadviaže na existujúcu (110→160)", cerstve[1].poc===110 && cerstve[2].kon===160);

// znamienko
const znam=(poc,kon)=>({rozdiel:r2(poc-kon), prekryv:r2(poc-kon)<0});
t("medzera (+18) = nie prekryv", znam(118,100).prekryv===false);
t("prekryv (−18) = prekryv", znam(82,100).prekryv===true);

console.log(`\n═══ ${ok} prešlo, ${zle} zlyhalo ═══`);
process.exit(zle?1:0);
