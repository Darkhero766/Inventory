import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// Replit provides PORT/BASE_PATH during development. Capacitor APK builds
// need relative asset URLs so the app works from the local WebView bundle.
const port = Number(process.env.PORT || 5000);
const basePath = process.env.CAPACITOR_BUILD === 'true'
  ? './'
  : (process.env.BASE_PATH || '/');

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
  plugins: [
    react(),
    tailwindcss(),
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
