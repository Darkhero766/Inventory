import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './auth';
import { ErrorBoundary } from '@/components/error-boundary';
import { hydrateInventoryState } from '@/lib/cloud-sync';
import './index.css';
import './ui-polish.css';
import './ui-upgrade.css';

function Bootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { hydrateInventoryState().finally(() => setReady(true)); }, []);
  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-[#f7f7fb] text-sm text-slate-400">Loading workspace…</div>;
  return <>{children}</>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Electronics Inventory: #root element was not found.');

createRoot(root).render(
  <ErrorBoundary>
    <Bootstrap>
      <AuthGate>
        <App />
      </AuthGate>
    </Bootstrap>
  </ErrorBoundary>,
);
