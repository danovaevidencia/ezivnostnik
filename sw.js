// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — service worker
//
//  STRATÉGIA (dôležité pre aktualizácie):
//   · ezivnostnik.html  → NAJPRV SIEŤ, cache len ako záloha pri výpadku.
//     Cache-first by znamenal, že nová verzia sa k používateľovi nedostane
//     nikdy — presne ten problém, kvôli ktorému bolo treba appku preinštalovať.
//   · sadzby.js, faktura_pdf.js → NAJPRV SIEŤ, tak ako HTML. Je to KÓD, nie statika —
//     cache-first by znamenal, že oprava vo výpočte sadzieb sa nikdy nedoručí.
//     Do cache ale patrí, lebo bez neho sa appka offline vôbec nespustí.
//   · sadzby.json        → LEN SIEŤ, necachujeme vôbec. Sú to daňové sadzby;
//     stará kópia by znamenala počítanie starým zákonom. Appka si posledný
//     platný súbor drží sama v pamäti zariadenia, takže offline je pokrytý
//     a druhá kópia tu by len prekážala. Bez tejto vetvy by súbor spadol do
//     „najprv cache" a keďže sa ťahá s ?v=<čas>, pribúdal by NOVÝ záznam
//     v cache pri každom spustení appky.
//   · ikony, manifest    → najprv cache (menia sa výnimočne)
//   · CDN knižnice       → nechávame na HTTP cache prehliadača, sem nesiahame
//   · POST na /ezivnostnik.html → SHARE TARGET. Android takto posiela súbor
//     zdieľaný zo systémového menu. GitHub Pages je statický hosting a na POST
//     odpovie 405 — jediný, kto naň môže odpovedať, je tento worker.
//
//  Pri zmene appky staci zvysit VERZIA — stary cache sa vymaze pri aktivacii.
// ═══════════════════════════════════════════════════════════════════════════
const VERZIA = "2026.08.23-HN";
const CACHE  = "ezivnostnik-" + VERZIA;
// Odkladisko pre súbor zo systémového „Zdieľať". Nemá verziu v mene — obsah je
// dočasný a musí prežiť aj aktualizáciu workera medzi zdieľaním a vyzdvihnutím.
const ZDIELANE = "ezivnostnik-zdielane";

// minimum na to, aby sa appka otvorila aj bez signálu
const ZAKLAD = [
  "/ezivnostnik.html",
  "/sadzby.js",
  "/faktura_pdf.js",
  "/site.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.svg",
];

self.addEventListener("install", e => {
  // nečakáme na zatvorenie starých kariet — o prevzatie kontroly rozhoduje
  // až používateľ cez tlačidlo "Obnoviť" v appke (message SKIP_WAITING)
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ZAKLAD)).catch(() => {})
  );
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const mena = await caches.keys();
    // ZDIELANE sa zámerne NEMAŽE: medzi prijatím súboru a jeho vyzdvihnutím
    // appkou môže prísť aktualizácia workera. Zmazať by znamenalo, že
    // používateľ zdieľal doklad a nič sa nestalo — bez vysvetlenia.
    await Promise.all(mena.filter(m => m !== CACHE && m !== ZDIELANE).map(m => caches.delete(m)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  if (e.data === "VERZIA") e.source?.postMessage({ typ: "verzia", verzia: VERZIA });
});

self.addEventListener("fetch", e => {
  const req = e.request;

  // ── SHARE TARGET ──
  // Musí stáť PRED testom na GET, inak POST prepadne na sieť a share zlyhá.
  // Odpoveďou je presmerovanie, nie HTML: appka sa má otvoriť normálnym GET,
  // aby POST neostal v histórii a obnovenie stránky ho neposlalo znova.
  if (req.method === "POST" && new URL(req.url).pathname.endsWith("/ezivnostnik.html")) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const f = fd.get("doklad");
        if (f && f.size) {
          const c = await caches.open(ZDIELANE);
          // Cache API berie Response, takže súbor prežije aj štart appky.
          // Meno ide do hlavičky zakódované — hlavičky nesmú mať diakritiku.
          await c.put("/__zdielany", new Response(f, {
            headers: {
              "Content-Type": f.type || "application/octet-stream",
              "X-Nazov": encodeURIComponent(f.name || "doklad"),
            },
          }));
        }
      } catch (_) {}   // nič sa neuloží → appka sa otvorí normálne, bez dokladu
      return Response.redirect("/ezivnostnik.html?zdielane=1", 303);
    })());
    return;
  }

  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // CDN a Supabase neriešime

  // Sadzby: vždy zo siete, nikdy do cache. Keď sieť nie je, vrátime chybu —
  // appka to očakáva a spadne späť na svoju uloženú kópiu, resp. na zabudovanú
  // tabuľku. Radšej priznaná nedostupnosť než ticho podstrčená stará sadzba.
  if (url.pathname.endsWith("/sadzby.json") || url.pathname === "/sadzby.json") {
    e.respondWith(
      fetch(req).catch(() => new Response("", { status: 504 }))
    );
    return;
  }

  // Kód sa obsluhuje rovnako ako HTML: najprv sieť, cache je len záloha.
  // Každý vlastný .js je KÓD — nie statika. Cache-first by znamenal, že oprava
  // vo výpočte sadzieb alebo v generátore faktúr sa k používateľovi nedostane.
  // Preto sa tu netestuje zoznam mien, ale prípona: nový modul sa nezabudne.
  const jeKod = req.mode === "navigate"
             || req.destination === "document"
             || url.pathname.endsWith(".html")
             || url.pathname.endsWith(".js");

  if (jeKod) {
    // NAJPRV SIEŤ — nová verzia sa prejaví hneď po nasadení
    e.respondWith((async () => {
      try {
        const odpoved = await fetch(req);
        const kopia = odpoved.clone();
        caches.open(CACHE).then(c => c.put(req, kopia)).catch(() => {});
        return odpoved;
      } catch (_) {
        // offline → posledná známa verzia
        const z = await caches.match(req) || await caches.match("/ezivnostnik.html");
        return z || new Response("eživnostník je offline a nemá uloženú kópiu.", {
          status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })());
    return;
  }

  // statika: najprv cache, na pozadí dopĺňame
  e.respondWith((async () => {
    const z = await caches.match(req);
    if (z) return z;
    try {
      const odpoved = await fetch(req);
      if (odpoved.ok && odpoved.type === "basic") {
        const kopia = odpoved.clone();
        caches.open(CACHE).then(c => c.put(req, kopia)).catch(() => {});
      }
      return odpoved;
    } catch (_) {
      return new Response("", { status: 504 });
    }
  })());
});
