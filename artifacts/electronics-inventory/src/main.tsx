import { ReactNode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './auth';
import { supabase } from './lib/supabase';
import { clearTenantCache, hydrateInventoryState, resetCloudHydration } from './lib/cloud-sync';
import { ErrorBoundary } from '@/components/error-boundary';
import './index.css';
import './ui-polish.css';
import './ui-upgrade.css';

function CloudHydrationGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    const hydrateForUser = async (userId: string | null) => {
      if (!userId) {
        clearTenantCache();
        resetCloudHydration();
        if (alive) {
          setOwnerId(null);
          setReady(false);
        }
        return;
      }

      // Supabase is the source of truth. Never carry React/local cache from
      // another authenticated account into this tenant.
      clearTenantCache();
      resetCloudHydration();
      if (alive) {
        setOwnerId(userId);
        setReady(false);
      }

      await hydrateInventoryState();
      if (alive) setReady(true);
    };

    supabase.auth.getSession().then(({ data }) => {
      void hydrateForUser(data.session?.user?.id ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateForUser(session?.user?.id ?? null);
    });

    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
      clearTenantCache();
      resetCloudHydration();
    };
  }, []);

  if (!ownerId || !ready) {
    return <div className="min-h-screen bg-[#f7f7fb]" aria-label="Loading workspace" />;
  }

  return <div key={ownerId}>{children}</div>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Electronics Inventory: #root element was not found.');

createRoot(root).render(
  <ErrorBoundary>
    <AuthGate>
      <CloudHydrationGate>
        <App />
      </CloudHydrationGate>
    </AuthGate>
  </ErrorBoundary>,
);
