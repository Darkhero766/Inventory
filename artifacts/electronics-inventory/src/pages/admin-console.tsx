import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Users, RefreshCw, UserCog, Check, AlertTriangle } from 'lucide-react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';

type Role = 'admin' | 'staff';
type Profile = { id:string; name:string|null; email:string|null; role:Role; created_at:string; updated_at?:string|null };

const money=(v:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v);

export default function AdminConsole(){
  const [,setLocation]=useLocation();
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [stats,setStats]=useState({products:0,sales:0,customers:0,emi:0});

  const load=async()=>{
    setLoading(true);setError('');
    try{
      if(!supabase) throw new Error('Supabase is not configured.');
      const {data:userData}=await supabase.auth.getUser();
      const user=userData.user;
      if(!user?.email) throw new Error('You must be signed in.');
      const {data:me,error:meError}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
      if(meError) throw meError;
      if(me?.role!=='admin') { setLocation('/'); return; }
      const [{data:list,error:listError},{count:products},{count:sales},{count:customers},{count:emi}]=await Promise.all([
        supabase.from('profiles').select('id,name,email,role,created_at,updated_at').order('created_at',{ascending:false}),
        supabase.from('products').select('id',{count:'exact',head:true}),
        supabase.from('sales').select('id',{count:'exact',head:true}),
        supabase.from('customers').select('id',{count:'exact',head:true}),
        supabase.from('emi_plans').select('id',{count:'exact',head:true}),
      ]);
      if(listError) throw listError;
      setProfiles((list||[]) as Profile[]);setStats({products:products||0,sales:sales||0,customers:customers||0,emi:emi||0});
    }catch(e){setError(e instanceof Error?e.message:'Unable to load admin console.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);

  const staffCount=useMemo(()=>profiles.filter(p=>p.role==='staff').length,[profiles]);
  const updateRole=async(profile:Profile)=>{
    if(!supabase||profile.role==='admin'&&profiles.filter(p=>p.role==='admin').length<=1) return;
    setSaving(profile.id);setError('');setMessage('');
    try{
      const next:Role=profile.role==='admin'?'staff':'admin';
      if(next==='staff'&&profile.email?.toLowerCase()==='nightowlclub72@gmail.com') throw new Error('The workspace owner must remain an admin.');
      const {error:e}=await supabase.from('profiles').update({role:next,updated_at:new Date().toISOString()}).eq('id',profile.id);
      if(e)throw e;
      setProfiles(prev=>prev.map(p=>p.id===profile.id?{...p,role:next}:p));setMessage(`${profile.email||profile.name||'Account'} is now ${next}.`);
    }catch(e){setError(e instanceof Error?e.message:'Unable to change role.');}
    finally{setSaving(null);}
  };

  return <div className="fade-up mx-auto max-w-6xl">
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Owner / Control room</p><h1 className="mt-2 text-3xl font-bold tracking-[-.045em] md:text-4xl">Admin console</h1><p className="mt-2 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">Manage workspace accounts and see a live overview of the shop.</p></div>
      <button onClick={()=>void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-semibold"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</button>
    </div>
    {error&&<div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><div><p className="font-bold">Admin data unavailable</p><p className="mt-1">{error}</p><p className="mt-2 text-xs">If this mentions the profiles table or permissions, run the admin SQL migration in Supabase first.</p></div></div>}
    {message&&<div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4"/>{message}</div>}
    <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">
      {[['Accounts',profiles.length,Users],['Staff',staffCount,UserCog],['Products',stats.products,ShieldCheck],['Sales',stats.sales,Check]].map(([label,value,Icon])=>{const I=Icon as typeof Users;return <div key={String(label)} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm"><I className="h-4 w-4 text-[hsl(var(--primary))]"/><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-1 text-2xl font-extrabold">{value as number}</p></div>})}
    </div>
    <section className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><p className="text-sm font-extrabold">Workspace accounts</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Admin can promote or demote accounts. Authentication passwords stay in Supabase Auth.</p></div><span className="rounded-full bg-[hsl(var(--accent))] px-3 py-1 text-[10px] font-bold">{profiles.length} accounts</span></div>
      {loading?<div className="p-8 text-sm text-[hsl(var(--muted-foreground))]">Loading accounts…</div>:profiles.length===0?<div className="p-8 text-sm text-[hsl(var(--muted-foreground))]">No profiles found.</div>:<div>{profiles.map(p=><div key={p.id} className="flex flex-col gap-3 border-b border-[hsl(var(--border))] px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-bold">{p.name||p.email?.split('@')[0]||'Account'}</p><p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{p.email||'No email'} · joined {new Date(p.created_at).toLocaleDateString('en-IN')}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${p.role==='admin'?'bg-violet-100 text-violet-700':'bg-slate-100 text-slate-600'}`}>{p.role}</span><button disabled={saving===p.id||p.email?.toLowerCase()==='nightowlclub72@gmail.com'} onClick={()=>void updateRole(p)} className="rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-[10px] font-bold disabled:opacity-40">{saving===p.id?'Saving…':p.role==='admin'?'Make staff':'Make admin'}</button></div></div>)}</div>}
    </section>
    <div className="mt-5 rounded-2xl border border-dashed border-[hsl(var(--border))] p-4 text-xs text-[hsl(var(--muted-foreground))]">Security note: the page checks the signed-in user's <b>profiles.role</b>. Database RLS should also restrict profile administration to admins; the UI is not the security boundary.</div>
  </div>;
}
