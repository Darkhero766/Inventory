import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-storefront.tsx';
let source = fs.readFileSync(file, 'utf8');

// The mobile bottom navigation in InventoryShell is already viewport-fixed.
// The cart summary therefore belongs in normal document flow: it scrolls with
// the product list and ends naturally above the navigation instead of floating
// over products or the navigation.
const flowClass = 'className="relative z-10 mx-auto mt-6 mb-24 w-full max-w-3xl"';

const positionPatterns = [
  /className="relative z-20 mx-auto mt-6 mb-28 w-full max-w-3xl"/,
  /className="relative z-20 mx-auto mt-7 mb-28 w-full max-w-3xl"/,
  /className="relative z-20 mx-auto mt-6 mb-24 w-full max-w-3xl"/,
  /className="fixed bottom-20 left-1\/2 z-40 w-\[calc\(100%-24px\)\] max-w-2xl -translate-x-1\/2 rounded-2xl[^\"]*"/,
  /className="fixed bottom-20[^\"]*max-w-2xl[^\"]*"/,
  /className="fixed inset-x-3 bottom-\[88px\] z-40[^\"]*"/,
  /className="fixed inset-x-3 bottom-20 z-40[^\"]*"/,
];

let changed = false;
for (const pattern of positionPatterns) {
  if (pattern.test(source)) {
    source = source.replace(pattern, flowClass);
    changed = true;
    break;
  }
}

if (!changed) {
  console.log('Sales cart already uses normal document flow.');
} else {
  console.log('Sales cart converted to normal document flow above mobile navigation.');
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
