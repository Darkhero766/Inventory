import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BarChart3, Boxes, CheckCircle2, ClipboardList, Home, Menu, MoreHorizontal, ShoppingCart, Sparkles, WifiOff, X } from 'lucide-react';

const nav = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/purchases', label: 'Purchases', icon: ClipboardList },
  { href: '/sales', label: 'Sales', icon: ShoppingCart },
];

function OfflineStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online
    ? <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700 sm:flex"><CheckCircle2 className="h-3 w-3" /> Ready</span>
    : <span className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold text-amber-700"><WifiOff className="h-3 w-3" /> Offline</span>;
}

export function InventoryShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const active = (href: string) => href === '/' ? location === '/' : location.startsWith(href);
  const close = () => setOpen(false);

  return <div className="app-shell flex min-h-[100dvh] text-[hsl(var(--foreground))]">
    <aside className={`inventory-sidebar fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar)/.96)] px-4 py-5 shadow-[18px_0_60px_rgba(15,23,42,.04)] backdrop-blur-xl transition-transform duration-300 md:relative md:translate-x-0 md:shadow-none ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2">
        <Link href="/" onClick={close} className="flex min-w-0 items-center gap-3" data-testid="link-brand">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] shadow-[0_8px_20px_hsl(var(--sidebar-primary)/.25)]"><Sparkles className="h-4 w-4" /></span>
          <span className="min-w-0"><strong className="block truncate text-sm tracking-[-.02em]">Keystone</strong><span className="font-mono text-[9px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Stock desk</span></span>
        </Link>
        <button className="rounded-xl p-2 md:hidden" onClick={close} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>

      <div className="mt-9">
        <p className="mb-3 px-3 font-mono text-[9px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Workspace</p>
        {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={close} data-testid={`link-nav-${label.toLowerCase()}`} className={`mb-1 flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-sm transition-all ${active(href) ? 'bg-[hsl(var(--sidebar-accent))] font-bold text-[hsl(var(--sidebar-accent-foreground))] shadow-[inset_0_0_0_1px_hsl(var(--sidebar-primary)/.08)]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'}`}><Icon className="h-[17px] w-[17px]" /><span>{label}</span></Link>)}
      </div>

      <div className="mt-8">
        <p className="mb-3 px-3 font-mono text-[9px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Manage</p>
        <Link href="/stock-history" onClick={close} data-testid="link-nav-stock-history" className={`mb-1 flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-sm transition-all ${active('/stock-history') ? 'bg-[hsl(var(--sidebar-accent))] font-bold text-[hsl(var(--sidebar-accent-foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`}><BarChart3 className="h-[17px] w-[17px]" />Stock history</Link>
      </div>

      <div className="mt-auto rounded-[20px] border border-[hsl(var(--sidebar-border))] bg-[linear-gradient(145deg,hsl(var(--sidebar-accent)),hsl(var(--card)))] p-4">
        <p className="text-xs font-bold">A clear shelf, every day.</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Products, purchases and sales in one calm workspace.</p>
        <Link href="/inventory" onClick={close} className="mt-4 flex items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] px-3 py-2.5 text-xs font-bold transition hover:bg-[hsl(var(--card))]">Open inventory</Link>
      </div>
    </aside>

    {open && <button className="fixed inset-0 z-30 bg-[hsl(224_26%_16%/.28)] backdrop-blur-[2px] md:hidden" onClick={close} aria-label="Close navigation" />}

    <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[hsl(var(--border)/.8)] bg-[hsl(var(--background)/.84)] px-4 backdrop-blur-xl md:px-9">
        <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.7)] md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <div className="hidden md:block"><p className="font-mono text-[9px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Electronics stock desk</p><p className="mt-1 text-xs font-semibold">Inventory workspace</p></div>
        <div className="ml-auto flex items-center gap-2.5"><OfflineStatus /><div className="hidden text-right sm:block"><p className="text-xs font-bold">Aarav Mehta</p><p className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">Owner / Admin</p></div><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-xs font-extrabold text-[hsl(var(--accent-foreground))] ring-4 ring-[hsl(var(--accent)/.45)]">AM</div></div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 pb-24 pt-4 sm:px-5 md:px-9 md:pb-10 md:pt-8">{children}</main>
    </div>

    <nav className="mobile-nav-shadow fixed bottom-0 left-0 right-0 z-30 flex h-[72px] items-center justify-around border-t border-[hsl(var(--border)/.9)] bg-[hsl(var(--card)/.94)] px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
      {[...nav, { href: '/stock-history', label: 'More', icon: MoreHorizontal }].map(({ href, label, icon: Icon }) => <Link href={href} key={label} data-testid={`mobile-nav-${label.toLowerCase()}`} className={`flex min-w-[60px] flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold transition-all ${active(href) ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[0_5px_16px_hsl(var(--accent)/.55)]' : 'text-[hsl(var(--muted-foreground))]'}`}><Icon className="h-[18px] w-[18px]" />{label}</Link>)}
    </nav>
  </div>;
}
