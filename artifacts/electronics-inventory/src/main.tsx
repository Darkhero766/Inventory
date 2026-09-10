import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';
import './ui-polish.css';

// Web build: keep startup independent from the old Capacitor/APK work.
// Referencing an undeclared build-time constant here caused a ReferenceError
// before React could mount, which resulted in a completely blank page on Render.
const isCapacitorBuild = false;

// Keep the PWA service worker for the web install experience. It is harmless
// for the normal online web app and can cache the shell after the first visit.
if ('serviceWorker' in navigator && import.meta.env.PROD && !isCapacitorBuild) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).catch((error) => {
      console.warn('Electronics Inventory service worker could not start.', error);
    });
  });
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('Electronics Inventory: #root element was not found.');
}

createRoot(root, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
