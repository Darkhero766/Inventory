import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-storefront.tsx';
let source = fs.readFileSync(file, 'utf8');

// The cart summary is intentionally viewport-fixed. It must sit immediately
// above InventoryShell's fixed bottom navigation, while the product list keeps
// scrolling underneath it. Keep a bottom offset large enough for the mobile
// tab bar and add safe-area padding for modern phones.
const fixedClass = 'className="fixed inset-x-3 bottom-[92px] z-40 mx-auto w-[calc(100%-24px)] max-w-3xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 p-2 shadow-2xl backdrop-blur-xl sm:bottom-6 sm:w-[calc(100%-48px)]"';

// Handle every cart positioning version introduced by earlier build patches.
// The selector is deliberately limited to the cart wrapper class shape so we
// do not touch unrelated fixed elements such as the app navigation.
const positionPatterns = [
  /className="relative z-10 mx-auto mt-6 mb-24 w-full max-w-3xl"/,
  /className="relative z-20 mx-auto mt-6 mb-24 w-full max-w-3xl"/,
  /className="relative z-20 mx-auto mt-7 mb-28 w-full max-w-3xl"/,
  /className="fixed bottom-20 left-1\/2 z-40 w-\[calc\(100%-24px\)\] max-w-2xl -translate-x-1\/2 rounded-2xl[^\"]*"/,
  /className="fixed bottom-20[^\"]*max-w-2xl[^\"]*"/,
  /className="fixed inset-x-3 bottom-\[88px\] z-40[^\"]*"/,
  /className="fixed inset-x-3 bottom-20 z-40[^\"]*"/,
  /className="fixed inset-x-3 bottom-\[92px\] z-40[^\"]*"/,
];

let changed = false;
for (const pattern of positionPatterns) {
  if (pattern.test(source)) {
    source = source.replace(pattern, fixedClass);
    changed = true;
    break;
  }
}

if (!changed && !source.includes(fixedClass)) {
  // Fail loudly instead of silently shipping a cart that is in the wrong
  // position. This also makes future storefront markup changes obvious.
  throw new Error('Sales cart wrapper not found; refusing to modify unrelated code.');
}

if (changed) console.log('Sales cart fixed above the mobile bottom navigation.');
else console.log('Sales cart position already correct.');

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
