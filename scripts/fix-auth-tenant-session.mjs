import fs from 'node:fs';

const path = 'artifacts/electronics-inventory/src/auth.tsx';
let source = fs.readFileSync(path, 'utf8');

// Keep this patch idempotent. The source file and later build patches may already
// contain some of these changes, so never blindly add imports/declarations.
source = source.replace(
  /import \{\s*hydrateInventoryState\s*\} from '\.\/lib\/cloud-sync';/,
  "import { clearTenantCache, hydrateInventoryState } from './lib/cloud-sync';",
);

source = source.replace(
  /import \{\s*clearTenantCache,\s*hydrateInventoryState\s*\} from '\.\/lib\/cloud-sync';/g,
  "import { clearTenantCache, hydrateInventoryState } from './lib/cloud-sync';",
);

// Never boot the UI from the previous account's serialized profile. Supabase Auth
// is the source of truth; AuthGate will populate the session after getSession().
source = source.replace(
  /useState<Session\|null>\(\(\)=>read<Session\|null>\(SESSION_KEY,null\)\)/,
  'useState<Session|null>(null)',
);

// Replace the login/auth-change hydration sequence. Clear only when the
// authenticated owner actually changes, then fetch that owner's cloud state.
const oldSync = "const s=await buildSession(user);write(SESSION_KEY,s);write(PROFILE_KEY,s);if(alive)setSession(s);await hydrateInventoryState();";
const newSync = "const ownerKey='keystone-active-owner-id-v1';const previousOwner=localStorage.getItem(ownerKey);if(previousOwner!==user.id)clearTenantCache();const s=await buildSession(user);const loaded=await hydrateInventoryState();if(!alive)return;write(SESSION_KEY,s);write(PROFILE_KEY,s);window.dispatchEvent(new Event('keystone-session-change'));setSession(s);if(!loaded)console.warn('[auth] inventory hydration failed for authenticated user',user.id);";
if (source.includes(oldSync)) source = source.replace(oldSync, newSync);

// Sign-out must clear tenant-scoped inventory/profile state before another
// account can be rendered in the same browser.
const oldLogout = "const logout=async()=>{if(supabase)await supabase.auth.signOut();localStorage.removeItem(SESSION_KEY);localStorage.removeItem(PROFILE_KEY);setSession(null);setProfileOpen(false);};";
const newLogout = "const logout=async()=>{clearTenantCache();if(supabase)await supabase.auth.signOut();localStorage.removeItem(SESSION_KEY);localStorage.removeItem(PROFILE_KEY);setSession(null);setProfileOpen(false);window.location.assign('/');};";
if (source.includes(oldLogout)) source = source.replace(oldLogout, newLogout);

fs.writeFileSync(path, source);
console.log('Auth tenant-session isolation patch applied safely.');
