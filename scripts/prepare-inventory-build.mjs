import fs from 'node:fs';
import path from 'node:path';

const required = [
  'artifacts/electronics-inventory/src/App.tsx',
  'artifacts/electronics-inventory/src/auth.tsx',
  'artifacts/electronics-inventory/src/lib/cloud-sync.ts',
  'artifacts/electronics-inventory/src/pages/sales-checkout.tsx',
];
for (const file of required) {
  if (!fs.existsSync(path.resolve(file))) {
    throw new Error(`Required source file is missing: ${file}`);
  }
}

function replaceExact(file, from, to, label) {
  const full = path.resolve(file);
  const source = fs.readFileSync(full, 'utf8');
  if (!source.includes(from)) {
    throw new Error(`Build patch target not found (${label}) in ${file}`);
  }
  fs.writeFileSync(full, source.replace(from, to), 'utf8');
}

// Dashboard: never use the old demo name. Read the current authenticated
// display name that AuthGate keeps in the session cache.
replaceExact(
  'artifacts/electronics-inventory/src/App.tsx',
  "function HomePage(){const {products,sales,emiPlans}=useInventory();",
  "function HomePage(){const {products,sales,emiPlans}=useInventory();const accountName=(()=>{try{return JSON.parse(localStorage.getItem('keystone-auth-session-v1')||'{}').name||'Account';}catch{return 'Account';}})();",
  'dashboard account name',
);
replaceExact(
  'artifacts/electronics-inventory/src/App.tsx',
  '>{greeting}, Aarav</h1>',
  '>{greeting}, {accountName}</h1>',
  'dashboard greeting',
);

// Profile: persist the display name in both Supabase Auth metadata and the
// public profiles row. This prevents a stale profiles.name (such as the old
// demo name) from replacing the user's new name on the next login.
replaceExact(
  'artifacts/electronics-inventory/src/auth.tsx',
  "if(data.user){const {error}=await supabase.auth.updateUser({data:{full_name:clean}});if(error)console.warn('[auth] name update:',error.message);}",
  "if(data.user){const {error}=await supabase.auth.updateUser({data:{full_name:clean}});if(error)console.warn('[auth] name update:',error.message);const {error:profileError}=await supabase.from('profiles').upsert({id:data.user.id,name:clean,email:session.email,role:session.role},{onConflict:'id'});if(profileError)console.warn('[auth] profile row update:',profileError.message);}",
  'profile persistence',
);

// Checkout: after a sale/EMI write, a quick route transition could hydrate an
// older cloud snapshot before the debounced sync finished. Hold hydration for
// a short window so the new local EMI plan remains visible while the snapshot
// sync completes.
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

console.log('Inventory source patches applied: dynamic account name, persistent profile name, protected post-sale EMI hydration.');
