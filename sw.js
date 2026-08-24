const CACHE='muistio-iphone-offline-v11';
const CORE=[
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

async function cacheCore(){
  const cache=await caches.open(CACHE);
  await cache.addAll(CORE);
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    await cacheCore();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data && event.data.type==='REFRESH_STATIC_CACHE'){
    event.waitUntil((async()=>{
      try{
        const cache=await caches.open(CACHE);
        for(const url of CORE){
          try{
            const response=await fetch(url,{cache:'no-store'});
            if(response && response.ok) await cache.put(url,response.clone());
          }catch{}
        }
      }catch{}
    })());
  }
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;

  const url=new URL(req.url);

  // Navigation: always open the cached application shell first.
  // Network is used only as a background opportunity to refresh the cache.
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const cached=await cache.match('./index.html') || await cache.match('./');
      if(cached){
        event.waitUntil((async()=>{
          try{
            const fresh=await fetch(req,{cache:'no-store'});
            if(fresh && fresh.ok) await cache.put('./index.html',fresh.clone());
          }catch{}
        })());
        return cached;
      }
      try{
        const fresh=await fetch(req);
        if(fresh && fresh.ok) await cache.put('./index.html',fresh.clone());
        return fresh;
      }catch{
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Muistio</title><h1>Muistio</h1><p>Offline-välimuistia ei ole vielä asennettu. Avaa sovellus kerran verkkoyhteydellä.</p>',
          {headers:{'Content-Type':'text/html; charset=utf-8'}}
        );
      }
    })());
    return;
  }

  // Same-origin static assets: cache first, network fallback.
  if(url.origin===self.location.origin){
    event.respondWith((async()=>{
      const cached=await caches.match(req);
      if(cached) return cached;
      try{
        const fresh=await fetch(req);
        if(fresh && fresh.ok){
          const cache=await caches.open(CACHE);
          cache.put(req,fresh.clone());
        }
        return fresh;
      }catch{
        return new Response('',{status:503,statusText:'Offline'});
      }
    })());
  }
});
