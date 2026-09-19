// Vlastné anonymné počítanie návštev webu (spec kap. 131, ROZHODNUTIA č. 187–190).
//
// Bez cookies a bez ukladania čohokoľvek do prehliadača: pošle jednu krátku
// správu edge funkcii `navsteva` (stránka, odkiaľ prišiel návštevník — len
// doména, parametre kampane). Server z IP a prehliadača vypočíta hash platný
// jeden deň a IP neukladá. „Nesledovať“ (DNT / GPC) sa rešpektuje.
//
// Jediná výnimka z „nič neukladá“: `?nepocitat=1` si nastaví sám návštevník
// (vlastník, testy) a vtedy sa neposiela nič; `?nepocitat=0` to zruší.
(function () {
  try {
    var q = new URLSearchParams(location.search);
    if (q.get("nepocitat") === "1") { try { localStorage.setItem("eziv_nepocitat", "1"); } catch (e) {} }
    if (q.get("nepocitat") === "0") { try { localStorage.removeItem("eziv_nepocitat"); } catch (e) {} }
    try { if (localStorage.getItem("eziv_nepocitat") === "1") return; } catch (e) {}
    if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl) return;
    // Lokálny vývoj, e2e demo a snímkovač návodov bežia na 127.0.0.1 — nepočítajú sa.
    if (!/(^|\.)ezivnostnik\.eu$/.test(location.hostname)) return;
    var t = JSON.stringify({
      typ: "zobrazenie", cesta: location.pathname, referrer: document.referrer || "",
      utm_source: q.get("utm_source") || "", utm_medium: q.get("utm_medium") || "", utm_campaign: q.get("utm_campaign") || ""
    });
    var u = "https://jriuljhmacgvxyrptbme.supabase.co/functions/v1/navsteva";
    // text/plain = bez predbežnej CORS požiadavky; odpoveď nás nezaujíma.
    if (navigator.sendBeacon) navigator.sendBeacon(u, new Blob([t], { type: "text/plain" }));
    else fetch(u, { method: "POST", body: t, keepalive: true, headers: { "content-type": "text/plain" } }).catch(function () {});
  } catch (e) {}
})();
