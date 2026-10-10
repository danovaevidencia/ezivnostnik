// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — admin: ZÁSAHY DO FIRMY ZÁKAZNÍKA (spec 154 A2, A9, D1; admin_71)
//
//  · Konfig: kto plán platí (karta Stripe, prevod, účtovník, ručne) a výslovné
//    varovanie pred ručnou zmenou plánu firmy, ktorá platí (č. 154.8 bod 2 —
//    varovať, dovoliť). Zápis cez RPC `admin_firma_config` s logom.
//  · Zmazanie účtu: okno so zhrnutím (čo sa zmaže, čo ostane) a potvrdenie
//    napísaním IČO, pri firme bez IČO názvu (č. 154.8 bod 4). Dovtedy jedno
//    confirm() — pri nezvratnej akcii formalita (CLAUDE.md, Poučenia).
//  · Detail: „Zásahy admina“ z `admin_log_zoznam`.
//
//  Klasický skript; admin ho načíta pri otvorení Konfigu, Detailu alebo
//  zmazania (adminSkript). Používa globálne sb, esc, penaz,
//  cfgFirmaId, ziskajToken, SUPABASE_URL, CHYBA_SESSION, zavriCfg,
//  nacitajPrehlad a nacitajSaasFaktury z admin.html.
// ═══════════════════════════════════════════════════════════════════════════

const ZASAH_AKCIE = {
  firma_config: "Konfig firmy", gdpr_zmazat: "zmazanie účtu", prevod_sparuj: "ručné spárovanie platby",
  prevod_zrus: "zrušenie objednávky", prevod_over: "overenie platby výpisom", dobropis: "dobropis",
  kampan_vyrad: "vyradenie z kampane", kampan_vylucenie_spatne: "vylúčenie z kampaní (spätne)",
};
const CFG_KTO = { stripe: "karta (Stripe)", prevod: "prevod", uctovnik: "účtovník", rucne: "ručne (darovaný alebo nastavený adminom)", free: "nikto — Free" };

function zasahDatum(x){ return x ? new Date(x).toLocaleDateString("sk-SK") : "neobmedzene"; }

// ── Konfig: kto platí ───────────────────────────────────────────────────────
function cfgPlatbaHtml(p){
  p = p || {};
  let h = "<b>Kto platí:</b> " + esc(CFG_KTO[p.kto] || p.kto || "–");
  if(p.kto === "uctovnik" && p.uctovnik_firma) h += " — " + esc(p.uctovnik_firma);
  if(p.kto === "stripe") h += p.stripe_sub ? " — predplatné v Stripe beží" : " — bez predplatného v Stripe";
  if(p.plan && p.plan !== "free") h += " · plán " + esc(p.plan) + " do " + esc(zasahDatum(p.plan_do));
  if(p.posledna) h += '<div style="font-size:12px;color:var(--soft)">posledná platba: ' + esc(p.posledna.kanal) + ", " + esc(penaz(p.posledna.suma))
    + ", " + esc(zasahDatum(p.posledna.kedy)) + "</div>";
  if(p.vyzva) h += '<div style="font-size:12px;color:var(--warn)">čaká výzva prevodom: VS ' + esc(p.vyzva.vs) + ", " + esc(penaz(p.vyzva.suma))
    + ", splatnosť " + esc(zasahDatum(p.vyzva.splatnost)) + "</div>";
  return h;
}
// Varovať treba, keď firma plán platí a admin mení plán alebo jeho platnosť
// — ďalšia platba (webhook Stripe, výzva prevodom) by zmenu prepísala alebo
// sa riadila dátumom, ktorý zadal admin (spec 154 A9).
function cfgTrebaPotvrdit(platba, povodne, nove){
  if(!platba || !platba.plati || !povodne || !nove) return false;
  return (povodne.plan || "free") !== (nove.plan || "free") || String(povodne.plan_do || "") !== String(nove.plan_do || "");
}
let _cfgPlatba = null;
async function cfgNacitajPlatbu(firmaId){
  const el = document.getElementById("cfgPlatba");
  _cfgPlatba = null;
  if(el) el.innerHTML = '<span style="color:var(--soft)">Zisťujem, kto platí…</span>';
  const { data, error } = await sb.rpc("admin_firma_platba", { p_firma: firmaId });
  if(firmaId !== cfgFirmaId) return;          // medzitým otvorená iná firma
  if(error){ if(el) el.innerHTML = '<span style="color:var(--neg)">Kto platí, sa nepodarilo zistiť: ' + esc(error.message) + "</span>"; return; }
  _cfgPlatba = data || {};
  if(el) el.innerHTML = cfgPlatbaHtml(_cfgPlatba);
}

// ── Zmazanie účtu ───────────────────────────────────────────────────────────
// Čo treba napísať: IČO (len číslice), pri firme bez IČO názov.
function gdprKluc(firma){
  const meta = ((firma || {}).data || {}).meta || {};
  const ico = String(meta.ico || "").replace(/\D/g, "");
  if(ico) return { kluc: ico, popis: "IČO firmy", ico: true };
  return { kluc: String(meta.nazov || (firma || {}).nazov || "").trim(), popis: "názov firmy", ico: false };
}
function gdprSedi(napisane, k){
  if(!k || !k.kluc) return false;
  const n = k.ico ? String(napisane || "").replace(/\D/g, "") : String(napisane || "").trim().replace(/\s+/g, " ");
  return n === (k.ico ? k.kluc : k.kluc.replace(/\s+/g, " "));
}
function gdprZhrnutieHtml(z){
  const firmy = z.firmy || [];
  const pocet = (f, kl) => (((f.data || {})[kl]) || []).length;
  let h = '<div class="hint neg"><b>Zmaže sa celý účet používateľa</b> — ' + (firmy.length === 1 ? "jeho firma" : "všetky jeho firmy (" + firmy.length + ")") + ":</div>"
    + "<ul style=\"margin:6px 0 10px 18px;font-size:13px\">"
    + firmy.map(f => "<li>" + esc(((f.data || {}).meta || {}).nazov || f.nazov || "—") + " — faktúr " + pocet(f, "faktury") + ", výdavkov "
      + pocet(f, "vydavky") + ", jázd " + pocet(f, "jazdy") + "</li>").join("") + "</ul>"
    + '<div style="font-size:13px;line-height:1.5">Zmaže sa aj: súbory v úložisku (doklady, výpisy, podania), objednávky (' + (z.objednavky || 0)
    + "), konfigurácia a prístupy. Predplatné v Stripe sa zruší.</div>"
    + '<div style="font-size:13px;line-height:1.5;margin-top:6px"><b>Ostane:</b> ' + (z.testovaci
      ? '<span style="color:var(--neg)">TESTOVACÍ REŽIM — zmažú sa aj faktúry za predplatné (' + (z.saas || 0) + "), teda daňové doklady s archiváciou 10 rokov.</span>"
      : "faktúry za predplatné (" + (z.saas || 0) + ") — daňové doklady, 10 rokov")
    + "; súhlasy (4 roky); pri firme v sieti Peppol záznam vo fronte ukončení (OP 7.6); záznam v logu zásahov.</div>";
  return h;
}
let _gdpr = null;
async function gdprOtvor(firmaId, testovaci){
  const body = document.getElementById("gdprBody");
  _gdpr = { firma: firmaId, testovaci: !!testovaci, k: null, zhrnutie: null };
  document.getElementById("gdprKluc").value = "";
  document.getElementById("gdprErr").textContent = "";
  document.getElementById("gdprPotvrd").disabled = true;
  body.innerHTML = '<div class="loading">Načítavam, čo sa zmaže…</div>';
  document.getElementById("gdprModal").classList.add("on");
  try{
    const { data: f, error: e1 } = await sb.from("firmy").select("id, user_id, nazov, data").eq("id", firmaId).maybeSingle();
    if(e1 || !f) throw new Error(e1 ? e1.message : "firma sa nenašla");
    const [F, O, S] = await Promise.all([
      sb.from("firmy").select("id, nazov, data").eq("user_id", f.user_id),
      sb.from("objednavky").select("id", { count: "exact", head: true }).eq("user_id", f.user_id),
      sb.from("saas_faktury").select("id", { count: "exact", head: true }).eq("user_id", f.user_id),
    ]);
    for(const r of [F, O, S]) if(r.error) throw new Error(r.error.message);
    if(!_gdpr || _gdpr.firma !== firmaId) return;
    _gdpr.k = gdprKluc(f);
    _gdpr.zhrnutie = { firmy: F.data || [], objednavky: O.count || 0, saas: S.count || 0, testovaci: _gdpr.testovaci,
                       nazov: ((f.data || {}).meta || {}).nazov || f.nazov || "" };
    body.innerHTML = gdprZhrnutieHtml(_gdpr.zhrnutie);
    document.getElementById("gdprKlucPopis").textContent = "Na potvrdenie napíšte " + _gdpr.k.popis + (_gdpr.k.ico ? "" : " presne") + ":";
  }catch(e){ body.innerHTML = '<div class="err">Zhrnutie sa nenačítalo: ' + esc(e.message) + " — zmazanie nie je možné.</div>"; _gdpr.k = null; }
}
function gdprKontrola(){
  const ok = !!(_gdpr && _gdpr.k && gdprSedi(document.getElementById("gdprKluc").value, _gdpr.k));
  document.getElementById("gdprPotvrd").disabled = !ok;
  return ok;
}
function gdprZavri(){ document.getElementById("gdprModal").classList.remove("on"); _gdpr = null; }
async function gdprZmazatPotvrd(){
  const err = document.getElementById("gdprErr");
  // Poistka aj tu, nie len zakázané tlačidlo — volá sa aj mimo kliknutia.
  if(!gdprKontrola()){ err.textContent = "Napísaný údaj nesedí — nič sa nezmazalo."; return; }
  const g = _gdpr;
  err.textContent = "Mažem…";
  document.getElementById("gdprPotvrd").disabled = true;
  try{
    const tok = await ziskajToken();
    if(!tok){ err.textContent = CHYBA_SESSION; return; }
    const res = await fetch(SUPABASE_URL + "/functions/v1/gdpr", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
      body: JSON.stringify({ akcia: "zmazat", firma_id: g.firma, testovaci: g.testovaci })
    });
    const r = await res.json().catch(() => ({}));
    if(!res.ok || !r.ok){ err.textContent = "Zmazanie zlyhalo: " + (r.error || res.status); gdprKontrola(); return; }
    const z = r.zmazane || {};
    // Záznam do logu zásahov zapisuje edge gdpr sám (spec 154 D1).
    gdprZavri();
    zavriCfg();
    alert("Účet zmazaný.\n\n" +
      (z.faktury != null ? "Zmazaných faktúr: " + z.faktury + "\n" : "Faktúry ponechané (archivačná povinnosť): " + (z.faktury_ponechane ?? 0) + "\n") +
      "Zmazaných súborov: " + (z.subory ?? 0));
    nacitajPrehlad();
    nacitajSaasFaktury();
  }catch(e){ err.textContent = "Chyba: " + e.message; gdprKontrola(); }
}

// ── Zásahy admina v Detaile ─────────────────────────────────────────────────
function zasahZmeny(pred, po){
  if(!pred || !po || typeof pred !== "object" || typeof po !== "object") return [];
  const s = v => v == null ? "–" : (typeof v === "object" ? JSON.stringify(v) : String(v));
  return Object.keys(po).filter(k => s(pred[k]) !== s(po[k])).map(k => k + ": " + s(pred[k]) + " → " + s(po[k]));
}
function zasahyHtml(log){
  if(!log || !log.length) return '<div style="font-size:12.5px;color:var(--soft)">Žiadny zásah admina.</div>';
  return log.map(z => {
    const zmeny = z.akcia === "firma_config" ? zasahZmeny(z.pred, z.po) : [];
    return '<div style="padding:6px 0;border-bottom:1px solid var(--line);font-size:12.5px">'
      + "<b>" + esc(ZASAH_AKCIE[z.akcia] || z.akcia) + "</b> · " + esc(new Date(z.cas).toLocaleString("sk-SK"))
      + (z.kto_email ? " · " + esc(z.kto_email) : "") + (z.objekt ? ' · <span class="mono">' + esc(z.objekt) + "</span>" : "")
      + (zmeny.length ? '<div class="mono" style="color:var(--soft);word-break:break-word">' + zmeny.map(esc).join("<br>") + "</div>"
        : (z.akcia === "firma_config" ? '<div style="color:var(--soft)">bez zmeny</div>' : ""))
      + "</div>";
  }).join("");
}
async function detailZasahy(firmaId){
  const el = document.getElementById("detailZasahy");
  if(!el) return;
  const { data, error } = await sb.rpc("admin_log_zoznam", { p_firma: firmaId, p_limit: 30 });
  if(error){ el.innerHTML = '<div class="err">Zásahy sa nenačítali: ' + esc(error.message) + "</div>"; return; }
  el.innerHTML = zasahyHtml(data || []);
}
