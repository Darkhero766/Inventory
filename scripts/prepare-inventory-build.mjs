import fs from 'node:fs';
import path from 'node:path';

const required = [
  'artifacts/electronics-inventory/src/App.tsx',
  'artifacts/electronics-inventory/src/auth.tsx',
  'artifacts/electronics-inventory/src/lib/cloud-sync.ts',
  'artifacts/electronics-inventory/src/pages/sales-checkout.tsx',
  'artifacts/electronics-inventory/src/pages/admin-console.tsx',
];
for (const file of required) {
  if (!fs.existsSync(path.resolve(file))) throw new Error(`Required source file is missing: ${file}`);
}

function replaceExact(file, from, to, label) {
  const full = path.resolve(file);
  const source = fs.readFileSync(full, 'utf8');
  if (!source.includes(from)) throw new Error(`Build patch target not found (${label}) in ${file}`);
  fs.writeFileSync(full, source.replace(from, to), 'utf8');
}

// Dashboard identity: always use the current authenticated profile instead
// of the old demo name, and update immediately after profile changes.
replaceExact(
  'artifacts/electronics-inventory/src/App.tsx',
  "function HomePage(){const {products,sales,emiPlans}=useInventory();",
  "function HomePage(){const {products,sales,emiPlans}=useInventory();const [accountName,setAccountName]=useState(()=>{try{return JSON.parse(localStorage.getItem('keystone-auth-session-v1')||'{}').name||'Account';}catch{return 'Account';}});useEffect(()=>{const sync=()=>{try{setAccountName(JSON.parse(localStorage.getItem('keystone-auth-session-v1')||'{}').name||'Account');}catch{setAccountName('Account');}};window.addEventListener('keystone-session-change',sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener('keystone-session-change',sync);window.removeEventListener('storage',sync);};},[]);",
  'dashboard account name state',
);
replaceExact('artifacts/electronics-inventory/src/App.tsx','>{greeting}, Aarav</h1>','>{greeting}, {accountName}</h1>','dashboard greeting');
replaceExact('artifacts/electronics-inventory/src/App.tsx','>AM</span>','>{accountName.slice(0,2).toUpperCase()}</span>','dashboard initials');

// Profile: persist the display name in both Supabase Auth metadata and the
// public profile row, then notify the rest of the app immediately.
replaceExact(
  'artifacts/electronics-inventory/src/auth.tsx',
  "if(data.user){const {error}=await supabase.auth.updateUser({data:{full_name:clean}});if(error)console.warn('[auth] name update:',error.message);}",
  "if(data.user){const {error}=await supabase.auth.updateUser({data:{full_name:clean}});if(error)console.warn('[auth] name update:',error.message);const {error:profileError}=await supabase.from('profiles').update({name:clean,updated_at:new Date().toISOString()}).eq('id',data.user.id);if(profileError)console.warn('[auth] profile row update:',profileError.message);}",
  'profile persistence',
);
replaceExact(
  'artifacts/electronics-inventory/src/auth.tsx',
  "write(SESSION_KEY,next);write(PROFILE_KEY,next);onUpdate(next);setSaved(true);",
  "write(SESSION_KEY,next);write(PROFILE_KEY,next);window.dispatchEvent(new Event('keystone-session-change'));onUpdate(next);setSaved(true);",
  'profile change event',
);

// Logging out of the platform admin must never leave a shop owner at /admin.
// Otherwise Wouter renders its 404 because /admin is intentionally only
// handled by InventoryShell for an authenticated admin session.
replaceExact(
  'artifacts/electronics-inventory/src/auth.tsx',
  "const logout=async()=>{if(supabase)await supabase.auth.signOut();localStorage.removeItem(SESSION_KEY);setSession(null);setProfileOpen(false);};",
  "const logout=async()=>{if(supabase)await supabase.auth.signOut();localStorage.removeItem(SESSION_KEY);localStorage.removeItem(PROFILE_KEY);setSession(null);setProfileOpen(false);window.location.assign('/');};",
  'logout route reset',
);
replaceExact(
  'artifacts/electronics-inventory/src/auth.tsx',
  "if(!session)return <LoginScreen onLogin={setSession}/>;",
  "if(!session)return <LoginScreen onLogin={s=>{if(s.role!=='admin'&&window.location.pathname==='/admin'){window.location.assign('/');return;}setSession(s);}}/>;",
  'shop owner admin-route guard',
);

// Checkout: protect the new local EMI state from an immediate stale cloud
// hydration while the debounced relational snapshot sync finishes.
replaceExact(
  'artifacts/electronics-inventory/src/lib/cloud-sync.ts',
  "export function resetCloudHydration(){bootPromise=null;}",
  "let localMutationHoldUntil=0;export function resetCloudHydration(){localMutationHoldUntil=Date.now()+2000;bootPromise=Promise.resolve(true);setTimeout(()=>{if(Date.now()>=localMutationHoldUntil)bootPromise=null;},2100);}",
  'post-checkout hydration guard',
);
replaceExact(
  'artifacts/electronics-inventory/src/lib/cloud-sync.ts',
  "export async function hydrateInventoryState(){const client=supabase;if(!client||typeof window==='undefined')return false;if(bootPromise)return bootPromise;",
  "export async function hydrateInventoryState(){const client=supabase;if(!client||typeof window==='undefined')return false;if(Date.now()<localMutationHoldUntil)return true;if(bootPromise)return bootPromise;",
  'hydration guard check',
);

console.log('Inventory source patches applied: SaaS identity, persistent profile updates, protected post-sale EMI hydration, safe admin logout routing.');
