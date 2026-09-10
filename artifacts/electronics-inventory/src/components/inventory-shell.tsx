import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BarChart3, Boxes, ClipboardList, Home, Menu, MoreHorizontal, PackagePlus, ShoppingCart, Sparkles, X } from 'lucide-react';

const nav = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/purchases', label: 'Purchases', icon: ClipboardList },
  { href: '/sales', label: 'Sales', icon: ShoppingCart },
];

export function InventoryShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const active = (href: string) => href === '/' ? location === '/' : location.startsWith(href);
  const close = () => setOpen(false);

  return (
    <div className="app-shell flex text-[hsl(var(--foreground))]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] p-5 transition-transform md:relative md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between">
          <Link href="/" onClick={close} className="flex items-center gap-3" data-testid="link-brand">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><Sparkles className="h-4 w-4" /></span>
            <span><strong className="block text-sm tracking-[-.02em]">Keystone</strong><span className="font-mono text-[9px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Stock desk</span></span>
          </Link>
          <button className="rounded-lg p-2 md:hidden" onClick={close} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-10">
          <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Workspace</p>
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={close} data-testid={`link-nav-${label.toLowerCase()}`} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${active(href) ? 'bg-[hsl(var(--sidebar-accent))] font-semibold text-[hsl(var(--sidebar-accent-foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'}`}>
              <Icon className="h-[17px] w-[17px]" /><span>{label}</span>
            </Link>
          ))}
        </div>
        <div className="mt-8">
          <p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Manage</p>
          <Link href="/stock-history" onClick={close} data-testid="link-nav-stock-history" className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${active('/stock-history') ? 'bg-[hsl(var(--sidebar-accent))] font-semibold text-[hsl(var(--sidebar-accent-foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`}>
            <BarChart3 className="h-[17px] w-[17px]" />Stock history
          </Link>
        </div>
        <div className="mt-auto rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent))] p-4">
          <p className="text-xs font-semibold">A clear shelf, every day.</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Keep products, purchases and sales in one calm place.</p>
          <Link href="/inventory/new" onClick={close} data-testid="link-add-product-sidebar" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--sidebar-primary))] px-3 py-2.5 text-xs font-bold text-[hsl(var(--sidebar-primary-foreground))]">
            <PackagePlus className="h-3.5 w-3.5" /> Add product
          </Link>
        </div>
      </aside>
      {open && <button className="fixed inset-0 z-30 bg-[hsl(224_26%_16%/.28)] md:hidden" onClick={close} aria-label="Close navigation" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.88)] px-4 backdrop-blur md:px-9">
          <button className="rounded-xl p-2 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="hidden md:block"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Electronics stock desk</p></div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-xs font-semibold">Aarav Mehta</p><p className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">Owner / Admin</p></div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-xs font-bold text-[hsl(var(--accent-foreground))]">AM</div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-24 pt-5 md:px-9 md:pb-10 md:pt-8">{children}</main>
      </div>
      <nav className="mobile-nav-shadow fixed bottom-0 left-0 right-0 z-30 flex h-[70px] items-center justify-around border-t border-[hsl(var(--border))] bg-[hsl(var(--card)/.97)] px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {[...nav, { href: '/stock-history', label: 'More', icon: MoreHorizontal }].map(({ href, label, icon: Icon }) => (
          <Link href={href} key={label} data-testid={`mobile-nav-${label.toLowerCase()}`} className={`flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium ${active(href) ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
            <Icon className="h-[18px] w-[18px]" />{label}
          </Link>
        ))}
      </nav>
    </div>
  );
}