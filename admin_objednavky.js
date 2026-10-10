// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — admin: PLATBY PREDPLATNÉHO PREVODOM (admin_67, NAVRH_PREVOD 8b)
//
//  Klasický skript s globálnymi funkciami (obsluhy v onclick="…"), načíta ho
//  smerovač adminu pri otvorení sekcie #objednavky. Používa globálne sb, esc,
//  penaz a adminPocet z admin.html.
//
//  Párovanie robí cron `predplatne-prevod` sám, keď sedí VS aj suma
//  (z pohybov Romanovej firmy — notifikácie banky a výpisy). Sem patrí to,
//  čo automatika nespáruje: zlý alebo chýbajúci VS, iná suma — a platby
//  spárované len z notifikácie, ktoré ešte nepotvrdil výpis.
// ═══════════════════════════════════════════════════════════════════════════

const OBJ_STAV = { caka_na_prevod:"čaká na platbu", neuhradena:"neuhradená", zaplatena:"zaplatená", zrusena:"zrušená" };
let _objAdm = { data: [], chyba: "" };

function objDatum(x){ return x ? new Date(String(x).length === 10 ? x + "T12:00:00" : x).toLocaleDateString("sk-SK") : "–"; }
// Dnešok v Bratislave (RRRR-MM-DD). `toISOString()` je UTC — medzi 0:00 a 2:00
// SELČ dal včerajšok, a ten deň je začiatok predplatného aj dátum na faktúre
// (spec 154 C1).
function objDnesBA(){ return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bratislava" }).format(new Date()); }

// Neoverená výpisom do konca nasledujúceho mesiaca = podozrivá (Roman 8. 10.:
// pri podvrhnutej notifikácii prídeme o jedno predplatné, nie o peniaze).
function objPodozriva(o, dnes){
  if(o.stav !== "zaplatena" || o.overene_vypisom !== false || !o.prijate_dna) return false;
  // výpis za deň pripísania je naimportovaný a platbu nemá (admin_68)
  if(o.vypis_rozpor) return true;
  const d = new Date(o.prijate_dna + "T12:00:00");
  const hranica = new Date(d.getFullYear(), d.getMonth() + 2, 1);
  return (dnes || new Date()) >= hranica;
}

async function nacitajObjednavkyPrevod(){
  const telo = document.getElementById("objAdmBody");
  telo.innerHTML = '<div class="loading">Načítavam platby prevodom…</div>';
  const { data, error } = await sb.from("objednavky")
    .select("id, firma_id, vytvorene, stav, plan, suma, vs, splatnost, je_obnova, doplatok, prijate_dna, prijate_suma, sparoval, overene_vypisom, vypis_rozpor, obdobie_od, obdobie_do, firmy(nazov)")
    .eq("kanal", "prevod").order("vytvorene", { ascending: false }).limit(300);
  _objAdm = { data: data || [], chyba: error ? error.message : "" };
  vykresliObjednavkyPrevod();
}

function vykresliObjednavkyPrevod(){
  const telo = document.getElementById("objAdmBody");
  telo.onclick = objKlik;
  if(_objAdm.chyba){ telo.innerHTML = '<div class="loading">Chyba: ' + esc(_objAdm.chyba) + "</div>"; return; }
  const d = _objAdm.data;
  const caka = d.filter(o => o.stav === "caka_na_prevod" || o.stav === "neuhradena");
  const neover = d.filter(o => o.stav === "zaplatena" && o.overene_vypisom === false);
  adminPocet("objednavky", caka.length + neover.filter(o => objPodozriva(o)).length);
  if(!d.length){ telo.innerHTML = '<div class="empty">Zatiaľ žiadna objednávka prevodom.</div>'; return; }
  // Filter (spec 154 B5): predvolene len to, čo treba vybaviť; hľadanie VS, firmy, plánu.
  const filter = (document.getElementById("objFilter") || {}).value || "";
  const vybrane = objFiltruj(d, filter, (document.getElementById("objHladaj") || {}).value || "");
  const strana = _objAdm.strana || ADMIN_STRANA;
  const riadok = (o) => {
    const druh = o.doplatok ? "doplatok" : o.je_obnova ? "obnova" : "nová";
    // Ručné spárovanie: formulár priamo v riadku, nie vyskakovacie okno prompt (spec 154 C1) —
    // dátum je pole typu date s dneškom v Bratislave, nezvratnosť je napísaná pri tlačidle.
    const akcie = (o.stav === "caka_na_prevod" || o.stav === "neuhradena") && _objAdm.sparuj === o.id
      ? `<div style="display:grid;gap:6px;min-width:220px">
           <label class="email">Deň pripísania na účet <input type="date" id="objSpDatum" value="${objDnesBA()}" max="${objDnesBA()}" style="font-size:12px"></label>
           <div class="email">Predplatné začne týmto dňom a hneď odíde faktúra — nedá sa vrátiť. Suma ${penaz(o.suma)} musí sedieť do centa.</div>
           <div id="objSpChyba" class="email" style="color:var(--neg)"></div>
           <div><button class="btn" style="padding:3px 8px;font-size:11px" data-obj="potvrd" data-id="${esc(o.id)}">Spárovať a vystaviť faktúru</button>
             <button class="btn" style="padding:3px 8px;font-size:11px" onclick="objSparuj(null)">Späť</button></div>
         </div>`
      : (o.stav === "caka_na_prevod" || o.stav === "neuhradena")
      ? `<button class="btn" style="padding:3px 8px;font-size:11px" data-obj="sparuj" data-id="${esc(o.id)}">Spárovať ručne…</button>
         <button class="btn" style="padding:3px 8px;font-size:11px" data-obj="zrus" data-id="${esc(o.id)}">Zrušiť</button>`
      : (o.stav === "zaplatena" && o.overene_vypisom === false)
        ? `<span class="email" style="color:${objPodozriva(o) ? "var(--neg)" : "inherit"}">${o.vypis_rozpor ? "ROZPOR — výpis za ten deň platbu nemá" : objPodozriva(o) ? "PODOZRIVÁ — výpis ju nepotvrdil" : "čaká na výpis"}</span>
           <button class="btn" style="padding:3px 8px;font-size:11px" data-obj="over" data-id="${esc(o.id)}">Overené vo výpise</button>`
        : "";
    return `<tr>
      <td>${objDatum(o.vytvorene)}</td>
      <td>${esc((o.firmy && o.firmy.nazov) || "—")}<div class="email">${esc(o.plan || "")} · ${druh}</div></td>
      <td class="mono">${esc(o.vs || "")}</td>
      <td class="r">${penaz(o.suma)}</td>
      <td>${esc(OBJ_STAV[o.stav] || o.stav)}<div class="email">${o.stav === "zaplatena"
        ? "pripísané " + objDatum(o.prijate_dna) + " · " + (o.sparoval === "admin" ? "ručne" : "automaticky") + " · obdobie " + objDatum(o.obdobie_od) + " – " + objDatum(o.obdobie_do)
        : "splatnosť " + objDatum(o.splatnost)}</div></td>
      <td>${akcie}</td>
    </tr>`;
  };
  telo.innerHTML = `<div class="email" style="margin-bottom:10px">Automatika páruje každých 15 minút z notifikácií banky aj z Banky, keď sedí VS aj suma; platbu z notifikácie potvrdí mesačný výpis (keď ju výpis za ten deň nemá, je to rozpor a príde e-mail). Ručne len to, čo nesedí — dátum = deň pripísania na účet.</div>
    ${vybrane.length ? `<div style="overflow-x:auto"><table><thead><tr><th>Vytvorená</th><th>Firma</th><th>VS</th><th class="r">Suma</th><th>Stav</th><th></th></tr></thead>
    <tbody>${vybrane.slice(0, strana).map(riadok).join("")}</tbody></table></div>`
      : `<div class="empty">${(document.getElementById("objHladaj") || {}).value ? "Nič nezodpovedá hľadaniu." : "Nič nečaká na vybavenie — ostatné ukáže filter „všetky“."}</div>`}
    ${adminDalsiHtml(Math.min(strana, vybrane.length), vybrane.length, "_objAdm.strana = (_objAdm.strana || ADMIN_STRANA) + ADMIN_STRANA; vykresliObjednavkyPrevod()")}`;
}
// Na vybavenie = čaká na platbu alebo zaplatená a neoverená výpisom (aj
// podozrivá) — to, pri čom je v riadku tlačidlo. „vsetky“ = celá história.
function objFiltruj(d, filter, hladaj){
  return d.filter(o => (filter === "vsetky" || o.stav === "caka_na_prevod" || o.stav === "neuhradena"
      || (o.stav === "zaplatena" && o.overene_vypisom === false))
    && adminHladaj([o.vs, o.plan, o.firmy && o.firmy.nazov, OBJ_STAV[o.stav]], hladaj));
}

// Tlačidlá v riadkoch nesú len data-obj (akcia) a data-id; kód v atribúte
// nevzniká (spec 154 D2, vzor A1). Obsluha jedna, delegovaná na telo sekcie.
const OBJ_AKCIE = { potvrd: id => objSparujPotvrd(id), sparuj: id => objSparuj(id), zrus: id => objZrus(id), over: id => objOver(id) };
function objKlik(e){
  const b = e.target && e.target.closest ? e.target.closest("button[data-obj]") : null;
  if(!b || !OBJ_AKCIE[b.dataset.obj]) return;
  OBJ_AKCIE[b.dataset.obj](b.dataset.id);
}
async function objVolaj(telo){
  const { data, error } = await sb.functions.invoke("predplatne-prevod", { body: telo });
  if(error){
    let sprava = error.message;
    try{ const t = await error.context.json(); if(t && t.error) sprava = t.error; }catch(_){}
    throw new Error(sprava);
  }
  return data;
}

// Otvorí (id) alebo zavrie (null) formulár ručného spárovania v riadku.
function objSparuj(id){ _objAdm.sparuj = id || null; vykresliObjednavkyPrevod(); }
async function objSparujPotvrd(id){
  const o = _objAdm.data.find(x => x.id === id); if(!o) return;
  const datum = String((document.getElementById("objSpDatum") || {}).value || "").trim();
  const chyba = document.getElementById("objSpChyba");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum > objDnesBA()){ if(chyba) chyba.textContent = "Zadajte deň pripísania — nie v budúcnosti."; return; }
  try{
    const v = await objVolaj({ akcia: "admin_sparuj", objednavka_id: id, datum, suma: o.suma, overene: true });
    await adminLog("prevod_sparuj", o.firma_id, o.vs, { stav: o.stav, suma: o.suma }, { datum, faktura: v && v.faktura || null });
    _objAdm.sparuj = null;
    alert("✓ Spárované" + (v && v.faktura ? ", faktúra " + v.faktura : " — faktúru dobehne cron") + ".");
    nacitajObjednavkyPrevod();
  }catch(e){ if(chyba) chyba.textContent = "Nespárované: " + e.message; else alert("Nespárované: " + e.message); }
}
async function objZrus(id){
  if(!confirm("Zrušiť objednávku? Neskorú platbu s týmto VS potom automatika nespáruje.")) return;
  const o = _objAdm.data.find(x => x.id === id) || {};
  try{
    await objVolaj({ akcia: "admin_zrus", objednavka_id: id });
    await adminLog("prevod_zrus", o.firma_id, o.vs, { stav: o.stav, suma: o.suma }, { stav: "zrusena" });
    nacitajObjednavkyPrevod();
  }
  catch(e){ alert("Nezrušené: " + e.message); }
}
async function objOver(id){
  const o = _objAdm.data.find(x => x.id === id) || {};
  try{
    await objVolaj({ akcia: "admin_over", objednavka_id: id });
    await adminLog("prevod_over", o.firma_id, o.vs, { overene_vypisom: o.overene_vypisom }, { overene_vypisom: true });
    nacitajObjednavkyPrevod();
  }
  catch(e){ alert("Nezapísané: " + e.message); }
}
