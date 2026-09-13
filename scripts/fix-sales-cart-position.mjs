import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-storefront.tsx';
let source = fs.readFileSync(file, 'utf8');

// The cart belongs to the sales storefront document flow. It must sit after
// the product list and before the bottom navigation in the page content.
// Do NOT make it fixed/sticky: the cashier should see it move naturally with
// the product list while the app's bottom navigation remains independently
// positioned by InventoryShell.
const normalClass = 'className="relative z-20 mx-auto mt-5 mb-6 w-full max-w-3xl"';
const patterns = [
  /className="fixed[^\"]*max-w-3xl[^\"]*"(?:\s+style=\{\{[^}]*\}\})?/,
  /className="sticky[^\"]*max-w-3xl[^\"]*"(?:\s+style=\{\{[^}]*\}\})?/,
  /className="relative[^\"]*max-w-3xl[^\"]*"/,
  /className="mx-auto mt-5 w-full max-w-3xl pb-1"/,
];

let changed = false;
for (const pattern of patterns) {
  if (pattern.test(source)) {
    source = source.replace(pattern, normalClass);
    changed = true;
    break;
  }
}

// Older builds rendered the cart through a portal. Keep it in the storefront
// DOM so it participates in normal scrolling/document flow.
if (source.includes("import { createPortal } from 'react-dom';")) {
  source = source.replace("import { createPortal } from 'react-dom';\n", '');
  changed = true;
}
const portalPattern = /\{typeof document !== 'undefined' && createPortal\(cartBar, document\.body\)\}/;
if (portalPattern.test(source)) {
  source = source.replace(portalPattern, '{cartBar}');
  changed = true;
}

// Keep selected products visible in the picker so more than one product can
// be added/edited before opening checkout.
const badFilter = "p.quantity > 0 && !cart.some(line => line.productId === p.id) && (category === 'All' || p.category === category) && `${p.name} ${p.brand} ${p.model} ${p.sku}`.toLowerCase().includes(search.toLowerCase())";
const goodFilter = "p.quantity > 0 && (category === 'All' || p.category === category) && `${p.name} ${p.brand} ${p.model} ${p.sku}`.toLowerCase().includes(search.toLowerCase())";
if (source.includes(badFilter)) {
  source = source.replace(badFilter, goodFilter);
  changed = true;
}

// Do not let async cloud hydration overwrite a cart the cashier has already
// started building.
const oldHydration = "setProducts(readStore('keystone-products', seedProducts));\n      setCart(readStore('keystone-sale-draft', []));\n      setHydrating(false);";
const newHydration = "setProducts(readStore('keystone-products', seedProducts));\n      const persistedDraft = readStore<CartLine[]>('keystone-sale-draft', []);\n      setCart(prev => prev.length ? prev : persistedDraft);\n      setHydrating(false);";
if (source.includes(oldHydration)) {
  source = source.replace(oldHydration, newHydration);
  changed = true;
}

fs.writeFileSync(file, source);
console.log(changed ? 'Sales cart normalized to document flow above bottom navigation.' : 'Sales cart already uses normal document flow; no position patch needed.');
