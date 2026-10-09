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

// Neoverená výpisom do konca nasledujúceho mesiaca = podozrivá (Roman 8. 10.:
// pri podvrhnutej notifikácii prídeme o jedno predplatné, nie o peniaze).
function objPodozriva(o, dnes){
  if(o.stav !== "zaplatena" || o.overene_vypisom !== false || !o.prijate_dna) return false;
  const d = new Date(o.prijate_dna + "T12:00:00");
  const hranica = new Date(d.getFullYear(), d.getMonth() + 2, 1);
  return (dnes || new Date()) >= hranica;
}

async function nacitajObjednavkyPrevod(){
  const telo = document.getElementById("objAdmBody");
  telo.innerHTML = '<div class="loading">Načítavam platby prevodom…</div>';
  const { data, error } = await sb.from("objednavky")
    .select("id, vytvorene, stav, plan, suma, vs, splatnost, je_obnova, doplatok, prijate_dna, prijate_suma, sparoval, overene_vypisom, obdobie_od, obdobie_do, firmy(nazov)")
    .eq("kanal", "prevod").order("vytvorene", { ascending: false }).limit(300);
  _objAdm = { data: data || [], chyba: error ? error.message : "" };
  vykresliObjednavkyPrevod();
}

function vykresliObjednavkyPrevod(){
  const telo = document.getElementById("objAdmBody");
  if(_objAdm.chyba){ telo.innerHTML = '<div class="loading">Chyba: ' + esc(_objAdm.chyba) + "</div>"; return; }
  const d = _objAdm.data;
  const caka = d.filter(o => o.stav === "caka_na_prevod" || o.stav === "neuhradena");
  const neover = d.filter(o => o.stav === "zaplatena" && o.overene_vypisom === false);
  adminPocet("objednavky", caka.length + neover.filter(o => objPodozriva(o)).length);
  if(!d.length){ telo.innerHTML = '<div class="empty">Zatiaľ žiadna objednávka prevodom.</div>'; return; }
  const riadok = (o) => {
    const druh = o.doplatok ? "doplatok" : o.je_obnova ? "obnova" : "nová";
    const akcie = (o.stav === "caka_na_prevod" || o.stav === "neuhradena")
      ? `<button class="btn" style="padding:3px 8px;font-size:11px" onclick="objSparuj('${esc(o.id)}')">Spárovať ručne…</button>
         <button class="btn" style="padding:3px 8px;font-size:11px" onclick="objZrus('${esc(o.id)}')">Zrušiť</button>`
      : (o.stav === "zaplatena" && o.overene_vypisom === false)
        ? `<span class="email" style="color:${objPodozriva(o) ? "var(--neg)" : "inherit"}">${objPodozriva(o) ? "PODOZRIVÁ — výpis ju nepotvrdil" : "čaká na výpis"}</span>
           <button class="btn" style="padding:3px 8px;font-size:11px" onclick="objOver('${esc(o.id)}')">Overené vo výpise</button>`
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
  telo.innerHTML = `<div class="email" style="margin-bottom:10px">Automatika páruje každých 15 minút, keď sedí VS aj suma. Ručne len to, čo nesedí — dátum = deň pripísania na účet.</div>
    <table><thead><tr><th>Vytvorená</th><th>Firma</th><th>VS</th><th class="r">Suma</th><th>Stav</th><th></th></tr></thead>
    <tbody>${d.map(riadok).join("")}</tbody></table>`;
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

async function objSparuj(id){
  const o = _objAdm.data.find(x => x.id === id); if(!o) return;
  const datum = prompt("RUČNÉ SPÁROVANIE — VS " + o.vs + ", " + penaz(o.suma) + "\n\n"
    + "Predplatné začne dňom pripísania a hneď odíde faktúra (nedá sa vrátiť).\n"
    + "Suma musí sedieť do centa — inú sumu treba riešiť so zákazníkom.\n\n"
    + "Deň pripísania na účet (RRRR-MM-DD):", new Date().toISOString().slice(0, 10));
  if(datum === null) return;
  try{
    const v = await objVolaj({ akcia: "admin_sparuj", objednavka_id: id, datum: datum.trim(), suma: o.suma, overene: true });
    alert("✓ Spárované" + (v && v.faktura ? ", faktúra " + v.faktura : " — faktúru dobehne cron") + ".");
    nacitajObjednavkyPrevod();
  }catch(e){ alert("Nespárované: " + e.message); }
}
async function objZrus(id){
  if(!confirm("Zrušiť objednávku? Neskorú platbu s týmto VS potom automatika nespáruje.")) return;
  try{ await objVolaj({ akcia: "admin_zrus", objednavka_id: id }); nacitajObjednavkyPrevod(); }
  catch(e){ alert("Nezrušené: " + e.message); }
}
async function objOver(id){
  try{ await objVolaj({ akcia: "admin_over", objednavka_id: id }); nacitajObjednavkyPrevod(); }
  catch(e){ alert("Nezapísané: " + e.message); }
}
