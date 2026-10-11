// Hält die App offline verfügbar. Bei Änderungen an den Dateien VERSION erhöhen.
const VERSION = 'fightclub-v10';
const FILES = [
  './', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest', 'js/icons.js',
  'js/data.js', 'js/sync.js', 'js/xlsx.js', 'js/scanner.js', 'js/food.js', 'js/recipes.js',
  'vendor/barcode-detector.js', 'vendor/zxing_reader.wasm',
  'fonts/ibm-plex-sans.woff2', 'fonts/ibm-plex-mono-400.woff2', 'fonts/ibm-plex-mono-500.woff2',
  'icon-soap-180.png', 'icon-soap-192.png', 'icon-soap-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Nur eigene Dateien cachen (nie die Sync-Anfragen an Supabase).
// Erst Netzwerk – am Browser-Cache vorbei (cache: 'no-cache' prüft immer beim Server nach),
// damit Updates sofort ankommen. Offline aus dem Cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    // Neue Anfrage nur aus der URL bauen – Seitenaufrufe (mode „navigate“) lassen sich nicht mit Optionen kopieren.
    fetch(new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }))
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
