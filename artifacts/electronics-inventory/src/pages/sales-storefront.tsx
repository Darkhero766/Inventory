import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { Product, readStore, seedProducts, writeStore } from '@/lib/inventory';
import { hydrateInventoryState } from '@/lib/cloud-sync';
import { ProductImage } from '@/components/product-card';

const money = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);
const input = 'h-11 w-full rounded-2xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3.5 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.14)]';
type CartLine = { productId: string; quantity: number };

export default function SalesStorefront() {
  const [, setLocation] = useLocation();
  const [products, setProducts] = useState<Product[]>(() => readStore('keystone-products', seedProducts));
  const [cart, setCart] = useState<CartLine[]>(() => readStore('keystone-sale-draft', []));
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let active = true;
    void hydrateInventoryState().then(() => {
      if (!active) return;
      setProducts(readStore('keystone-products', seedProducts));
      setCart(readStore('keystone-sale-draft', []));
      setHydrating(false);
    }).catch(() => { if (active) setHydrating(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { writeStore('keystone-sale-draft', cart); }, [cart]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))], [products]);
  const filtered = useMemo(() => products.filter(p => p.quantity > 0 && (category === 'All' || p.category === category) && `${p.name} ${p.brand} ${p.model} ${p.sku}`.toLowerCase().includes(search.toLowerCase())), [products, search, category]);
  const cartItems = useMemo(() => cart.map(line => ({ ...line, product: products.find(p => p.id === line.productId) })).filter(x => x.product), [cart, products]);
  const count = cart.reduce((sum, x) => sum + x.quantity, 0);
  const total = cartItems.reduce((sum, x) => sum + (x.product?.sellingPrice ?? 0) * x.quantity, 0);

  const add = (product: Product) => setCart(prev => {
    const existing = prev.find(x => x.productId === product.id);
    if (existing) return prev.map(x => x.productId === product.id ? { ...x, quantity: Math.min(product.quantity, x.quantity + 1) } : x);
    return [...prev, { productId: product.id, quantity: 1 }];
  });
  const change = (id: string, delta: number) => setCart(prev => prev.map(x => {
    if (x.productId !== id) return x;
    const product = products.find(p => p.id === id);
    return { ...x, quantity: Math.max(1, Math.min(product?.quantity ?? 1, x.quantity + delta)) };
  }));
  const remove = (id: string) => setCart(prev => prev.filter(x => x.productId !== id));

  return <div className="mx-auto max-w-6xl pb-10 fade-up">
    <div className="mb-5 flex items-end justify-between gap-3">
      <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--muted-foreground))]">Point of sale</p><h1 className="mt-1 text-3xl font-extrabold tracking-[-.055em]">Choose products</h1><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Add multiple products, then review everything on one checkout page.</p></div>
      <div className="hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-right sm:block"><p className="text-[10px] text-[hsl(var(--muted-foreground))]">Inventory</p><b className="text-sm">{products.length} products</b></div>
    </div>
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{categories.map(c => <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${category === c ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]'}`}>{c}</button>)}</div>
    <div className="relative mb-5"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"/><input className={`${input} pl-10`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, brand, model or SKU…"/></div>
    {hydrating ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="h-28 animate-pulse rounded-2xl border bg-[hsl(var(--muted)/.35)]"/><div className="h-28 animate-pulse rounded-2xl border bg-[hsl(var(--muted)/.35)]"/><div className="h-28 animate-pulse rounded-2xl border bg-[hsl(var(--muted)/.35)]"/></div> : filtered.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map(product => {
        const inCart = cart.find(x => x.productId === product.id)?.quantity ?? 0;
        return <article key={product.id} className="flex min-h-[118px] items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <ProductImage product={product} className="h-20 w-20 shrink-0 rounded-xl object-cover"/>
          <div className="min-w-0 flex-1 self-stretch py-1"><p className="truncate text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{product.brand}</p><h2 className="mt-1 truncate text-sm font-extrabold">{product.name}</h2><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{money(product.sellingPrice)} · {product.quantity} available</p><div className="mt-2 flex items-center gap-2">{inCart > 0 && <div className="flex items-center rounded-xl bg-[hsl(var(--muted))] p-0.5"><button onClick={() => change(product.id, -1)} className="rounded-lg p-1"><Minus className="h-3 w-3"/></button><span className="w-5 text-center text-xs font-bold">{inCart}</span><button onClick={() => change(product.id, 1)} className="rounded-lg p-1"><Plus className="h-3 w-3"/></button></div>}<button onClick={() => add(product)} disabled={inCart >= product.quantity} className="inline-flex items-center gap-1.5 rounded-xl bg-[hsl(var(--primary))] px-3 py-1.5 text-[11px] font-bold text-[hsl(var(--primary-foreground))] disabled:opacity-50"><Plus className="h-3.5 w-3.5"/>{inCart ? 'Add more' : 'Add'}</button></div></div>
        </article>;
      })}
    </div> : <div className="rounded-3xl border border-dashed p-12 text-center"><ShoppingCart className="mx-auto mb-3 h-8 w-8 text-[hsl(var(--muted-foreground))]"/><b>No products found</b><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Try another search or category.</p></div>}

    {count > 0 && <div className="relative z-20 mt-5 w-full">
      <div className="rounded-3xl border border-white/10 bg-[hsl(var(--primary))] p-3 text-[hsl(var(--primary-foreground))] shadow-2xl shadow-black/25 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15"><ShoppingCart className="h-5 w-5"/></div>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.15em] opacity-60">Current cart</p><p className="truncate text-sm font-extrabold">{count} {count === 1 ? 'item' : 'items'} · {money(total)}</p></div>
          <div className="hidden max-w-[250px] items-center gap-1 sm:flex">{cartItems.slice(0, 2).map(x => <span key={x.productId} className="rounded-full bg-white/10 px-2 py-1 text-[10px]">{x.product?.name} ×{x.quantity}</span>)}</div>
          <button onClick={() => setLocation('/sales/checkout')} className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-extrabold text-[hsl(var(--primary))] shadow-lg">Review & checkout <ArrowRight className="h-4 w-4"/></button>
        </div>
      </div>
    </div>}
  </div>;
}
