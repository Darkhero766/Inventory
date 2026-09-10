import { createRoot } from 'react-dom/client';

import App from './App';
import { AuthGate } from './auth';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';
import './ui-polish.css';
import './ui-upgrade.css';

// Web-only entry point. No APK/offline boot logic is registered.
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
