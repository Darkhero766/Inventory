import { useEffect, useState } from 'react';
import { Activity, Building2, CircleDollarSign, Package, RefreshCw, ShieldCheck, Store, Users, WalletCards, AlertTriangle } from 'lucide-react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';

type Shop = {
  shop_id:string; shop_name:string; business_type:string; status:'ACTIVE'|'SUSPENDED'|'CLOSED'; created_at:string;
  owner_id:string; owner_name:string|null; owner_email:string|null; products:number; customers:number; sales:number;
  revenue:number; profit:number; emi_outstanding:number;
};
type Overview = {
  owners:number; shops:number; active_shops:number; products:number; customers:number; sales:number;
  revenue:number; profit:number; emi_plans:number; emi_outstanding:number; shops_detail:Shop[];
};

const money=(v:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(v)||0);
const date=(v:string)=>new Date(v).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});

export default function AdminConsole(){
  const [,setLocation]=useLocation();
  const [data,setData]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [lastLoaded,setLastLoaded]=useState('');

  const load=async()=>{
    setLoading(true);setError('');
    try{
      if(!supabase)throw new Error('Supabase is not configured.');
      const {data:userData,error:userError}=await supabase.auth.getUser();
      if(userError)throw userError;
      const user=userData.user;
      if(!user?.id){setLocation('/');return;}
      const {data:profile,error:profileError}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
      if(profileError)throw profileError;
      if(profile?.role!=='admin'){setLocation('/');return;}
      const {data:overview,error:overviewError}=await supabase.rpc('platform_admin_overview');
      if(overviewError)throw overviewError;
      setData((overview||null) as Overview|null);setLastLoaded(new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}));
    }catch(e){setError(e instanceof Error?e.message:'Unable to load platform control room.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);

  const cards=[
    {label:'Shop owners',value:data?.owners??0,icon:Users},
    {label:'Shops',value:data?.shops??0,icon:Store},
    {label:'Active shops',value:data?.active_shops??0,icon:Activity},
    {label:'Products',value:data?.products??0,icon:Package},
    {label:'Customers',value:data?.customers??0,icon:Users},
    {label:'Completed sales',value:data?.sales??0,icon:CircleDollarSign},
  ];

  return <div className="fade-up mx-auto max-w-7xl">
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--muted-foreground))]">Platform / Control room</p><h1 className="mt-2 text-3xl font-bold tracking-[-.05em] md:text-4xl">Keystone Platform</h1><p className="mt-2 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">One view of every shop owner, shop and business metric across the platform.</p></div>
      <button onClick={()=>void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-semibold shadow-sm"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</button>
    </div>
    {error&&<div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><div><p className="font-bold">Platform data unavailable</p><p className="mt-1">{error}</p><p className="mt-2 text-xs">Run the latest multi-tenant SQL migration in Supabase, then refresh this page.</p></div></div>}

    <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map(({label,value:val,icon:Icon})=><div key={label} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm"><Icon className="h-4 w-4 text-[hsl(var(--primary))]"/><p className="mt-3 text-[11px] text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-1 text-2xl font-extrabold tracking-[-.04em]">{loading?'—':val}</p></div>)}
    </div>

    <div className="mb-7 grid gap-3 sm:grid-cols-3">
      <div className="rounded-3xl bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))] shadow-lg"><p className="text-[10px] font-mono uppercase tracking-[.18em] opacity-55">Platform revenue</p><p className="mt-3 text-3xl font-extrabold tracking-[-.05em]">{loading?'—':money(data?.revenue??0)}</p><p className="mt-1 text-xs opacity-55">Completed sales across all shops</p></div>
      <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm"><p className="text-[10px] font-mono uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Platform profit</p><p className="mt-3 text-3xl font-extrabold tracking-[-.05em]">{loading?'—':money(data?.profit??0)}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Recorded profit from completed sales</p></div>
      <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm"><p className="text-[10px] font-mono uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">EMI outstanding</p><p className="mt-3 text-3xl font-extrabold tracking-[-.05em]">{loading?'—':money(data?.emi_outstanding??0)}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Across all active customer plans</p></div>
    </div>

    <section className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
      <div className="flex flex-col gap-2 border-b border-[hsl(var(--border))] px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[hsl(var(--primary))]"/><p className="text-sm font-extrabold">Shop owners & shops</p></div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Every owner gets one isolated shop workspace. Platform admins can observe aggregate activity without sharing tenant data.</p></div><span className="rounded-full bg-[hsl(var(--accent))] px-3 py-1 text-[10px] font-bold">{data?.shops??0} shops</span></div>
      {loading?<div className="p-8 text-sm text-[hsl(var(--muted-foreground))]">Loading platform data…</div>:!data?.shops_detail?.length?<div className="p-8 text-sm text-[hsl(var(--muted-foreground))]">No shop owners have joined yet.</div>:<div className="divide-y divide-[hsl(var(--border))]">{data.shops_detail.map(shop=><div key={shop.shop_id} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-extrabold">{shop.shop_name}</h3><span className={`rounded-full px-2 py-1 text-[9px] font-black ${shop.status==='ACTIVE'?'bg-emerald-50 text-emerald-700':shop.status==='SUSPENDED'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-600'}`}>{shop.status}</span></div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Owner: <span className="font-semibold text-[hsl(var(--foreground))]">{shop.owner_name||'Unnamed owner'}</span> · {shop.owner_email||'No email'}</p><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{shop.business_type} · joined {date(shop.created_at)}</p></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:min-w-[610px]"><Metric label="Products" value={shop.products}/><Metric label="Customers" value={shop.customers}/><Metric label="Sales" value={shop.sales}/><Metric label="Revenue" value={money(shop.revenue)}/><Metric label="Profit" value={money(shop.profit)}/><Metric label="EMI due" value={money(shop.emi_outstanding)}/></div></div></div>)}</div>}
    </section>

    <div className="mt-5 flex items-center gap-2 rounded-2xl border border-dashed border-[hsl(var(--border))] p-4 text-xs text-[hsl(var(--muted-foreground))]"><ShieldCheck className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]"/><span>Security boundary: tenant data remains protected by RLS. Platform-wide figures are exposed only through the database security-definer analytics function after an admin-role check.{lastLoaded&&` Last refreshed ${lastLoaded}.`}</span></div>
  </div>;
}

function Metric({label,value}:{label:string;value:string|number}){return <div className="rounded-xl bg-[hsl(var(--muted)/.55)] p-2.5"><p className="text-[9px] text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-1 truncate text-xs font-extrabold">{value}</p></div>}
