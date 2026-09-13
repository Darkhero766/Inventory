import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-storefront.tsx';
let source = fs.readFileSync(file, 'utf8');

// The cart is intentionally part of the document flow. It appears after the
// product list, immediately above the app's fixed bottom navigation, and moves
// away naturally when the cashier scrolls. Do not portal it to document.body
// and do not use fixed/sticky positioning here.
const normalFlow = 'className="mx-auto mt-5 w-full max-w-3xl pb-1"';
const patterns = [
  /className="fixed[^\"]*max-w-3xl[^\"]*"/,
  /className="sticky[^\"]*max-w-3xl[^\"]*"/,
  /className="relative[^\"]*max-w-3xl[^\"]*"/,
  /className="mx-auto mt-5 w-full max-w-3xl pb-1"/,
];

let changed = false;
for (const pattern of patterns) {
  if (pattern.test(source) && !pattern.test(normalFlow)) {
    source = source.replace(pattern, normalFlow);
    changed = true;
    break;
  }
}

// Older builds rendered the cart through a portal, which made it independent
// of page scrolling. Remove that portal so the cart stays in normal flow.
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
console.log(changed ? 'Sales cart position normalized to document flow above bottom navigation.' : 'Sales cart already uses normal document flow.');
