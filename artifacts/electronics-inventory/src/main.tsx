import { createRoot } from 'react-dom/client';

import App from './App';
import { AuthGate } from './auth';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';
import './ui-polish.css';

// Web-only entry point. The app no longer registers a service worker or
// contains APK/offline boot logic, so the browser always loads the latest
// deployed JavaScript from Render.

const root = document.getElementById('root');

if (!root) {
  throw new Error('Electronics Inventory: #root element was not found.');
}

createRoot(root).render(
  <ErrorBoundary>
    <AuthGate>
      <App />
    </AuthGate>
  </ErrorBoundary>,
);
