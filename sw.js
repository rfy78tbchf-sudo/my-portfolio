const CACHE='my-portfolio-shell-20260926-57g';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.png','./passkey.js','./app-enhancements.js?v=57g','./realized-sales-ui.js?v=56','./vendor/jszip.min.js'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{
      const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return res;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  // UI scripts must update without asking iPhone PWA users to clear their
  // site data (which would also remove their saved login session).
  if(url.pathname.endsWith('/app-enhancements.js')||url.pathname.endsWith('/realized-sales-ui.js')||url.pathname.endsWith('/passkey.js')){
    event.respondWith(fetch(req).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
      return res;
    }).catch(()=>caches.match(req)));
    return;
  }
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
    return res;
  })));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(open=>{
    const existing=open.find(client=>client.url.startsWith(self.registration.scope));
    return existing?existing.focus():self.clients.openWindow('./');
  }));
});
