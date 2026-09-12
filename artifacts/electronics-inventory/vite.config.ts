import fs from 'node:fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const port = Number(process.env.PORT || 5000);
const basePath = process.env.BASE_PATH || '/';
const outputDir = path.resolve(import.meta.dirname, 'dist/public');

const devPlugins =
  process.env.REPL_ID !== undefined
    ? [
        await import('@replit/vite-plugin-cartographer').then((m) =>
          m.cartographer({ root: path.resolve(import.meta.dirname, '..') }),
        ),
        await import('@replit/vite-plugin-dev-banner').then((m) => m.devBanner()),
      ]
    : [];

// Render/static hosting can request /sales or /sales/checkout directly after a
// browser refresh. Emit the built SPA as 404.html so those routes boot React
// instead of showing the host's plain "Not Found" page.
const spaFallbackPlugin = {
  name: 'spa-fallback-404',
  closeBundle() {
    const indexFile = path.join(outputDir, 'index.html');
    const fallbackFile = path.join(outputDir, '404.html');
    if (fs.existsSync(indexFile)) fs.copyFileSync(indexFile, fallbackFile);
  },
};

export default defineConfig(({ mode }) => ({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    spaFallbackPlugin,
    ...(mode !== 'production' ? [runtimeErrorOverlay(), ...devPlugins] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: outputDir,
    emptyOutDir: true,
    sourcemap: mode !== 'production',
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: { strict: true },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
}));
