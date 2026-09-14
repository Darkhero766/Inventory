import fs from 'node:fs';

const path = 'artifacts/electronics-inventory/src/auth.tsx';
let source = fs.readFileSync(path, 'utf8');

// Keep exactly one cloud-sync import. Auth must use Supabase's persisted session
// as the source of truth instead of trusting the previous browser-local session.
source = source.replace(/import \{[^\n]*\} from '\.\/lib\/cloud-sync';/, "import { clearTenantCache, hydrateInventoryState } from './lib/cloud-sync';");
if (!source.includes("import { clearTenantCache, hydrateInventoryState } from './lib/cloud-sync';")) {
  source = source.replace("import { supabase, supabaseConfigured } from './lib/supabase';", "import { supabase, supabaseConfigured } from './lib/supabase';\nimport { clearTenantCache, hydrateInventoryState } from './lib/cloud-sync';");
}

// Remove any old local declaration left by previous patches. clearTenantCache must
// only come from cloud-sync so logout and account switching cannot diverge.
source = source.replace(/\n(?:const|function) clearTenantCache[^\n]*\n?/g, '\n');

const start = source.indexOf('export function AuthGate');
if (start < 0) throw new Error('AuthGate anchor not found.');

const replacement = `export function AuthGate({children}:{children:ReactNode}){
 const [session,setSession]=useState<Session|null>(null);
 const [authReady,setAuthReady]=useState(false);
 const [profileOpen,setProfileOpen]=useState(false);
 useEffect(()=>{
   if(!supabaseConfigured||!supabase){setAuthReady(true);return;}
   let alive=true;
   const sync=async(user:any)=>{
     const email=String(user?.email||'').trim().toLowerCase();
     if(!email){if(alive)setAuthReady(true);return;}
     if(user?.app_metadata?.provider==='google'&&email!==ADMIN_EMAIL){
       await supabase!.auth.signOut();
       if(alive){setSession(null);setAuthReady(true);}
       return;
     }
     try{
       const ownerKey='keystone-active-owner-id-v1';
       const previousOwner=localStorage.getItem(ownerKey);
       if(previousOwner&&previousOwner!==user.id) clearTenantCache();
       const s=await buildSession(user);
       // Hydrate BEFORE rendering the inventory application. This removes the
       // race where InventoryProvider mounts with an empty cache and misses the
       // one-shot hydration event.
       const loaded=await hydrateInventoryState();
       if(!alive)return;
       write(SESSION_KEY,s);write(PROFILE_KEY,s);
       setSession(s);setAuthReady(true);
       window.dispatchEvent(new Event('keystone-session-change'));
       if(!loaded)console.warn('[auth] inventory hydration returned no data for authenticated user',user.id);
     }catch(error){
       console.warn('[auth] session bootstrap failed:',error);
       if(alive)setAuthReady(true);
     }
   };
   supabase.auth.getSession().then(({data})=>{void sync(data.session?.user??null);}).catch(error=>{console.warn('[auth] getSession failed:',error);if(alive)setAuthReady(true);});
   const {data}=supabase.auth.onAuthStateChange((_event,s)=>{if(s?.user)void sync(s.user);else if(alive){clearTenantCache();localStorage.removeItem(SESSION_KEY);localStorage.removeItem(PROFILE_KEY);setSession(null);setAuthReady(true);}});
   return()=>{alive=false;data.subscription.unsubscribe();};
 },[]);
 const logout=async()=>{
   clearTenantCache();
   if(supabase)await supabase.auth.signOut();
   localStorage.removeItem(SESSION_KEY);localStorage.removeItem(PROFILE_KEY);
   setSession(null);setProfileOpen(false);setAuthReady(true);
 };
 if(!authReady)return <div className="min-h-screen bg-[#f7f7fb] flex items-center justify-center"><div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-500 shadow-sm">Loading your workspace…</div></div>;
 if(!session)return <LoginScreen onLogin={setSession}/>;
 return <div className="relative"><button onClick={()=>setProfileOpen(true)} className="fixed right-3 top-3 z-[90] flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur"><span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-violet-100 text-[10px] font-black text-violet-700">{session.avatarUrl?<img src={session.avatarUrl} alt="" className="h-full w-full object-cover"/>:session.name.slice(0,2).toUpperCase()}</span><span className="hidden max-w-[140px] truncate pr-1 text-[10px] font-black text-slate-600 sm:block">{session.name}</span></button>{children}{profileOpen&&<ProfilePanel session={session} onClose={()=>setProfileOpen(false)} onLogout={logout} onUpdate={setSession}/>}</div>;
}
`;
source = source.slice(0,start) + replacement;
fs.writeFileSync(path, source);
console.log('Auth refresh/session bootstrap patch applied.');
