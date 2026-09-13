import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-storefront.tsx';
let source = fs.readFileSync(file, 'utf8');

// The sales cart must be part of the document flow. It should sit naturally
// above the fixed mobile navigation, but it must scroll away with the product
// list instead of sticking to the viewport.
const replacement = 'className="relative z-20 mx-auto mt-6 mb-24 w-full max-w-3xl"';
const patterns = [
  /className="sticky bottom-\[88px\] z-20 mx-auto mt-5 w-full max-w-3xl px-0\.5 pb-1"/,
  /className="sticky bottom-\[[^\]]+\] z-20 mx-auto[^\"]*max-w-3xl[^\"]*"/,
  /className="fixed left-3 right-3 bottom-\[[^\]]+\] z-40[^\"]*"/,
  /className="fixed bottom-20 left-1\/2 z-40[^\"]*"/,
  /className="fixed bottom-20[^\"]*max-w-2xl[^\"]*"/,
  /className="relative z-10 mx-auto mt-6 mb-24 w-full max-w-3xl"/,
  /className="relative z-20 mx-auto mt-6 mb-24 w-full max-w-3xl"/,
  /className="relative z-20 mx-auto mt-7 mb-28 w-full max-w-3xl"/,
];

let changed = false;
for (const pattern of patterns) {
  if (pattern.test(source)) {
    source = source.replace(pattern, replacement);
    changed = true;
    break;
  }
}

// If the storefront already has a normal-flow cart, do nothing. Never fail a
// production build just because an earlier patch already applied the change.
if (changed) {
  fs.writeFileSync(file, source);
  console.log('Sales cart converted to normal document flow above bottom navigation.');
} else {
  console.log('Sales cart position already uses normal document flow; no position patch needed.');
}

// Selected products must stay visible in the storefront so the cashier can
// increase/decrease quantity or add more.
const badFilter = "p.quantity > 0 && !cart.some(line => line.productId === p.id) && (category === 'All' || p.category === category) && `${p.name} ${p.brand} ${p.model} ${p.sku}`.toLowerCase().includes(search.toLowerCase())";
const goodFilter = "p.quantity > 0 && (category === 'All' || p.category === category) && `${p.name} ${p.brand} ${p.model} ${p.sku}`.toLowerCase().includes(search.toLowerCase())";
if (source.includes(badFilter)) {
  source = source.replace(badFilter, goodFilter);
  fs.writeFileSync(file, source);
  console.log('Selected products remain visible in the sales picker.');
}

// Do not let async cloud hydration overwrite a cart that the cashier has
// already started building.
const oldHydration = "setProducts(readStore('keystone-products', seedProducts));\n      setCart(readStore('keystone-sale-draft', []));\n      setHydrating(false);";
const newHydration = "setProducts(readStore('keystone-products', seedProducts));\n      const persistedDraft = readStore<CartLine[]>('keystone-sale-draft', []);\n      setCart(prev => prev.length ? prev : persistedDraft);\n      setHydrating(false);";
if (source.includes(oldHydration)) {
  source = source.replace(oldHydration, newHydration);
  fs.writeFileSync(file, source);
  console.log('Sales cart hydration race fixed.');
}
