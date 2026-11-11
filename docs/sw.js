/* Hält die App offline verfügbar und lässt sie ohne Wartezeit starten.

   Alle Dateien liegen im Speicher des Geräts und werden von dort geladen – die App
   wartet beim Öffnen nie auf das Netz (wichtig bei schlechtem Empfang im Studio).
   Eine neue Version erkennt der Browser an dieser Datei: Sie wird im Hintergrund
   vollständig geladen und erst dann – als Ganzes – aktiv.

   Bei jeder Änderung an den Dateien VERSION erhöhen
   (immer dieselbe Nummer wie APP_VERSION in app.js). */
const VERSION = 'fightclub-v13';
const PREFIX = 'fightclub-';
const FILES = [
  './', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'js/icons.js', 'js/data.js', 'js/sync.js', 'js/xlsx.js', 'js/scanner.js', 'js/fooddb.js', 'js/food.js', 'js/recipes.js',
  'vendor/barcode-detector.js', 'vendor/zxing_reader.wasm',
  'fonts/ibm-plex-sans.woff2', 'fonts/ibm-plex-mono-400.woff2', 'fonts/ibm-plex-mono-500.woff2',
  'icon-soap-180.png', 'icon-soap-192.png', 'icon-soap-512.png',
];
const SCOPE_PATH = new URL(self.registration.scope).pathname;

/** Antwort so ablegen, dass der Browser sie nicht von sich aus weiterverwendet: Er fragt
    bei jedem Laden diesen Speicher – und bekommt nach einem Update sicher die neue Fassung
    (der Server erlaubt sonst, Dateien zehn Minuten lang ungefragt wiederzuverwenden). */
function stored(res) {
  const headers = new Headers({ 'Cache-Control': 'no-cache' });
  const type = res.headers.get('Content-Type');
  if (type) headers.set('Content-Type', type);
  return new Response(res.body, { status: 200, headers });
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Mit Versions-Kennung laden: so kommt jede Datei frisch vom Server – weder der
    // Browser noch ein Zwischenspeicher im Netz kann eine alte Fassung liefern.
    // Schlägt eine Datei fehl, bleibt die bisherige Version vollständig aktiv.
    await Promise.all(FILES.map(async (f) => {
      const res = await fetch(new Request(`${f}?v=${VERSION}`, { cache: 'reload' }));
      if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
      await cache.put(new Request(f), stored(res));
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/** Aus dem Speicher antworten; nur was dort fehlt, kommt aus dem Netz (und wird gemerkt). */
async function fromCache(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  if (req.mode === 'navigate') {
    const page = await cache.match('index.html');
    if (page) return page;
  }
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') cache.put(req, stored(res.clone())).catch(() => {});
  return res;
}

/** config.js (Zugangsdaten für die Synchronisierung) lässt sich direkt auf GitHub ändern,
    ohne die Version zu erhöhen. Deshalb wird sie nach jedem Start im Hintergrund
    nachgeprüft; hat sie sich geändert, erfährt es die App. */
async function refreshConfig() {
  try {
    const res = await fetch(new Request('config.js', { cache: 'no-cache' }));
    if (!res.ok) return;
    const cache = await caches.open(VERSION);
    const old = await cache.match('config.js');
    const fresh = await res.clone().text();
    const before = old ? await old.text() : null;
    if (fresh === before) return;
    await cache.put(new Request('config.js'), stored(res));
    if (before === null) return;
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.postMessage({ type: 'config-changed' }));
  } catch (e) { /* offline – beim nächsten Start */ }
}

// Nur die eigenen Dateien – nie die Anfragen an Supabase (Sync) oder Open Food Facts.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return;
  if (req.cache === 'no-store') return;   // ausdrücklich „frisch vom Server“ (Verbindungstest)
  e.respondWith(fromCache(req));
  if (url.pathname === SCOPE_PATH + 'config.js') e.waitUntil(refreshConfig());
});
