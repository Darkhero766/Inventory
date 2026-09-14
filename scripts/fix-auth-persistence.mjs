import fs from 'node:fs';

const path = 'artifacts/electronics-inventory/src/auth.tsx';
let source = fs.readFileSync(path, 'utf8');

// Keep the locally cached profile only as a visual bootstrap while Supabase
// restores its real persisted session. Authorization still comes exclusively
// from Supabase getSession(). This prevents a mobile refresh from flashing the
// login screen before the Supabase session has finished restoring.
source = source.replace(
  "const [session,setSession]=useState<Session|null>(null);",
  "const [session,setSession]=useState<Session|null>(()=>read<Session|null>(SESSION_KEY,null));",
);

// Supabase can emit an auth event with no session while the persisted session is
// being restored. Do not wipe the tenant cache on that transient event; the
// authoritative getSession() result below decides whether the user is logged in.
source = source.replace(
  "onAuthStateChange((_event,s)=>{if(s?.user)void sync(s.user);else if(alive){clearTenantCache();localStorage.removeItem(SESSION_KEY);localStorage.removeItem(PROFILE_KEY);setSession(null);setAuthReady(true);}})",
  "onAuthStateChange((_event,s)=>{if(s?.user)void sync(s.user);})",
);

fs.writeFileSync(path, source);
console.log('Persistent Supabase auth refresh patch applied.');
