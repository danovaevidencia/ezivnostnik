// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — admin: B2B SLUŽBY — prístup (admin_76, spec 157.16)
//
//  Klasický skript s globálnymi funkciami, načíta ho smerovač adminu pri
//  otvorení sekcie #projekty. Používa globálne sb a esc z admin.html.
//
//  Prístup = smie zakladať projekty (b2b_zakladatelia). Existujúcemu účtu ho
//  RPC pridá hneď; e-mailu bez účtu vznikne pozvánka, ktorá platí po
//  registrácii a potvrdení adresy. Do projektu pozýva jeho správca v appke —
//  projekty sa tu len ukazujú. Každý zásah zapisuje server do admin_log.
// ═══════════════════════════════════════════════════════════════════════════

let _b2bAdm = { data: null, chyba: "" };

function b2bAdmDatum(x){ return x ? new Date(x).toLocaleDateString("sk-SK") : "–"; }
function b2bAdmStav(text, chyba){
  const el = document.getElementById("b2bAdmStav");
  if(!el) return;
  el.textContent = text || "";
  el.style.color = chyba ? "var(--neg)" : "";
}

async function nacitajB2bAdmin(){
  const telo = document.getElementById("b2bAdmBody");
  telo.innerHTML = '<div class="loading">Načítavam B2B služby…</div>';
  const { data, error } = await sb.rpc("admin_b2b_prehlad");
  _b2bAdm = { data: data || null, chyba: error ? error.message : "" };
  vykresliB2bAdmin();
}

function vykresliB2bAdmin(){
  const telo = document.getElementById("b2bAdmBody");
  telo.onclick = b2bAdmKlik;
  if(_b2bAdm.chyba){ telo.innerHTML = '<div class="loading">Chyba: ' + esc(_b2bAdm.chyba) + "</div>"; return; }
  const d = _b2bAdm.data || {};
  const Z = d.zakladatelia || [], P = d.pozvanky || [], J = d.projekty || [];
  // Tlačidlá nesú len akciu a index riadku — e-mail ani iný text do kódu nejde (spec 154 D2).
  const btn = (akcia, i, text) => `<button class="btn" style="padding:3px 8px;font-size:11px" data-b2b="${akcia}" data-i="${i}">${text}</button>`;
  const tab = (hlavicka, riadky, prazdne) => riadky.length
    ? `<div style="overflow-x:auto"><table><thead><tr>${hlavicka.map(h => "<th>" + h + "</th>").join("")}</tr></thead><tbody>${riadky.join("")}</tbody></table></div>`
    : `<div class="empty">${prazdne}</div>`;
  const zakl = Z.map((z, i) => `<tr>
      <td>${esc(z.email || "(účet zmazaný)")}<div class="email">${esc(z.poznamka || "")}</div></td>
      <td>${b2bAdmDatum(z.pridane)}</td>
      <td class="r">${+z.projektov || 0}</td>
      <td>${z.email ? btn("mail_z", i, "Poslať e-mail") : ""} ${btn("odober_z", i, "Odobrať")}</td></tr>`);
  const poz = P.map((p, i) => `<tr>
      <td>${esc(p.email)}<div class="email">${esc(p.poznamka || "")}</div></td>
      <td>${b2bAdmDatum(p.vytvorene)}</td>
      <td>${p.odoslane ? "odoslaná " + b2bAdmDatum(p.odoslane) : "e-mail neodišiel"}<div class="email">${p.potvrdeny ? "účet založený — prístup už platí" : p.ucet ? "účet čaká na potvrdenie e-mailu" : "bez účtu"}</div></td>
      <td>${btn("mail_p", i, "Poslať pozvánku")} ${btn("zrus_p", i, "Zrušiť")}</td></tr>`);
  const proj = J.map(j => `<tr>
      <td>${esc(j.nazov)} <span class="email">${esc(j.kod)}</span></td>
      <td>${esc(j.zakladatel || "–")}</td>
      <td class="r">${+j.osob || 0} <span class="email">(${+j.s_uctom || 0} s účtom)</span></td>
      <td>${esc((j.spravcovia || []).join(", ") || "–")}</td>
      <td>${b2bAdmDatum(j.vytvorene)}</td></tr>`);
  telo.innerHTML = `<div class="email" style="margin-bottom:10px">Prístup = smie zakladať projekty na zmluvu. Existujúcemu účtu sa pridá hneď;
      e-mailu bez účtu vznikne pozvánka, ktorá platí po registrácii a potvrdení adresy. Do projektu pozýva jeho správca v appke —
      tu sa projekty len ukazujú. Odobratie prístupu projekty ani členstvá nemení.</div>
    <h3 style="margin:14px 0 6px">Zakladatelia (${Z.length})</h3>
    ${tab(["Účet", "Pridaný", "Projektov", ""], zakl, "Zatiaľ nikto.")}
    <h3 style="margin:18px 0 6px">Pozvánky bez prijatia (${P.length})</h3>
    ${tab(["E-mail", "Vytvorená", "Stav", ""], poz, "Žiadna pozvánka nečaká.")}
    <h3 style="margin:18px 0 6px">Projekty (${J.length})</h3>
    ${tab(["Projekt", "Založil", "Osoby", "Správcovia", "Založený"], proj, "Zatiaľ žiadny projekt.")}`;
}

const B2B_ADM_AKCIE = {
  mail_z:   i => { const z = ((_b2bAdm.data || {}).zakladatelia || [])[i]; if(z && z.email) b2bAdmMail(z.email); },
  odober_z: i => { const z = ((_b2bAdm.data || {}).zakladatelia || [])[i]; if(z) b2bAdmOdober(z.email, +z.projektov || 0); },
  mail_p:   i => { const p = ((_b2bAdm.data || {}).pozvanky || [])[i]; if(p) b2bAdmMail(p.email); },
  zrus_p:   i => { const p = ((_b2bAdm.data || {}).pozvanky || [])[i]; if(p) b2bAdmOdober(p.email, 0); },
};
function b2bAdmKlik(e){
  const b = e.target && e.target.closest ? e.target.closest("button[data-b2b]") : null;
  if(!b || !B2B_ADM_AKCIE[b.dataset.b2b]) return;
  B2B_ADM_AKCIE[b.dataset.b2b](+b.dataset.i);
}

async function b2bAdmVolaj(email){
  const { data, error } = await sb.functions.invoke("b2b", { body: { akcia: "admin_pozvanka", email } });
  if(error){
    let sprava = error.message;
    try{ const t = await error.context.json(); if(t && t.chyba) sprava = t.chyba; }catch(_){}
    throw new Error(sprava);
  }
  return data;
}

async function b2bAdmPridaj(){
  const email = String((document.getElementById("b2bAdmEmail") || {}).value || "").trim().toLowerCase();
  const poznamka = String((document.getElementById("b2bAdmPozn") || {}).value || "").trim();
  const posli = !!(document.getElementById("b2bAdmMail") || {}).checked;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return b2bAdmStav("Zadajte platný e-mail.", true);
  const { data, error } = await sb.rpc("admin_b2b_pridaj", { p_email: email, p_poznamka: poznamka || null });
  if(error) return b2bAdmStav("Neuložené: " + error.message, true);
  const stav = (data && data.stav) || "";
  let sprava = stav === "uz_ma" ? "Účet " + email + " prístup už má."
    : stav === "zakladatel" ? "✓ Prístup pridaný existujúcemu účtu " + email + "."
    : "✓ Pozvánka pre " + email + " — prístup bude platiť po registrácii a potvrdení e-mailu.";
  if(posli && stav !== "uz_ma"){
    try{ await b2bAdmVolaj(email); sprava += " E-mail odišiel."; }
    catch(e){ sprava += " E-mail NEODIŠIEL: " + e.message; }
  }
  b2bAdmStav(sprava, /NEODIŠIEL/.test(sprava));
  const el = document.getElementById("b2bAdmEmail"); if(el && stav !== "uz_ma") el.value = "";
  nacitajB2bAdmin();
}

async function b2bAdmMail(email){
  try{
    const r = await b2bAdmVolaj(email);
    b2bAdmStav("✓ E-mail odišiel na " + email + (r && r.ucet ? " (prihlásenie do appky)." : " (registrácia)."));
    nacitajB2bAdmin();
  }catch(e){ b2bAdmStav("E-mail neodišiel: " + e.message, true); }
}

async function b2bAdmOdober(email, projektov){
  if(!confirm("Odobrať prístup k B2B službám pre " + email + "?" + (projektov ? "\n\nProjekty, ktoré založil (" + projektov + "), aj jeho členstvá v nich ostanú — tie spravuje správca projektu." : ""))) return;
  const { data, error } = await sb.rpc("admin_b2b_odober", { p_email: email });
  if(error) return b2bAdmStav("Neodobraté: " + error.message, true);
  b2bAdmStav((data && (data.zakladatel || data.pozvanka)) ? "✓ Prístup pre " + email + " odobratý." : "Pre " + email + " nebolo čo odobrať.");
  nacitajB2bAdmin();
}
