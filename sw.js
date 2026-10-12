'use strict';

/* Service worker: network-first with offline fallback.
   Online = always the freshest files; offline = last cached version.
   No user data ever leaves the device. */

const CACHE_NAME = 'meu-treino-v15';

const ASSETS = [
  './',
  './index.html',
  './reset.html',
  './css/styles.css?v=15',
  './vendor/bootstrap/bootstrap.min.css?v=15',
  './vendor/bootstrap/bootstrap.bundle.min.js?v=15',
  './vendor/bootstrap-icons/bootstrap-icons.min.css?v=15',
  './js/db.js?v=15',
  './js/app.js?v=15',
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
  if (response && response.status === 200) {
    const clone = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(key, clone));
  }
  return response;
}

async function fromCache(key, request) {
  const direct = await caches.match(key);
  if (direct) return direct;
  if (request.mode === 'navigate') {
    const index = await caches.match('./index.html');
    if (index) return index;
  }
  return Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept the service worker script itself.
  if (url.pathname.slice(-6) === '/sw.js') return;

  // Versioned assets (?v=) are cached under their exact URL;
  // everything else (fonts with ?hash) is cached by path only.
  const key = url.searchParams.has('v') ? request.url : (url.origin + url.pathname);

  event.respondWith(
    fetch(request)
      .then((response) => putInCache(key, response))
      .catch(() => fromCache(key, request))
  );
});
