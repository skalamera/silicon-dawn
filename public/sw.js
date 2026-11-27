const CACHE_NAME = 'silicon-dawn-v5';
const PRECACHE_URLS = ['/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML / navigation so deployments never serve stale entry points
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          if (fresh && fresh.status === 200) {
            void cache.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          return (
            (await cache.match(req)) ||
            (await cache.match('/index.html')) ||
            (await cache.match('/')) ||
            Response.error()
          );
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const networkPromise = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200) {
            void cache.put(req, resp.clone());
          }
          return resp;
        })
        .catch(() => cached);

      return cached || networkPromise;
    })
  );
});
