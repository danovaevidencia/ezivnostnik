// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — admin: SPÄTNÁ VÄZBA (spec kap. 148.6, ROZHODNUTIA č. 270, admin_56)
//
//  Klasický skript s globálnymi funkciami (obsluhy v onclick="…"), načíta ho
//  smerovač adminu pri otvorení sekcie #spatna-vazba. Detail je
//  #spatna-vazba/<id> (odkaz z e-mailu do podpory). Používa globálne sb,
//  esc a adminPocet z admin.html.
//
//  Dáta len cez admin RPC (spatna_vazba_zoznam, spatna_vazba_uprav) — tabuľka
//  je pre appku zatvorená a pohľady by obišli RLS. Žiadne alert/confirm:
//  nezvratný krok (vymazanie textu) má potvrdenie priamo pod tlačidlom.
//  Farby len z tokenov palety adminu (:root v admin.html).
//
//  F2 (admin_58, spec 148.14): prehľad nad zoznamom (spatna_vazba_prehlad —
//  KPI 30 dní, moduly, týždne s verziami), SLA otázok 48 h a „Uložiť a poslať
//  e-mailom“ (edge spatna-vazba, akcia odpoved, len so súhlasom s kontaktom).
// ═══════════════════════════════════════════════════════════════════════════

const SV_ADMIN_TYP = { hodnotenie:"⭐ Hodnotenie", navrh:"💡 Návrh", otazka:"❓ Otázka", chyba:"🐞 Chyba" };
const SV_ADMIN_STAV = { nove:"nové", precitane:"prečítané", planovane:"plánované", vo_vyvoji:"vo vývoji",
  hotove:"hotové", zamietnute:"zamietnuté", zodpovedane:"zodpovedané" };
let _svAdm = { polozky: [], filter: { pohlad:"akcia", typ:"", stav:"", modul:"" }, akcia: 0, spolu: 0, detail: "", vymazPotvrd: false,
  prehlad: null, prehladChyba: "" };
const SV_ADMIN_ZNACKY = { nezrozumitelne:"nezrozumiteľné", pomale:"pomalé", nefunguje:"nefunguje", chyba_funkcia:"chýba funkcia",
  zly_vypocet:"zlý výpočet", mobil:"na mobile zle", ine:"iné" };
// Interné SLA na otázku (148.12): 48 h od prijatia.
const SV_SLA_HODIN = 48;

function svAdmCas(x){ return x ? new Date(x).toLocaleString("sk-SK", { day:"numeric", month:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "–"; }
function svAdmVek(x){
  if(!x) return "";
  const h = Math.round((Date.now() - new Date(x).getTime()) / 3600000);
  return h < 24 ? h + " h" : Math.round(h / 24) + " d";
}
// Farba skóre: 1–2 zlé, 3 neutrálne, 4–5 dobré (top-2-box, 148.2).
function svAdmSkore(s){
  if(s === null || s === undefined) return "";
  const f = s <= 2 ? "var(--neg)" : s === 3 ? "var(--warn)" : "var(--accent2)";
  return '<b style="color:' + f + '">' + esc(String(s)) + "/5</b>";
}
// Výzva po úlohe meria náročnosť (CES), tlačidlo spokojnosť (CSAT).
function svAdmTyp(x){ return x.typ === "hodnotenie" && x.metrika === "ces" ? "📏 Náročnosť" : (SV_ADMIN_TYP[x.typ] || x.typ); }
// Otázka bez odpovede dlhšie než SLA.
function svAdmPoSla(x){
  return x.typ === "otazka" && (x.stav === "nove" || x.stav === "precitane")
    && Date.now() - new Date(x.vytvorene).getTime() > SV_SLA_HODIN * 3600000;
}
// ── Prehľad (F2): KPI za 30 dní, mapa modulov, týždne s verziami ──────────
// Top-2-box = podiel 4–5 (148.2); pod 5 hodnotení „málo dát“.
function svAdmTop2(n, top2){ return !n || n < 5 ? "málo dát" : esc(String(top2).replace(".", ",")) + " %"; }
function svAdmPrehladHtml(){
  if(_svAdm.prehladChyba) return '<div class="hint" style="border-left-color:var(--warn)">Prehľad sa nenačítal: ' + esc(_svAdm.prehladChyba) + "</div>";
  const P = _svAdm.prehlad;
  if(!P) return "";
  const kpi = P.kpi || {};
  const karta = (nadpis, hodnota, pod) => '<div style="flex:1 1 150px;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel)">'
    + '<div style="font-size:11.5px;color:var(--soft);text-transform:uppercase;letter-spacing:.03em">' + esc(nadpis) + "</div>"
    + '<div style="font-size:20px;font-weight:700;margin-top:2px">' + hodnota + "</div>"
    + '<div style="font-size:12px;color:var(--soft)">' + pod + "</div></div>";
  const zmena = (k) => !k || !k.n_pred ? "" : " · predtým " + svAdmTop2(k.n_pred, k.top2_pred);
  const cs = kpi.csat || {}, ce = kpi.ces || {};
  const otazkaVek = P.najstarsia_otazka ? Math.round((Date.now() - new Date(P.najstarsia_otazka).getTime()) / 3600000) : 0;
  const karty = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 12px">'
    + karta("Spokojnosť 30 d", svAdmTop2(cs.n, cs.top2), esc(String(cs.n || 0)) + "× · priemer " + esc(String(cs.priemer ?? "—")) + zmena(cs))
    + karta("Náročnosť úloh 30 d", svAdmTop2(ce.n, ce.top2), esc(String(ce.n || 0)) + "× · priemer " + esc(String(ce.priemer ?? "—")) + zmena(ce))
    + karta("Otvorené otázky", esc(String(P.otvorene_otazky || 0)),
        P.otvorene_otazky ? '<span style="' + (otazkaVek > SV_SLA_HODIN ? "color:var(--neg);font-weight:700" : "") + '">najstaršia ' + esc(String(otazkaVek)) + " h (SLA " + SV_SLA_HODIN + " h)</span>" : "nič nečaká")
    + karta("Návrhy v hre", esc(String(P.navrhy || 0)), "nie hotové ani zamietnuté")
    + "</div>";
  const moduly = (P.moduly || []).filter(m => m.n > 0);
  const tabModuly = !moduly.length ? "" : '<details style="margin:0 0 10px"><summary style="cursor:pointer;font-weight:600;font-size:13px">Moduly (180 dní, od najhoršieho)</summary>'
    + '<div style="overflow-x:auto"><table><thead><tr><th>Modul</th><th class="r">Hodnotení</th><th class="r">Priemer</th><th class="r">Top-2</th><th>Najčastejšie</th></tr></thead><tbody>'
    + moduly.map(m => "<tr><td>" + esc(m.modul) + '</td><td class="r">' + esc(String(m.n)) + '</td><td class="r">' + esc(String(m.priemer))
      + '</td><td class="r">' + svAdmTop2(m.n, m.top2) + "</td><td>" + esc(SV_ADMIN_ZNACKY[m.top_znacka] || m.top_znacka || "—") + "</td></tr>").join("")
    + "</tbody></table></div></details>";
  return karty + tabModuly + svAdmGraf(P.tyzdne || [], P.verzie || []);
}
// Týždne: stĺpec = podiel spokojných (CSAT 4–5), bod = priemer náročnosti
// (CES 1–5), čiarka = prvý príspevok z novej verzie appky.
function svAdmGraf(tyzdne, verzie){
  if(!tyzdne.length) return "";
  const W = 640, H = 150, L = 30, B = 22, sirka = (W - L - 8) / tyzdne.length;
  const y = (pct) => H - B - (pct / 100) * (H - B - 10);
  const pondelok = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); };
  let svg = "";
  [0, 50, 100].forEach(p => { svg += '<line x1="' + L + '" x2="' + (W - 8) + '" y1="' + y(p) + '" y2="' + y(p) + '" stroke="var(--line)"/>'
    + '<text x="' + (L - 4) + '" y="' + (y(p) + 4) + '" font-size="10" text-anchor="end" fill="var(--soft)">' + p + "</text>"; });
  tyzdne.forEach((t, i) => {
    const x = L + i * sirka;
    if(t.csat_n) svg += '<rect x="' + (x + 3) + '" y="' + y(t.csat_top2 || 0) + '" width="' + Math.max(2, sirka - 6) + '" height="' + (H - B - y(t.csat_top2 || 0))
      + '" fill="var(--accent)" opacity="' + (t.csat_n < 5 ? ".35" : ".8") + '"><title>' + esc(t.tyzden) + ": spokojných " + esc(String(t.csat_top2)) + " % z " + esc(String(t.csat_n)) + "</title></rect>";
    if(t.ces_n) svg += '<circle cx="' + (x + sirka / 2) + '" cy="' + y(((t.ces_priemer || 1) - 1) * 25) + '" r="4" fill="var(--orange)"><title>' + esc(t.tyzden) + ": náročnosť " + esc(String(t.ces_priemer)) + " z " + esc(String(t.ces_n)) + "</title></circle>";
    if(i % Math.ceil(tyzdne.length / 8) === 0) svg += '<text x="' + (x + sirka / 2) + '" y="' + (H - 6) + '" font-size="10" text-anchor="middle" fill="var(--soft)">' + esc(String(t.tyzden).slice(5).split("-").reverse().join(".")) + "</text>";
  });
  const tyzIdx = tyzdne.map(t => pondelok(t.tyzden));
  verzie.forEach(v => {
    const i = tyzIdx.indexOf(pondelok(v.prva));
    if(i < 0) return;
    const x = L + i * sirka + 1;
    svg += '<line x1="' + x + '" x2="' + x + '" y1="8" y2="' + (H - B) + '" stroke="var(--neg)" stroke-dasharray="2 3"><title>verzia ' + esc(v.verzia) + "</title></line>";
  });
  return '<details style="margin:0 0 12px"><summary style="cursor:pointer;font-weight:600;font-size:13px">Vývoj po týždňoch (26 týždňov)</summary>'
    + '<svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;max-width:' + W + 'px;height:auto;display:block;margin-top:6px" role="img" aria-label="Spokojnosť a náročnosť po týždňoch">' + svg + "</svg>"
    + '<div style="font-size:11.5px;color:var(--soft)">Stĺpec = % spokojných (4–5, bledý pod 5 hodnotení) · oranžový bod = náročnosť úloh (1 → 0, 5 → 100) · prerušovaná čiara = nová verzia.</div></details>';
}
function svAdmIdZHash(){
  const h = decodeURIComponent(location.hash.replace(/^#/, ""));
  return h.startsWith("spatna-vazba/") ? h.slice(13) : "";
}

async function nacitajSpatnuVazbu(){
  const telo = document.getElementById("svAdmBody");
  if(telo && !_svAdm.polozky.length) telo.innerHTML = '<div class="loading">Načítavam spätnú väzbu…</div>';
  const p = Object.assign({}, _svAdm.filter);
  // Detail z odkazu musí byť v zozname aj vtedy, keď už „nevyžaduje akciu“.
  if(svAdmIdZHash() && p.pohlad === "akcia") p.pohlad = "vsetko";
  // Prehľad (KPI, moduly, týždne — admin_58) beží súbežne; jeho chyba
  // zoznam nezastaví, ukáže sa v páse prehľadu.
  const prehlad = sb.rpc("spatna_vazba_prehlad").then(({ data: d, error: e }) => {
    if(e){ console.error("spatna_vazba_prehlad:", e); _svAdm.prehlad = null; _svAdm.prehladChyba = e.message || String(e); }
    else { _svAdm.prehlad = d || null; _svAdm.prehladChyba = ""; }
  });
  const { data, error } = await sb.rpc("spatna_vazba_zoznam", { p });
  await prehlad;
  if(error) throw new Error(error.message);
  _svAdm.polozky = (data && data.polozky) || [];
  _svAdm.akcia = (data && data.akcia) || 0;
  _svAdm.spolu = (data && data.spolu) || 0;
  if(p.pohlad !== _svAdm.filter.pohlad) _svAdm.filter.pohlad = p.pohlad;
  adminPocet("spatna-vazba", _svAdm.akcia);
  _svAdm.detail = svAdmIdZHash();
  svAdmKresli();
}
function svAdmFilter(k, v){
  _svAdm.filter[k] = v;
  nacitajSpatnuVazbu().catch(e => svAdmChyba(e));
}
function svAdmChyba(e){
  console.error("spätná väzba (admin):", e);
  const el = document.getElementById("svAdmSprava");
  if(el){ el.textContent = "Chyba: " + (e && e.message || e); el.style.color = "var(--neg)"; }
}

function svAdmKresli(){
  const telo = document.getElementById("svAdmBody");
  if(!telo) return;
  // Riadky a tlačidlá detailu nesú len data-sv a data-id (spec 154 D2) —
  // ID sa do kódu v atribúte neskladá, obsluha je jedna, delegovaná.
  telo.onclick = svAdmKlik;
  const f = _svAdm.filter;
  const volba = (k, hodnoty, prazdne) => '<select onchange="svAdmFilter(\'' + k + '\', this.value)" style="width:auto">'
    + (prazdne ? '<option value="">' + esc(prazdne) + "</option>" : "")
    + Object.keys(hodnoty).map(x => '<option value="' + esc(x) + '"' + (f[k] === x ? " selected" : "") + ">" + esc(hodnoty[x]) + "</option>").join("")
    + "</select>";
  const moduly = {};
  _svAdm.polozky.forEach(x => { if(x.modul) moduly[x.modul] = x.modul; });
  if(f.modul) moduly[f.modul] = f.modul;
  const riadky = _svAdm.polozky.map(x => {
    const zaciatok = String(x.text || "").replace(/\s+/g, " ").slice(0, 80);
    return '<tr style="cursor:pointer' + (x.id === _svAdm.detail ? ";background:var(--accent-lite)" : "") + '" data-sv="detail" data-id="' + esc(x.id) + '">'
      + "<td>" + esc(svAdmTyp(x)) + "</td>"
      + "<td>" + svAdmSkore(x.skore) + "</td>"
      + "<td>" + esc(x.modul || "—") + "</td>"
      + '<td style="max-width:320px">' + esc(zaciatok || "—") + "</td>"
      + '<td style="font-size:12px">' + esc(x.email || "—") + (x.firma ? '<br><span style="color:var(--soft)">' + esc(x.firma) + "</span>" : "") + "</td>"
      + "<td>" + esc(SV_ADMIN_STAV[x.stav] || x.stav) + "</td>"
      + '<td class="r" title="' + esc(svAdmCas(x.vytvorene)) + '"' + (svAdmPoSla(x) ? ' style="color:var(--neg);font-weight:700"' : "") + ">" + esc(svAdmVek(x.vytvorene)) + "</td></tr>";
  }).join("");
  telo.innerHTML = svAdmPrehladHtml()
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 10px">'
    + volba("pohlad", { akcia:"Vyžaduje akciu (" + _svAdm.akcia + ")", vsetko:"Všetko (" + _svAdm.spolu + ")" })
    + volba("typ", SV_ADMIN_TYP, "všetky typy")
    + volba("stav", SV_ADMIN_STAV, "všetky stavy")
    + volba("modul", moduly, "všetky moduly")
    + '<button class="rowbtn" onclick="nacitajSpatnuVazbu().catch(svAdmChyba)">Obnoviť</button>'
    + '<span id="svAdmSprava" style="font-size:12.5px"></span></div>'
    + '<div id="svAdmDetail"></div>'
    + (riadky
      ? '<div style="overflow-x:auto"><table><thead><tr><th>Typ</th><th>Skóre</th><th>Modul</th><th>Text</th><th>Kto</th><th>Stav</th><th class="r">Vek</th></tr></thead><tbody>' + riadky + "</tbody></table></div>"
      : '<div class="empty">' + (f.pohlad === "akcia" ? "Nič nečaká na odpoveď." : "Zatiaľ žiadna spätná väzba.") + "</div>");
  svAdmDetailKresli();
}

function svAdmDetailKresli(){
  const el = document.getElementById("svAdmDetail");
  if(!el) return;
  const x = _svAdm.polozky.find(p => p.id === _svAdm.detail);
  if(!x){
    el.innerHTML = _svAdm.detail ? '<div class="hint">Príspevok ' + esc(_svAdm.detail) + " sa v zozname nenašiel.</div>" : "";
    return;
  }
  const m = x.meta || {};
  const meta = ["verzia", "zariadenie", "obal", "tema", "obrazovka", "plan", "rola", "dni_od_registracie"]
    .filter(k => m[k] !== undefined && m[k] !== null && m[k] !== "")
    .map(k => esc(k) + ": <b>" + esc(String(m[k])) + "</b>").join(" · ");
  const stavy = Object.keys(SV_ADMIN_STAV).map(k => '<option value="' + k + '"' + (x.stav === k ? " selected" : "") + ">" + esc(SV_ADMIN_STAV[k]) + "</option>").join("");
  const priority = ['<option value="">—</option>'].concat([1, 2, 3].map(i => '<option value="' + i + '"' + (x.priorita === i ? " selected" : "") + ">" + i + "</option>")).join("");
  el.innerHTML = '<div style="border:1px solid var(--line);border-radius:10px;padding:14px;margin:0 0 14px;background:var(--panel)">'
    + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">'
    + "<b>" + esc(svAdmTyp(x)) + "</b>" + svAdmSkore(x.skore)
    + '<span style="color:var(--soft)">' + esc(x.modul || "celá aplikácia") + (x.udalost ? " · po úlohe " + esc(x.udalost) : "") + " · " + esc(svAdmCas(x.vytvorene)) + "</span>"
    + '<div style="flex:1"></div><button class="rowbtn" onclick="location.hash=\'spatna-vazba\'">Zavrieť ✕</button></div>'
    + (x.text ? '<div style="white-space:pre-wrap;background:var(--panel2);border-radius:8px;padding:10px 12px;margin-bottom:10px">' + esc(x.text) + "</div>"
              : '<div style="color:var(--soft);margin-bottom:10px">Bez textu.</div>')
    + ((x.tagy || []).length ? '<div style="font-size:12.5px;margin-bottom:6px">Značky: <b>' + esc(x.tagy.map(t => SV_ADMIN_ZNACKY[t] || t).join(", ")) + "</b></div>" : "")
    + '<div style="font-size:12.5px;margin-bottom:6px">Kto: <b>' + esc(x.email || "—") + "</b>"
    + (x.firma ? " · " + esc(x.firma) : "") + (x.kontakt_ok ? ' · <span style="color:var(--accent2)">smieme kontaktovať</span>' : ' · <span style="color:var(--soft)">bez súhlasu s kontaktom</span>') + "</div>"
    + (meta ? '<div style="font-size:12px;color:var(--soft);margin-bottom:12px">' + meta + "</div>" : "")
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
    + '<div class="field" style="margin:0"><label>Stav</label><select id="svAdmStav" style="width:auto">' + stavy + "</select></div>"
    + '<div class="field" style="margin:0"><label>Priorita</label><select id="svAdmPrio" style="width:auto">' + priority + "</select></div></div>"
    + '<div class="field" style="margin:10px 0 0"><label>Interná poznámka (používateľ ju nevidí)</label><textarea id="svAdmPozn" rows="2" maxlength="4000">' + esc(x.admin_poznamka || "") + "</textarea></div>"
    + '<div class="field" style="margin:10px 0 0"><label>Odpoveď' + (x.odpovedane ? " (uložená " + esc(svAdmCas(x.odpovedane)) + ")" : "") + '</label><textarea id="svAdmOdp" rows="3" maxlength="4000">' + esc(x.odpoved || "") + "</textarea>"
    + '<div style="font-size:12px;color:var(--soft);margin-top:4px">' + svAdmOdpovedStav(x) + "</div></div>"
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px">'
    + '<button class="btn" style="width:auto;padding:8px 14px" data-sv="uloz" data-id="' + esc(x.id) + '">Uložiť</button>'
    + (x.kontakt_ok && x.email && !x.odpoved_odoslana ? '<button class="btn" style="width:auto;padding:8px 14px" data-sv="posli" data-id="' + esc(x.id) + '">Uložiť a poslať e-mailom</button>' : "")
    + (x.text || x.email ? '<button class="rowbtn" data-sv="vymaz" data-id="' + esc(x.id) + '">' + (_svAdm.vymazPotvrd ? "Naozaj vymazať text a väzby" : "Vymazať text (žiadosť o výmaz)") + "</button>" : "")
    + '<span id="svAdmDetSprava" style="font-size:12.5px"></span></div>'
    + (_svAdm.vymazPotvrd ? '<div class="hint" style="border-left-color:var(--neg)">Vymaže sa text, odpoveď, poznámka a väzba na účet a firmu. Ostane len skóre a modul ako anonymná štatistika. Krok sa nedá vrátiť — potvrďte druhým ťuknutím.</div>' : "")
    + "</div>";
}

// Kam odpoveď dôjde: v appke vždy (Moje príspevky + zvonček), e-mailom len
// so súhlasom s kontaktom a len raz za znenie (zmena odpovede = nové poslanie).
function svAdmOdpovedStav(x){
  const casti = [];
  casti.push(x.odpoved_videna ? "Používateľ ju v appke videl " + esc(svAdmCas(x.odpoved_videna)) + "." : "Uložená odpoveď sa ukáže v appke (zvonček, Moje príspevky).");
  if(x.odpoved_odoslana) casti.push("E-mailom odoslaná " + esc(svAdmCas(x.odpoved_odoslana)) + ".");
  else if(!x.kontakt_ok) casti.push("E-mailom nie — používateľ nesúhlasil s kontaktom.");
  else if(!x.email) casti.push("E-mailom nie — príspevok už nie je spojený s účtom.");
  return casti.join(" ");
}
// Pošle ULOŽENÚ odpoveď (edge spatna-vazba, akcia odpoved). Najprv uloží to,
// čo je v poli — inak by odišlo staré znenie.
async function svAdmPosli(id){
  const ok = await svAdmUloz(id);
  if(!ok) return;
  const sprava = (t, chyba) => { const s = document.getElementById("svAdmDetSprava"); if(s){ s.textContent = t; s.style.color = chyba ? "var(--neg)" : "var(--accent2)"; } };
  const x = _svAdm.polozky.find(p => p.id === id);
  if(!x || !String(x.odpoved || "").trim()){ sprava("Najprv napíš odpoveď.", true); return; }
  sprava("Posielam…");
  const { data, error } = await sb.functions.invoke("spatna-vazba", { body: { akcia: "odpoved", id } });
  let chyba = data && data.chyba;
  // Pri ne-2xx odpovedi supabase-js telo nevráti v `data` — vytiahneme ho z kontextu.
  if(error && !chyba){ try{ chyba = (await error.context.json()).chyba; }catch(_){ chyba = error.message; } }
  if(chyba){ console.error("spatna-vazba/odpoved:", chyba); sprava("Neodoslané: " + chyba, true); return; }
  await nacitajSpatnuVazbu();
  sprava("Odpoveď odoslaná e-mailom.");
}
async function svAdmUloz(id){
  const x = _svAdm.polozky.find(p => p.id === id);
  if(!x) return false;
  const p = { id };
  const stav = document.getElementById("svAdmStav").value;
  const prio = document.getElementById("svAdmPrio").value;
  const pozn = document.getElementById("svAdmPozn").value;
  const odp = document.getElementById("svAdmOdp").value;
  if(stav !== x.stav) p.stav = stav;
  if(String(prio) !== String(x.priorita || "")) p.priorita = prio;
  if(pozn !== (x.admin_poznamka || "")) p.admin_poznamka = pozn;
  if(odp !== (x.odpoved || "")) p.odpoved = odp;
  // Otvorenie detailu = prečítané, ak nič iné nezmenil.
  if(Object.keys(p).length === 1 && x.stav === "nove") p.stav = "precitane";
  const sprava = document.getElementById("svAdmDetSprava");
  const { error } = await sb.rpc("spatna_vazba_uprav", { p });
  if(error){ if(sprava){ sprava.textContent = "Chyba: " + error.message; sprava.style.color = "var(--neg)"; } console.error("spatna_vazba_uprav:", error); return false; }
  await nacitajSpatnuVazbu();
  const s2 = document.getElementById("svAdmDetSprava");
  if(s2){ s2.textContent = "Uložené."; s2.style.color = "var(--accent2)"; }
  return true;
}

async function svAdmVymaz(id){
  if(!_svAdm.vymazPotvrd){ _svAdm.vymazPotvrd = true; svAdmDetailKresli(); return; }
  _svAdm.vymazPotvrd = false;
  const { error } = await sb.rpc("spatna_vazba_uprav", { p: { id, vymaz_text: true } });
  if(error){ svAdmChyba(error); return; }
  await nacitajSpatnuVazbu();
}

// Detail sa otvára zmenou hash (riadok, odkaz z e-mailu). Smerovač sekciu
// pozná podľa časti pred lomkou; tu sa prekreslí len detail.
window.addEventListener("hashchange", () => {
  const h = decodeURIComponent(location.hash.replace(/^#/, ""));
  if(!h.startsWith("spatna-vazba")) return;
  const id = svAdmIdZHash();
  _svAdm.vymazPotvrd = false;
  if(id && !_svAdm.polozky.some(p => p.id === id)){ nacitajSpatnuVazbu().catch(svAdmChyba); return; }
  _svAdm.detail = id;
  svAdmKresli();
});

const SV_AKCIE = { detail: id => { location.hash = "spatna-vazba/" + id; }, uloz: id => svAdmUloz(id), posli: id => svAdmPosli(id), vymaz: id => svAdmVymaz(id) };
function svAdmKlik(e){
  const el = e.target && e.target.closest ? e.target.closest("[data-sv]") : null;
  if(!el || !SV_AKCIE[el.dataset.sv]) return;
  SV_AKCIE[el.dataset.sv](el.dataset.id);
}
