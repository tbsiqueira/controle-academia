'use strict';

/* Service worker: cache-first for the app shell. No user data ever leaves the device. */

const CACHE_NAME = 'meu-treino-v4';

const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './vendor/bootstrap/bootstrap.min.css',
  './vendor/bootstrap/bootstrap.bundle.min.js',
  './vendor/bootstrap-icons/bootstrap-icons.min.css',
  './vendor/bootstrap-icons/fonts/bootstrap-icons.woff2',
  './vendor/bootstrap-icons/fonts/bootstrap-icons.woff',
  './js/db.js',
  './js/app.js',
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

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache/match by path only: fonts are requested with a cache-busting
  // query string (?hash), but ASSETS caches them without it.
  const cacheKey = url.origin + url.pathname;

  event.respondWith(
    caches.match(cacheKey).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, clone));
        }
        return response;
      });
    })
  );
});
