// Hält die App offline verfügbar. Bei Änderungen an den Dateien VERSION erhöhen.
const VERSION = 'fightclub-v2';
const FILES = [
  './', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'js/data.js', 'js/sync.js', 'js/xlsx.js', 'js/mfp.js',
  'fonts/bangers.woff2', 'fonts/comicneue-400.woff2', 'fonts/comicneue-700.woff2',
  'icon-180.png', 'icon-192.png', 'icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Nur eigene Dateien cachen (nie die Sync-Anfragen an Supabase).
// Erst Netzwerk (damit Updates sofort ankommen), sonst Cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
