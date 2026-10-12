'use strict';

/* Service worker: offline shell for Meu Treino.
   - Navigations (HTML): network-first, so new versions roll out when online.
   - Hashed/versioned assets (?v=): exact match, so a version bump fetches fresh files.
   - Fonts (requested with ?hash): matched by path only.
   No user data ever leaves the device. */

const CACHE_NAME = 'meu-treino-v5';

const ASSETS = [
  './',
  './index.html',
  './css/styles.css?v=5',
  './vendor/bootstrap/bootstrap.min.css?v=5',
  './vendor/bootstrap/bootstrap.bundle.min.js?v=5',
  './vendor/bootstrap-icons/bootstrap-icons.min.css?v=5',
  './js/db.js?v=5',
  './js/app.js?v=5',
  './manifest.webmanifest',
  './data/exercises.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function putInCache(key, response) {
  if (!response || response.status !== 200) return response;
  const clone = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(key, clone));
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept the service worker script itself.
  if (url.pathname.slice(-6) === '/sw.js') return;

  // HTML navigations: network-first, cache as fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache(request, response))
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Versioned assets (?v=): exact URL match, so a new version is fetched fresh.
  // Everything else (fonts with ?hash): match by path, ignoring the query string.
  const key = url.searchParams.has('v') ? request.url : (url.origin + url.pathname);

  event.respondWith(
    caches.match(key).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => putInCache(key, response));
    })
  );
});
