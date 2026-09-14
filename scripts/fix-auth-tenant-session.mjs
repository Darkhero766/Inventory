import fs from 'node:fs';

const path = 'artifacts/electronics-inventory/src/auth.tsx';
let source = fs.readFileSync(path, 'utf8');

const replacements = [
  [
    "import { hydrateInventoryState } from './lib/cloud-sync';",
    "import { hydrateInventoryState } from './lib/cloud-sync';\nconst clearTenantCache=()=>{for(const key of ['keystone-products','keystone-history','keystone-purchases','keystone-sales','keystone-customers','keystone-emi-plans','keystone-emi-payments','keystone-active-owner-id-v1'])localStorage.removeItem(key);};",
  ],
  [
    "useState<Session|null>(()=>read<Session|null>(SESSION_KEY,null))",
    "useState<Session|null>(null)",
  ],
  [
    "const s=await buildSession(user);write(SESSION_KEY,s);write(PROFILE_KEY,s);if(alive)setSession(s);await hydrateInventoryState();",
    "const s=await buildSession(user);clearTenantCache();const loaded=await hydrateInventoryState();if(!alive)return;write(SESSION_KEY,s);write(PROFILE_KEY,s);setSession(s);if(!loaded)console.warn('[auth] inventory hydration failed for authenticated user',user.id);",
  ],
  [
    "localStorage.removeItem(SESSION_KEY);setSession(null);",
    "clearTenantCache();localStorage.removeItem(SESSION_KEY);localStorage.removeItem(PROFILE_KEY);setSession(null);",
  ],
];

for (const [from, to] of replacements) {
  if (!source.includes(from)) throw new Error(`Auth patch target not found: ${from}`);
  source = source.split(from).join(to);
}

fs.writeFileSync(path, source);
console.log('Auth tenant-session isolation patch applied.');
