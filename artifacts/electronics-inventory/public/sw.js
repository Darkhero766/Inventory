const SHELL_CACHE = 'electronics-inventory-shell-v5';
const IMAGE_CACHE = 'electronics-inventory-images-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL.map((path) => new Request(new URL(path, self.registration.scope)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => ![SHELL_CACHE, IMAGE_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function put(cacheName, request, response) {
  if (response && (response.ok || response.type === 'opaque')) {
    const copy = response.clone();
    void caches.open(cacheName).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const image = request.destination === 'image' || /images\\.(unsplash|pexels)\\.com$/i.test(url.hostname);

  // The document must always be launchable offline after the first online visit.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => put(SHELL_CACHE, new Request(new URL('./index.html', self.registration.scope)), response))
        .catch(() => caches.match(new URL('./index.html', self.registration.scope)))
    );
    return;
  }

  // Product images are cached as they are viewed so previously viewed products
  // remain visible without a connection.
  if (image) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => put(IMAGE_CACHE, request, response))
          .catch(() => Response.error());
      })
    );
    return;
  }

  // Never turn an API failure into index.html. Let the app's local state handle
  // offline data while static assets continue to work from cache.
  if (!sameOrigin || request.destination === 'script' || request.destination === 'style' || request.destination === 'font' || request.destination === 'manifest') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => put(SHELL_CACHE, request, response));
      })
    );
    return;
  }

  // Same-origin assets/data: network first, cached copy second.
  event.respondWith(
    fetch(request)
      .then((response) => put(SHELL_CACHE, request, response))
      .catch(() => caches.match(request))
  );
});
