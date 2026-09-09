import { Link } from 'wouter';
import { ArrowUpRight, Package } from 'lucide-react';
import { useState } from 'react';
import { money, Product, statusOf } from '@/lib/inventory';

export function ProductImage({ product, className = '' }: { product: Product; className?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={`image-placeholder relative flex items-center justify-center overflow-hidden ${className}`}>
    {!failed && <img src={product.image} alt={product.name} className="h-full w-full object-contain mix-blend-multiply transition-transform duration-500 hover:scale-105" onError={() => setFailed(true)} />}
    {failed && <Package className="absolute h-9 w-9 opacity-45" aria-label="Image unavailable" />}
  </div>;
}
export function StatusPill({ product }: { product: Product }) {
  const status = statusOf(product);
  const styles = status === 'IN STOCK' ? 'bg-[hsl(164_28%_86%)] text-[hsl(166_39%_23%)]' : status === 'LOW STOCK' ? 'bg-[hsl(39_85%_85%)] text-[hsl(32_62%_31%)]' : 'bg-[hsl(2_62%_92%)] text-[hsl(2_62%_39%)]';
  return <span data-testid={`status-product-${product.id}`} className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-[.08em] ${styles}`}>{status}</span>;
}
export function ProductCard({ product }: { product: Product }) {
  return <Link href={`/product/${product.id}`} data-testid={`card-product-${product.id}`} className="soft-shadow-hover group block overflow-hidden rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))]">
    <ProductImage product={product} className="h-44 w-full" />
    <div className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{product.brand}</p><h3 className="mt-1 line-clamp-1 text-sm font-semibold text-[hsl(var(--foreground))]">{product.name}</h3></div><ArrowUpRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
      <div className="flex items-end justify-between"><div><p className="text-base font-bold">{money(product.sellingPrice)}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">Buy {money(product.purchasePrice)}</p></div><div className="text-right"><p className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{product.quantity} units</p><StatusPill product={product} /></div></div>
    </div>
  </Link>;
}