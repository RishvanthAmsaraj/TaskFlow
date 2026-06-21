const CACHE_NAME = 'taskflow-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(response => response || fetch(e.request)));
});
