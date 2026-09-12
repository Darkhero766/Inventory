import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-storefront.tsx';
let source = fs.readFileSync(file, 'utf8');

// The cart belongs to the sales page document flow. It must appear immediately
// after the product grid, above the fixed bottom navigation, and move away as
// the cashier scrolls. It must NOT be fixed/sticky to the viewport.
const fixedPatterns = [
  /className=\"fixed inset-x-3 bottom-\[88px\] z-40 mx-auto w-auto max-w-3xl md:inset-x-auto md:bottom-6\"/,
  /className=\"fixed bottom-20 left-1\/2 z-40 w-\[calc\(100%-24px\)\] max-w-2xl -translate-x-1\/2 rounded-2xl[^\"]*\"/,
  /className=\"fixed bottom-20[^\"]*max-w-2xl[^\"]*\"/,
];

const flowClass = 'className="relative z-20 mx-auto mt-6 mb-28 w-full max-w-3xl"';

let changed = false;
for (const pattern of fixedPatterns) {
  if (pattern.test(source)) {
    source = source.replace(pattern, flowClass);
    changed = true;
    console.log('Sales cart converted from viewport-fixed to normal document flow.');
    break;
  }
}

// Normalize older flow variants so the cart has enough space above the fixed
// bottom navigation while still scrolling naturally with the product list.
const oldFlowPatterns = [
  /className=\"relative z-20 mx-auto mt-7 mb-28 w-full max-w-3xl\"/,
  /className=\"relative z-20 mx-auto mt-6 mb-24 w-full max-w-3xl\"/,
];
for (const pattern of oldFlowPatterns) {
  if (pattern.test(source)) {
    source = source.replace(pattern, flowClass);
    changed = true;
    console.log('Sales cart flow spacing normalized above bottom navigation.');
    break;
  }
}

if (!changed) {
  console.log('Sales cart already uses normal document flow; no position patch needed.');
}

// Selected products must stay visible in the storefront so the cashier can
// increase/decrease quantity or add more.
const badFilter = "p.quantity > 0 && !cart.some(line => line.productId === p.id) && (category === 'All' || p.category === category) && `${p.name} ${p.brand} ${p.model} ${p.sku}`.toLowerCase().includes(search.toLowerCase())";
const goodFilter = "p.quantity > 0 && (category === 'All' || p.category === category) && `${p.name} ${p.brand} ${p.model} ${p.sku}`.toLowerCase().includes(search.toLowerCase())";
if (source.includes(badFilter)) {
  source = source.replace(badFilter, goodFilter);
  console.log('Selected products remain visible in the sales picker.');
}

// Do not let async cloud hydration overwrite a cart that the cashier has
// already started building.
const oldHydration = "setProducts(readStore('keystone-products', seedProducts));\n      setCart(readStore('keystone-sale-draft', []));\n      setHydrating(false);";
const newHydration = "setProducts(readStore('keystone-products', seedProducts));\n      const persistedDraft = readStore<CartLine[]>('keystone-sale-draft', []);\n      setCart(prev => prev.length ? prev : persistedDraft);\n      setHydrating(false);";
if (source.includes(oldHydration)) {
  source = source.replace(oldHydration, newHydration);
  console.log('Sales cart hydration race fixed.');
}

fs.writeFileSync(file, source);
