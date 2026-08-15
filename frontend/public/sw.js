const CACHE = 'homeunity-v3';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll([
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) return;

  const isNav = e.request.mode === 'navigate';

  e.respondWith(
    (async () => {
      const cached = await caches.match(e.request);
      if (cached && !isNav) return cached;
      try {
        const fresh = await fetch(e.request);
        const copy = fresh.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return fresh;
      } catch (err) {
        if (cached) return cached;
        if (isNav) return caches.match('/');
        return new Response('', { status: 503 });
      }
    })()
  );
});