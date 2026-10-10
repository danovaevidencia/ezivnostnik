// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — admin: KONTAKTY, SKUPINY, ODHLÁSENIA, ODOZVA KAMPANE
//  (spec kap. 141.6–141.8 a 141.10, ROZHODNUTIA č. 248–250, admin_53)
//
//  Klasický skript s globálnymi funkciami (obsluhy v onclick="…"), načíta ho
//  smerovač adminu pri otvorení sekcie Kontakty/Odhlásenia a admin_kampane.js
//  pri otvorení sekcie Kampane. Používa globálne sb, esc, kampanCsv,
//  kampanVolaj a kampGmailOdkaz z admin.html a admin_kampane.js.
//
//  Žiadne alert/prompt/confirm: nezvratný krok (upratanie, zápis do
//  odhlásení, nezáujem/nedoručené) má potvrdenie priamo pod tlačidlom.
//  Farby len z tokenov palety adminu (:root v admin.html, spec 141.2).
// ═══════════════════════════════════════════════════════════════════════════

// Šesť cieľových skupín (č. 248) — ten istý zoznam je v kontrole hodnôt
// tabuľky kontakty (admin_53) a v štúdiu (admin_52). Stráži test_kampane_kontakty.
const KONT_SKUPINY = {
  uctovnici:          "A · Účtovníci",
  szco_neplatitel:    "B · SZČO — neplatitelia DPH",
  szco_platitel:      "C · SZČO — platitelia DPH",
  firmy:              "D · Firmy",
  novi_szco:          "E · Noví SZČO",
  slobodne_povolania: "F · Slobodné povolania",
};
const KONT_ODPOVEDE = { zaujem:"záujem", nezaujem:"nezáujem", otazka:"otázka", stretnutie:"stretnutie", nedorucene:"nedoručené" };
// Tieto dve odpovede zapíšu adresu do odhlásení (admin_53, kampan_odpoved) —
// preto potvrdenie navyše; z odhlásení sa nič nemaže.
const KONT_ODPOVEDE_TRVALE = ["nezaujem", "nedorucene"];
const KONT_DOVODY = { odhlasenie:"nekontaktovať / odhlásenie", namietka:"námietka — zmaže aj kontakt", bounce:"nedoručené (bounce)", staznost:"sťažnosť" };
const KONT_STAVY = { caka:"čaká", odoslane:"odoslané", bounce:"nedoručené", odhlaseny:"odhlásený", chyba:"chyba", vyradeny:"vyradený" };
const KONT_LEHOTA_DNI = 60;          // č. 250 — databáza pod túto hranicu nepustí (kontakt_prekazka)

function kontSprava(id, text, zle){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = text;
  el.style.color = zle ? "var(--neg)" : "var(--accent2)";
}
function kontCas(x){ return x ? new Date(x).toLocaleString("sk-SK", { day:"numeric", month:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "–"; }
function kontDen(x){ return x ? new Date(x).toLocaleDateString("sk-SK") : "–"; }
function kontSkupinaSelect(id, hodnota){
  return '<select id="' + id + '">' + Object.entries(KONT_SKUPINY).map(([k, n]) =>
    '<option value="' + k + '"' + (k === hodnota ? " selected" : "") + ">" + esc(n) + "</option>").join("") + "</select>";
}
// CSV pre Excel (bodkočiarka, BOM) — rovnaký tvar ako export záznamov e-faktúr.
function kontCsv(hlavicka, riadky){
  const b = x => '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"';
  return "﻿" + [hlavicka.map(b).join(";")].concat(riadky.map(r => r.map(b).join(";"))).join("\r\n");
}
function kontStiahni(meno, text){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type:"text/csv;charset=utf-8" }));
  a.download = meno;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
// Potvrdenie v mieste: prvý klik ukáže otázku a dve tlačidlá, nič nezapíše.
let _kontPotvrd = null;
function kontPotvrdenie(miesto, otazka, akcia){
  _kontPotvrd = akcia;
  const el = document.getElementById(miesto);
  if(!el) return;
  el.innerHTML = '<div class="hint warn" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span style="flex:1;min-width:200px">' + esc(otazka) + "</span>"
    + '<button class="rowbtn" style="border-color:var(--neg);color:var(--neg)" onclick="kontPotvrdAno(\'' + miesto + '\')">Áno, pokračovať</button>'
    + '<button class="rowbtn" onclick="kontPotvrdNie(\'' + miesto + '\')">Zrušiť</button></div>';
}
async function kontPotvrdAno(miesto){
  const a = _kontPotvrd; _kontPotvrd = null;
  const el = document.getElementById(miesto); if(el) el.innerHTML = "";
  if(a) await a();
}
function kontPotvrdNie(miesto){
  _kontPotvrd = null;
  const el = document.getElementById(miesto); if(el) el.innerHTML = "";
}

// ═══ SEKCIA: KONTAKTY A SKUPINY ════════════════════════════════════════════
async function nacitajKontakty(){
  const body = document.getElementById("kontBody");
  const { data, error } = await sb.rpc("kontakty_prehlad");
  if(error){ body.innerHTML = '<div class="loading">Chyba načítania: ' + esc(error.message) + "</div>"; return; }
  const sk = data.skupiny || [], z = data.na_zmazanie || {};
  const naZmazanie = (z.kontakty_neoslovene || 0) + (z.kontakty_po_lehote || 0) + (z.adresati_neoslovene || 0) + (z.adresati_po_lehote || 0);
  body.innerHTML =
    '<div style="padding:10px 18px 4px;font-size:13px;color:var(--soft)">Kontakty na oslovenie so skupinou (č. 248). Kampaň si z nich adresátov <b>vyberá</b> — odhlásení nikdy, oslovení najskôr po '
      + KONT_LEHOTA_DNI + " dňoch. Kontakt bez odoslaného e-mailu sa po <b>90 dňoch</b> maže, po oslovení po 12 mesiacoch (zásady 1.18).</div>"
    + '<div style="overflow-x:auto"><table><thead><tr><th>Skupina</th><th class="r">Spolu</th><th class="r">Neoslovení</th><th class="r">Dá sa osloviť</th><th class="r">Odhlásení</th></tr></thead><tbody>'
    + sk.map(s => "<tr><td>" + esc(KONT_SKUPINY[s.skupina] || s.skupina) + '</td><td class="r amt">' + s.spolu + '</td><td class="r amt">' + s.neoslovene
      + '</td><td class="r amt"><b>' + s.dostupne + '</b></td><td class="r amt">' + s.odhlasene + "</td></tr>").join("")
    + '</tbody></table></div>'
    + '<div style="padding:4px 18px 12px;font-size:12.5px;color:var(--soft)">Spolu ' + (data.spolu || 0) + " kontaktov · trvalých odhlásení " + (data.odhlasenia || 0) + "</div>"

    + '<div style="padding:0 18px 14px">'
    + '<div class="hint' + (naZmazanie ? " warn" : "") + '"><b>Upratanie</b> — '
      + (naZmazanie
        ? "na zmazanie: kontakty bez e-mailu po 90 dňoch <b>" + (z.kontakty_neoslovene || 0) + "</b>, po 12 mesiacoch od e-mailu <b>" + (z.kontakty_po_lehote || 0)
          + "</b>; adresáti kampaní bez e-mailu po 90 dňoch <b>" + (z.adresati_neoslovene || 0) + "</b>, po 12 mesiacoch <b>" + (z.adresati_po_lehote || 0) + "</b>."
        : "nič nečaká na zmazanie.")
      + " Odhlásenia sa nemažú nikdy.</div>"
    + (naZmazanie ? '<button class="rowbtn" onclick="kontUprac()">Upratať (' + naZmazanie + ')</button>' : "")
    + '<div id="kontUpracPotvrd"></div><div id="kontUpracSprava" style="font-size:13px;min-height:18px;margin-top:4px"></div></div>'

    + '<div style="padding:0 18px 16px;border-top:1px solid var(--line)">'
    + '<h3 style="font-size:14px;margin:14px 0 8px">Import kontaktov</h3>'
    + '<div class="muted" style="margin-bottom:8px">CSV s hlavičkou — povinné <code>email</code> a <code>source_url</code> (stránka, kde bol kontakt zverejnený); ďalej <code>firma, meno, ico, mesto, kraj, platitel_dph, skupina, source_seen_at</code>. '
      + "Stĺpec skupina v riadku má prednosť pred voľbou nižšie. Existujúci e-mail sa nemení. Importuj len toľko, koľko oslovíš do 90 dní.</div>"
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0 12px">'
      + '<div class="field"><label for="kontImpSkupina">Skupina</label>' + kontSkupinaSelect("kontImpSkupina", "uctovnici") + "</div>"
      + '<div class="field"><label for="kontImpZdroj">Zber (odkiaľ)</label><input id="kontImpZdroj" value="leads/uctovnici"></div></div>'
    + '<div class="field"><label for="kontImpCsv">CSV</label><textarea id="kontImpCsv" rows="5" placeholder="email,firma,ico,mesto,skupina,source_url,source_seen_at"></textarea></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="rowbtn" onclick="document.getElementById(\'kontImpSubor\').click()">Načítať súbor CSV</button>'
      + '<input type="file" id="kontImpSubor" accept=".csv,text/csv" hidden onchange="kontImpSubor(this)">'
      + '<button class="btn" style="width:auto;padding:8px 16px" onclick="kontImport()">Importovať</button></div>'
    + '<div id="kontImpSprava" style="font-size:13px;min-height:18px;margin-top:6px"></div></div>';
}
async function kontImpSubor(vstup){
  const f = vstup.files && vstup.files[0];
  vstup.value = "";
  if(!f) return;
  document.getElementById("kontImpCsv").value = await f.text();
  kontSprava("kontImpSprava", "Načítané " + f.name + " — skontroluj skupinu a stlač Importovať.");
}
async function kontImport(){
  const riadky = kampanCsv(document.getElementById("kontImpCsv").value);
  if(!riadky.length){ kontSprava("kontImpSprava", "CSV je prázdne.", true); return; }
  const { data, error } = await sb.rpc("kontakty_import", { p_riadky: riadky,
    p_skupina: document.getElementById("kontImpSkupina").value, p_zdroj: document.getElementById("kontImpZdroj").value.trim() || null });
  if(error){ kontSprava("kontImpSprava", "Chyba: " + error.message, true); return; }
  document.getElementById("kontImpCsv").value = "";
  await nacitajKontakty();
  kontSprava("kontImpSprava", "Pridaných " + data.pridane + " · odhlásených " + data.odhlasene + " · bez zdroja " + data.bez_zdroja
    + " · zlá skupina " + data.zla_skupina + " · chybný e-mail " + data.zle + " · už v zozname " + data.duplicita);
}
function kontUprac(){
  kontPotvrdenie("kontUpracPotvrd", "Zmazať natrvalo kontakty a adresátov po lehote? Nedá sa vrátiť (odhlásenia ostanú).", async () => {
    const { data: d, error } = await sb.rpc("kontakty_uprac", { p_len_pocet: false });
    if(error){ kontSprava("kontUpracSprava", "Chyba: " + error.message, true); return; }
    const data = d || {};
    await nacitajKontakty();
    kontSprava("kontUpracSprava", "Zmazané: kontakty " + ((data.kontakty_neoslovene || 0) + (data.kontakty_po_lehote || 0))
      + ", adresáti kampaní " + ((data.adresati_neoslovene || 0) + (data.adresati_po_lehote || 0)) + ".");
  });
}

// ═══ SEKCIA: ODHLÁSENIA ═════════════════════════════════════════════════════
async function nacitajOdhlasenia(){
  const body = document.getElementById("odhlBody");
  if(!document.getElementById("odhlZoznam")){
    body.innerHTML =
      '<div style="padding:10px 18px 0;font-size:13px;color:var(--soft)">Adresy a IČO, na ktoré už nepíšeme — odhlásenie, námietka, nedoručené, sťažnosť. '
        + "Kontroluje ich import, výber adresátov aj príprava každého e-mailu. <b>Záznam sa nedá zmazať</b> (ani servisnou rolou).</div>"
      + '<div style="padding:10px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 12px;align-items:end">'
        + '<div class="field"><label for="odhlHladaj">Hľadať e-mail alebo IČO</label><input id="odhlHladaj" onkeydown="if(event.key===\'Enter\')odhlHladaj()"></div>'
        + '<div class="field"><button class="rowbtn" onclick="odhlHladaj()">Hľadať</button></div></div>'
      + '<div id="odhlZoznam"></div>'
      + '<div style="padding:4px 18px 16px;border-top:1px solid var(--line)">'
        + '<h3 style="font-size:14px;margin:14px 0 8px">Pridať — nekontaktovať</h3>'
        + '<div class="muted" style="margin-bottom:8px">Keď niekto odpíše „nepíšte mi“ alebo sa e-mail vráti. Kľúč je e-mail alebo IČO (8 číslic).</div>'
        + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 12px">'
          + '<div class="field"><label for="odhlKluc">E-mail alebo IČO</label><input id="odhlKluc" autocomplete="off"></div>'
          + '<div class="field"><label for="odhlDovod">Dôvod</label><select id="odhlDovod">'
            + Object.entries(KONT_DOVODY).map(([k, n]) => '<option value="' + k + '">' + esc(n) + "</option>").join("") + "</select></div></div>"
        + '<button class="btn" style="width:auto;padding:8px 16px" onclick="odhlPridaj()">Pridať do zoznamu</button>'
        + '<div id="odhlPotvrd"></div><div id="odhlSprava" style="font-size:13px;min-height:18px;margin-top:6px"></div></div>';
  }
  await odhlHladaj();
}
async function odhlHladaj(){
  const el = document.getElementById("odhlZoznam");
  const h = (document.getElementById("odhlHladaj") || {}).value || "";
  const { data, error } = await sb.rpc("odhlasenia_prehlad", { p_hladaj: h.trim() || null, p_limit: 200 });
  if(error){ el.innerHTML = '<div class="loading">Chyba: ' + esc(error.message) + "</div>"; return; }
  const pd = data.podla_dovodu || {}, r = data.riadky || [];
  el.innerHTML = '<div style="padding:0 18px 8px;font-size:12.5px;color:var(--soft)">Spolu <b>' + (data.spolu || 0) + "</b> · "
      + Object.keys(KONT_DOVODY).map(k => esc(KONT_DOVODY[k].split(" ")[0]) + " " + (pd[k] || 0)).join(" · ") + "</div>"
    + (!r.length ? '<div class="empty">' + (h.trim() ? "Nič sa nenašlo." : "Zoznam je prázdny.") + "</div>"
      : '<div style="overflow-x:auto"><table><thead><tr><th>Kľúč</th><th>Dôvod</th><th>Kedy</th></tr></thead><tbody>'
        + r.map(x => '<tr><td class="mono" style="overflow-wrap:anywhere">' + esc(x.kluc) + "</td><td>" + esc(KONT_DOVODY[x.dovod] || x.dovod) + "</td><td>" + esc(kontCas(x.cas)) + "</td></tr>").join("")
        + "</tbody></table></div>"
        + (r.length >= 200 ? '<div class="muted" style="padding:6px 18px">Zobrazených 200 najnovších — zúž hľadanie.</div>' : ""));
}
function odhlPridaj(){
  const kluc = document.getElementById("odhlKluc").value.trim();
  const dovod = document.getElementById("odhlDovod").value;
  if(!kluc){ kontSprava("odhlSprava", "Zadaj e-mail alebo IČO.", true); return; }
  kontPotvrdenie("odhlPotvrd", "Zapísať „" + kluc + "“ (" + KONT_DOVODY[dovod] + ")? Záznam sa nedá zmazať"
      + (dovod === "namietka" ? " a kontakt aj adresáti sa zmažú." : "."), async () => {
    const { data, error } = await sb.rpc("odhlasenie_pridaj", { p_kluc: kluc, p_dovod: dovod });
    if(error){ kontSprava("odhlSprava", "Chyba: " + error.message, true); return; }
    document.getElementById("odhlKluc").value = "";
    kontSprava("odhlSprava", (data.novy ? "Zapísané: " : "Už v zozname bolo: ") + data.kluc);
    await odhlHladaj();
  });
}

// ═══ KAMPAŇ: výber adresátov zo skupiny, odozva, denný plán, pripomienka ════
// Vkladá sa do detailu kampane (admin_kampane.js → kampanFormular*).
function kontKampanBlok(k){
  const id = k.id;
  // min-width:0 — formulár kampane je mriežka a jej položka by sa inak
  // roztiahla na šírku tabuľky adresátov (orezané na mobile, zmerané 27. 9.).
  return '<details open style="border:1px solid var(--line);border-radius:10px;padding:8px 12px;min-width:0">'
    + '<summary style="cursor:pointer;font-weight:700">Adresáti zo skupiny</summary>'
    + '<div class="muted" style="margin:6px 0 8px">Výber z Kontaktov a skupín. Odhlásení sa nevyberú nikdy, oslovení v inej kampani najskôr po '
      + KONT_LEHOTA_DNI + " dňoch, čakajúci v inej bežiacej kampani tiež nie.</div>"
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0 12px">'
      + '<div class="field"><label for="kvSkupina">Skupina</label>' + kontSkupinaSelect("kvSkupina", k.skupina || "uctovnici") + "</div>"
      + '<div class="field"><label for="kvMesto">Mesto</label><input id="kvMesto" placeholder="všetky"></div>'
      + '<div class="field"><label for="kvKraj">Kraj</label><input id="kvKraj" placeholder="všetky"></div>'
      + '<div class="field"><label for="kvPlatitel">Platiteľ DPH</label><select id="kvPlatitel"><option value="">nezáleží</option><option value="true">áno</option><option value="false">nie</option></select></div>'
      + '<div class="field"><label for="kvDni">Neoslovení aspoň (dní)</label><input id="kvDni" type="number" min="' + KONT_LEHOTA_DNI + '" value="' + KONT_LEHOTA_DNI + '"></div>'
      + '<div class="field"><label for="kvLimit">Najviac pridať</label><input id="kvLimit" type="number" min="1" max="5000" value="' + Math.max(20, (k.denny_limit || 20) * 5) + '"></div></div>'
    + '<label class="chk"><input type="checkbox" id="kvNikdy"> len ešte nikdy neoslovení</label>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="rowbtn" onclick="kontVyber(' + id + ',true)">Spočítať</button>'
      + '<button class="rowbtn" onclick="kontVyber(' + id + ',false)">Pridať do kampane</button></div>'
    + '<div id="kvSprava" style="font-size:13px;min-height:18px;margin-top:6px"></div></details>'
    + '<div id="kontVysl" style="min-width:0"><div class="loading" style="padding:14px">Načítavam výsledky…</div></div>';
}
function kontFilter(){
  const v = id => (document.getElementById(id) || {}).value || "";
  return { skupina: v("kvSkupina"), mesto: v("kvMesto").trim(), kraj: v("kvKraj").trim(), platitel: v("kvPlatitel"),
    dni: Math.max(KONT_LEHOTA_DNI, +v("kvDni") || KONT_LEHOTA_DNI), limit: +v("kvLimit") || 100,
    len_neoslovene: !!(document.getElementById("kvNikdy") || {}).checked };
}
async function kontVyber(kampan, lenPocet){
  const f = kontFilter();
  const { data, error } = await sb.rpc("kampan_vyber_adresatov", { p_kampan: kampan, p_filter: f, p_len_pocet: lenPocet });
  if(error){ kontSprava("kvSprava", "Chyba: " + error.message, true); return; }
  const text = "Vo filtri " + data.zhoda + " · dá sa osloviť " + data.dostupne
    + (lenPocet ? "" : " · <b>pridaných " + data.pridane + "</b>")
    + " · odhlásení " + data.odhlaseni + (data.vyluceni ? " · vylúčení z kampaní " + data.vyluceni : "") + " · oslovení za " + data.dni + " dní " + data.nedavno
    + (f.len_neoslovene ? " · už oslovení " + data.osloveni : "") + " · čakajú inde " + data.caka_inde + " · už v kampani " + data.v_kampani;
  // Pridanie prekreslí detail kampane (počty čakajúcich) — hlásenie až potom.
  if(!lenPocet) await nacitajKampane();
  const el = document.getElementById("kvSprava");
  if(el){ el.innerHTML = text; el.style.color = "var(--ink)"; }
}
function kontVyradeneText(v){
  const n = { odhlaseny:"odhlásený", lehota:"oslovený pred < 60 dňami", mx:"doména bez MX", "mx-nezname":"MX sa nepodarilo overiť (skúsi sa o hodinu)",
    "mx-odlozene":"čaká na nové overenie domény" };
  const e = Object.entries(v || {});
  return e.length ? " · vyradené: " + e.map(([k, c]) => (n[k] || k) + " " + c).join(", ") : "";
}

let _kontVysl = null, _kontAdresati = [], _kontPripomienky = [];
async function kontKampanDetail(kampan){
  const el = document.getElementById("kontVysl");
  if(!el) return;
  const [V, Z] = await Promise.all([
    sb.rpc("kampan_vysledky", { p_kampan: kampan }),
    sb.rpc("kampan_adresati_zoznam", { p_kampan: kampan, p_limit: 1000 }),
  ]);
  if(V.error || Z.error){ el.innerHTML = '<div class="loading">Výsledky sa nenačítali: ' + esc((V.error || Z.error).message) + "</div>"; return; }
  _kontVysl = V.data; _kontAdresati = Z.data || [];
  const v = _kontVysl, s = v.spolu || {}, p = v.plan || {}, an = v.analytika || {}, k = v.kampan || {};
  const rucna = k.sposob === "rucne";
  const kpi = (n, l) => '<div class="kpi" style="padding:10px 12px"><div class="n" style="font-size:20px">' + n + '</div><div class="l">' + l + "</div></div>";
  const pct = (a, b) => b ? " (" + Math.round(a / b * 100) + " %)" : "";
  const odp = v.odpovede || {};
  el.innerHTML =
    // ── Denný plán ──
    '<div class="hint" style="margin-top:12px"><b>Dnes</b> odoslané ' + (p.dnes_odoslane || 0) + " + pripomienky " + (p.dnes_pripomienky || 0)
      + " / limit " + (p.limit || 0) + " · čaká " + (p.caka || 0) + " · na pripomienku " + (p.pripomienky_na_dnes || 0)
      + ((p.dnes_odoslane || 0) + (p.dnes_pripomienky || 0) >= (p.limit || 0) && p.limit ? " · <b>denný limit je vyčerpaný</b>" : "") + "</div>"
    // ── Výsledky ──
    + '<div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:10px 0">'
      + kpi(s.odoslane || 0, "odoslané") + kpi(s.pripomenute || 0, "pripomenuté")
      + kpi(s.odpovedali || 0, "odpovedali" + pct(s.odpovedali || 0, s.odoslane || 0))
      + kpi(s.odhlaseni || 0, "odhlásení") + kpi(s.nedorucene || 0, "nedoručené") + kpi(s.vyradene || 0, "vyradené (MX, lehota)")
    + "</div>"
    + '<div style="font-size:13px;margin-bottom:8px"><b>Odpovede:</b> '
      + Object.keys(KONT_ODPOVEDE).map(x => esc(KONT_ODPOVEDE[x]) + " " + (odp[x] || 0)).join(" · ") + "</div>"
    // ── Analytika ──
    + '<div class="hint" style="font-size:12.5px">'
      + (k.utm_campaign
        ? "<b>Z webu</b> (utm_campaign=<code>" + esc(k.utm_campaign) + "</code>): návštevy <b>" + (an.navstevy || 0) + "</b> · spustenia ukážky "
          // Odkaz na ukážku vedie cez úvodnú stránku (?do=ukazka, č. 254) — klik
          // na ukážku je teda návšteva s UTM kampane; samostatná udalosť v appke nie je.
          + (an.demo_sa_meria ? "<b>" + (an.demo || 0) + "</b>" : "<i>sú v návštevách (odkaz vedie cez úvodnú stránku)</i>") + " · registrácie <b>" + (an.registracie || 0) + "</b>. "
          + "Súhrnne a len <b>v rámci toho istého dňa</b>: návštevník je jednodňový otlačok bez cookies (denná soľ), takže registráciu vidíme pri kampani, len ak prišla v deň návštevy s odkazom kampane. "
          + "Počíta sa len web (úvod, články) — odkaz priamo do appky (ezivnostnik.html) návštevu nezapíše."
        : '<span class="warnTxt">Kampaň nemá utm_campaign — návštevy z nej sa v analytike nedajú nájsť.</span>')
      + (rucna ? " Ručná kampaň sa nemeria (bez pixelu a presmerovania) — otvorenia a kliky tu preto nie sú." : "") + "</div>"
    // ── Graf po dňoch ──
    + kontGrafy(v.po_dnoch || [])
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">'
      + '<button class="rowbtn" onclick="kontExportDni()">Export po dňoch (CSV)</button>'
      + '<button class="rowbtn" onclick="kontExportAdresati()">Export adresátov (CSV)</button></div>'
    // ── Pripomienka ──
    + (rucna ? kontPripomienkaBlok(k) : '<div class="muted" style="margin:8px 0">Pripomienka je len pri ručnej kampani — hromadnú studenú poštu poskytovatelia zakazujú (132.13).</div>')
    // ── Adresáti a odpovede ──
    + kontAdresatiTabulka(kampan, rucna)
    + '<div id="kontNahlad"></div>';
}
// Tri malé grafy nad sebou so spoločnou osou dní (nie dve mierky v jednom grafe):
// e-maily, odpovede, návštevy. Stĺpec nesie popis pri podržaní myši.
function kontGrafy(dni){
  if(!dni.length) return "";
  const rad = (nazov, hodnota, jednotka) => {
    const max = Math.max(1, ...dni.map(hodnota));
    const sucet = dni.reduce((a, d) => a + hodnota(d), 0);
    return '<div style="margin-top:8px"><div style="font-size:12px;color:var(--soft);font-weight:700">' + esc(nazov) + " · spolu " + sucet + "</div>"
      + '<div style="display:flex;align-items:flex-end;gap:2px;height:48px;border-bottom:1px solid var(--line)">'
      + dni.map(d => { const x = hodnota(d);
          return '<div title="' + esc(kontDen(d.den)) + ": " + x + " " + jednotka + '" style="flex:1;min-width:2px;height:100%;display:flex;align-items:flex-end">'
            + '<div style="width:100%;background:var(--accent);border-radius:3px 3px 0 0;height:' + (x ? Math.max(6, Math.round(x / max * 100)) : 0) + '%"></div></div>'; }).join("")
      + "</div></div>";
  };
  return '<div style="margin:6px 0 4px">'
    + rad("E-maily (prvé + pripomienky)", d => (d.odoslane || 0) + (d.pripomienky || 0), "e-mailov")
    + rad("Odpovede", d => d.odpovede || 0, "odpovedí")
    + rad("Návštevy webu z kampane (návštevník dňa)", d => d.navstevy || 0, "návštev")
    + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--soft);margin-top:2px"><span>' + esc(kontDen(dni[0].den))
    + "</span><span>" + esc(kontDen(dni[dni.length - 1].den)) + "</span></div></div>";
}
function kontAdresatiTabulka(kampan, rucna){
  const r = _kontAdresati;
  if(!r.length) return '<div class="muted" style="margin:8px 0">Kampaň zatiaľ nemá adresátov.</div>';
  const select = x => {
    if(!x.odoslane_o) return "";
    return '<select aria-label="Odpoveď ' + esc(x.email) + '" style="width:auto;padding:4px 8px;font-size:12.5px" onchange="kontOdpoved(' + kampan + "," + x.id + ',this)">'
      + '<option value="">— bez odpovede —</option>'
      + Object.entries(KONT_ODPOVEDE).map(([k, n]) => '<option value="' + k + '"' + (x.odpoved === k ? " selected" : "") + ">" + esc(n) + "</option>").join("") + "</select>";
  };
  return '<h3 style="font-size:14px;margin:14px 0 6px">Adresáti a odpovede</h3>'
    + '<div class="muted" style="margin-bottom:6px">Odpoveď zapíš jedným klikom, keď príde do schránky. Nezáujem a nedoručené zapíšu adresu do Odhlásení.</div>'
    + '<div id="kontOdpPotvrd"></div>'
    + '<div style="overflow-x:auto;max-height:520px;overflow-y:auto;border:1px solid var(--line);border-radius:8px" data-scroll><table><thead><tr><th>Adresát</th><th>Stav</th><th>Odoslané</th><th>Pripomienka</th><th>Odpoveď</th>' + (rucna ? "<th></th>" : "") + "</tr></thead><tbody>"
    + r.map(x => "<tr><td><div style=\"overflow-wrap:anywhere\">" + esc(x.email) + '</div><div class="email">' + esc([x.firma, x.mesto].filter(Boolean).join(" · ")) + "</div></td>"
      + "<td>" + esc(KONT_STAVY[x.stav] || x.stav) + (x.chyba ? '<div class="email">' + esc(x.chyba) + "</div>" : "")
        + (x.stav === "caka" || x.stav === "odoslane" ? '<div><button class="rowbtn" style="padding:2px 8px;font-size:11.5px" onclick="kontVyradZacni(' + kampan + "," + x.id + ')">Vyradiť…</button></div>' : "") + "</td>"
      + "<td>" + esc(kontDen(x.odoslane_o)) + "</td><td>" + esc(kontDen(x.pripomenute_o)) + "</td><td>" + select(x) + "</td>"
      + (rucna ? '<td><button class="rowbtn" onclick="kontNahlad(' + kampan + "," + x.id + ')">Náhľad</button></td>' : "") + "</tr>").join("")
    + "</tbody></table></div>";
}
// Vyradenie z tabuľky adresátov — ten istý formulár ako pri pripravenom
// e-maile (kampVyradOtvor z admin_kampane.js, spec 154 B3).
function kontVyradZacni(kampan, adresat){
  const x = _kontAdresati.find(a => a.id === adresat); if(!x) return;
  kampVyradOtvor("kontOdpPotvrd", x.id, x.email, x.stav, async (r, dovod) => {
    kontSprava("kampSprava", "Vyradený: " + x.email + " — " + dovod + (r.vylucene_kontaktov ? " · vylúčený z ďalších kampaní" : ""));
    await kontKampanDetail(kampan);
  });
  const el = document.getElementById("kontOdpPotvrd"); if(el && el.scrollIntoView) el.scrollIntoView({ block:"nearest" });
}
async function kontOdpoved(kampan, adresat, sel){
  const hodnota = sel.value || null;
  const x = _kontAdresati.find(a => a.id === adresat) || {};
  const uloz = async () => {
    const { error } = await sb.rpc("kampan_odpoved", { p_adresat: adresat, p_odpoved: hodnota });
    if(error){ sel.value = x.odpoved || ""; kontSprava("kampSprava", "Chyba: " + error.message, true); return; }
    kontSprava("kampSprava", "Zapísané: " + x.email + " — " + (hodnota ? KONT_ODPOVEDE[hodnota] : "bez odpovede"));
    await kontKampanDetail(kampan);
  };
  if(KONT_ODPOVEDE_TRVALE.includes(hodnota)){
    sel.value = x.odpoved || "";          // kým nepotvrdí, nič sa nezmenilo
    kontPotvrdenie("kontOdpPotvrd", x.email + ": „" + KONT_ODPOVEDE[hodnota] + "“ zapíše adresu do Odhlásení — už sa neosloví a nedá sa to vrátiť.", async () => {
      sel.value = hodnota; await uloz(); });
    document.getElementById("kontOdpPotvrd").scrollIntoView({ block:"nearest" });
    return;
  }
  await uloz();
}
async function kontNahlad(kampan, adresat, pripomienka){
  const el = document.getElementById("kontNahlad");
  try{
    const d = await kampanVolaj({ kampan, akcia:"nahlad", adresat: adresat || undefined, pripomienka: !!pripomienka });
    const n = d.nahlad;
    el.innerHTML = '<div class="hint"><b>Náhľad ' + (pripomienka ? "pripomienky" : "e-mailu") + (adresat ? " pre skutočného adresáta" : "") + "</b> · Predmet: " + esc(n.predmet) + "</div>"
      + (n.html ? '<iframe id="kontNahladRam" sandbox="" style="width:100%;height:700px;border:1px solid var(--line);border-radius:10px;background:var(--panel)"></iframe>'
        : '<pre style="white-space:pre-wrap;font:inherit;font-size:13px;border:1px solid var(--line);border-radius:10px;padding:10px">' + esc(n.text) + "</pre>");
    if(n.html) document.getElementById("kontNahladRam").srcdoc = n.html;
    el.scrollIntoView({ block:"nearest" });
  }catch(e){ el.innerHTML = '<div class="hint warn">Náhľad zlyhal: ' + esc(e.message) + "</div>"; }
}

// ── Pripomienka (č. 250): jedna, najskôr 10 dní po odoslaní, bez odpovede ──
const KONT_PRIPOMIENKA_VZOR = [
  "Dobrý deň,",
  "",
  "pred pár dňami som vám písal o elektronických faktúrach, ktoré budú od 1. 1. 2027 povinné. Len sa pripomínam — ak by eživnostník pomohol aj {firma|vám}, stačí odpísať na tento e-mail a rád ho ukážem.",
  "",
  "Viac vám už nenapíšem, ak sa neozvete.",
  "",
  "S pozdravom",
  "Ing. Roman Slivka",
  "eživnostník · info@ezivnostnik.eu",
  "",
  "Váš kontakt som našiel na {source_url}. Odhlásite sa jedným klikom: {odhlasenie}",
].join("\n");
function kontPripomienkaBlok(k){
  return '<details style="border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin:10px 0"' + (k.pripomienka ? "" : " open") + ">"
    + '<summary style="cursor:pointer;font-weight:700">Pripomienka neodpovedaným</summary>'
    + '<div class="muted" style="margin:6px 0">Jedna, najskôr 10 dní po prvom e-maile, len adresátom bez odpovede a bez odhlásenia (č. 250). Čistý text; polia {firma|náhrada}, {mesto|náhrada}, {source_url}, {odhlasenie}. '
      + "Najlepšie ju pošli ako odpoveď v pôvodnom vlákne v Gmaile.</div>"
    + '<div class="field"><label for="kontPripText">Text pripomienky</label><textarea id="kontPripText" rows="9">' + esc(k.pripomienka || "") + "</textarea></div>"
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
      + '<button class="rowbtn" onclick="kontPripVzor()">Vložiť vzor</button>'
      + '<button class="rowbtn" onclick="kontPripUloz(' + k.id + ')">Uložiť pripomienku</button>'
      + '<button class="rowbtn" onclick="kontNahlad(' + k.id + ',null,true)">Náhľad</button>'
      + '<label for="kontPripPocet" style="font-size:12.5px;color:var(--soft)">Koľko</label><input id="kontPripPocet" type="number" min="1" max="30" value="10" style="width:70px;padding:5px 8px;border:1px solid var(--line);border-radius:6px">'
      + '<button class="rowbtn" onclick="kontPripPriprav(' + k.id + ')"' + (k.stav === "bezi" ? "" : " disabled") + ">Pripraviť pripomienky</button></div>"
    + '<div id="kontPripSprava" style="font-size:13px;min-height:18px;margin-top:6px"></div><div id="kontPripZoznam"></div></details>';
}
function kontPripVzor(){
  const t = document.getElementById("kontPripText");
  if(t.value.trim() && t.value.trim() !== KONT_PRIPOMIENKA_VZOR){ kontSprava("kontPripSprava", "Pole nie je prázdne — vzor vkladám len do prázdneho poľa (zmaž text a skús znova).", true); return; }
  t.value = KONT_PRIPOMIENKA_VZOR;
  kontSprava("kontPripSprava", "Vzor vložený — uprav a ulož.");
}
async function kontPripUloz(kampan){
  const { error } = await sb.rpc("kampan_pripomienka_uloz", { p_kampan: kampan, p_text: document.getElementById("kontPripText").value });
  if(error) kontSprava("kontPripSprava", "Chyba: " + error.message, true); else kontSprava("kontPripSprava", "Pripomienka uložená.");
}
async function kontPripPriprav(kampan){
  try{
    const d = await kampanVolaj({ kampan, akcia:"pripomienky", pocet: +document.getElementById("kontPripPocet").value || 10 });
    _kontPripomienky = (d.emaily || []).map(e => Object.assign({ kampan }, e));
    kontPripVykresli();
    kontSprava("kontPripSprava", "Pripravených " + _kontPripomienky.length + " · dnes odoslaných " + d.dnes + "/" + d.limit + (d.dovod ? " (" + d.dovod + ")" : ""));
  }catch(e){ kontSprava("kontPripSprava", "Chyba: " + e.message, true); }
}
function kontPripVykresli(){
  const el = document.getElementById("kontPripZoznam");
  if(!el) return;
  el.innerHTML = _kontPripomienky.map((e, i) => '<div class="hint" style="display:grid;gap:6px">'
    + "<div><b>" + esc(e.email) + '</b> <span style="color:var(--soft);font-size:12px">pripomienka</span></div>'
    + '<div style="font-size:12.5px"><b>Predmet:</b> ' + esc(e.predmet) + "</div>"
    + '<details><summary style="cursor:pointer;font-size:12.5px">Text</summary><pre style="white-space:pre-wrap;font:inherit;font-size:12.5px;margin-top:6px">' + esc(e.text) + "</pre></details>"
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<a class="rowbtn" href="' + esc(kampGmailOdkaz(e)) + '" target="_blank" rel="noopener">Otvoriť v Gmaile</a>'
      + '<button class="rowbtn" onclick="kontPripKopiruj(' + i + ')">Kopírovať text</button>'
      + '<button class="rowbtn" onclick="kontPripOdoslana(' + i + ')">Pripomienka odoslaná ✓</button></div></div>').join("");
}
async function kontPripKopiruj(i){
  const e = _kontPripomienky[i];
  try{ await navigator.clipboard.writeText("Predmet: " + e.predmet + "\n\n" + e.text); kontSprava("kontPripSprava", "Skopírované: " + e.email); }
  catch(err){ kontSprava("kontPripSprava", "Kopírovanie zlyhalo: " + err.message, true); }
}
// „Odoslaná“ zapisuje až človek; server znova overí, že adresát na pripomienku ešte je.
async function kontPripOdoslana(i){
  const e = _kontPripomienky[i];
  try{
    await kampanVolaj({ kampan: e.kampan, akcia:"pripomenute", adresat: e.id });
    _kontPripomienky.splice(i, 1);
    kontPripVykresli();
    kontSprava("kontPripSprava", "Zapísaná pripomienka: " + e.email);
  }catch(err){ kontSprava("kontPripSprava", "Chyba: " + err.message, true); }
}

// ── Export výsledkov (spec 141.8 bod 6) ─────────────────────────────────────
function kontMenoSuboru(co){
  const k = (_kontVysl && _kontVysl.kampan) || {};
  const zaklad = String(k.utm_campaign || ("kampan-" + (k.id || ""))).replace(/[^a-z0-9_-]+/gi, "-");
  return zaklad + "-" + co + "-" + new Date().toISOString().slice(0, 10) + ".csv";
}
function kontExportDni(){
  if(!_kontVysl) return;
  kontStiahni(kontMenoSuboru("po-dnoch"), kontCsv(
    ["Deň", "Odoslané", "Pripomienky", "Odpovede", "Návštevy (návštevník dňa)", "Registrácie v ten istý deň"],
    (_kontVysl.po_dnoch || []).map(d => [d.den, d.odoslane, d.pripomienky, d.odpovede, d.navstevy, d.registracie])));
}
function kontExportAdresati(){
  kontStiahni(kontMenoSuboru("adresati"), kontCsv(
    ["E-mail", "Firma", "Mesto", "Stav", "Odoslané", "Pripomienka", "Odpoveď", "Odpoveď kedy", "Zdroj kontaktu", "Chyba"],
    _kontAdresati.map(x => [x.email, x.firma, x.mesto, KONT_STAVY[x.stav] || x.stav, x.odoslane_o || "", x.pripomenute_o || "",
      KONT_ODPOVEDE[x.odpoved] || "", x.odpoved_o || "", x.source_url, x.chyba || ""])));
}
