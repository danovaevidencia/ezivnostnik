// Offline cache pre "Hry pre partiu". Pri zmene hry zvýš VERZIU.
const VERSION='hry-v5';
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./maskable-192.png','./maskable-512.png','./apple-touch-icon.png'];
const EXTRA=['https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(VERSION).then(async c=>{
    await c.addAll(CORE);
    for(const u of EXTRA){try{await c.add(new Request(u,{mode:'cors'}));}catch(err){}}
  }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  // stránka: najprv sieť (aby prišli novinky), offline z cache
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(VERSION).then(c=>c.put('./index.html',cp));return r;})
      .catch(()=>caches.match('./index.html')));
    return;
  }
  // ostatné: cache, potom sieť (fonty a knižnica sa uložia pri prvom použití)
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{
    if(r.ok&&(url.origin===location.origin||/fonts\.(googleapis|gstatic)\.com|unpkg\.com/.test(url.hostname))){const cp=r.clone();caches.open(VERSION).then(c=>c.put(req,cp));}
    return r;
  })));
});
