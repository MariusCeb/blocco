const CACHE  = 'blocco-v36';
const STATIC = [
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
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  // Solo GET è cacheabile — le POST (Firestore RPC) passano dirette alla rete
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;
  // API dinamiche Firebase (dati e auth) — mai intercettare né cachare
  if (/firestore|identitytoolkit|securetoken/.test(url.hostname)) return;

  // HTML/navigazioni — sempre rete, mai cache-first
  // request.mode==='navigate' copre anche path tipo /blocco/ (GitHub Pages)
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Asset propri (js/css) — network-first: gli aggiornamenti arrivano
  // subito, la cache serve solo da fallback offline
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return resp;
      }).catch(() => caches.match(request).then(c => c || new Response('', { status: 504, statusText: 'offline' })))
    );
    return;
  }

  // Risorse esterne (font, twemoji, librerie) — cache first
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
      }
      return resp;
    })).catch(() => new Response('', { status: 504, statusText: 'offline' }))
  );
});
