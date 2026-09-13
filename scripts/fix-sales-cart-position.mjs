import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-storefront.tsx';
let source = fs.readFileSync(file, 'utf8');

// The cart is a viewport-level action bar on mobile. It must sit above the
// fixed 76px bottom navigation rather than scrolling with the product list.
const replacement = 'className="fixed inset-x-3 bottom-[84px] z-40 mx-auto w-[calc(100%-0px)] max-w-3xl pb-1 md:bottom-6 md:left-auto md:right-6 md:inset-x-auto md:w-auto"';
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

if (changed) {
  fs.writeFileSync(file, source);
  console.log('Sales cart fixed above the mobile bottom navigation.');
} else {
  console.log('Sales cart position already patched; no position change needed.');
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
