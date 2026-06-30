// ============================================================
// Malta Trip — Service Worker (offline support)
// Bump SHELL_VERSION whenever app shell files change to force
// clients to pick up the new versions.
// ============================================================
const SHELL_VERSION = 'malta-shell-v7';
const TILE_CACHE    = 'malta-tiles';     // OpenStreetMap map tiles (survives shell updates)
const WEATHER_CACHE = 'malta-weather';   // last good Open-Meteo response
const ROUTE_CACHE   = 'malta-routes';    // last good OSRM day routes
const ALLOWLIST     = [SHELL_VERSION, TILE_CACHE, WEATHER_CACHE, ROUTE_CACHE];

// Everything needed to boot the app with no network.
const APP_SHELL = [
  './index.html',
  './malta_trip.html',
  './styles.css',
  './app.js',
  './data.js',
  './firebase-config.js',
  './sync.js',
  './manifest.json',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  './vendor/sortable/Sortable.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './images/day1.jpg', './images/day2.jpg', './images/day3.jpg', './images/day4.jpg',
  './images/day5.jpg', './images/day6.jpg', './images/day7.jpg', './images/day8.jpg',
  './images/day9.jpg', './images/day10.jpg',
];

// ---- install: precache the app shell (tolerant of a missing file) ----
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_VERSION);
    await Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

// ---- activate: drop old shell caches, take control immediately ----
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !ALLOWLIST.includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ---- fetch routing ----
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Page navigations: try network, fall back to the cached app page offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./malta_trip.html')));
    return;
  }

  // Map tiles: cache-first, so revisited areas work offline.
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(cacheFirst(req, TILE_CACHE));
    return;
  }

  // Live weather: network-first, fall back to the last good response.
  if (url.hostname === 'api.open-meteo.com') {
    event.respondWith(networkFirst(req, WEATHER_CACHE));
    return;
  }

  // Day routes (OSRM): network-first so a viewed route works offline later.
  if (url.hostname === 'router.project-osrm.org') {
    event.respondWith(networkFirst(req, ROUTE_CACHE));
    return;
  }

  // Firebase SDK from gstatic: cache-first so sync code loads offline after first visit.
  if (url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/')) {
    event.respondWith(cacheFirst(req, SHELL_VERSION));
    return;
  }

  // Geocoding has no offline value — let it hit the network untouched.
  if (url.hostname === 'nominatim.openstreetmap.org') return;

  // Same-origin app assets: serve from cache instantly, refresh in the
  // background so edits/redeploys are picked up on the next load.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, SHELL_VERSION));
  }
});

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const network = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || network;
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // Cache normal OK responses AND opaque cross-origin ones (map tiles are
    // loaded as no-cors <img>, so they come back opaque with ok === false).
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return hit || Response.error();
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req);
    return hit || Response.error();
  }
}
