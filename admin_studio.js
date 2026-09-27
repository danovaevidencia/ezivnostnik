// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — admin: KAMPAŇOVÉ ŠTÚDIO (spec kap. 141.4, 141.5, 141.9;
//  ROZHODNUTIA č. 246–248, 251–252)
//
//  Kampaň sa skladá z blokov, nie písaním HTML. HTML vyrába JEDEN renderer
//  (`studioRender`) v tom istom markupe ako dev/kampane/uctovnici.html —
//  tabuľky, len inline štýly, 600 px — lebo presne ten prešiel vložením do
//  Gmailu (141.0). Ručný import HTML ostáva v admin_kampane.js ako núdzový.
//
//  Čo renderer drží za človeka:
//   · pätka je povinná a nedá sa upraviť ani odstrániť (OP Verteco 4.2,
//     čl. 14 GDPR, odhlásenie) — do blokov sa vôbec neukladá,
//   · odkazy sú CIELE (demo, web, cenník, článok, registrácia) a UTM doplní
//     renderer podľa kampane — ručne písané UTM sa rozíde s kampaňou,
//   · ceny sú polia {cena:…} doplnené z podmienky.html — cena napísaná
//     v šablóne by bola tretia kópia cenníka (kap. 16). Keď sa cena v
//     podmienkach nenájde, je to chyba, nie tichá náhrada.
//
//  Klasický skript, nie modul: obsluhy v onclick="…" potrebujú globálne
//  funkcie. Admin ho načíta pri otvorení sekcie Šablóny, pri sprievodcovi
//  novej kampane a v štúdiu v novom okne (#studio/<param>, č. 252).
//  Čisté funkcie (renderer, ceny, odkazy) nesiahajú na DOM — test ich
//  spúšťa v Node (dev/test/test_kampane_studio.js).
// ═══════════════════════════════════════════════════════════════════════════

const STUDIO_WEB = "https://ezivnostnik.eu/";
// Verejná adresa bucketu `kampane` (admin_52, č. 247). Tá istá je povolená
// v kampanSablonaRozober — obrázok odinakiaľ e-mailový klient nezobrazí
// spoľahlivo a my by sme nevedeli, čo adresátovi ukazuje.
const STUDIO_BUCKET = "https://jriuljhmacgvxyrptbme.supabase.co/storage/v1/object/public/kampane/";

// Rovnaký zoznam drží admin_52 (kontrola hodnôt) aj kontakty (admin_53).
const STUDIO_SKUPINY = {
  uctovnici:          "Účtovníci",
  szco_neplatitel:    "Živnostníci — neplatitelia DPH",
  szco_platitel:      "Živnostníci — platitelia DPH",
  firmy:              "Firmy",
  novi_szco:          "Noví živnostníci",
  slobodne_povolania: "Slobodné povolania",
};

// Kam smie viesť odkaz. Článok je „clanok:<slug>“ → clanky/<slug>.html.
const STUDIO_CIELE = {
  demo:        { n: "Ukážka bez registrácie (demo)", cesta: "ezivnostnik.html?vstup=demo" },
  registracia: { n: "Registrácia",                   cesta: "ezivnostnik.html?vstup=register" },
  web:         { n: "Web — úvodná stránka",          cesta: "" },
  cennik:      { n: "Cenník na webe",                cesta: "", kotva: "cennik" },
  clanky:      { n: "Zoznam článkov",                cesta: "clanky/" },
  email:       { n: "E-mail info@ezivnostnik.eu",    mailto: "info@ezivnostnik.eu" },
};

// Polia cien. Hodnoty dodá studioCeny z podmienky.html — nikdy nie odtiaľto.
const STUDIO_CENY_POLIA = {
  neplatitel:        "Neplatiteľ DPH — bez DPH",
  neplatitel_s_dph:  "Neplatiteľ DPH — s DPH",
  platitel:          "Platiteľ DPH — bez DPH",
  platitel_s_dph:    "Platiteľ DPH — s DPH",
  ucto_od:           "Účtovník od (najmenší tier) — bez DPH",
  ucto_2:            "Účtovník do 2 firiem — bez DPH",
  ucto_5:            "Účtovník do 5 firiem — bez DPH",
  ucto_10:           "Účtovník do 10 firiem — bez DPH",
  ucto_2_s_dph:      "Účtovník do 2 firiem — s DPH",
  ucto_5_s_dph:      "Účtovník do 5 firiem — s DPH",
  ucto_10_s_dph:     "Účtovník do 10 firiem — s DPH",
  priznanie_b_s_dph: "Daňové priznanie typ B (jednorazovo) — s DPH",
};

const STUDIO_BLOKY = {
  hlavicka: { n: "Hlavička s logom",           novy: () => ({ typ: "hlavicka" }) },
  odsek:    { n: "Odsek",                      novy: () => ({ typ: "odsek", text: "" }) },
  box:      { n: "Zvýraznený box",             novy: () => ({ typ: "box", nadpis: "", text: "" }) },
  obrazok:  { n: "Obrázok / GIF",              novy: () => ({ typ: "obrazok", src: "", alt: "", popis: "", ciel: "demo", sirka: 560 }) },
  body:     { n: "Očíslované body",            novy: () => ({ typ: "body", nadpis: "", polozky: [""] }) },
  tlacidlo: { n: "Tlačidlo",                   novy: () => ({ typ: "tlacidlo", text: "Pozrieť ukážku bez registrácie →", ciel: "demo" }) },
  poznamka: { n: "Poznámka pod tlačidlom",     novy: () => ({ typ: "poznamka", text: "" }) },
  podpis:   { n: "Podpis",                     novy: () => ({ typ: "podpis", uvod: "", pozdrav: "S pozdravom", meno: "Ing. Roman Slivka",
                                                             rola: "eživnostník — účtovníctvo a e-faktúry pre živnostníkov" }) },
};

// Pätka — needitovateľná. Veta o doručovacej službe je doslova tá z
// dev/kampane/uctovnici.html a textovej šablóny (OP Verteco 4.2: nikde
// „certifikovaný sprostredkovateľ“); stráži test_kampane_studio.
const STUDIO_PATKA_SLUZBA = "Doručovaciu službu e-faktúr poskytuje Ing. Roman Slivka - agile management ako sprostredkovateľ zapísaný v zozname Finančnej správy SR; technicky ju zabezpečuje certifikovaný poskytovateľ Verteco digital services, s. r. o. (EFSK000031).";

// Vymyslený adresát pre náhľad (141.5 f).
const STUDIO_UKAZKA = { firma: "Účtovníctvo Vzorová s. r. o.", mesto: "Trnava",
  source_url: "www.priklad-uctovnictvo.sk/kontakt", odhlasenie: "#" };

// ── Čisté pomôcky ──────────────────────────────────────────────────────────
function studioEsc(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
// utm_campaign zo slugu názvu (141.4): bez diakritiky, malé písmená, pomlčky.
function studioSlug(s){
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// Ceny z podmienok (tabuľka „5. Plány a ceny“ a veta „Bez DPH ide o …“).
// Vracia { ceny: { kluc: "9,90 €" }, chyby: [...] }. Každá cena sa berie
// z jedného miesta a čísla s DPH a bez DPH sa navzájom overia — keby sa
// podmienky zmenili len na jednom mieste, šablóna nesmie potichu ponúknuť
// ktorékoľvek z nich.
function studioCeny(podmienky){
  const t = " " + String(podmienky || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ") + " ";
  const ceny = {}, chyby = [];
  const S = "(\\d+,\\d\\d) €";
  const najdi = (vzor, popis) => { const m = t.match(new RegExp(vzor)); if(!m) chyby.push("v podmienkach sa nenašlo: " + popis); return m; };
  const bez = najdi("Bez DPH ide o " + S + " mesačne pri pláne Neplatiteľ DPH, " + S + " mesačne pri pláne Platiteľ DPH a "
    + S + ", " + S + " alebo " + S + " mesačne pri pláne Účtovník", "veta „Bez DPH ide o …“");
  const nep = najdi(" Neplatiteľ DPH " + S + " / mesiac", "riadok Neplatiteľ DPH v tabuľke cien");
  const pla = najdi(" Platiteľ DPH " + S + " / mesiac", "riadok Platiteľ DPH v tabuľke cien");
  const uct = najdi(" Účtovník " + S + " / mesiac \\(do 2 firiem\\) " + S + " / mesiac \\(do 5 firiem\\) " + S + " / mesiac \\(do 10 firiem\\)",
    "riadok Účtovník v tabuľke cien");
  const dpb = najdi(" Daňové priznanie typ B " + S + " jednorazovo", "doplnok Daňové priznanie typ B");
  const e = x => x + " €";
  if(bez){
    ceny.neplatitel = e(bez[1]); ceny.platitel = e(bez[2]);
    ceny.ucto_2 = e(bez[3]); ceny.ucto_5 = e(bez[4]); ceny.ucto_10 = e(bez[5]); ceny.ucto_od = e(bez[3]);
  }
  if(nep) ceny.neplatitel_s_dph = e(nep[1]);
  if(pla) ceny.platitel_s_dph = e(pla[1]);
  if(uct){ ceny.ucto_2_s_dph = e(uct[1]); ceny.ucto_5_s_dph = e(uct[2]); ceny.ucto_10_s_dph = e(uct[3]); }
  if(dpb) ceny.priznanie_b_s_dph = e(dpb[1]);
  // Suma s DPH / 1,23 musí dať sumu bez DPH (na cent). Inak podmienky
  // hovoria dve rôzne ceny a e-mail by jednu z nich sľúbil.
  const cislo = x => +String(x).replace(" €", "").replace(",", ".");
  [["neplatitel", "neplatitel_s_dph"], ["platitel", "platitel_s_dph"], ["ucto_2", "ucto_2_s_dph"],
   ["ucto_5", "ucto_5_s_dph"], ["ucto_10", "ucto_10_s_dph"]].forEach(([b, s]) => {
    if(ceny[b] && ceny[s] && Math.abs(cislo(ceny[s]) / 1.23 - cislo(ceny[b])) > 0.006)
      chyby.push("podmienky si protirečia: " + ceny[s] + " s DPH nie je " + ceny[b] + " bez DPH (" + b + ")");
  });
  return { ceny, chyby };
}

// Cieľ → adresa s UTM. { url } alebo { chyba }.
function studioOdkaz(ciel, o){
  const c = String(ciel || "");
  let cesta, kotva = "";
  if(c.startsWith("clanok:")){
    const slug = c.slice(7);
    if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { chyba: "neplatný článok v odkaze: " + c };
    cesta = "clanky/" + slug + ".html";
  } else {
    const d = STUDIO_CIELE[c];
    if(!d) return { chyba: "neznámy cieľ odkazu: " + (c || "(prázdny)") };
    if(d.mailto) return { url: "mailto:" + d.mailto };
    cesta = d.cesta;
    kotva = d.kotva ? "#" + d.kotva : "";
  }
  const utm = "utm_source=email&utm_medium=" + (o && o.sposob === "hromadne" ? "kampan" : "osobne")
    + "&utm_campaign=" + encodeURIComponent((o && o.utm) || "");
  return { url: STUDIO_WEB + cesta + (cesta.includes("?") ? "&" : "?") + utm + kotva };
}

// Pole v zložených zátvorkách: {cena:…}, {firma|náhrada}, {mesto|náhrada}.
// `hodnota` je už escapovaná (studioInline escapuje pred rozborom).
function studioPole(pole, ctx){
  let m = pole.match(/^cena:([a-z0-9_]+)$/);
  if(m){
    if(!STUDIO_CENY_POLIA[m[1]]){ ctx.chyba("neznáma cena {cena:" + m[1] + "}"); return "{" + pole + "}"; }
    if(!ctx.o.ceny){ ctx.chyba("ceny sa nenačítali z podmienok — {cena:" + m[1] + "} sa nedá doplniť"); return "{" + pole + "}"; }
    const v = ctx.o.ceny[m[1]];
    if(!v){ ctx.chyba("cena {cena:" + m[1] + "} sa v podmienkach nenašla"); return "{" + pole + "}"; }
    return studioEsc(v);
  }
  m = pole.match(/^(firma|mesto)\|(.*)$/);
  if(m){
    if(!m[2].trim()){ ctx.chyba("pole {" + m[1] + "|…} potrebuje náhradu pre adresáta bez údaja"); return "{" + pole + "}"; }
    ctx.personalizacia = true;
    if(ctx.o.polia) return ctx.o.polia[m[1]] ? studioEsc(ctx.o.polia[m[1]]) : m[2];
    return "{" + pole + "}";
  }
  if(pole === "firma" || pole === "mesto"){ ctx.chyba("pole {" + pole + "} potrebuje náhradu: {" + pole + "|…}"); return "{" + pole + "}"; }
  if(pole === "source_url" || pole === "odhlasenie"){ ctx.chyba("{" + pole + "} patrí do pätky — tá je v každom e-maile sama"); return "{" + pole + "}"; }
  ctx.chyba("neznáme pole {" + pole + "}");
  return "{" + pole + "}";
}

// Riadkový text: escapovanie, polia, odkazy [text](cieľ), tučné **text**.
function studioInline(text, ctx, bezOdkazov){
  const zdroj = String(text == null ? "" : text);
  if(/https?:\/\/|www\./i.test(zdroj)) ctx.chyba("adresu do textu nepíš — odkaz vlož ako [text](cieľ), UTM doplní štúdio");
  if(/certifikovan\S* sprostredkovate/i.test(zdroj)) ctx.chyba("„certifikovaný sprostredkovateľ“ nesmieme o sebe písať (OP Verteco 4.2)");
  if((zdroj.split("**").length - 1) % 2) ctx.chyba("nezatvorené ** (tučné)");
  let s = studioEsc(zdroj).replace(/\{([^{}]*)\}/g, (_m, pole) => studioPole(pole, ctx));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]*)\)/g, (m, t, c) => {
    if(bezOdkazov){ ctx.chyba("v tomto poli odkaz nemôže byť"); return t; }
    const r = studioOdkaz(c, ctx.o);
    if(r.chyba){ ctx.chyba(r.chyba); return m; }
    return '<a href="' + studioEsc(r.url) + '" style="color:#1f5fa8;text-decoration:underline">' + t + "</a>";
  });
  return s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
}
function studioOdseky(text, ctx, okraj){
  const ods = String(text || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  if(!ods.length) ctx.chyba("prázdny text");
  return ods.map(p => '<p style="margin:0 0 ' + okraj + 'px">' + studioInline(p, ctx).split("\n").join("<br>") + "</p>");
}
function studioSrcChyba(src){
  const s = String(src || "");
  if(!s) return "obrázok ešte nie je — vyber snímku z návodov, zlož GIF alebo nahraj vlastný";
  if(s.includes("..") || !(s.startsWith(STUDIO_WEB) || s.startsWith(STUDIO_BUCKET)))
    return "obrázok musí byť z ezivnostnik.eu alebo z bucketu kampaní: " + s;
  return "";
}

// ── Bloky → markup uctovnici.html ──────────────────────────────────────────
const STUDIO_RENDER = {
  hlavicka(){
    return '  <tr><td style="padding:22px 28px 18px;border-bottom:1px solid #e2e8f1">\n'
      + '    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>\n'
      + '      <td style="vertical-align:middle;padding-right:10px"><img src="' + STUDIO_WEB + 'icon-192.png" width="36" height="36" alt="eživnostník" style="display:block;border:0;border-radius:9px"></td>\n'
      + '      <td style="vertical-align:middle;font-size:19px;font-weight:700;color:#1f5fa8;letter-spacing:-0.2px">eživnostník</td>\n'
      + "    </tr></table>\n  </td></tr>";
  },
  odsek(b, ctx){
    const hore = ctx.predosly && ctx.predosly.typ === "hlavicka" ? 26 : 6;
    return '  <tr><td style="padding:' + hore + 'px 28px 6px;font-size:15px;line-height:1.6">\n    '
      + studioOdseky(b.text, ctx, 14).join("\n    ") + "\n  </td></tr>";
  },
  box(b, ctx){
    if(!String(b.nadpis || "").trim() && !String(b.text || "").trim()) ctx.chyba("box nemá nadpis ani text");
    return '  <tr><td style="padding:6px 28px 18px">\n'
      + '    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#e4edf8;border-left:4px solid #f08a24;border-radius:10px">\n'
      + '      <tr><td style="padding:16px 18px;font-size:15px;line-height:1.55;color:#131c2b">\n'
      + (String(b.nadpis || "").trim() ? '        <div style="font-size:17px;font-weight:700;color:#164883;margin:0 0 6px">' + studioInline(b.nadpis, ctx) + "</div>\n" : "")
      + "        " + studioInline(b.text, ctx).split("\n").join("<br>") + "\n"
      + "      </td></tr>\n    </table>\n  </td></tr>";
  },
  obrazok(b, ctx){
    const chyba = studioSrcChyba(b.src);
    const sirka = Math.max(120, Math.min(560, +b.sirka || 560));
    if(!String(b.alt || "").trim()) ctx.chyba("obrázok potrebuje popis pre čítačky a vypnuté obrázky (alt)");
    let obr;
    if(chyba){
      ctx.chyba(chyba);
      obr = '<div style="border:2px dashed #d3dce8;border-radius:10px;padding:40px 12px;color:#5b6779;font-size:13px">Sem príde obrázok</div>';
    } else {
      obr = '<img src="' + studioEsc(b.src) + '" width="' + sirka + '" alt="' + studioEsc(b.alt) + '" style="display:block;width:100%;max-width:'
        + sirka + 'px;height:auto;border:1px solid #d3dce8;border-radius:10px">';
    }
    if(b.ciel){
      const r = studioOdkaz(b.ciel, ctx.o);
      if(r.chyba) ctx.chyba(r.chyba);
      else obr = '<a href="' + studioEsc(r.url) + '" style="text-decoration:none">\n      ' + obr + "\n    </a>";
    }
    const popis = String(b.popis || "").trim();
    return '  <tr><td style="padding:0 20px ' + (popis ? 6 : 18) + 'px" align="center">\n    ' + obr + "\n  </td></tr>"
      + (popis ? '\n  <tr><td style="padding:0 28px 18px;font-size:12.5px;line-height:1.5;color:#5b6779" align="center">' + studioInline(popis, ctx) + "</td></tr>" : "");
  },
  body(b, ctx){
    const polozky = (Array.isArray(b.polozky) ? b.polozky : []).map(x => String(x || "").trim()).filter(Boolean);
    if(!polozky.length) ctx.chyba("žiadny bod");
    if(polozky.length > 6) ctx.chyba("viac ako 6 bodov — e-mail sa číta na telefóne, skráť ho");
    const nadpis = String(b.nadpis || "").trim();
    return (nadpis ? '  <tr><td style="padding:4px 28px 4px;font-size:15px;line-height:1.6">\n'
        + '    <p style="margin:0 0 12px;font-weight:700;font-size:16px;color:#131c2b">' + studioInline(nadpis, ctx) + "</p>\n  </td></tr>\n" : "")
      + '  <tr><td style="padding:0 28px">\n'
      + '    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14.5px;line-height:1.55;color:#131c2b">\n'
      + polozky.map((p, i) => "      <tr>\n"
        + '        <td width="34" style="vertical-align:top;padding:2px 0 14px"><div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:#1f5fa8;color:#ffffff;font-size:13px;font-weight:700;text-align:center">' + (i + 1) + "</div></td>\n"
        + '        <td style="vertical-align:top;padding:0 0 14px">' + studioInline(p, ctx) + "</td>\n      </tr>\n").join("")
      + "    </table>\n  </td></tr>";
  },
  tlacidlo(b, ctx){
    if(!String(b.text || "").trim()) ctx.chyba("tlačidlo bez textu");
    const r = studioOdkaz(b.ciel, ctx.o);
    if(r.chyba) ctx.chyba(r.chyba);
    return '  <tr><td style="padding:10px 28px 8px" align="center">\n'
      + '    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr>\n'
      + '      <td style="border-radius:10px;background:#1f5fa8">\n'
      + '        <a href="' + studioEsc(r.url || "#") + '" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">'
      + studioInline(b.text, ctx, true) + "</a>\n"
      + "      </td>\n    </tr></table>\n  </td></tr>";
  },
  poznamka(b, ctx){
    if(!String(b.text || "").trim()) ctx.chyba("prázdna poznámka");
    return '  <tr><td style="padding:0 28px 22px;font-size:13px;line-height:1.5;color:#5b6779" align="center">' + studioInline(b.text, ctx) + "</td></tr>";
  },
  podpis(b, ctx){
    if(!String(b.meno || "").trim()) ctx.chyba("podpis bez mena");
    const web = studioOdkaz("web", ctx.o);
    return '  <tr><td style="padding:0 28px 24px;font-size:15px;line-height:1.6">\n'
      + (String(b.uvod || "").trim() ? "    " + studioOdseky(b.uvod, ctx, 14).join("\n    ") + "\n" : "")
      + '    <p style="margin:0 0 4px">' + studioInline(b.pozdrav || "S pozdravom", ctx, true) + "</p>\n"
      + '    <p style="margin:0;line-height:1.5"><b>' + studioInline(b.meno, ctx, true) + "</b><br>\n"
      + (String(b.rola || "").trim() ? '      <span style="color:#5b6779">' + studioInline(b.rola, ctx, true) + "</span><br>\n" : "")
      + '      <a href="mailto:info@ezivnostnik.eu" style="color:#1f5fa8;text-decoration:none">info@ezivnostnik.eu</a> · <a href="'
      + studioEsc(web.url) + '" style="color:#1f5fa8;text-decoration:none">ezivnostnik.eu</a></p>\n'
      + "  </td></tr>";
  },
};
function studioPatka(o){
  const zdroj = o.polia ? studioEsc(o.polia.source_url) : "{source_url}";
  const odhl = o.polia ? studioEsc(o.polia.odhlasenie) : "{odhlasenie}";
  return '  <tr><td style="padding:16px 28px 22px;border-top:1px solid #e2e8f1;font-size:12px;line-height:1.55;color:#5b6779">\n'
    + '    <p style="margin:0 0 8px">' + studioEsc(STUDIO_PATKA_SLUZBA) + "</p>\n"
    + '    <p style="margin:0">Váš kontakt som našiel na ' + zdroj + '. Ak si neželáte ďalšie správy, <a href="' + odhl
    + '" style="color:#5b6779;text-decoration:underline">odhlásite sa jedným klikom</a>.</p>\n'
    + "  </td></tr>";
}

// JEDEN renderer. volby: { ceny, utm, sposob: "rucne"|"hromadne",
// polia: null (uloží sa s poľami) | { firma, mesto, source_url, odhlasenie } }.
// Vracia { predmet, telo, html, chyby: [{blok, text}], varovania }. blok -1 =
// celá šablóna. `telo` ide do kampane.telo, `html` je celý dokument
// (<title> = predmet) v tvare, ktorý prijme kampanSablonaRozober.
function studioRender(sablona, volby){
  const s = sablona || {}, v = volby || {};
  const chyby = [], varovania = [];
  const o = { utm: v.utm || s.kod || s.skupina || "kampan", sposob: v.sposob === "hromadne" ? "hromadne" : "rucne",
              ceny: v.ceny || null, polia: v.polia || null };
  if(!/^[a-z0-9][a-z0-9_-]*$/.test(o.utm)) chyby.push({ blok: -1, text: "utm_campaign môže mať len malé písmená, číslice, pomlčku a podčiarkovník" });
  const bloky = Array.isArray(s.bloky) ? s.bloky : [];
  let personalizacia = false;
  const casti = [];
  bloky.forEach((b, i) => {
    const ctx = { o, chyba: t => chyby.push({ blok: i, text: t }), predosly: i ? bloky[i - 1] : null };
    const r = b && STUDIO_RENDER[b.typ];
    if(!r){ ctx.chyba("neznámy blok: " + (b && b.typ)); return; }
    casti.push(r(b, ctx));
    if(ctx.personalizacia) personalizacia = true;
  });
  if(!bloky.length) chyby.push({ blok: -1, text: "šablóna nemá žiadny blok" });
  if(bloky.length && bloky[0] && bloky[0].typ !== "hlavicka") varovania.push("hlavička s logom nie je prvá — adresát nevidí hneď, od koho e-mail je");
  if(!bloky.some(b => b && b.typ === "podpis")) varovania.push("chýba podpis — osobný e-mail bez podpisu pôsobí ako hromadný");
  if(!bloky.some(b => b && (b.typ === "tlacidlo" || (b.typ === "obrazok" && b.ciel)))) varovania.push("e-mail nemá tlačidlo ani obrázok s odkazom");
  casti.push(studioPatka(o));   // vždy — pätka sa z blokov odstrániť nedá

  const pctx = { o, chyba: t => chyby.push({ blok: -1, text: "predmet: " + t }) };
  const predmetZdroj = String(s.predmet || "").trim();
  if(!predmetZdroj) chyby.push({ blok: -1, text: "chýba predmet e-mailu" });
  if(/[*\[\]]/.test(predmetZdroj)) chyby.push({ blok: -1, text: "predmet je čistý text — bez ** a odkazov" });
  const predmet = predmetZdroj.replace(/\{([^{}]*)\}/g, (_m, pole) => {
    const x = studioPole(pole, pctx);
    return x.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  });
  if(pctx.personalizacia) personalizacia = true;
  if(predmet.length > 78) varovania.push("predmet má " + predmet.length + " znakov — Gmail na telefóne ukáže asi 40, na počítači okolo 70");
  if(personalizacia && !o.polia) varovania.push("šablóna používa {firma|…} / {mesto|…} — doplní ich server (kampan-posli) až s personalizáciou (spec 141.8 bod 4)");

  const telo = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2f7;border-collapse:collapse">\n'
    + '<tr><td align="center" style="padding:24px 12px">\n\n'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;background:#ffffff;border-radius:14px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#131c2b">\n\n'
    + casti.join("\n\n") + "\n\n</table>\n</td></tr>\n</table>";
  if(telo.length > 100000) chyby.push({ blok: -1, text: "telo má " + telo.length + " znakov — Gmail dlhé správy skracuje" });
  const html = '<!DOCTYPE html>\n<html lang="sk">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + "<title>" + studioEsc(predmet) + "</title>\n</head>\n"
    + '<body style="margin:0;padding:0;background:#eef2f7">\n' + telo + "\n</body>\n</html>\n";
  return { predmet, telo, html, chyby, varovania };
}

// Predpripravená šablóna zo súboru dev/kampane/sablony/<kod>.json (č. 248).
function studioOverSubor(x){
  const chyby = [];
  if(!x || typeof x !== "object") return ["nie je to objekt"];
  if(!/^[a-z0-9_]{2,40}$/.test(x.kod || "")) chyby.push("kod: malé písmená, číslice, podčiarkovník");
  if(!String(x.nazov || "").trim()) chyby.push("chýba názov");
  if(!STUDIO_SKUPINY[x.skupina]) chyby.push("neznáma skupina: " + x.skupina);
  if(typeof x.predmet !== "string") chyby.push("chýba predmet");
  if(!Array.isArray(x.bloky) || !x.bloky.length) chyby.push("chýbajú bloky");
  else x.bloky.forEach((b, i) => { if(!b || !STUDIO_BLOKY[b.typ]) chyby.push("blok " + (i + 1) + ": neznámy typ " + (b && b.typ)); });
  if(x.otazky != null && (!Array.isArray(x.otazky) || x.otazky.some(q => typeof q !== "string"))) chyby.push("otázky musia byť zoznam textov");
  return chyby;
}

// ═══════════════════════════════════════════════════════════════════════════
//  UI — všetko nižšie pracuje s DOM a so sb (globálne z admin.html).
//  Farby výhradne z tokenov palety (var(--…)), nie pevné (spec 141.2).
//  Žiadne alert/prompt/confirm — okná štúdia (Roman: „nie hlášky ako
//  nástroj z 90. rokov“).
// ═══════════════════════════════════════════════════════════════════════════
let _st = null;           // otvorené štúdio: { el, param, rezim, s, povodna, kampan, nahlad }
let _stZoznam = [];       // knižnica šablón
let _stCeny = null;       // { ceny, chyby } z podmienky.html
let _stTimer = null, _stDialogZrus = null, _stClanky = null;

function studioCss(){
  if(document.getElementById("studioCss")) return;
  const st = document.createElement("style");
  st.id = "studioCss";
  st.textContent = [
    ".stHlava{display:grid;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line)}",
    ".stRad{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}",
    ".stRad .field{margin:0;flex:1;min-width:180px}",
    ".stMriezka{display:grid;grid-template-columns:minmax(300px,1fr) minmax(0,664px);gap:16px;padding:14px 18px;align-items:start}",
    "@media(max-width:1150px){.stMriezka{grid-template-columns:1fr}}",
    ".stBlok{border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:10px 12px;margin-bottom:10px}",
    ".stBlok.zle{border-color:var(--neg);border-left:4px solid var(--neg)}",
    ".stBlok.zamknuty{background:var(--panel2);border-style:dashed}",
    ".stBlokHlava{display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:13px;color:var(--ink)}",
    ".stBlokHlava .sp{flex:1}",
    ".stBlok .field{margin-bottom:8px}",
    ".stBlok .field label{text-transform:none;letter-spacing:0;font-size:12px}",
    ".stChyby{color:var(--neg);font-size:12.5px;line-height:1.45}",
    ".stVar{color:var(--warn);font-size:12.5px;line-height:1.45}",
    ".stNastroje{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 5px}",
    ".stNastroje button{background:var(--panel2);border:1px solid var(--line);color:var(--ink);border-radius:6px;padding:3px 9px;font-size:12px;cursor:pointer}",
    ".stNastroje button:hover{border-color:var(--accent)}",
    ".stNahlad{position:sticky;top:calc(var(--top) + 10px)}",
    "body.studio .stNahlad{top:calc(var(--top) + 10px)}",
    ".stRam{display:block;margin:8px auto 0;border:1px solid var(--line);border-radius:10px;background:var(--panel);width:640px;max-width:100%;height:900px}",
    ".stRam.m{width:390px}",
    ".stPrep{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}",
    ".stPrep button{background:var(--panel);border:none;color:var(--ink);padding:6px 12px;font-size:13px;cursor:pointer}",
    ".stPrep button.on{background:var(--accent);color:var(--panel)}",
    ".stRiadok{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid var(--line)}",
    ".stRiadok .sp{flex:1}",
    ".stStitok{display:inline-block;font-size:11.5px;border-radius:999px;padding:1px 8px;background:var(--panel2);color:var(--soft);border:1px solid var(--line)}",
    ".stStitok.zle{color:var(--neg);border-color:var(--neg)}",
    ".stStitok.var{color:var(--warn);border-color:var(--warn)}",
    ".stStitok.ok{color:var(--accent2);border-color:var(--accent2)}",
    ".stVolba{display:block;border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;color:var(--ink)}",
    ".stVolba.zvol{border-color:var(--accent);background:var(--accent-lite)}",
    ".stVolba.vyp{cursor:not-allowed;border-style:dashed;background:var(--panel2)}",
    ".stVolba input{margin-right:8px;accent-color:var(--accent)}",
    ".stVolba .muted{display:block;margin:4px 0 0 24px}",
    ".stSnimky{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;max-height:46vh;overflow:auto;padding:2px}",
    ".stSnimky button{border:2px solid var(--line);border-radius:8px;background:var(--panel);padding:4px;cursor:pointer;text-align:left;font-size:11px;color:var(--ink)}",
    ".stSnimky button.zvol{border-color:var(--accent)}",
    ".stSnimky img{width:100%;display:block;border-radius:4px}",
    ".stObr{max-width:100%;border:1px solid var(--line);border-radius:8px;display:block}",
    ".stZaber{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin-bottom:6px}",
    ".stZaber img{width:84px;border-radius:4px;border:1px solid var(--line)}",
    "#stDialog .box{max-height:92vh}",
  ].join("\n");
  document.head.appendChild(st);
}

// ── Okná (namiesto alert/prompt/confirm) ───────────────────────────────────
function studioDialogZavri(){
  const m = document.getElementById("stDialog");
  if(m) m.remove();
  const z = _stDialogZrus; _stDialogZrus = null;
  if(z) z();
}
function studioDialog(nadpis, teloHtml, tlacidla, sirka, priZruseni){
  studioCss();
  studioDialogZavri();
  const m = document.createElement("div");
  m.className = "modal on";
  m.id = "stDialog";
  m.setAttribute("role", "dialog");
  m.setAttribute("aria-modal", "true");
  m.innerHTML = '<div class="box" style="max-width:' + (sirka || 520) + 'px"><div class="mh"><h3>' + studioEsc(nadpis)
    + '</h3><button class="x" aria-label="Zavrieť">×</button></div><div class="mb">' + teloHtml + '</div><div class="mf"></div></div>';
  const mf = m.querySelector(".mf");
  (tlacidla || []).forEach(t => {
    const b = document.createElement("button");
    b.className = t.hlavne ? "btn" : "rowbtn";
    if(t.hlavne) b.style.width = "auto";
    b.textContent = t.text;
    if(t.id) b.id = t.id;
    b.onclick = t.akcia;
    mf.appendChild(b);
  });
  m.querySelector(".x").onclick = studioDialogZavri;
  document.body.appendChild(m);
  _stDialogZrus = priZruseni || null;
  return m;
}
function studioPotvrd(text, ano){
  return new Promise(ok => {
    studioDialog("Potvrdenie", '<p style="line-height:1.55">' + studioEsc(text) + "</p>", [
      { text: "Späť", akcia: () => studioDialogZavri() },
      { text: ano || "Pokračovať", hlavne: true, akcia: () => { _stDialogZrus = null; studioDialogZavri(); ok(true); } },
    ], 440, () => ok(false));
  });
}
function studioOznam(text, zle){
  const el = document.getElementById("stStav");
  if(el){ el.textContent = text; el.style.color = zle ? "var(--neg)" : "var(--accent2)"; }
}

// ── Dáta ───────────────────────────────────────────────────────────────────
async function studioNacitajZoznam(){
  const { data, error } = await sb.rpc("kampan_sablony_zoznam");
  if(error) throw new Error("knižnica šablón sa nenačítala (je spustená migrácia admin_52?): " + error.message);
  _stZoznam = Array.isArray(data) ? data : [];
  return _stZoznam;
}
async function studioNacitajCeny(){
  if(_stCeny) return _stCeny;
  try{
    const r = await fetch("podmienky.html", { cache: "no-store" });
    if(!r.ok) throw new Error("HTTP " + r.status);
    _stCeny = studioCeny(await r.text());
  }catch(e){
    _stCeny = { ceny: null, chyby: ["podmienky.html sa nenačítali: " + e.message] };
  }
  return _stCeny;
}
// Hromadné odosielanie je dostupné len s nastaveným poskytovateľom (141.4).
// kampan-posli to povie akciou „poskytovatel“; kým ju nepozná, platí
// „nedostupné“ — radšej zamknúť než ponúknuť cestu, ktorá nič nepošle.
async function studioPoskytovatel(){
  try{
    const { data, error } = await sb.functions.invoke("kampan-posli", { body: { akcia: "poskytovatel" } });
    if(error || !data || !data.posta) return { ok: false, dovod: "poskytovateľ sa nedá overiť (kampan-posli nepozná akciu „poskytovatel“)" };
    if(data.posta === "test") return { ok: false, dovod: "poskytovateľ nie je nastavený (KAMPAN_POSTA = test)" };
    return { ok: true, posta: data.posta };
  }catch(e){ return { ok: false, dovod: "poskytovateľ sa nedá overiť: " + e.message }; }
}

// ── Vstup: sekcia Šablóny, nové okno, sprievodca ───────────────────────────
function studioOtvor(parameter){
  return studioKresli(document.getElementById("studioBody"), parameter || "");
}
function nacitajSablony(){
  return studioKresli(document.getElementById("sablBody"), "");
}
function studioVNovomOkne(param){
  window.open("admin.html#studio/" + (param || ""), "_blank");
}
function studioChod(param){
  if(document.body.classList.contains("studio")) location.hash = "studio/" + param;
  else studioKresli(_st ? _st.el : document.getElementById("sablBody"), param);
}
function studioZmenene(){
  return !!(_st && _st.rezim === "sablona" && _st.povodna !== JSON.stringify(studioNaUlozenie(_st.s)));
}
// Zavretie okna s neuloženou šablónou (štúdio v novom okne sa zatvára ľahko).
if(typeof window !== "undefined" && window.addEventListener)
  window.addEventListener("beforeunload", e => { if(studioZmenene()){ e.preventDefault(); e.returnValue = ""; } });

async function studioKresli(el, param){
  if(!el) return;
  studioCss();
  if(studioZmenene() && _st.el === el && !(await studioPotvrd("V šablóne sú neuložené zmeny. Zahodiť ich?", "Zahodiť zmeny"))) return;
  // Štúdio kreslí buď do sekcie Šablóny, alebo do plochy nového okna — nikdy
  // do oboch: rovnaké id prvkov dvakrát by priebežné kontroly zapisovali do
  // skrytej kópie. Druhá plocha sa vyprázdni a sekcia sa pri návrate načíta znova.
  ["sablBody", "studioBody"].forEach(id => {
    const ina = document.getElementById(id);
    if(ina && ina !== el && ina.querySelector("[id^=st]")){
      ina.innerHTML = "";
      if(id === "sablBody" && typeof _adminNacitane === "object") _adminNacitane.sablony = false;
    }
  });
  _st = { el, param: param || "", rezim: "", nahlad: _st ? _st.nahlad : "d" };
  el.innerHTML = '<div class="loading">Načítavam štúdio…</div>';
  try{
    await studioNacitajCeny();
    const p = _st.param;
    if(!p) return await studioKniznica();
    if(p === "novy") return studioEditor(studioNovaSablona());
    if(/^s\d+$/.test(p)){
      await studioNacitajZoznam();
      const s = _stZoznam.find(x => x.id === +p.slice(1));
      if(!s){ el.innerHTML = '<div class="loading">Šablóna ' + studioEsc(p.slice(1)) + " neexistuje.</div>"; return; }
      return studioEditor(JSON.parse(JSON.stringify(s)));
    }
    if(/^k\d+$/.test(p)) return await studioKampan(+p.slice(1));
    el.innerHTML = '<div class="loading">Neznáma adresa štúdia: ' + studioEsc(p) + "</div>";
  }catch(e){
    console.error("štúdio:", e);
    el.innerHTML = '<div class="loading">Štúdio sa nenačítalo: ' + studioEsc(e.message) + "</div>";
  }
}
function studioNovaSablona(){
  return { id: null, kod: null, nazov: "", skupina: "szco_neplatitel", predmet: "", otazky: [], verzia: null,
    bloky: ["hlavicka", "odsek", "box", "tlacidlo", "poznamka", "podpis"].map(t => STUDIO_BLOKY[t].novy()) };
}
function studioNaUlozenie(s){
  return { id: s.id || null, verzia: s.verzia || null, nazov: s.nazov, skupina: s.skupina, predmet: s.predmet,
    bloky: s.bloky, otazky: s.otazky || [] };
}

// ── Knižnica ───────────────────────────────────────────────────────────────
async function studioKniznica(){
  _st.rezim = "kniznica";
  let zoznam = [], chyba = "";
  try{ zoznam = await studioNacitajZoznam(); }catch(e){ chyba = e.message; }
  const novOkno = document.body.classList.contains("studio");
  const cenyChyba = _stCeny && _stCeny.chyby.length ? '<div class="hint warn">Ceny: ' + studioEsc(_stCeny.chyby.join(" · ")) + "</div>" : "";
  const riadky = zoznam.map(s => {
    const r = studioRender(s, { ceny: _stCeny && _stCeny.ceny });
    const stav = (s.otazky && s.otazky.length ? '<span class="stStitok var">otázky: ' + s.otazky.length + "</span> " : "")
      + (r.chyby.length ? '<span class="stStitok zle">chyby: ' + r.chyby.length + "</span>" : '<span class="stStitok ok">pripravená</span>');
    return '<div class="stRiadok"><div style="min-width:0;flex:1 1 260px"><b>' + studioEsc(s.nazov) + "</b> "
      + '<span class="stStitok">' + studioEsc(STUDIO_SKUPINY[s.skupina] || s.skupina) + "</span> " + stav
      + '<div class="muted" style="margin-top:3px">' + studioEsc(s.predmet || "(bez predmetu)") + " · verzia " + s.verzia
      + (s.kampane ? " · kampane: " + s.kampane : "") + "</div></div>"
      + '<button class="rowbtn" onclick="studioChod(\'s' + s.id + '\')">Upraviť</button>'
      + '<button class="rowbtn" onclick="studioVNovomOkne(\'s' + s.id + '\')" title="Štúdio na celú šírku v novom okne">Nové okno ↗</button>'
      + '<button class="rowbtn" onclick="studioDuplikuj(' + s.id + ')">Duplikovať</button>'
      + '<button class="rowbtn" onclick="studioZmaz(' + s.id + ')">Zmazať</button></div>';
  }).join("");
  _st.el.innerHTML = (novOkno ? '<div class="head"><h2>Šablóny kampaní</h2></div>' : "")
    + '<div class="stRiadok">'
    + '<button class="btn" style="width:auto" onclick="studioChod(\'novy\')">+ Nová šablóna</button>'
    + '<button class="rowbtn" onclick="document.getElementById(\'stSeed\').click()">Načítať predpripravené…</button>'
    + '<input type="file" id="stSeed" accept=".json,application/json" multiple hidden onchange="studioSeedImport(this)">'
    + (novOkno ? "" : '<button class="rowbtn" onclick="studioVNovomOkne(\'\')">Otvoriť štúdio v novom okne ↗</button>')
    + '<div class="sp"></div><span id="stStav" style="font-size:13px"></span></div>'
    + '<div style="padding:0 18px">' + cenyChyba
    + '<div class="hint">Šablóny majú <b>vlastný podpis</b> (č. 251). V Gmaile preto pre nové e-maily z info@ezivnostnik.eu nastav v podpise <b>„Bez podpisu“</b> — inak bude pod e-mailom podpis dvakrát.</div>'
    + (chyba ? '<div class="hint warn">' + studioEsc(chyba) + "</div>" : "") + "</div>"
    + (riadky || (chyba ? "" : '<div class="empty">Knižnica je prázdna. <b>Načítať predpripravené…</b> a vyber súbory <span class="mono">dev/kampane/sablony/*.json</span>.</div>'));
}
async function studioDuplikuj(id){
  const s = _stZoznam.find(x => x.id === id);
  if(!s) return;
  const kopia = studioNaUlozenie(JSON.parse(JSON.stringify(s)));
  delete kopia.id; delete kopia.verzia;
  kopia.nazov = s.nazov + " (kópia)";
  const { error } = await sb.rpc("kampan_sablona_uloz", { p: kopia });
  if(error){ studioOznam("Chyba: " + error.message, true); return; }
  await studioKniznica();
  studioOznam("Skopírované.");
}
async function studioZmaz(id){
  const s = _stZoznam.find(x => x.id === id);
  if(!s) return;
  const pozn = s.kampane ? " Kampane, ktoré z nej vznikli (" + s.kampane + "), si text ponechajú — majú vlastnú kópiu." : "";
  if(!(await studioPotvrd("Zmazať šablónu „" + s.nazov + "“?" + pozn, "Zmazať šablónu"))) return;
  const { error } = await sb.rpc("kampan_sablona_zmaz", { p_id: id });
  if(error){ studioOznam("Chyba: " + error.message, true); return; }
  await studioKniznica();
  studioOznam("Šablóna zmazaná.");
}
// Predpripravené šablóny (č. 248) ležia v privátnom dev/kampane/sablony —
// na Pages nie sú, preto ich admin číta zo súborov, ktoré vyberie človek.
async function studioSeedImport(vstup){
  const subory = Array.from(vstup.files || []);
  vstup.value = "";
  if(!subory.length) return;
  const polozky = [];
  for(const f of subory){
    let x = null, chyby = [];
    try{ x = JSON.parse(await f.text()); chyby = studioOverSubor(x); }catch(e){ chyby = ["nie je platný JSON: " + e.message]; }
    const existuje = x && _stZoznam.find(s => s.kod && s.kod === x.kod);
    polozky.push({ subor: f.name, x, chyby, existuje });
  }
  const riadok = (p, i) => '<div class="stBlok' + (p.chyby.length ? " zle" : "") + '"><b>' + studioEsc(p.subor) + "</b>"
    + (p.x && p.x.nazov ? " — " + studioEsc(p.x.nazov) : "")
    + (p.chyby.length ? '<div class="stChyby">' + studioEsc(p.chyby.join(" · ")) + "</div>"
      : p.existuje ? '<label class="chk"><input type="checkbox" id="stSeedPrepis' + i + '"> V knižnici už je (verzia ' + p.existuje.verzia
        + "). Prepísať textom zo súboru — tvoje úpravy v štúdiu sa stratia.</label>"
      : '<div class="muted">Pribudne do knižnice.' + (p.x.otazky && p.x.otazky.length ? " Otvorené otázky: " + p.x.otazky.length + " — kampaň sa z nej nezaloží, kým ich nevyriešiš." : "") + "</div>")
    + "</div>";
  studioDialog("Načítať predpripravené šablóny", polozky.map(riadok).join("") + '<div id="stSeedStav" class="muted"></div>', [
    { text: "Zrušiť", akcia: studioDialogZavri },
    { text: "Načítať", hlavne: true, akcia: async () => {
      const stav = document.getElementById("stSeedStav");
      let n = 0; const zle = [];
      for(let i = 0; i < polozky.length; i++){
        const p = polozky[i];
        if(p.chyby.length) continue;
        let telo = { kod: p.x.kod, nazov: p.x.nazov, skupina: p.x.skupina, predmet: p.x.predmet, bloky: p.x.bloky, otazky: p.x.otazky || [] };
        if(p.existuje){
          const ch = document.getElementById("stSeedPrepis" + i);
          if(!ch || !ch.checked) continue;
          telo = Object.assign(telo, { id: p.existuje.id, verzia: p.existuje.verzia });
          delete telo.kod;
        }
        const { error } = await sb.rpc("kampan_sablona_uloz", { p: telo });
        if(error) zle.push(p.subor + ": " + error.message); else n++;
        stav.textContent = "Uložené " + n + "…";
      }
      studioDialogZavri();
      await studioKniznica();
      studioOznam("Načítané " + n + (zle.length ? " · chyby: " + zle.join(" · ") : ""), !!zle.length);
    } },
  ], 560);
}

// ── Editor šablóny ─────────────────────────────────────────────────────────
function studioEditor(s){
  _st.rezim = "sablona";
  _st.s = s;
  _st.povodna = s.id ? JSON.stringify(studioNaUlozenie(s)) : "";
  studioEditorKresli();
}
function studioEditorKresli(){
  const s = _st.s;
  const novOkno = document.body.classList.contains("studio");
  const skupiny = Object.keys(STUDIO_SKUPINY).map(k => '<option value="' + k + '"' + (k === s.skupina ? " selected" : "") + ">" + studioEsc(STUDIO_SKUPINY[k]) + "</option>").join("");
  const pridaj = '<option value="">+ Pridať blok…</option>' + Object.keys(STUDIO_BLOKY).map(k => '<option value="' + k + '">' + studioEsc(STUDIO_BLOKY[k].n) + "</option>").join("");
  const otazky = (s.otazky || []).length ? '<div class="hint warn"><b>Otvorené otázky k pravdivosti textu</b> — kým tu sú, kampaň sa z tejto šablóny nezaloží:'
      + s.otazky.map((q, i) => '<div style="display:flex;gap:8px;align-items:flex-start;margin-top:6px"><div style="flex:1">' + studioEsc(q)
        + '</div><button class="rowbtn" onclick="studioOtazkaVyriesena(' + i + ')">Vyriešené</button></div>').join("") + "</div>" : "";
  _st.el.innerHTML = '<div class="stHlava">'
    + '<div class="stRad"><button class="rowbtn" onclick="studioChod(\'\')">← Knižnica</button>'
      + '<b style="font-size:15px">' + (s.id ? "Šablóna #" + s.id + " · verzia " + s.verzia : "Nová šablóna") + "</b>"
      + '<div class="sp" style="flex:1"></div><span id="stStav" style="font-size:13px"></span></div>'
    + '<div class="stRad">'
      + '<div class="field"><label for="stNazov">Názov</label><input id="stNazov" value="' + studioEsc(s.nazov) + '" oninput="studioZmenHlavu(\'nazov\',this.value)"></div>'
      + '<div class="field"><label for="stSkupina">Cieľová skupina</label><select id="stSkupina" onchange="studioZmenHlavu(\'skupina\',this.value)">' + skupiny + "</select></div></div>"
    + '<div class="field" style="margin:0"><label for="stPredmet">Predmet e-mailu (čistý text; ceny cez {cena:…})</label><input id="stPredmet" value="' + studioEsc(s.predmet) + '" oninput="studioZmenHlavu(\'predmet\',this.value)"></div>'
    + '<div class="stRad">'
      + '<button class="btn" style="width:auto" onclick="studioUloz()">Uložiť</button>'
      + (s.id && !novOkno ? '<button class="rowbtn" onclick="studioVNovomOkne(\'s' + s.id + '\')">Otvoriť v novom okne ↗</button>' : "")
      + '<button class="rowbtn" onclick="studioSkuskaSablony()">Skúška sebe</button>'
      + '<button class="rowbtn" onclick="studioStiahniHtml()">Stiahnuť HTML</button></div>'
    + otazky
    + '<div class="hint" style="margin:0">Podpis je v šablóne (č. 251) — v Gmaile pre nové e-maily z info@ezivnostnik.eu nastav <b>„Bez podpisu“</b>, inak bude dvakrát.</div>'
    + "</div>"
    + '<div class="stMriezka"><div id="stBloky">'
      + s.bloky.map((b, i) => studioBlokHtml(b, i)).join("")
      + '<div class="stRad" style="margin-bottom:10px"><select style="width:auto" onchange="studioPridajBlok(this.value);this.value=\'\'">' + pridaj + "</select></div>"
      + '<div class="stBlok zamknuty"><div class="stBlokHlava"><b>Pätka</b><span class="sp"></span><span class="stStitok">povinná · needitovateľná</span></div>'
        + '<div class="muted">' + studioEsc(STUDIO_PATKA_SLUZBA) + "<br>Váš kontakt som našiel na {source_url}. Ak si neželáte ďalšie správy, odhlásite sa jedným klikom ({odhlasenie}).</div>"
        + '<div class="muted" style="margin-top:6px">Je v každom e-maile: veta o doručovacej službe (OP Verteco 4.2), zdroj kontaktu (čl. 14 GDPR) a odhlásenie.</div></div>'
    + "</div>"
    + '<div class="stNahlad"><div class="stRad"><div class="stPrep" role="group" aria-label="Šírka náhľadu">'
      + '<button id="stPrepD" onclick="studioNahladSirka(\'d\')">Desktop 600</button><button id="stPrepM" onclick="studioNahladSirka(\'m\')">Mobil 390</button></div>'
      + '<span class="muted">vymyslený adresát: ' + studioEsc(STUDIO_UKAZKA.firma) + "</span></div>"
      + '<div id="stSuhrn" style="margin-top:8px"></div>'
      + '<iframe id="stRam" class="stRam" title="Náhľad e-mailu" sandbox="allow-same-origin"></iframe></div>'
    + "</div>";
  studioNahladSirka(_st.nahlad || "d", true);
  studioPrekresli();
}
function studioBlokHtml(b, i){
  const n = (STUDIO_BLOKY[b.typ] || { n: b.typ }).n;
  const pocet = _st.s.bloky.length;
  let polia = "";
  const pole = (meno, popis, hodnota, textarea, nastroje, pomoc) => {
    const id = "stB" + i + "_" + meno;
    return '<div class="field"><label for="' + id + '">' + studioEsc(popis) + "</label>"
      + (nastroje ? studioNastroje(id) : "")
      + (textarea
        ? '<textarea id="' + id + '" rows="' + textarea + '" oninput="studioZmen(' + i + ",'" + meno + "',this.value)\">" + studioEsc(hodnota) + "</textarea>"
        : '<input id="' + id + '" value="' + studioEsc(hodnota) + '" oninput="studioZmen(' + i + ",'" + meno + "',this.value)\">")
      + (pomoc ? '<div class="muted">' + pomoc + "</div>" : "") + "</div>";
  };
  if(b.typ === "hlavicka") polia = '<div class="muted">Logo a názov eživnostník — rovnaké v každom e-maile.</div>';
  if(b.typ === "odsek") polia = pole("text", "Text (prázdny riadok = nový odsek)", b.text, 5, true);
  if(b.typ === "box") polia = pole("nadpis", "Nadpis", b.nadpis, 0, true) + pole("text", "Text", b.text, 3, true);
  if(b.typ === "body") polia = pole("nadpis", "Nadpis nad bodmi", b.nadpis, 0, true)
    + pole("polozky", "Body — každý riadok je jeden bod (začni **tučným** úvodom)", (b.polozky || []).join("\n"), 6, true);
  if(b.typ === "tlacidlo") polia = pole("text", "Text tlačidla", b.text) + studioCielPole(i, "ciel", b.ciel, false);
  if(b.typ === "poznamka") polia = pole("text", "Poznámka (malým písmom pod tlačidlom)", b.text, 2, true);
  if(b.typ === "podpis") polia = pole("uvod", "Záverečná veta pred pozdravom", b.uvod, 3, true) + pole("pozdrav", "Pozdrav", b.pozdrav)
    + pole("meno", "Meno", b.meno) + pole("rola", "Riadok pod menom", b.rola)
    + '<div class="muted">Pod podpisom je vždy info@ezivnostnik.eu a web s UTM kampane.</div>';
  if(b.typ === "obrazok") polia = (b.src && !studioSrcChyba(b.src) ? '<img class="stObr" src="' + studioEsc(b.src) + '" alt="" style="max-height:160px;margin-bottom:8px">' : "")
    + '<div class="stRad" style="margin-bottom:8px">'
      + '<button class="rowbtn" onclick="studioSnimkaDialog(' + i + ')">Snímka z návodov</button>'
      + '<button class="rowbtn" onclick="studioGifDialog(' + i + ')">' + (b.gif_navrh && b.gif_navrh.length && !b.src ? "Zložiť GIF z návrhu" : "GIF skladačka") + "</button>"
      + '<button class="rowbtn" onclick="document.getElementById(\'stVlastny' + i + '\').click()">Vlastný obrázok</button>'
      + '<input type="file" id="stVlastny' + i + '" accept="image/png,image/jpeg,image/gif" hidden onchange="studioVlastnyObrazok(' + i + ',this)"></div>'
    + '<div class="muted" style="margin-bottom:8px;word-break:break-all">' + (b.src ? studioEsc(b.src) : "zatiaľ bez obrázka") + "</div>"
    + pole("alt", "Popis obrázka pre vypnuté obrázky (alt)", b.alt)
    + pole("popis", "Popis pod obrázkom (nepovinné)", b.popis)
    + studioCielPole(i, "ciel", b.ciel, true)
    + pole("sirka", "Šírka v e-maile (px, najviac 560)", b.sirka || 560);
  return '<div class="stBlok" id="stBlok' + i + '"><div class="stBlokHlava"><b>' + (i + 1) + ". " + studioEsc(n) + '</b><span class="sp"></span>'
    + '<button class="rowbtn" onclick="studioPosun(' + i + ',-1)"' + (i ? "" : " disabled") + ' aria-label="Posunúť vyššie">↑</button>'
    + '<button class="rowbtn" onclick="studioPosun(' + i + ',1)"' + (i < pocet - 1 ? "" : " disabled") + ' aria-label="Posunúť nižšie">↓</button>'
    + '<button class="rowbtn" onclick="studioZmazBlok(' + i + ')" aria-label="Zmazať blok">✕</button></div>'
    + polia + '<div class="stChyby" id="stChyby' + i + '"></div></div>';
}
function studioNastroje(id){
  return '<div class="stNastroje">'
    + '<button type="button" onclick="studioTucne(\'' + id + '\')" title="Tučné: **text**"><b>B</b></button>'
    + '<button type="button" onclick="studioOdkazDialog(\'' + id + '\')" title="Odkaz na cieľ — UTM doplní štúdio">Odkaz</button>'
    + '<button type="button" onclick="studioCenaDialog(\'' + id + '\')" title="Cena z podmienok">Cena</button>'
    + '<button type="button" onclick="studioVlozDoPola(\'' + id + '\',\'{firma|vašej firme}\')" title="Názov firmy adresáta, inak náhrada">Firma</button>'
    + '<button type="button" onclick="studioVlozDoPola(\'' + id + '\',\'{mesto|vo vašom meste}\')" title="Mesto adresáta, inak náhrada">Mesto</button></div>';
}
function studioCielMoznosti(hodnota, bezOdkazu){
  const clanok = String(hodnota || "").startsWith("clanok:");
  return (bezOdkazu ? '<option value=""' + (!hodnota ? " selected" : "") + ">— bez odkazu —</option>" : "")
    + Object.keys(STUDIO_CIELE).map(k => '<option value="' + k + '"' + (k === hodnota ? " selected" : "") + ">" + studioEsc(STUDIO_CIELE[k].n) + "</option>").join("")
    + '<option value="clanok:"' + (clanok ? " selected" : "") + ">Konkrétny článok…</option>";
}
function studioCielPole(i, meno, hodnota, bezOdkazu){
  const clanok = String(hodnota || "").startsWith("clanok:");
  return '<div class="field"><label for="stB' + i + "_" + meno + '">Kam vedie (UTM doplní štúdio)</label>'
    + '<select id="stB' + i + "_" + meno + '" onchange="studioCielZmena(' + i + ",'" + meno + "',this.value)\">" + studioCielMoznosti(hodnota, bezOdkazu) + "</select>"
    + (clanok ? '<input style="margin-top:6px" placeholder="slug článku" value="' + studioEsc(String(hodnota).slice(7)) + '" oninput="studioZmen(' + i + ",'" + meno + "','clanok:'+this.value.trim())\">" : "")
    + "</div>";
}
function studioCielZmena(i, meno, v){
  _st.s.bloky[i][meno] = v;
  studioEditorKresli();
  if(v === "clanok:") studioClankyNapoveda();
}
async function studioClankyNapoveda(){
  if(_stClanky) return;
  try{
    const { data } = await sb.from("clanky").select("slug,nazov,zverejneny").eq("zverejneny", true);
    _stClanky = data || [];
    if(_stClanky.length) studioOznam("Zverejnené články: " + _stClanky.map(c => c.slug).join(", "));
  }catch(_){ _stClanky = []; }
}

// ── Úpravy ─────────────────────────────────────────────────────────────────
function studioZmenHlavu(pole, v){ _st.s[pole] = v; studioNaplanuj(); }
function studioZmen(i, pole, v){
  const b = _st.s.bloky[i];
  if(!b) return;
  if(pole === "polozky") b.polozky = String(v).split("\n");
  else if(pole === "sirka") b.sirka = +v || 560;
  else b[pole] = v;
  studioNaplanuj();
}
function studioNaplanuj(){
  clearTimeout(_stTimer);
  _stTimer = setTimeout(studioPrekresli, 200);
}
function studioPosun(i, smer){
  const b = _st.s.bloky, j = i + smer;
  if(j < 0 || j >= b.length) return;
  [b[i], b[j]] = [b[j], b[i]];
  studioEditorKresli();
}
async function studioZmazBlok(i){
  const b = _st.s.bloky[i];
  const prazdny = !Object.keys(b).some(k => k !== "typ" && String(b[k] || "").trim() && !(k === "sirka" || k === "ciel" || k === "pozdrav"));
  if(!prazdny && !(await studioPotvrd("Zmazať blok „" + (STUDIO_BLOKY[b.typ] || { n: b.typ }).n + "“ aj s textom?", "Zmazať blok"))) return;
  _st.s.bloky.splice(i, 1);
  studioEditorKresli();
}
function studioPridajBlok(typ){
  if(!STUDIO_BLOKY[typ]) return;
  const b = _st.s.bloky;
  // Nový blok ide pred podpis — za podpisom by bol text po pozdrave.
  const kam = b.findIndex(x => x.typ === "podpis");
  b.splice(kam < 0 ? b.length : kam, 0, STUDIO_BLOKY[typ].novy());
  studioEditorKresli();
}
function studioOtazkaVyriesena(i){
  _st.s.otazky.splice(i, 1);
  studioEditorKresli();
  studioOznam("Otázka odstránená — ulož šablónu.");
}
function studioVlozDoPola(id, text, obal){
  const el = document.getElementById(id);
  if(!el) return;
  const a = el.selectionStart || 0, z = el.selectionEnd || 0;
  const vyber = el.value.slice(a, z);
  const vloz = obal ? obal(vyber) : text;
  el.value = el.value.slice(0, a) + vloz + el.value.slice(z);
  el.focus();
  el.selectionStart = el.selectionEnd = a + vloz.length;
  el.dispatchEvent(new Event("input"));
}
function studioTucne(id){ studioVlozDoPola(id, "", v => "**" + (v || "tučný text") + "**"); }
function studioOdkazDialog(id){
  const el = document.getElementById(id);
  const vyber = el ? el.value.slice(el.selectionStart || 0, el.selectionEnd || 0) : "";
  const clanky = (_stClanky || []).map(c => '<option value="' + studioEsc(c.slug) + '">').join("");
  studioDialog("Vložiť odkaz", '<div class="field"><label for="stOdkText">Text odkazu</label><input id="stOdkText" value="' + studioEsc(vyber || "") + '"></div>'
    + '<div class="field"><label for="stOdkCiel">Kam vedie</label><select id="stOdkCiel" onchange="document.getElementById(\'stOdkClanokPole\').style.display=this.value===\'clanok:\'?\'\':\'none\'">'
    + studioCielMoznosti("demo", false) + "</select></div>"
    + '<div class="field" id="stOdkClanokPole" style="display:none"><label for="stOdkClanok">Slug článku (z adresy /clanky/&lt;slug&gt;.html)</label>'
    + '<input id="stOdkClanok" list="stOdkClanky"><datalist id="stOdkClanky">' + clanky + "</datalist></div>"
    + '<div class="muted">UTM (utm_source=email, utm_medium podľa spôsobu, utm_campaign kampane) doplní štúdio samo.</div>', [
    { text: "Zrušiť", akcia: studioDialogZavri },
    { text: "Vložiť", hlavne: true, akcia: () => {
      let c = document.getElementById("stOdkCiel").value;
      if(c === "clanok:") c += document.getElementById("stOdkClanok").value.trim();
      const t = document.getElementById("stOdkText").value.trim() || "odkaz";
      studioDialogZavri();
      studioVlozDoPola(id, "[" + t.replace(/[\[\]]/g, "") + "](" + c + ")");
    } },
  ], 460);
  studioClankyNapoveda();
}
function studioCenaDialog(id){
  const c = (_stCeny && _stCeny.ceny) || {};
  studioDialog("Vložiť cenu z podmienok", '<div class="field"><label for="stCena">Cena</label><select id="stCena">'
    + Object.keys(STUDIO_CENY_POLIA).map(k => '<option value="' + k + '">' + studioEsc(STUDIO_CENY_POLIA[k]) + " — " + studioEsc(c[k] || "nenašla sa") + "</option>").join("")
    + '</select></div><div class="muted">Do textu ide pole {cena:…}; číslo doplní štúdio z podmienky.html pri každom vykreslení. „bez DPH“ / „s DPH“ a „mesačne“ napíš do vety sám.</div>', [
    { text: "Zrušiť", akcia: studioDialogZavri },
    { text: "Vložiť", hlavne: true, akcia: () => { const k = document.getElementById("stCena").value; studioDialogZavri(); studioVlozDoPola(id, "{cena:" + k + "}"); } },
  ], 480);
}

// ── Náhľad a priebežné kontroly ────────────────────────────────────────────
function studioVolbyNahlad(){
  return { ceny: _stCeny && _stCeny.ceny, polia: STUDIO_UKAZKA };
}
function studioPrekresli(){
  if(!_st || _st.rezim !== "sablona") return;
  const r = studioRender(_st.s, studioVolbyNahlad());
  // Uložená podoba (s poľami) prejde aj rozborom importu — tou istou
  // kontrolou, akou prechádza ručne písaná šablóna (kampanSablonaRozober).
  const ulozena = studioRender(_st.s, { ceny: _stCeny && _stCeny.ceny });
  const rozbor = typeof kampanSablonaRozober === "function" ? kampanSablonaRozober(ulozena.html).chyby : [];
  _st.s.bloky.forEach((_b, i) => {
    const el = document.getElementById("stChyby" + i), blok = document.getElementById("stBlok" + i);
    const moje = r.chyby.filter(c => c.blok === i).map(c => c.text);
    if(el) el.innerHTML = moje.map(t => "⚠ " + studioEsc(t)).join("<br>");
    if(blok) blok.classList.toggle("zle", moje.length > 0);
  });
  const vseob = r.chyby.filter(c => c.blok < 0).map(c => c.text).concat(rozbor.filter(t => !r.chyby.some(c => c.text === t)));
  const cenyChyby = _stCeny && _stCeny.chyby.length ? _stCeny.chyby : [];
  const pocet = r.chyby.length + rozbor.length;
  document.getElementById("stSuhrn").innerHTML = (pocet
      ? '<div class="stChyby"><b>' + studioChyb(pocet) + "</b> — kampaň sa zo šablóny nezaloží, kým ich neopravíš."
        + (vseob.length ? "<br>" + vseob.map(t => "⚠ " + studioEsc(t)).join("<br>") : "") + "</div>"
      : '<div style="color:var(--accent2);font-size:12.5px">✓ Bez chýb · predmet: ' + studioEsc(r.predmet) + "</div>")
    + (cenyChyby.length ? '<div class="stChyby">' + cenyChyby.map(t => "⚠ " + studioEsc(t)).join("<br>") + "</div>" : "")
    + (r.varovania.length ? '<div class="stVar">' + r.varovania.map(t => "• " + studioEsc(t)).join("<br>") + "</div>" : "");
  studioRamNapln(document.getElementById("stRam"), r.html);
}
function studioRamNapln(ram, html){
  if(!ram) return;
  ram.onload = () => { try{ ram.style.height = (ram.contentDocument.documentElement.scrollHeight + 4) + "px"; }catch(_){} };
  ram.srcdoc = html;
}
function studioNahladSirka(v, bezPrekreslenia){
  if(!_st) return;
  _st.nahlad = v;
  const ram = document.getElementById("stRam");
  if(ram) ram.classList.toggle("m", v === "m");
  const d = document.getElementById("stPrepD"), m = document.getElementById("stPrepM");
  if(d){ d.classList.toggle("on", v === "d"); d.setAttribute("aria-pressed", v === "d"); }
  if(m){ m.classList.toggle("on", v === "m"); m.setAttribute("aria-pressed", v === "m"); }
  if(!bezPrekreslenia && ram && ram.contentDocument) try{ ram.style.height = (ram.contentDocument.documentElement.scrollHeight + 4) + "px"; }catch(_){}
  if(!bezPrekreslenia && _st.rezim === "sablona") studioPrekresli();
  if(!bezPrekreslenia && _st.rezim === "kampan") studioKampanNahlad();
}

async function studioUloz(){
  const s = _st.s;
  if(!String(s.nazov || "").trim()){ studioOznam("Šablóna potrebuje názov.", true); return; }
  const r = studioRender(s, { ceny: _stCeny && _stCeny.ceny });
  const { data, error } = await sb.rpc("kampan_sablona_uloz", { p: studioNaUlozenie(s) });
  if(error){ studioOznam("Chyba: " + error.message, true); return; }
  s.id = data.id; s.verzia = data.verzia;
  _st.povodna = JSON.stringify(studioNaUlozenie(s));
  _stZoznam = [];
  if(document.body.classList.contains("studio") && _st.param !== "s" + s.id){ _st.param = "s" + s.id; history.replaceState(null, "", "#studio/s" + s.id); }
  studioEditorKresli();
  studioOznam("Uložené · verzia " + s.verzia + (r.chyby.length ? " · " + studioChyb(r.chyby.length) + " — kampaň sa z nej zatiaľ nezaloží" : ""), r.chyby.length > 0);
}
function studioStiahniHtml(){
  const r = studioRender(_st.s, { ceny: _stCeny && _stCeny.ceny });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([r.html], { type: "text/html;charset=utf-8" }));
  a.download = (studioSlug(_st.s.nazov) || "sablona") + ".html";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  studioOznam(r.chyby.length ? "Stiahnuté, ale s " + r.chyby.length + " chybami." : "Stiahnuté.", r.chyby.length > 0);
}

// ── Skúška sebe (141.5 g) ──────────────────────────────────────────────────
// Ručná: e-mail do schránky (text/html aj text/plain) a koncept v Gmaile na
// vlastnú adresu — Ctrl+V, ako pri ostrom odosielaní (kampanHtmlDoGmailu).
function studioVlastnaAdresa(){
  let a = "";
  try{ a = typeof kampGmailUcet === "function" ? kampGmailUcet() : (localStorage.getItem("eziv_kamp_gmail") || ""); }catch(_){}
  return a;
}
function studioSkuskaPolia(){
  return { firma: "", mesto: "", source_url: "www.priklad.sk/kontakt (skúška)", odhlasenie: STUDIO_WEB + "odhlasenie.html?o=skuska" };
}
function studioAdresaDialog(pokracuj){
  studioDialog("Skúška sebe", '<div class="field"><label for="stSkAdresa">Tvoja adresa (Gmail účet, v ktorom sa otvorí koncept)</label>'
    + '<input id="stSkAdresa" type="email" value="' + studioEsc(studioVlastnaAdresa()) + '" placeholder="roman@ezivnostnik.eu"></div>'
    + '<div class="muted">E-mail sa skopíruje do schránky a otvorí sa koncept na túto adresu. V Gmaile vlož telo cez <b>Ctrl+V</b> a pošli si ho. Polia {firma|…} dostanú náhradu — tak, ako ich uvidí adresát bez údaja.</div>', [
    { text: "Zrušiť", akcia: studioDialogZavri },
    { text: "Kopírovať a otvoriť Gmail", hlavne: true, akcia: () => {
      const a = document.getElementById("stSkAdresa").value.trim();
      if(!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(a)){ document.getElementById("stSkAdresa").focus(); return; }
      try{ localStorage.setItem("eziv_kamp_gmail", a); }catch(_){}
      studioDialogZavri();
      pokracuj(a);
    } },
  ], 460);
}
async function studioSkuskaDoGmailu(adresa, predmet, html){
  // Čistý text je tu len záloha pre schránku (Gmail vloží HTML); ostré texty
  // skladá server (naCistyText v kampan-posli).
  const text = (new DOMParser().parseFromString(html, "text/html").body.textContent || "")
    .split("\n").map(r => r.trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  try{
    await navigator.clipboard.write([new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" }),
    })]);
  }catch(e){ studioOznam("Kopírovanie zlyhalo: " + e.message, true); return; }
  const odkaz = typeof kampGmailOdkaz === "function" ? kampGmailOdkaz({ email: adresa, predmet: "[skúška] " + predmet, text: "" })
    : "https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=" + encodeURIComponent(adresa) + "&su=" + encodeURIComponent("[skúška] " + predmet);
  window.open(odkaz, "_blank", "noopener");
  studioOznam("Skopírované — v Gmaile vlož telo cez Ctrl+V (ak sa karta neotvorila, povoľ vyskakovacie okná).");
}
function studioSkuskaSablony(){
  const r = studioRender(_st.s, { ceny: _stCeny && _stCeny.ceny, polia: studioSkuskaPolia() });
  if(r.chyby.length){ studioOznam("Šablóna má " + studioChyb(r.chyby.length) + " — oprav ich pred skúškou.", true); return; }
  studioAdresaDialog(a => studioSkuskaDoGmailu(a, r.predmet, r.telo));
}

// ── Kampaň v štúdiu (#studio/k<id>) ────────────────────────────────────────
async function studioKampan(id){
  _st.rezim = "kampan";
  const { data: k, error } = await sb.rpc("kampan_studio", { p_id: id });
  if(error) throw new Error(error.message);
  if(!k){ _st.el.innerHTML = '<div class="loading">Kampaň ' + id + " neexistuje.</div>"; return; }
  _st.kampan = k;
  const poskytovatel = await studioPoskytovatel();
  const odoslana = k.odoslane > 0;
  const volba = (hodnota, nazov, popis, vypnuta, dovod) => '<label class="stVolba' + (k.sposob === hodnota ? " zvol" : "") + (vypnuta ? " vyp" : "") + '">'
    + '<input type="radio" name="stSposob" value="' + hodnota + '"' + (k.sposob === hodnota ? " checked" : "") + (vypnuta ? " disabled" : "")
    + ' onchange="studioKampanSposob(this.value)"><b>' + nazov + '</b><span class="muted">' + popis + (dovod ? "<br><b>Nedostupné:</b> " + studioEsc(dovod) : "") + "</span></label>";
  const novsia = k.sablona_id && k.sablona_aktualna && k.sablona_aktualna !== k.sablona_verzia;
  _st.el.innerHTML = '<div class="stHlava">'
    + '<div class="stRad"><button class="rowbtn" onclick="studioChod(\'\')">← Knižnica šablón</button>'
      + '<b style="font-size:15px">Kampaň: ' + studioEsc(k.nazov) + '</b><span class="stStitok">' + studioEsc((typeof KAMP_STAVY === "object" && KAMP_STAVY[k.stav]) || k.stav) + "</span>"
      + (k.skupina ? '<span class="stStitok">' + studioEsc(STUDIO_SKUPINY[k.skupina] || k.skupina) + "</span>" : "")
      + '<div class="sp" style="flex:1"></div><span id="stStav" style="font-size:13px"></span></div>'
    + '<div><div class="muted" style="margin-bottom:6px">Spôsob odosielania' + (odoslana ? " — už sa nedá zmeniť, kampaň má " + k.odoslane + " odoslaných" : "") + "</div>"
      + volba("rucne", "Ručne z vlastnej schránky", "Každý e-mail pošleš sám z info@ezivnostnik.eu (Gmail, Ctrl+V). Server skontroluje odhlásenia a pripraví text. Nič sa nemeria.", odoslana && k.sposob !== "rucne")
      + volba("hromadne", "Hromadne cez poskytovateľa", "Posiela edge funkcia dávkami a meria otvorenia a kliky. Podmienky poskytovateľov hromadnú studenú poštu zakazujú (č. 191).",
          (odoslana && k.sposob !== "hromadne") || (!poskytovatel.ok && k.sposob !== "hromadne"), !poskytovatel.ok && k.sposob !== "hromadne" ? poskytovatel.dovod : "")
    + "</div>"
    + '<div class="stRad">'
      + (k.sablona_id ? '<span class="muted">Zo šablóny #' + k.sablona_id + " · verzia " + (k.sablona_verzia || "?")
          + (k.sablona_aktualna ? (novsia ? " (v knižnici je už verzia " + k.sablona_aktualna + ")" : " (aktuálna)") : " (šablóna bola zmazaná)") + "</span>"
          + (k.sablona_aktualna ? '<button class="rowbtn" onclick="studioChod(\'s' + k.sablona_id + '\')">Otvoriť šablónu</button>' : "")
          + (novsia ? '<button class="rowbtn" onclick="studioKampanPrevezmi()"' + (odoslana ? ' disabled title="Kampaň už má odoslaných — text sa nemení"' : "") + ">Prevziať verziu " + k.sablona_aktualna + "</button>" : "")
        : '<span class="muted">Text kampane nie je zo šablóny (ručný alebo importovaný).</span>')
      + '<button class="rowbtn" onclick="studioSkuskaKampane()">Skúška sebe</button></div>'
    + "</div>"
    + '<div style="padding:14px 18px"><div class="stRad"><div class="stPrep" role="group" aria-label="Šírka náhľadu">'
      + '<button id="stPrepD" onclick="studioNahladSirka(\'d\')">Desktop 600</button><button id="stPrepM" onclick="studioNahladSirka(\'m\')">Mobil 390</button></div>'
      + '<span class="muted">Predmet: ' + studioEsc(k.predmet) + "</span></div>"
      + '<div id="stSuhrn" style="margin-top:8px"></div>'
      + '<iframe id="stRam" class="stRam" title="Náhľad e-mailu kampane" sandbox="allow-same-origin"></iframe></div>';
  studioNahladSirka(_st.nahlad || "d", true);
  studioKampanNahlad();
}
function studioKampanPolia(html, polia){
  return String(html || "").replace(/\{(firma|mesto)\|([^{}]*)\}/g, (_m, k, nahrada) => polia[k] ? studioEsc(polia[k]) : nahrada)
    .split("{source_url}").join(studioEsc(polia.source_url)).split("{odhlasenie}").join(studioEsc(polia.odhlasenie));
}
function studioKampanNahlad(){
  const k = _st.kampan;
  if(!k) return;
  const telo = String(k.telo || "");
  const suhrn = document.getElementById("stSuhrn");
  if(!/^\s*</.test(telo)){
    if(suhrn) suhrn.innerHTML = '<div class="muted">Kampaň má čistý text, nie HTML — náhľad ukazuje text.</div>';
    studioRamNapln(document.getElementById("stRam"), '<pre style="white-space:pre-wrap;font:14px/1.55 sans-serif;padding:16px">' + studioEsc(telo) + "</pre>");
    return;
  }
  const chyby = typeof kampanSablonaRozober === "function" ? kampanSablonaRozober("<title>" + studioEsc(k.predmet) + "</title><body>" + telo + "</body>").chyby : [];
  if(suhrn) suhrn.innerHTML = chyby.length ? '<div class="stChyby">' + chyby.map(t => "⚠ " + studioEsc(t)).join("<br>") + "</div>" : "";
  studioRamNapln(document.getElementById("stRam"), '<!DOCTYPE html><html lang="sk"><head><meta charset="utf-8"></head><body style="margin:0">'
    + studioKampanPolia(telo, STUDIO_UKAZKA) + "</body></html>");
}
async function studioKampanSposob(sposob){
  const k = _st.kampan;
  if(!k || sposob === k.sposob) return;
  if(k.odoslane > 0){ studioOznam("Spôsob sa nedá zmeniť — kampaň už má odoslaných.", true); return studioKampan(k.id); }
  if(sposob === "hromadne"){
    const p = await studioPoskytovatel();
    if(!p.ok){ studioOznam("Hromadne sa nedá: " + p.dovod, true); return studioKampan(k.id); }
  }
  // Stráž je aj v databáze (spúšťač kampane_sposob_straz, admin_52).
  const { error } = await sb.rpc("kampan_uloz", { p: { id: k.id, sposob } });
  if(error){ studioOznam("Chyba: " + error.message, true); return studioKampan(k.id); }
  await studioKampan(k.id);
  studioOznam("Spôsob zmenený. UTM v odkazoch (utm_medium) sa zmení až prevzatím šablóny.");
}
async function studioKampanPrevezmi(){
  const k = _st.kampan;
  await studioNacitajZoznam();
  const s = _stZoznam.find(x => x.id === k.sablona_id);
  if(!s){ studioOznam("Šablóna už neexistuje.", true); return; }
  const r = studioRender(s, { ceny: _stCeny && _stCeny.ceny, utm: k.utm_campaign, sposob: k.sposob });
  if(r.chyby.length){ studioOznam("Šablóna má " + studioChyb(r.chyby.length) + " — oprav ich v šablóne.", true); return; }
  if(!(await studioPotvrd("Nahradiť text kampane verziou " + s.verzia + " šablóny? Kým nikto e-mail nedostal, je to bezpečné.", "Prevziať"))) return;
  const { error } = await sb.rpc("kampan_obnov_zo_sablony", { p: { id: k.id, sablona_verzia: s.verzia, predmet: r.predmet, telo: r.telo } });
  if(error){ studioOznam("Chyba: " + error.message, true); return; }
  await studioKampan(k.id);
  studioOznam("Text kampane je z verzie " + s.verzia + ".");
}
function studioSkuskaKampane(){
  const k = _st.kampan;
  if(k.sposob === "hromadne"){
    // Hromadná skúška ide cez poskytovateľa (kampan-posli, akcia skúšky).
    studioDialog("Skúška sebe", '<div class="field"><label for="stSkAdresa">Adresa pre skúšobný e-mail</label><input id="stSkAdresa" type="email" value="'
      + studioEsc(studioVlastnaAdresa()) + '"></div><div class="muted">Pošle ho poskytovateľ ako ostatné e-maily kampane; do adresátov ani počtov sa nezapíše.</div>', [
      { text: "Zrušiť", akcia: studioDialogZavri },
      { text: "Poslať skúšku", hlavne: true, akcia: async () => {
        const a = document.getElementById("stSkAdresa").value.trim();
        if(!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(a)) return;
        studioDialogZavri();
        const { data, error } = await sb.functions.invoke("kampan-posli", { body: { kampan: k.id, skuska: a } });
        if(error || (data && data.chyba)) studioOznam("Chyba: " + ((data && data.chyba) || error.message), true);
        else studioOznam("Skúška odoslaná na " + a + ".");
      } },
    ], 460);
    return;
  }
  const html = studioKampanPolia(k.telo, studioSkuskaPolia());
  studioAdresaDialog(a => studioSkuskaDoGmailu(a, k.predmet, html));
}

// ── Obrázky (č. 247): snímka z návodov, GIF skladačka, vlastný ─────────────
async function studioSnimkyMapa(){
  if(!window.NAVODY_SNIMKY){
    if(typeof adminSkript === "function") await adminSkript("navody_snimky.js");
  }
  if(!window.NAVODY_SNIMKY) throw new Error("mapa snímok návodov (navody_snimky.js) sa nenačítala");
  return window.NAVODY_SNIMKY;
}
function studioObrazokNacitaj(src){
  return new Promise((ok, zle) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => zle(new Error("nenačítal sa obrázok " + src)); i.src = src; });
}
async function studioHash(blob){
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  return Array.from(h.slice(0, 5), b => b.toString(16).padStart(2, "0")).join("");
}
// Názov súboru nesie odtlačok obsahu: rovnaký obrázok = rovnaká adresa, iný
// obrázok nikdy neprepíše ten, ktorý už odišiel v e-mailoch.
async function studioNahraj(blob, nazov){
  const ext = { "image/gif": "gif", "image/png": "png", "image/jpeg": "jpg" }[blob.type];
  if(!ext) throw new Error("povolený je len GIF, PNG a JPEG (" + (blob.type || "neznámy typ") + ")");
  if(blob.size > 2 * 1024 * 1024) throw new Error("súbor má " + Math.round(blob.size / 1024) + " kB — bucket berie najviac 2 MB");
  const d = new Date();
  const cesta = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "/" + (studioSlug(nazov) || "obrazok") + "-" + (await studioHash(blob)) + "." + ext;
  const { error } = await sb.storage.from("kampane").upload(cesta, blob, { contentType: blob.type, upsert: false, cacheControl: "31536000" });
  if(error && !/exists|duplicate/i.test(error.message || "")) throw new Error("nahratie zlyhalo: " + error.message);
  return STUDIO_BUCKET + cesta;
}
function studioObrazokPouzi(i, url, alt){
  const b = _st.s.bloky[i];
  if(!b) return;
  b.src = url;
  if(alt && !String(b.alt || "").trim()) b.alt = alt;
  if(b.gif_navrh && url) delete b.gif_navrh;
  studioEditorKresli();
  studioOznam("Obrázok je v šablóne — ulož ju.");
}
function studioChyb(n){ return n + " " + (n === 1 ? "chyba" : n < 5 ? "chyby" : "chýb"); }
function studioKb(n){ return Math.round(n / 1024) + " kB"; }

async function studioSnimkaDialog(i){
  let mapa;
  try{ mapa = await studioSnimkyMapa(); }catch(e){ studioOznam(e.message, true); return; }
  const kluce = Object.keys(mapa);
  const stav = { kluc: "", variant: "d", blob: null };
  const mriezka = () => kluce.filter(k => k.includes((document.getElementById("stSnHladaj") || {}).value || "") && mapa[k][stav.variant])
    .map(k => '<button type="button" data-k="' + k + '" class="' + (k === stav.kluc ? "zvol" : "") + '"><img loading="lazy" src="' + studioEsc(mapa[k][stav.variant].subor) + '" alt="">' + studioEsc(k) + "</button>").join("");
  studioDialog("Snímka z návodov", '<div class="stRad" style="margin-bottom:8px"><div class="field"><label for="stSnHladaj">Hľadať</label><input id="stSnHladaj" placeholder="napr. efaktury, jazdy, vydavky"></div>'
    + '<div class="stPrep" role="group" aria-label="Variant"><button id="stSnD" class="on">Desktop</button><button id="stSnM">Mobil</button></div></div>'
    + '<div class="stSnimky" id="stSnMriezka">' + mriezka() + '</div><div id="stSnVysledok" style="margin-top:10px"></div>', [
    { text: "Zrušiť", akcia: studioDialogZavri },
    { text: "Nahrať a použiť", hlavne: true, id: "stSnPouzi", akcia: async () => {
      if(!stav.blob) return;
      const v = document.getElementById("stSnVysledok");
      v.innerHTML = '<div class="muted">Nahrávam…</div>';
      try{ const url = await studioNahraj(stav.blob, stav.kluc); studioDialogZavri(); studioObrazokPouzi(i, url, "Obrazovka aplikácie eživnostník"); }
      catch(e){ v.innerHTML = '<div class="stChyby">' + studioEsc(e.message) + "</div>"; }
    } },
  ], 820);
  document.getElementById("stSnPouzi").disabled = true;
  const prekresli = () => { document.getElementById("stSnMriezka").innerHTML = mriezka(); };
  document.getElementById("stSnHladaj").oninput = prekresli;
  const prepni = v => { stav.variant = v; document.getElementById("stSnD").classList.toggle("on", v === "d"); document.getElementById("stSnM").classList.toggle("on", v === "m"); prekresli(); };
  document.getElementById("stSnD").onclick = () => prepni("d");
  document.getElementById("stSnM").onclick = () => prepni("m");
  document.getElementById("stSnMriezka").onclick = async e => {
    const btn = e.target.closest("button[data-k]");
    if(!btn) return;
    stav.kluc = btn.dataset.k;
    prekresli();
    const v = document.getElementById("stSnVysledok");
    v.innerHTML = '<div class="muted">Pripravujem PNG…</div>';
    try{
      // WebP Outlook nezobrazí — snímka ide do e-mailu ako PNG.
      const img = await studioObrazokNacitaj(mapa[stav.kluc][stav.variant].subor);
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      stav.blob = await new Promise(ok => c.toBlob(ok, "image/png"));
      v.innerHTML = '<img class="stObr" src="' + URL.createObjectURL(stav.blob) + '" alt="" style="max-height:240px"><div class="muted">PNG ' + c.width + " × " + c.height + " px · " + studioKb(stav.blob.size)
        + (stav.blob.size > 400 * 1024 ? ' · <span class="warnTxt">veľký súbor, zvaž GIF alebo menší výrez</span>' : "") + "</div>";
      document.getElementById("stSnPouzi").disabled = false;
    }catch(err){ v.innerHTML = '<div class="stChyby">' + studioEsc(err.message) + "</div>"; }
  };
}

async function studioVlastnyObrazok(i, vstup){
  const f = vstup.files && vstup.files[0];
  vstup.value = "";
  if(!f) return;
  if(!/^image\/(png|jpeg|gif)$/.test(f.type)){ studioOznam("Obrázok musí byť PNG, JPEG alebo GIF (WebP Outlook nezobrazí).", true); return; }
  if(f.size > 2 * 1024 * 1024){ studioOznam("Obrázok má " + studioKb(f.size) + " — najviac 2 MB, cieľ pod 800 kB.", true); return; }
  studioOznam("Nahrávam " + f.name + " (" + studioKb(f.size) + ")…");
  try{
    const url = await studioNahraj(f, f.name.replace(/\.[a-z0-9]+$/i, ""));
    studioObrazokPouzi(i, url);
    if(f.size > 800 * 1024) studioOznam("Nahraté, ale " + studioKb(f.size) + " je nad 800 kB — e-mail sa bude načítavať pomaly.", true);
  }catch(e){ studioOznam(e.message, true); }
}

// GIF skladačka (č. 247) — to isté, čo dev/kampane/gif_appka.py, bez Pythonu:
// snímky návodov (variant desktop), lišta prehliadača, pás s popisom,
// prelínanie a jedna paleta pre všetky zábery (inak GIF pri prelínaní
// bliká farbami). Prvý záber nesie hlavnú správu — Outlook ukáže len ten.
// Knižnica sa načíta až pri kódovaní, nie v <head> (CLAUDE.md).
const STUDIO_GIF = { sirka: 560, lista: 26, popis: 46, drz: 2600, prechod: 2, krok: 90, farby: 127, limit: 800 * 1024,
  kniznica: "https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js" };
let _stGifLib = null;
function studioGifKniznica(){
  if(!_stGifLib) _stGifLib = import(STUDIO_GIF.kniznica).catch(e => { _stGifLib = null; throw new Error("knižnica GIF sa nenačítala: " + e.message); });
  return _stGifLib;
}
function studioGifZaber(img, popis){
  const G = STUDIO_GIF;
  const vyska = Math.round(img.naturalHeight * G.sirka / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = G.sirka; c.height = G.lista + vyska + G.popis;
  const x = c.getContext("2d");
  const f = { pozadie: "rgb(255,255,255)", lista: "rgb(238,242,247)", linka: "rgb(211,220,232)", sede: "rgb(91,103,121)",
              pas: "rgb(22,72,131)", akcent: "rgb(240,138,36)", biela: "rgb(255,255,255)" };
  x.fillStyle = f.pozadie; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = f.lista; x.fillRect(0, 0, G.sirka, G.lista);
  x.fillStyle = f.linka; x.fillRect(0, G.lista - 1, G.sirka, 1);
  ["rgb(236,106,94)", "rgb(244,191,79)", "rgb(97,197,84)"].forEach((fa, i) => { x.fillStyle = fa; x.beginPath(); x.arc(16 + i * 14, 13, 4, 0, Math.PI * 2); x.fill(); });
  x.fillStyle = f.pozadie; x.beginPath();
  if(x.roundRect) x.roundRect(64, 5, G.sirka - 128, G.lista - 11, 7); else x.rect(64, 5, G.sirka - 128, G.lista - 11);
  x.fill();
  x.fillStyle = f.sede; x.font = "11px 'Segoe UI', Inter, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText("ezivnostnik.eu", G.sirka / 2, G.lista / 2);
  x.drawImage(img, 0, G.lista, G.sirka, vyska);
  const y0 = G.lista + vyska;
  x.fillStyle = f.pas; x.fillRect(0, y0, G.sirka, G.popis);
  x.fillStyle = f.akcent; x.fillRect(0, y0, 6, G.popis);
  x.fillStyle = f.biela;
  let v = 15;
  do { x.font = "700 " + v + "px 'Segoe UI', Inter, sans-serif"; v--; } while(x.measureText(popis).width > G.sirka - 28 && v > 10);
  x.fillText(popis, G.sirka / 2 + 3, y0 + G.popis / 2);
  return c;
}
async function studioGifKoduj(zabery, priebeh){
  const G = STUDIO_GIF;
  const mapa = await studioSnimkyMapa();
  const { GIFEncoder, quantize, applyPalette } = await studioGifKniznica();
  priebeh("Kreslím zábery…");
  const obr = [];
  for(const z of zabery){
    if(!mapa[z.kluc] || !mapa[z.kluc].d) throw new Error("chýba snímka " + z.kluc + " (variant desktop)");
    obr.push(studioGifZaber(await studioObrazokNacitaj(mapa[z.kluc].d.subor), z.popis));
  }
  const w = obr[0].width, h = obr[0].height;
  if(obr.some(c => c.width !== w || c.height !== h)) throw new Error("snímky nemajú rovnaký rozmer");
  const data = c => c.getContext("2d").getImageData(0, 0, w, h).data;
  // Snímky a prelínania.
  const snimky = [];
  obr.forEach((c, i) => {
    snimky.push({ d: data(c), t: G.drz });
    const dalsi = obr[(i + 1) % obr.length];
    for(let k = 1; k <= G.prechod; k++){
      const m = document.createElement("canvas"); m.width = w; m.height = h;
      const x = m.getContext("2d");
      x.drawImage(c, 0, 0); x.globalAlpha = k / (G.prechod + 1); x.drawImage(dalsi, 0, 0);
      snimky.push({ d: data(m), t: G.krok });
    }
  });
  priebeh("Počítam paletu…");
  const mozaika = new Uint8ClampedArray(w * h * 4 * obr.length);
  obr.forEach((c, i) => mozaika.set(data(c), i * w * h * 4));
  const paleta = quantize(mozaika, G.farby);
  const priehladna = paleta.length;               // index navyše = „bez zmeny“
  const plnaPaleta = paleta.concat([[255, 0, 255]]);
  const gif = GIFEncoder();
  let predosla = null;
  for(let i = 0; i < snimky.length; i++){
    priebeh("Kódujem snímku " + (i + 1) + " / " + snimky.length + "…");
    await new Promise(r => setTimeout(r, 0));
    const idx = applyPalette(snimky[i].d, paleta);
    let zapis = idx;
    // Pixel rovnaký ako v predošlej snímke sa neposiela znova (priehľadný
    // index + „nemazať“) — súbor je menší, obraz rovnaký.
    if(predosla){ zapis = new Uint8Array(idx); for(let p = 0; p < idx.length; p++) if(idx[p] === predosla[p]) zapis[p] = priehladna; }
    gif.writeFrame(zapis, w, h, i === 0 ? { palette: plnaPaleta, delay: snimky[i].t, repeat: 0, dispose: 1 }
      : { delay: snimky[i].t, transparent: true, transparentIndex: priehladna, dispose: 1 });
    predosla = idx;
  }
  gif.finish();
  return { blob: new Blob([gif.bytes()], { type: "image/gif" }), snimok: snimky.length, sirka: w, vyska: h };
}
async function studioGifDialog(i){
  let mapa;
  try{ mapa = await studioSnimkyMapa(); }catch(e){ studioOznam(e.message, true); return; }
  const b = _st.s.bloky[i];
  const stav = { zabery: (b.gif_navrh || []).filter(z => mapa[z.snimka] && mapa[z.snimka].d).map(z => ({ kluc: z.snimka, popis: z.popis || "" })), vysledok: null };
  const kluce = Object.keys(mapa).filter(k => mapa[k].d);
  const zoznam = () => stav.zabery.length ? stav.zabery.map((z, j) => '<div class="stZaber"><img src="' + studioEsc(mapa[z.kluc].d.subor) + '" alt="">'
      + '<div class="field" style="margin:0"><label for="stGifP' + j + '">' + (j === 0 ? "1. záber — hlavná správa (Outlook ukáže len ten)" : (j + 1) + ". záber") + " · " + studioEsc(z.kluc) + "</label>"
      + '<input id="stGifP' + j + '" maxlength="70" value="' + studioEsc(z.popis) + '" data-j="' + j + '"></div>'
      + '<div style="display:flex;gap:4px"><button type="button" class="rowbtn" data-hore="' + j + '"' + (j ? "" : " disabled") + ' aria-label="Vyššie">↑</button>'
      + '<button type="button" class="rowbtn" data-von="' + j + '" aria-label="Odobrať">✕</button></div></div>').join("")
    : '<div class="muted">Vyber 3 až 6 snímok nižšie.</div>';
  const mriezka = () => kluce.filter(k => k.includes((document.getElementById("stGifHladaj") || {}).value || ""))
    .map(k => '<button type="button" data-k="' + k + '" class="' + (stav.zabery.some(z => z.kluc === k) ? "zvol" : "") + '"><img loading="lazy" src="' + studioEsc(mapa[k].d.subor) + '" alt="">' + studioEsc(k) + "</button>").join("");
  studioDialog("GIF skladačka", '<div id="stGifZabery">' + zoznam() + "</div>"
    + '<div class="stRad" style="margin:10px 0 6px"><div class="field"><label for="stGifHladaj">Pridať snímku — hľadať</label><input id="stGifHladaj" placeholder="napr. efaktury, vydavky-fotka, jazdy"></div></div>'
    + '<div class="stSnimky" id="stGifMriezka">' + mriezka() + "</div>"
    + '<div id="stGifVysledok" style="margin-top:10px"></div>', [
    { text: "Zrušiť", akcia: studioDialogZavri },
    { text: "Zakódovať GIF", id: "stGifKoduj", akcia: async () => {
      const v = document.getElementById("stGifVysledok");
      if(stav.zabery.length < 3 || stav.zabery.length > 6){ v.innerHTML = '<div class="stChyby">GIF potrebuje 3 až 6 záberov.</div>'; return; }
      if(stav.zabery.some(z => !z.popis.trim())){ v.innerHTML = '<div class="stChyby">Každý záber potrebuje popis — nesie správu aj pri vypnutej animácii.</div>'; return; }
      document.getElementById("stGifKoduj").disabled = true;
      try{
        const r = await studioGifKoduj(stav.zabery, t => { v.innerHTML = '<div class="muted">' + studioEsc(t) + "</div>"; });
        stav.vysledok = r;
        const ok = r.blob.size < STUDIO_GIF.limit;
        v.innerHTML = '<img class="stObr" src="' + URL.createObjectURL(r.blob) + '" alt="Náhľad GIF">'
          + '<div class="' + (ok ? "muted" : "stChyby") + '" id="stGifVelkost">GIF ' + r.sirka + " × " + r.vyska + " px · " + r.snimok + " snímok · <b>" + studioKb(r.blob.size) + "</b>"
          + (ok ? " · pod limitom 800 kB" : " — nad limitom 800 kB: uber záber alebo vyber pokojnejšie obrazovky") + "</div>";
        document.getElementById("stGifPouzi").disabled = !ok;
      }catch(e){ v.innerHTML = '<div class="stChyby">' + studioEsc(e.message) + "</div>"; }
      document.getElementById("stGifKoduj").disabled = false;
    } },
    { text: "Nahrať a použiť", hlavne: true, id: "stGifPouzi", akcia: async () => {
      if(!stav.vysledok) return;
      const v = document.getElementById("stGifVysledok");
      try{
        const url = await studioNahraj(stav.vysledok.blob, (studioSlug(_st.s.nazov) || "kampan") + "-appka");
        const alt = "Ukážky obrazoviek aplikácie eživnostník: " + stav.zabery.map(z => z.popis.replace(/[.—–-]+\s*$/, "").trim()).join("; ");
        studioDialogZavri();
        studioObrazokPouzi(i, url, alt);
      }catch(e){ v.insertAdjacentHTML("beforeend", '<div class="stChyby">' + studioEsc(e.message) + "</div>"); }
    } },
  ], 860);
  document.getElementById("stGifPouzi").disabled = true;
  const prekresli = () => {
    document.getElementById("stGifZabery").innerHTML = zoznam();
    document.getElementById("stGifMriezka").innerHTML = mriezka();
    stav.vysledok = null;
    document.getElementById("stGifPouzi").disabled = true;
  };
  document.getElementById("stGifHladaj").oninput = () => { document.getElementById("stGifMriezka").innerHTML = mriezka(); };
  document.getElementById("stGifMriezka").onclick = e => {
    const btn = e.target.closest("button[data-k]");
    if(!btn) return;
    const j = stav.zabery.findIndex(z => z.kluc === btn.dataset.k);
    if(j >= 0) stav.zabery.splice(j, 1);
    else if(stav.zabery.length < 6) stav.zabery.push({ kluc: btn.dataset.k, popis: "" });
    prekresli();
  };
  const zab = document.getElementById("stGifZabery");
  zab.oninput = e => { const j = e.target.dataset.j; if(j != null){ stav.zabery[+j].popis = e.target.value; stav.vysledok = null; document.getElementById("stGifPouzi").disabled = true; } };
  zab.onclick = e => {
    const h = e.target.closest("[data-hore]"), x = e.target.closest("[data-von]");
    if(h){ const j = +h.dataset.hore; [stav.zabery[j - 1], stav.zabery[j]] = [stav.zabery[j], stav.zabery[j - 1]]; prekresli(); }
    if(x){ stav.zabery.splice(+x.dataset.von, 1); prekresli(); }
  };
}

// ── Sprievodca novej kampane (141.4) — volá ho kampanNova ──────────────────
async function studioSprievodca(){
  studioCss();
  let zoznam = [], chybaKniznice = "";
  try{ zoznam = await studioNacitajZoznam(); }catch(e){ chybaKniznice = e.message; }
  await studioNacitajCeny();
  const poskytovatel = await studioPoskytovatel();
  const skupiny = Object.keys(STUDIO_SKUPINY).map(k => '<option value="' + k + '">' + studioEsc(STUDIO_SKUPINY[k]) + "</option>").join("");
  const volba = (hodnota, nazov, popis, vypnuta, dovod, zvolena) => '<label class="stVolba' + (zvolena ? " zvol" : "") + (vypnuta ? " vyp" : "") + '" id="stSpVolba_' + hodnota + '">'
    + '<input type="radio" name="stSpSposob" value="' + hodnota + '"' + (zvolena ? " checked" : "") + (vypnuta ? " disabled" : "") + "><b>" + nazov + "</b>"
    + '<span class="muted">' + popis + (dovod ? "<br><b>Nedostupné:</b> " + studioEsc(dovod) : "") + "</span></label>";
  studioDialog("Nová kampaň",
    '<div class="field"><label for="stSpNazov">Názov kampane</label><input id="stSpNazov" placeholder="napr. Účtovníci — október 2026"></div>'
    + '<div class="field"><label for="stSpSkupina">Cieľová skupina</label><select id="stSpSkupina">' + skupiny + "</select></div>"
    + '<div class="field"><label for="stSpSablona">Šablóna z knižnice</label><select id="stSpSablona"></select>'
      + '<div id="stSpSablonaStav" class="muted" style="margin-top:4px"></div>'
      + (chybaKniznice ? '<div class="stChyby">' + studioEsc(chybaKniznice) + "</div>" : "") + "</div>"
    // Nie .field: jej štýl label (veľké písmená, drobné písmo) by zasiahol aj vysvetlenia volieb.
    + '<div style="margin-bottom:14px" role="radiogroup" aria-label="Spôsob odosielania"><div class="muted" style="margin-bottom:6px">Spôsob odosielania</div>'
      + volba("rucne", "Ručne z vlastnej schránky — odporúčané", "Každý e-mail pošleš sám z info@ezivnostnik.eu (Gmail, Ctrl+V). Server skontroluje odhlásenia a pripraví text. <b>Nič sa nemeria</b> — zásady to tak sľubujú.", false, "", true)
      + volba("hromadne", "Hromadne cez poskytovateľa", "Posiela edge funkcia dávkami a meria otvorenia a kliky. <b>Pre studenú poštu zakázané</b> podmienkami poskytovateľov (Mailgun, Resend, SES — č. 191): len pre ľudí, ktorí o poštu požiadali.",
        !poskytovatel.ok, poskytovatel.ok ? "" : poskytovatel.dovod, false)
      + '<div class="muted">Spôsob sa dá zmeniť v štúdiu kampane, kým nikto nedostal e-mail.</div></div>'
    + '<div class="stRad"><div class="field"><label for="stSpLimit">Denný limit</label><input id="stSpLimit" type="number" min="1" max="5000" value="20"></div>'
      + '<div class="field"><label for="stSpUtm">utm_campaign</label><input id="stSpUtm" placeholder="zo slugu názvu"></div></div>'
    + '<div class="muted">Pri ručnej kampani odporúčame 20–30 e-mailov denne. Podľa utm_campaign sa kampaň nájde v Návštevnosti.</div>'
    + '<div id="stSpChyby" class="stChyby" style="margin-top:8px"></div>', [
    { text: "Zrušiť", akcia: studioDialogZavri },
    { text: "Založiť kampaň", hlavne: true, id: "stSpZaloz", akcia: () => studioSprievodcaZaloz(zoznam) },
  ], 600);
  let utmRucne = false;
  const nazov = document.getElementById("stSpNazov"), utm = document.getElementById("stSpUtm"), sk = document.getElementById("stSpSkupina"),
        sab = document.getElementById("stSpSablona"), limit = document.getElementById("stSpLimit");
  nazov.oninput = () => { if(!utmRucne) utm.value = studioSlug(nazov.value); };
  utm.oninput = () => { utmRucne = true; };
  const sablony = () => {
    const v = zoznam.filter(s => s.skupina === sk.value);
    sab.innerHTML = v.map(s => '<option value="' + s.id + '">' + studioEsc(s.nazov) + " (verzia " + s.verzia + ")</option>").join("")
      + '<option value="">— bez šablóny (text doplníš v kampani) —</option>';
    stavSablony();
  };
  const stavSablony = () => {
    const s = zoznam.find(x => String(x.id) === sab.value);
    const el = document.getElementById("stSpSablonaStav");
    if(!s){ el.innerHTML = zoznam.length ? "Kampaň bez textu — vložíš ho neskôr." : "Knižnica je prázdna — šablóny pridáš v sekcii Šablóny."; return; }
    const r = studioRender(s, { ceny: _stCeny && _stCeny.ceny, utm: utm.value || "kampan" });
    el.innerHTML = studioEsc(s.predmet) + (s.otazky && s.otazky.length ? '<br><span class="warnTxt">Otvorené otázky: ' + s.otazky.length + " — najprv ich vyrieš v štúdiu.</span>" : "")
      + (r.chyby.length ? '<br><span class="warnTxt">Chyby v šablóne: ' + r.chyby.length + ".</span>" : "");
  };
  sk.onchange = sablony;
  sab.onchange = stavSablony;
  document.getElementById("stDialog").querySelectorAll('input[name="stSpSposob"]').forEach(r => r.onchange = () => {
    ["rucne", "hromadne"].forEach(h => document.getElementById("stSpVolba_" + h).classList.toggle("zvol", h === r.value));
    limit.value = r.value === "hromadne" ? 50 : 20;
  });
  sablony();
  nazov.focus();
}
async function studioSprievodcaZaloz(zoznam){
  const el = document.getElementById("stSpChyby");
  const nazov = document.getElementById("stSpNazov").value.trim();
  const skupina = document.getElementById("stSpSkupina").value;
  const sposobEl = document.querySelector('input[name="stSpSposob"]:checked');
  const sposob = sposobEl ? sposobEl.value : "";
  const limit = +document.getElementById("stSpLimit").value;
  const utm = document.getElementById("stSpUtm").value.trim() || studioSlug(nazov);
  const s = zoznam.find(x => String(x.id) === document.getElementById("stSpSablona").value);
  const chyby = [];
  if(!nazov) chyby.push("zadaj názov kampane");
  if(sposob !== "rucne" && sposob !== "hromadne") chyby.push("vyber spôsob odosielania");
  if(!(limit >= 1 && limit <= 5000)) chyby.push("denný limit 1 až 5000");
  if(!/^[a-z0-9][a-z0-9_-]{1,59}$/.test(utm)) chyby.push("utm_campaign: malé písmená, číslice, pomlčka (2–60 znakov)");
  let r = null;
  if(s){
    if(s.otazky && s.otazky.length) chyby.push("šablóna má otvorené otázky k textu — vyrieš ich v štúdiu");
    r = studioRender(s, { ceny: _stCeny && _stCeny.ceny, utm, sposob });
    if(r.chyby.length) chyby.push("šablóna má chyby: " + r.chyby.map(c => c.text).join(" · "));
  }
  if(chyby.length){ el.innerHTML = chyby.map(t => "⚠ " + studioEsc(t)).join("<br>"); return; }
  document.getElementById("stSpZaloz").disabled = true;
  const p = { nazov, skupina, sposob, denny_limit: limit, utm_campaign: utm };
  if(s) Object.assign(p, { sablona_id: s.id, sablona_verzia: s.verzia, predmet: r.predmet, telo: r.telo });
  const { data, error } = await sb.rpc("kampan_zo_sablony", { p });
  if(error){ el.innerHTML = "⚠ " + studioEsc(error.message); document.getElementById("stSpZaloz").disabled = false; return; }
  studioDialogZavri();
  if(typeof nacitajKampane === "function"){
    if(typeof _kampanOtvorena !== "undefined") _kampanOtvorena = data;
    nacitajKampane();
  }
}
