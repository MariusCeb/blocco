const CACHE  = 'blocco-v19';
const STATIC = ['./notes-manifest.json', './notes-icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled([...STATIC, './notes.html'].map(a => c.add(a)))
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
  // Ignora schemi non-http (chrome-extension, data, ecc.)
  if (!url.protocol.startsWith('http')) return;

  // Network-first per l'HTML: aggiorna sempre, fallback offline
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/blocco')) {
    e.respondWith(
      fetch(request)
        .then(resp => {
          // clone() va chiamato subito in modo sincrono,
          // prima che qualsiasi operazione asincrona consumi il body
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first per manifest e icon
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
