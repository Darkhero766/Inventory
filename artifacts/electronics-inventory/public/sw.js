const CACHE_NAME = 'electronics-inventory-shell-v4';
const IMAGE_CACHE = 'electronics-inventory-images-v2';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((path) => new Request(new URL(path, self.registration.scope)))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![CACHE_NAME, IMAGE_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function cacheResponse(cacheName, request, response) {
  if (!response || (!response.ok && response.type !== 'opaque')) return response;
  const copy = response.clone();
  void caches.open(cacheName).then((cache) => cache.put(request, copy));
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate';
  const isImage = event.request.destination === 'image' || /images\.unsplash\.com|images\.pexels\.com/i.test(url.hostname);

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => cacheResponse(CACHE_NAME, new Request(new URL('./index.html', self.registration.scope)), response))
        .catch(() => caches.match(new URL('./index.html', self.registration.scope))),
    );
    return;
  }

  if (isImage) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => cacheResponse(IMAGE_CACHE, event.request, response))
          .catch(() => Response.error());
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => cacheResponse(CACHE_NAME, event.request, response))
        .catch(() => caches.match(new URL('./index.html', self.registration.scope)));
    }),
  );
});
