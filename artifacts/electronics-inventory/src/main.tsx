import { ReactNode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './auth';
import AdminConsole from './pages/admin-console';
import { supabase } from './lib/supabase';
import { clearTenantCache, hydrateInventoryState, resetCloudHydration } from './lib/cloud-sync';
import { ErrorBoundary } from '@/components/error-boundary';
import './index.css';
import './ui-polish.css';
import './ui-upgrade.css';

function CloudHydrationGate({ children }: { children: ReactNode }) {
  const [, setReady] = useState(false);
  const [, setOwnerId] = useState<string | null>(null);

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

      // Do not block the first paint on Supabase. The application already has
      // a local cache and individual pages can render from it immediately.
      // Cloud data is refreshed in the background and the hydration event lets
      // interested screens update when it is ready.
      if (alive) {
        setOwnerId(userId);
        setReady(true);
      }

      try {
        await hydrateInventoryState();
      } catch (error) {
        console.warn('[cloud] background hydration failed:', error);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      void hydrateForUser(data.session?.user?.id ?? null);
    }).catch(() => undefined);

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateForUser(session?.user?.id ?? null);
    });

    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
      resetCloudHydration();
    };
  }, []);

  // AuthGate is responsible for deciding whether a user is signed in. Once
  // mounted, always paint the app immediately instead of showing a blank page
  // while several Supabase queries complete.
  return <>{children}</>;
}

function PlatformEntry() {
  const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
  return isAdminRoute ? <AdminConsole /> : <CloudHydrationGate><App /></CloudHydrationGate>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Electronics Inventory: #root element was not found.');

createRoot(root).render(
  <ErrorBoundary>
    <AuthGate>
      <PlatformEntry />
    </AuthGate>
  </ErrorBoundary>,
);
