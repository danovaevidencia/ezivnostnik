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
// ═══════════════════════════════════════════════════════════════════════════

const SV_ADMIN_TYP = { hodnotenie:"⭐ Hodnotenie", navrh:"💡 Návrh", otazka:"❓ Otázka", chyba:"🐞 Chyba" };
const SV_ADMIN_STAV = { nove:"nové", precitane:"prečítané", planovane:"plánované", vo_vyvoji:"vo vývoji",
  hotove:"hotové", zamietnute:"zamietnuté", zodpovedane:"zodpovedané" };
let _svAdm = { polozky: [], filter: { pohlad:"akcia", typ:"", stav:"", modul:"" }, akcia: 0, spolu: 0, detail: "", vymazPotvrd: false };

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
  const { data, error } = await sb.rpc("spatna_vazba_zoznam", { p });
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
    return '<tr style="cursor:pointer' + (x.id === _svAdm.detail ? ";background:var(--accent-lite)" : "") + '" onclick="location.hash=\'spatna-vazba/' + esc(x.id) + '\'">'
      + "<td>" + esc(SV_ADMIN_TYP[x.typ] || x.typ) + "</td>"
      + "<td>" + svAdmSkore(x.skore) + "</td>"
      + "<td>" + esc(x.modul || "—") + "</td>"
      + '<td style="max-width:320px">' + esc(zaciatok || "—") + "</td>"
      + '<td style="font-size:12px">' + esc(x.email || "—") + (x.firma ? '<br><span style="color:var(--soft)">' + esc(x.firma) + "</span>" : "") + "</td>"
      + "<td>" + esc(SV_ADMIN_STAV[x.stav] || x.stav) + "</td>"
      + '<td class="r" title="' + esc(svAdmCas(x.vytvorene)) + '">' + esc(svAdmVek(x.vytvorene)) + "</td></tr>";
  }).join("");
  telo.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 10px">'
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
    + "<b>" + esc(SV_ADMIN_TYP[x.typ] || x.typ) + "</b>" + svAdmSkore(x.skore)
    + '<span style="color:var(--soft)">' + esc(x.modul || "celá aplikácia") + " · " + esc(svAdmCas(x.vytvorene)) + "</span>"
    + '<div style="flex:1"></div><button class="rowbtn" onclick="location.hash=\'spatna-vazba\'">Zavrieť ✕</button></div>'
    + (x.text ? '<div style="white-space:pre-wrap;background:var(--panel2);border-radius:8px;padding:10px 12px;margin-bottom:10px">' + esc(x.text) + "</div>"
              : '<div style="color:var(--soft);margin-bottom:10px">Bez textu.</div>')
    + '<div style="font-size:12.5px;margin-bottom:6px">Kto: <b>' + esc(x.email || "—") + "</b>"
    + (x.firma ? " · " + esc(x.firma) : "") + (x.kontakt_ok ? ' · <span style="color:var(--accent2)">smieme kontaktovať</span>' : ' · <span style="color:var(--soft)">bez súhlasu s kontaktom</span>') + "</div>"
    + (meta ? '<div style="font-size:12px;color:var(--soft);margin-bottom:12px">' + meta + "</div>" : "")
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
    + '<div class="field" style="margin:0"><label>Stav</label><select id="svAdmStav" style="width:auto">' + stavy + "</select></div>"
    + '<div class="field" style="margin:0"><label>Priorita</label><select id="svAdmPrio" style="width:auto">' + priority + "</select></div></div>"
    + '<div class="field" style="margin:10px 0 0"><label>Interná poznámka (používateľ ju nevidí)</label><textarea id="svAdmPozn" rows="2" maxlength="4000">' + esc(x.admin_poznamka || "") + "</textarea></div>"
    + '<div class="field" style="margin:10px 0 0"><label>Odpoveď' + (x.odpovedane ? " (uložená " + esc(svAdmCas(x.odpovedane)) + ")" : "") + '</label><textarea id="svAdmOdp" rows="3" maxlength="4000">' + esc(x.odpoved || "") + "</textarea>"
    + '<div style="font-size:12px;color:var(--soft);margin-top:4px">V F1 sa odpoveď len uloží — používateľovi odpíš z Gmailu (e-mail z podpory má adresu na odpoveď). Poslanie z adminu príde v F2.</div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px">'
    + '<button class="btn" style="width:auto;padding:8px 14px" onclick="svAdmUloz(\'' + esc(x.id) + '\')">Uložiť</button>'
    + (x.text || x.email ? '<button class="rowbtn" onclick="svAdmVymaz(\'' + esc(x.id) + '\')">' + (_svAdm.vymazPotvrd ? "Naozaj vymazať text a väzby" : "Vymazať text (žiadosť o výmaz)") + "</button>" : "")
    + '<span id="svAdmDetSprava" style="font-size:12.5px"></span></div>'
    + (_svAdm.vymazPotvrd ? '<div class="hint" style="border-left-color:var(--neg)">Vymaže sa text, odpoveď, poznámka a väzba na účet a firmu. Ostane len skóre a modul ako anonymná štatistika. Krok sa nedá vrátiť — potvrďte druhým ťuknutím.</div>' : "")
    + "</div>";
}

async function svAdmUloz(id){
  const x = _svAdm.polozky.find(p => p.id === id);
  if(!x) return;
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
  if(error){ if(sprava){ sprava.textContent = "Chyba: " + error.message; sprava.style.color = "var(--neg)"; } console.error("spatna_vazba_uprav:", error); return; }
  await nacitajSpatnuVazbu();
  const s2 = document.getElementById("svAdmDetSprava");
  if(s2){ s2.textContent = "Uložené."; s2.style.color = "var(--accent2)"; }
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
