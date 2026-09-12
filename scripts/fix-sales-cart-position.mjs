import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-storefront.tsx';
let source = fs.readFileSync(file, 'utf8');

// The cart is intentionally a floating overlay on mobile: it sits above the
// fixed bottom navigation instead of becoming the last item in the product
// list. On desktop it sits near the bottom of the viewport.
const fixedCart = /className=\"fixed inset-x-3 bottom-\[88px\] z-40 mx-auto w-auto max-w-3xl md:inset-x-auto md:bottom-6\"/;
const oldFlowCart = /className=\"relative z-20 mx-auto mt-7 mb-28 w-full max-w-3xl\"/;
const legacyFlowCart = /className=\"relative z-20 mx-auto mt-6 mb-24 w-full max-w-3xl\"/;
const cartReplacement = 'className="fixed inset-x-3 bottom-[88px] z-40 mx-auto w-auto max-w-3xl md:inset-x-auto md:bottom-6"';

if (oldFlowCart.test(source)) {
  source = source.replace(oldFlowCart, cartReplacement);
  console.log('Sales cart moved to floating overlay above bottom navigation.');
} else if (legacyFlowCart.test(source)) {
  source = source.replace(legacyFlowCart, cartReplacement);
  console.log('Sales cart moved to floating overlay above bottom navigation.');
} else if (fixedCart.test(source)) {
  console.log('Sales cart already uses the correct floating position.');
} else {
  console.log('Sales cart uses a different safe layout; no position change made.');
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
