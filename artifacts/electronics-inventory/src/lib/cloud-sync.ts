import { supabase } from './supabase';

const KEYS = ['keystone-products','keystone-history','keystone-purchases','keystone-sales','keystone-customers','keystone-emi-plans','keystone-emi-payments'] as const;
let hydrating = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let bootPromise: Promise<boolean> | null = null;

const snapshot = () => Object.fromEntries(KEYS.map(key => {
  try { return [key, JSON.parse(localStorage.getItem(key) || 'null')]; } catch { return [key, null]; }
}));

async function ensureSession() {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  if (data.session) return true;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) { console.warn('[cloud] Supabase anonymous auth unavailable:', error.message); return false; }
  return true;
}

export async function hydrateInventoryState() {
  if (!supabase || typeof window === 'undefined') return false;
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    if (!(await ensureSession())) return false;
    const { data, error } = await supabase.from('inventory_state').select('state').eq('workspace_key', 'default').maybeSingle();
    if (error) { console.warn('[cloud] state read failed:', error.message); return false; }
    if (!data?.state) return false;
    hydrating = true;
    try {
      const state = data.state as Record<string, unknown>;
      for (const key of KEYS) if (state[key] !== undefined && state[key] !== null) localStorage.setItem(key, JSON.stringify(state[key]));
    } finally { hydrating = false; }
    return true;
  })();
  return bootPromise;
}

export function syncInventoryState() {
  if (!supabase || typeof window === 'undefined' || hydrating) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    if (!(await ensureSession())) return;
    const { error } = await supabase.from('inventory_state').upsert({ workspace_key: 'default', state: snapshot(), updated_at: new Date().toISOString() }, { onConflict: 'workspace_key' });
    if (error) console.warn('[cloud] state write failed:', error.message);
  }, 350);
}

export const cloudSyncConfigured = () => Boolean(supabase);
