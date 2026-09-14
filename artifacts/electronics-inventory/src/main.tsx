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
  const [ready, setReady] = useState(() => !supabase);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let alive = true;

    const hydrateForUser = async (userId: string | null) => {
      if (!userId) {
        clearTenantCache();
        resetCloudHydration();
        if (alive) setReady(false);
        return;
      }

      // IMPORTANT: do not mount InventoryProvider until the tenant's cloud
      // state has been loaded. InventoryProvider initializes React state from
      // localStorage; mounting it first creates the startup race that used to
      // leave a perfectly valid Supabase tenant showing zero rows.
      if (alive) setReady(false);
      try {
        await hydrateInventoryState();
      } catch (error) {
        console.warn('[cloud] background hydration failed:', error);
      } finally {
        if (alive) setReady(true);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      void hydrateForUser(data.session?.user?.id ?? null);
    }).catch(() => {
      if (alive) setReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateForUser(session?.user?.id ?? null);
    });

    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
      resetCloudHydration();
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#f7f7fb] flex items-center justify-center text-slate-500">
        <div className="text-center">
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-violet-600" />
          <p className="text-sm font-semibold">Loading your shop…</p>
        </div>
      </div>
    );
  }

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
