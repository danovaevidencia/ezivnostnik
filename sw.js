// ═══════════════════════════════════════════════════════════════════════════
//  eživnostník — service worker
//
//  STRATÉGIA (dôležité pre aktualizácie):
//   · ezivnostnik.html  → NAJPRV SIEŤ, cache len ako záloha pri výpadku.
//     Cache-first by znamenal, že nová verzia sa k používateľovi nedostane
//     nikdy — presne ten problém, kvôli ktorému bolo treba appku preinštalovať.
//   · sadzby.js          → NAJPRV SIEŤ, tak ako HTML. Je to KÓD, nie statika —
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
//
//  Pri zmene appky staci zvysit VERZIA — stary cache sa vymaze pri aktivacii.
// ═══════════════════════════════════════════════════════════════════════════
const VERZIA = "2026.07.20-BS";
const CACHE  = "ezivnostnik-" + VERZIA;

// minimum na to, aby sa appka otvorila aj bez signálu
const ZAKLAD = [
  "/ezivnostnik.html",
  "/sadzby.js",
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
    await Promise.all(mena.filter(m => m !== CACHE).map(m => caches.delete(m)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  if (e.data === "VERZIA") e.source?.postMessage({ typ: "verzia", verzia: VERZIA });
});

self.addEventListener("fetch", e => {
  const req = e.request;
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
  const jeKod = req.mode === "navigate"
             || req.destination === "document"
             || url.pathname.endsWith(".html")
             || url.pathname.endsWith("/sadzby.js");

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
