import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';
import './ui-polish.css';

declare const __CAPACITOR_BUILD__: boolean;

// PWAs need the service worker for offline web installs. Capacitor APKs do
// not: their compiled web bundle is already local, and a service worker inside
// the Android WebView can interfere with Capacitor's local asset server.
if ('serviceWorker' in navigator && import.meta.env.PROD && !__CAPACITOR_BUILD__) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch((error) => {
      console.warn('Electronics Inventory offline support could not start.', error);
    });
  });
}

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
