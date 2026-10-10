// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — admin: PREHĽAD PREVÁDZKY (spec 154 B1, B2; admin_70)
//
//  Panel „Dnes treba“ nad KPI v Prehľade a počítadlá v menu hneď po
//  prihlásení — z jedného RPC `admin_dnes()` (len čísla, nie dáta). Dovtedy
//  počítadlá naplnilo až otvorenie sekcie a výpadok zálohy, cronu či Stripe
//  sa zistil o týždne neskôr (spec 149.12).
//  Sekcia „Automatika“ (Prevádzka) z `admin_automatika()`: plánované úlohy,
//  odpovede edge funkcií, Stripe v chybe, faktúry za predplatné.
//
//  Klasický skript s globálnymi funkciami; admin ho načíta po prihlásení
//  s `?v=ADMIN_VERZIA`. Používa globálne sb, esc, penaz, adminPocet
//  a ZAL_DNI_UPOZORNENIE z admin.html. Všetko, čo príde z databázy (správy
//  cronu, telá odpovedí, chyby Stripe), ide na obrazovku cez esc.
// ═══════════════════════════════════════════════════════════════════════════

let _dnes = null;

// Počítadlá menu — tie isté pravidlá ako sekcie (admin_70 ich kopíruje
// z objPodozriva, ppCakajuce a spatna_vazba_zoznam; test porovnáva).
function dnesPocty(d){
  d = d || {};
  const pr = d.prevod || {}, pp = d.peppol || {}, f = d.faktury || {}, z = d.zaloha || {};
  const kampZostava = (d.kampane || []).reduce((s, k) => s + (k.caka > 0 ? Math.max(0, Math.min(k.caka, (k.limit || 0) - (k.dnes || 0))) : 0), 0);
  return {
    kampane: kampZostava,
    objednavky: (pr.caka || 0) + (pr.podozrive || 0),
    "spatna-vazba": d.spatna_vazba || 0,
    peppol: (pp.ukoncenia || 0) + (pp.vybery || 0),
    zalohy: (z.dni == null || z.dni > ZAL_DNI_UPOZORNENIE) ? 1 : 0,
    faktury: (f.peppol_chyba || 0) + (f.bez_pdf || 0),
    automatika: d.automatika || 0,
  };
}

// Položky panela: len to, čo naozaj čaká (trvalé „nič“ sa nekreslí).
// vaha: "neg" = niečo je pokazené, "warn" = práca na dnes.
function dnesPolozky(d){
  d = d || {};
  const p = [];
  const pr = d.prevod || {}, pp = d.peppol || {}, f = d.faktury || {}, z = d.zaloha || {};
  if(d.automatika) p.push({ sekcia:"automatika", vaha:"neg", text: d.automatika + " × automatika hlási problém (úloha, odpoveď funkcie, Stripe alebo faktúra)" });
  for(const k of d.kampane || []){
    const zost = Math.max(0, Math.min(k.caka || 0, (k.limit || 0) - (k.dnes || 0)));
    if(zost) p.push({ sekcia:"kampane", vaha:"warn", text: "Kampaň „" + k.nazov + "“: dnes " + (k.dnes || 0) + "/" + (k.limit || 0) + ", zostáva poslať " + zost + " (čaká " + k.caka + ")" });
    if(k.pripravene) p.push({ sekcia:"kampane", vaha:"warn", text: "Kampaň „" + k.nazov + "“: " + k.pripravene + " pripravených bez „Odoslané ✓“ — over v Odoslaných" });
  }
  if(pr.podozrive) p.push({ sekcia:"objednavky", vaha:"neg", text: pr.podozrive + " × platba prevodom bez potvrdenia výpisom (podozrivá)" });
  if(pr.caka) p.push({ sekcia:"objednavky", vaha:"warn", text: pr.caka + " × platba prevodom čaká" });
  if(d.spatna_vazba) p.push({ sekcia:"spatna-vazba", vaha:"warn", text: d.spatna_vazba + " × spätná väzba čaká na odpoveď" });
  if(pp.po_termine) p.push({ sekcia:"peppol", vaha:"neg", text: pp.po_termine + " × ukončenie v Peppol po termíne (OP 7.6)" });
  const ppIne = (pp.ukoncenia || 0) - (pp.po_termine || 0) + (pp.vybery || 0);
  if(ppIne > 0) p.push({ sekcia:"peppol", vaha:"warn", text: ppIne + " × Peppol: ukončenie alebo výber čaká na rozhodnutie" });
  if(f.peppol_chyba) p.push({ sekcia:"faktury", vaha:"neg", text: f.peppol_chyba + " × faktúra za predplatné: e-faktúra neodišla" });
  if(f.bez_pdf) p.push({ sekcia:"faktury", vaha:"neg", text: f.bez_pdf + " × faktúra za predplatné bez PDF" });
  if(z.dni == null) p.push({ sekcia:"zalohy", vaha:"neg", text: "Zatiaľ žiadna hotová záloha" });
  else if(z.dni > ZAL_DNI_UPOZORNENIE) p.push({ sekcia:"zalohy", vaha:"warn", text: "Posledná záloha je stará " + z.dni + " dní" });
  return p;
}

function dnesPanelHtml(polozky){
  return polozky.map(x => '<a class="hint' + (x.vaha === "warn" ? " warn" : " neg") + '" href="#' + esc(x.sekcia) + '" style="display:block;text-decoration:none">'
    + esc(x.text) + " →</a>").join("");
}

// Mesačný príjem dvojako (spec 154.8 bod 5): podľa cien aktívnych predplatných
// (čo má prísť) a podľa faktúr za posledných 30 dní (čo prišlo).
function dnesPrijemHtml(p){
  p = p || {};
  const cen = +p.cennik || 0, fak = +p.faktury30 || 0, rozdiel = Math.round((cen - fak) * 100) / 100;
  let h = "Mesačne podľa cien · faktúry za 30 dní: <b>" + esc(penaz(fak)) + "</b>";
  if(Math.abs(rozdiel) >= 0.01) h += " (rozdiel " + esc(penaz(rozdiel)) + ")";
  h += "<br>platiaci " + (+p.platiacich || 0) + ": karta " + (+p.karta || 0) + " · prevod " + (+p.prevod || 0)
    + " · klienti účtovníka " + (+p.uctovnik || 0);
  if(p.bez_ceny) h += ' · <span style="color:var(--warn)">' + (+p.bez_ceny) + " bez objednávky</span>";
  return h;
}

async function adminDnes(){
  const { data, error } = await sb.rpc("admin_dnes");
  if(error){ console.error("admin_dnes:", error); return; }
  _dnes = data || {};
  const pocty = dnesPocty(_dnes);
  for(const id in pocty) adminPocet(id, pocty[id]);
  const polozky = dnesPolozky(_dnes);
  const sec = document.getElementById("dnesSec");
  if(sec){
    document.getElementById("dnesBody").innerHTML = dnesPanelHtml(polozky);
    sec.classList.toggle("hidden", !polozky.length);
  }
  const n = document.getElementById("kFakt"), l = document.getElementById("kFaktL");
  if(n) n.textContent = penaz((_dnes.prijem || {}).cennik);
  if(l) l.innerHTML = dnesPrijemHtml(_dnes.prijem);
}

// ═══ AUTOMATIKA ═════════════════════════════════════════════════════════════
function autoKedy(ts, teraz){
  if(!ts) return "nikdy";
  const min = Math.round(((teraz || new Date()) - new Date(ts)) / 60000);
  if(min < 1) return "práve teraz";
  if(min < 60) return "pred " + min + " min";
  if(min < 48 * 60) return "pred " + Math.round(min / 60) + " h";
  return "pred " + Math.round(min / 1440) + " dňami";
}
function autoInterval(m){
  if(!m) return "";
  if(m < 60) return "každých " + m + " min";
  if(m === 60) return "každú hodinu";
  if(m === 1440) return "denne";
  if(m === 10080) return "týždenne";
  return "každých " + m + " min";
}

function autoPrehladHtml(a, teraz){
  a = a || {};
  const ulohy = a.ulohy || [], h = a.http || {}, st = a.stripe || [], sf = a.saas || [];
  const cerv = +a.cervene || 0;
  let o = cerv
    ? '<div class="hint neg" style="margin:12px 18px">Červené: <b>' + cerv + "</b> — oprav alebo vysvetli, kým to zapadne.</div>"
    : '<div class="hint" style="margin:12px 18px">Všetko beží. Kontrolované ' + esc(autoKedy(a.cas, teraz)) + ".</div>";
  o += '<div style="padding:4px 18px 10px"><div style="font-size:12px;color:var(--soft);font-weight:700;margin:6px 0">Plánované úlohy</div>';
  o += ulohy.map(u => '<div class="autoUloha" style="padding:8px 0;border-bottom:1px solid var(--line)">'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:baseline"><b class="mono">' + esc(u.meno) + "</b>"
      + '<span style="color:var(--soft);font-size:12px">' + esc(autoInterval(u.interval_min) || u.rozvrh || "") + "</span>"
      + (u.problem ? '<span class="pill off">' + esc(u.problem) + "</span>" : '<span class="pill" style="color:var(--accent2)">beží</span>') + "</div>"
      + '<div style="font-size:12.5px;color:var(--soft)">posledný beh ' + esc(autoKedy(u.posledny, teraz)) + (u.stav ? " (" + esc(u.stav) + ")" : "")
      + " · za 24 h " + (+u.behov24 || 0) + " behov" + (u.chyb24 ? ', <span style="color:var(--neg)">' + (+u.chyb24) + " zlyhaní</span>" : "") + "</div>"
      + (u.stav === "failed" && u.sprava ? '<div class="mono" style="font-size:12px;color:var(--neg);word-break:break-word">' + esc(u.sprava) + "</div>" : "")
      + "</div>").join("");
  o += "</div>";

  o += '<div style="padding:4px 18px 10px"><div style="font-size:12px;color:var(--soft);font-weight:700;margin:6px 0">Odpovede edge funkcií (24 h, pg_net drží asi 6 h)</div>'
    + '<div style="font-size:13px">spolu ' + (+h.spolu || 0) + " · zlé " + (h.zle ? '<b style="color:var(--neg)">' + (+h.zle) + "</b>" : "0")
    + " · s chybami v tele " + (+h.chyby_v_tele || 0) + " · posledná " + esc(autoKedy(h.posledna, teraz))
    + (h.posledna_zla ? ' <span class="pill off">posledná je zlá</span>' : "") + "</div>"
    + (h.zle_posledne || []).map(x => '<div class="mono" style="font-size:12px;padding:3px 0;word-break:break-word"><span style="color:var(--neg)">' + esc(x.kod == null ? "—" : x.kod) + "</span> "
        + esc(autoKedy(x.cas, teraz)) + " · " + esc(x.text || "") + "</div>").join("")
    + "</div>";

  if(st.length) o += '<div style="padding:4px 18px 10px"><div style="font-size:12px;color:var(--soft);font-weight:700;margin:6px 0">Stripe — udalosti v chybe</div>'
    + st.map(s => '<div style="font-size:12.5px;padding:3px 0;word-break:break-word"><span class="mono">' + esc(s.typ) + "</span> · " + esc(s.stav) + " · "
        + esc(autoKedy(s.prijate, teraz)) + " · pokusov " + (+s.pokusy || 0) + (s.chyba ? '<div class="mono" style="color:var(--neg)">' + esc(s.chyba) + "</div>" : "") + "</div>").join("")
    + "</div>";
  if(sf.length) o += '<div style="padding:4px 18px 10px"><div style="font-size:12px;color:var(--soft);font-weight:700;margin:6px 0">Faktúry za predplatné</div>'
    + sf.map(f => '<div style="font-size:12.5px;padding:3px 0;word-break:break-word"><a href="#faktury" class="mono">' + esc(f.cislo) + "</a> · "
        + (f.bez_pdf ? '<span style="color:var(--neg)">bez PDF</span> ' : "")
        + (f.peppol_chyba ? '<span style="color:var(--neg)">e-faktúra: ' + esc(f.peppol_chyba) + "</span> (" + (+f.peppol_pokusy || 0) + "×)" : "") + "</div>").join("")
    + "</div>";
  return o;
}

async function nacitajAutomatiku(){
  const el = document.getElementById("autoBody");
  el.innerHTML = '<div class="loading">Načítavam…</div>';
  const { data, error } = await sb.rpc("admin_automatika");
  if(error){ el.innerHTML = '<div class="err" style="padding:12px 18px">Chyba: ' + esc(error.message) + "</div>"; return; }
  el.innerHTML = autoPrehladHtml(data || {}, new Date());
  adminPocet("automatika", +(data && data.cervene) || 0);
}
