import { Link } from 'wouter';
import { ArrowUpRight, Package, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { money, Product, statusOf } from '@/lib/inventory';

const brandSlugs: Record<string, string> = {
  Apple: 'apple', Samsung: 'samsung', LG: 'lg', Sony: 'sony', OnePlus: 'oneplus', Xiaomi: 'xiaomi', Motorola: 'motorola',
  HP: 'hp', Dell: 'dell', Lenovo: 'lenovo', ASUS: 'asus', Acer: 'acer', Whirlpool: 'whirlpool', IFB: 'ifb', Bosch: 'bosch',
  Haier: 'haier', Voltas: 'voltas', Daikin: 'daikin', JBL: 'jbl', boAt: 'boat', Canon: 'canon', Epson: 'epson', Logitech: 'logitech',
  'TP-Link': 'tplink', Google: 'google', Vivo: 'vivo', TCL: 'tcl', Godrej: 'godrej', Bose: 'bose', Fujifilm: 'fujifilm', Anker: 'anker'
};

export function BrandMark({ brand, size = 'md' }: { brand: string; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  const slug = brandSlugs[brand];
  const box = size === 'lg' ? 'h-12 w-12 rounded-2xl' : size === 'sm' ? 'h-7 w-7 rounded-lg' : 'h-9 w-9 rounded-xl';
  const icon = size === 'lg' ? 'h-7 w-7' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return <span className={`inline-flex shrink-0 items-center justify-center border border-[hsl(var(--border))] bg-white ${box}`} title={brand}>
    {slug && !failed ? <img src={`https://cdn.simpleicons.org/${slug}?viewbox=auto`} alt="" aria-hidden="true" className={`${icon} object-contain`} onError={() => setFailed(true)} /> : <span className="text-[10px] font-black tracking-tight text-[hsl(var(--foreground))]">{brand.slice(0, 2).toUpperCase()}</span>}
  </span>;
}

export function ProductImage({ product, className = '' }: { product: Product; className?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={`product-image relative flex items-center justify-center overflow-hidden ${className}`}>
    {!failed && <img loading="lazy" decoding="async" src={product.image} alt={product.name} className="h-full w-full object-contain p-3 mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.04]" onError={() => setFailed(true)} />}
    {failed && <div className="image-placeholder flex h-full w-full flex-col items-center justify-center gap-1 text-[hsl(var(--muted-foreground))]"><Package className="h-7 w-7 opacity-35" /><span className="text-[10px] font-medium">Image unavailable</span></div>}
  </div>;
}

export function StatusPill({ product }: { product: Product }) {
  const status = statusOf(product);
  const styles = status === 'IN STOCK' ? 'bg-[hsl(159_39%_91%)] text-[hsl(159_44%_31%)]' : status === 'LOW STOCK' ? 'bg-[hsl(43_78%_92%)] text-[hsl(35_61%_35%)]' : 'bg-[hsl(348_70%_94%)] text-[hsl(346_58%_42%)]';
  const label = status === 'IN STOCK' ? 'In stock' : status === 'LOW STOCK' ? 'Low stock' : 'Out of stock';
  return <span data-testid={`status-product-${product.id}`} className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 font-mono text-[8px] font-bold tracking-[.02em] ${styles}`}>{label}</span>;
}

export function ProductCard({ product }: { product: Product }) {
  const discount = product.mrp > product.sellingPrice ? Math.round((1 - product.sellingPrice / product.mrp) * 100) : 0;
  return <article data-testid={`card-product-${product.id}`} className="group overflow-hidden rounded-[22px] border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] shadow-[0_4px_20px_rgba(15,23,42,.04)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(15,23,42,.10)]">
    <Link href={`/product/${product.id}`} className="block">
      <ProductImage product={product} className="aspect-square w-full bg-[hsl(220_20%_97%)]" />
    </Link>
    <div className="p-3.5 sm:p-4">
      <div className="flex items-start gap-3">
        <Link href={`/inventory?brand=${encodeURIComponent(product.brand)}`} className="shrink-0" aria-label={`View ${product.brand} products`} onClick={e => e.stopPropagation()}>
          <BrandMark brand={product.brand} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/inventory?brand=${encodeURIComponent(product.brand)}`} className="block truncate text-[10px] font-semibold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{product.brand}</Link>
          <Link href={`/product/${product.id}`} className="mt-1 block line-clamp-2 min-h-[2.45rem] text-[14px] font-bold leading-[1.2rem] tracking-[-.015em]">{product.name}</Link>
        </div>
        <Link href={`/product/${product.id}`} className="mt-0.5 shrink-0 rounded-full p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]" aria-label="Open product">
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-[17px] font-extrabold tracking-[-.035em]">{money(product.sellingPrice)}</p>
            {product.mrp > product.sellingPrice && <p className="text-[10px] text-[hsl(var(--muted-foreground))] line-through">{money(product.mrp)}</p>}
          </div>
          {discount > 0 && <p className="mt-0.5 text-[10px] font-bold text-[hsl(151_62%_40%)]">{discount}% off</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5"><StatusPill product={product} /><p className="text-[9px] text-[hsl(var(--muted-foreground))]">{product.quantity} units</p></div>
      </div>
      <Link href={`/product/${product.id}`} className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] text-xs font-bold text-[hsl(var(--primary-foreground))] transition hover:opacity-90">
        <ShoppingCart className="h-3.5 w-3.5" /> View / sell
      </Link>
    </div>
  </article>;
}
