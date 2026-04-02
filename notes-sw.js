const CACHE  = 'blocco-v26';
const STATIC = ['./notes-manifest.json', './notes-icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(STATIC.map(a => c.add(a)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const {request} = e;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // HTML — always network, no cache (so updates show immediately)
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/blocco')) {
    e.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets — cache first
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
      }
      return resp;
    }))
  );
});
