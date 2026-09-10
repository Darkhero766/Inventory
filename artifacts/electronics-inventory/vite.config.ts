import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// Replit provides PORT/BASE_PATH during development. Capacitor APK builds
// need relative asset URLs so the app works from the local WebView bundle.
const port = Number(process.env.PORT || 5000);
const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';
const basePath = isCapacitorBuild
  ? './'
  : (process.env.BASE_PATH || '/');

// Generate the service worker from the actual Vite output. This is important
// because Vite hashes JS/CSS filenames; hard-coding a small shell can leave a
// newly installed PWA without one of the chunks it needs offline.
function offlinePwaPlugin(): Plugin {
  return {
    name: 'electronics-inventory-offline-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Native Capacitor builds must NOT contain/register a service worker.
      // Capacitor already serves the bundled web assets locally, and a service
      // worker inside the WebView can cause stale/blank native launches.
      if (isCapacitorBuild) {
        delete bundle['sw.js'];
        return;
      }

      const files = Object.keys(bundle).filter((fileName) => fileName !== 'sw.js');
      const cacheVersion = `electronics-inventory-${Date.now()}`;
      const precache = files.map((fileName) => `./${fileName}`);

      const sw = `
const CACHE_VERSION = ${JSON.stringify(cacheVersion)};
const PRECACHE = ${JSON.stringify(precache)};
const APP_SHELL = new URL('./index.html', self.registration.scope).toString();

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, self.registration.scope).toString())))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('electronics-inventory-') && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function cacheResponse(cacheName, request, response) {
  if (response && (response.ok || response.type === 'opaque')) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isImage = request.destination === 'image';

  // Keep the app launchable without internet. When online, refresh index.html
  // so a new deployment becomes available; when offline, use the local shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(CACHE_VERSION, new Request(APP_SHELL), response))
        .catch(() => caches.match(APP_SHELL))
    );
    return;
  }

  // Product images are often remote (e.g. Unsplash). Cache every image after
  // its first successful view so products already seen remain available offline.
  if (isImage) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => cacheResponse(CACHE_VERSION, request, response))
          .catch(() => Response.error());
      })
    );
    return;
  }

  // Local build assets are cache-first. This includes Vite's hashed JS/CSS
  // chunks, fonts and the manifest, so the UI can render without a network.
  if (sameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => cacheResponse(CACHE_VERSION, request, response));
      })
    );
  }
});
`;

      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw.trimStart() });
    },
  };
}

const devPlugins =
  process.env.REPL_ID !== undefined
    ? [
        await import('@replit/vite-plugin-cartographer').then((m) =>
          m.cartographer({
            root: path.resolve(import.meta.dirname, '..'),
          }),
        ),
        await import('@replit/vite-plugin-dev-banner').then((m) =>
          m.devBanner(),
        ),
      ]
    : [];

export default defineConfig(({ mode }) => ({
  base: basePath,
  define: {
    __CAPACITOR_BUILD__: JSON.stringify(isCapacitorBuild),
  },
  plugins: [
    react(),
    tailwindcss(),
    offlinePwaPlugin(),
    ...(mode !== 'production'
      ? [runtimeErrorOverlay(), ...devPlugins]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    sourcemap: mode !== 'production',
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
}));
