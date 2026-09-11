import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BarChart3, Boxes, ClipboardList, Home, LogOut, Menu, ShoppingCart, Sparkles, Users, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const nav = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/purchases', label: 'Purchases', icon: ClipboardList },
  { href: '/sales', label: 'Sales', icon: ShoppingCart },
  { href: '/customers', label: 'Customers', icon: Users },
];
type Session = { username:string; role:'admin'|'staff'; name?:string; email?:string; avatarUrl?:string };
const KEY='keystone-auth-session-v1';
const read=():Session|null=>{try{const r=localStorage.getItem(KEY);return r?JSON.parse(r):null;}catch{return null;}};

export function InventoryShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open,setOpen]=useState(false);
  const [session,setSession]=useState<Session|null>(()=>read());
  const [accountOpen,setAccountOpen]=useState(false);
  useEffect(()=>{const sync=()=>setSession(read());window.addEventListener('storage',sync);window.addEventListener('keystone-session-change',sync);return()=>{window.removeEventListener('storage',sync);window.removeEventListener('keystone-session-change',sync);};},[]);
  const active=(href:string)=>href==='/'?location==='/':location.startsWith(href);
  const logout=async()=>{if(supabase) await supabase.auth.signOut();localStorage.removeItem(KEY);window.dispatchEvent(new Event('keystone-session-change'));setSession(null);setAccountOpen(false);window.location.assign('/');};
  return <div className="app-shell flex min-h-[100dvh] text-[hsl(var(--foreground))]">
    <aside className={`inventory-sidebar fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar)/.96)] px-4 py-5 shadow-[18px_0_60px_rgba(15,23,42,.04)] backdrop-blur-xl transition-transform duration-300 md:relative md:translate-x-0 md:shadow-none ${open?'translate-x-0':'-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2"><Link href="/" onClick={()=>setOpen(false)} className="flex min-w-0 items-center gap-3"><span className="brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><Sparkles className="h-4 w-4"/></span><span className="min-w-0"><strong className="block truncate text-sm">Keystone</strong><span className="font-mono text-[9px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Stock desk</span></span></Link><button className="rounded-xl p-2 md:hidden" onClick={()=>setOpen(false)} aria-label="Close menu"><X className="h-5 w-5"/></button></div>
      <div className="mt-9"><p className="mb-3 px-3 font-mono text-[9px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Workspace</p>{nav.map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>setOpen(false)} className={`mb-1 flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-sm transition-all ${active(href)?'bg-[hsl(var(--sidebar-accent))] font-bold text-[hsl(var(--sidebar-accent-foreground))]':'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'}`}><Icon className="h-[17px] w-[17px]"/><span>{label}</span></Link>)}</div>
      <div className="mt-8"><p className="mb-3 px-3 font-mono text-[9px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Manage</p><Link href="/stock-history" onClick={()=>setOpen(false)} className={`mb-1 flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-sm transition-all ${active('/stock-history')?'bg-[hsl(var(--sidebar-accent))] font-bold text-[hsl(var(--sidebar-accent-foreground))]':'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`}><BarChart3 className="h-[17px] w-[17px]"/>Stock history</Link></div>
      <div className="mt-auto rounded-[20px] border border-[hsl(var(--sidebar-border))] bg-[linear-gradient(145deg,hsl(var(--sidebar-accent)),hsl(var(--card)))] p-4"><p className="text-xs font-bold">A clear shelf, every day.</p><p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Products, customers, purchases and sales in one calm workspace.</p><Link href="/inventory" onClick={()=>setOpen(false)} className="mt-4 flex items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] px-3 py-2.5 text-xs font-bold">Open inventory</Link></div>
    </aside>
    {open&&<button className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={()=>setOpen(false)} aria-label="Close navigation"/>}
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[hsl(var(--border)/.8)] bg-[hsl(var(--background)/.84)] px-4 backdrop-blur-xl md:px-9">
        <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.7)] shadow-sm md:hidden" onClick={()=>setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5"/></button>
        <div className="hidden md:block"><p className="font-mono text-[9px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Electronics stock desk</p><p className="mt-1 text-xs font-semibold">Inventory workspace</p></div>
        <div className="relative ml-auto"><button onClick={()=>setAccountOpen(v=>!v)} className="flex items-center gap-2.5 rounded-full p-1.5 transition hover:bg-[hsl(var(--muted))]" aria-label="Open account menu"><div className="hidden text-right sm:block"><p className="text-xs font-bold">{session?.name||session?.email||'Account'}</p><p className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{session?.role==='admin'?'Owner / Admin':'Staff'}</p></div><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[hsl(var(--accent))] text-xs font-extrabold ring-4 ring-[hsl(var(--accent)/.45)]">{session?.avatarUrl?<img src={session.avatarUrl} alt="" className="h-full w-full object-cover"/>:(session?.name||session?.email||'AC').slice(0,2).toUpperCase()}</div></button>{accountOpen&&<div className="absolute right-0 top-12 w-[260px] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-2xl"><div className="rounded-xl bg-[hsl(var(--muted))] p-3"><p className="text-sm font-black">{session?.name||'Account'}</p><p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{session?.email||session?.username}</p></div><button onClick={logout} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4"/>Log out</button></div>}</div>
      </header>
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 pb-24 pt-4 sm:px-5 md:px-9 md:pb-10 md:pt-8">{children}</main>
    </div>
    <nav className="mobile-nav-shadow fixed bottom-0 left-0 right-0 z-30 flex h-[76px] items-center justify-around border-t border-[hsl(var(--border)/.9)] bg-[hsl(var(--card)/.94)] px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">{nav.map(({href,label,icon:Icon})=><Link href={href} key={label} className={`flex min-w-[58px] flex-col items-center gap-1 rounded-2xl px-1.5 py-2 text-[9px] font-bold ${active(href)?'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[0_5px_16px_hsl(var(--accent)/.55)]':'text-[hsl(var(--muted-foreground))]'}`}><Icon className="h-[17px] w-[17px]"/>{label}</Link>)}</nav>
  </div>;
}
