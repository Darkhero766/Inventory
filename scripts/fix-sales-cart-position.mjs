import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-storefront.tsx';
let source = fs.readFileSync(file, 'utf8');

// The sales cart must stay visible while the cashier scrolls. It is a fixed
// floating bar positioned directly above the mobile bottom navigation.
// Keep it out of document flow so it never gets buried below the product list.
const fixedFlow = 'className="fixed left-1/2 z-40 w-[calc(100%-24px)] max-w-3xl -translate-x-1/2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 p-2 shadow-2xl backdrop-blur-xl" style={{bottom:\'calc(76px + env(safe-area-inset-bottom) + 10px)\'}}';
const patterns = [
  /className="fixed[^\"]*max-w-3xl[^\"]*"(?:\s+style=\{\{[^}]*\}\})?/,
  /className="sticky[^\"]*max-w-3xl[^\"]*"/,
  /className="relative[^\"]*max-w-3xl[^\"]*"/,
  /className="mx-auto mt-5 w-full max-w-3xl pb-1"/,
];

let changed = false;
for (const pattern of patterns) {
  if (pattern.test(source)) {
    source = source.replace(pattern, fixedFlow);
    changed = true;
    break;
  }
}

// Older builds rendered the cart through a portal. Keep the cart in the page
// component and use fixed positioning so it remains anchored to the viewport.
if (source.includes("import { createPortal } from 'react-dom';")) {
  source = source.replace("import { createPortal } from 'react-dom';\n", '');
  changed = true;
}
const portalPattern = /\{typeof document !== 'undefined' && createPortal\(cartBar, document\.body\)\}/;
if (portalPattern.test(source)) {
  source = source.replace(portalPattern, '{cartBar}');
  changed = true;
}

// Selected products must remain visible so the cashier can increase/decrease
// quantity or add more without losing the selected row from the picker.
const badFilter = "p.quantity > 0 && !cart.some(line => line.productId === p.id) && (category === 'All' || p.category === category) && `${p.name} ${p.brand} ${p.model} ${p.sku}`.toLowerCase().includes(search.toLowerCase())";
const goodFilter = "p.quantity > 0 && (category === 'All' || p.category === category) && `${p.name} ${p.brand} ${p.model} ${p.sku}`.toLowerCase().includes(search.toLowerCase())";
if (source.includes(badFilter)) {
  source = source.replace(badFilter, goodFilter);
  changed = true;
}

// Do not let async cloud hydration overwrite a cart that the cashier has
// already started building.
const oldHydration = "setProducts(readStore('keystone-products', seedProducts));\n      setCart(readStore('keystone-sale-draft', []));\n      setHydrating(false);";
const newHydration = "setProducts(readStore('keystone-products', seedProducts));\n      const persistedDraft = readStore<CartLine[]>('keystone-sale-draft', []);\n      setCart(prev => prev.length ? prev : persistedDraft);\n      setHydrating(false);";
if (source.includes(oldHydration)) {
  source = source.replace(oldHydration, newHydration);
  changed = true;
}

fs.writeFileSync(file, source);
console.log(changed ? 'Sales cart fixed above mobile bottom navigation.' : 'Sales cart already uses fixed viewport positioning.');
