import { Link } from 'wouter';
import { ArrowUpRight, Package } from 'lucide-react';
import { useState } from 'react';
import { money, Product, statusOf } from '@/lib/inventory';

export function ProductImage({ product, className = '' }: { product: Product; className?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={`image-placeholder relative flex items-center justify-center overflow-hidden ${className}`}>
    {!failed && <img src={product.image} alt={product.name} className="h-full w-full object-contain p-3 mix-blend-multiply transition-transform duration-500 group-hover:scale-105" onError={() => setFailed(true)} />}
    {failed && <div className="flex h-full w-full items-center justify-center bg-[hsl(40_25%_93%)]"><Package className="h-8 w-8 opacity-35" aria-label="Image unavailable" /></div>}
  </div>;
}
export function StatusPill({ product }: { product: Product }) {
  const status = statusOf(product);
  const styles = status === 'IN STOCK' ? 'bg-[hsl(164_28%_86%)] text-[hsl(166_39%_23%)]' : status === 'LOW STOCK' ? 'bg-[hsl(39_85%_85%)] text-[hsl(32_62%_31%)]' : 'bg-[hsl(2_62%_92%)] text-[hsl(2_62%_39%)]';
  return <span data-testid={`status-product-${product.id}`} className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-[.08em] ${styles}`}>{status}</span>;
}
export function ProductCard({ product }: { product: Product }) {
  return <Link href={`/product/${product.id}`} data-testid={`card-product-${product.id}`} className="soft-shadow-hover group block overflow-hidden rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))]">
    <ProductImage product={product} className="aspect-square w-full" />
    <div className="space-y-2.5 p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{product.brand}</p><h3 className="mt-1 line-clamp-2 min-h-[2.25rem] text-[13px] font-semibold leading-[1.15rem] text-[hsl(var(--foreground))]">{product.name}</h3></div><ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
      <div className="flex items-end justify-between gap-2"><p className="text-[15px] font-bold tracking-[-.02em]">{money(product.sellingPrice)}</p><div className="flex min-w-0 flex-col items-end gap-1"><p className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{product.quantity} units</p><StatusPill product={product} /></div></div>
    </div>
  </Link>;
}