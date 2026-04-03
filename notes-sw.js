const CACHE   = 'blocco-v30';
const VERSION = 30;
const STATIC  = [
  './notes-manifest.json',
  './notes-icon.svg',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
];

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
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => c.navigate(c.url)))
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // HTML — always network, no cache
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/blocco')) {
    e.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Everything else — cache first
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
