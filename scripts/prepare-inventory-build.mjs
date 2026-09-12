import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
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

// The dashboard previously rendered the demo name "Aarav" directly in App.tsx.
// Read the authenticated display name from the session cache instead.
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

// Checkout writes the sale + EMI plan locally and schedules cloud sync. A fast
// route transition could previously hydrate stale cloud data and overwrite the
// newly-created EMI plan. Keep the just-written local snapshot authoritative for
// a short hydration window while the debounced cloud sync completes.
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

console.log('Inventory source patches applied: dynamic account name + protected post-sale EMI hydration.');
