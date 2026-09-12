import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-storefront.tsx';
let source = fs.readFileSync(file, 'utf8');

// Keep the cart in normal document flow. It appears above the fixed bottom
// navigation because of bottom spacing, but it scrolls naturally with content.
const fixedCart = /className=\"fixed inset-x-3 bottom-\[88px\] z-40 mx-auto w-auto max-w-3xl md:inset-x-auto md:bottom-6\"/;
const oldFlowCart = /className=\"relative z-20 mx-auto mt-6 mb-24 w-full max-w-3xl\"/;
const cartReplacement = 'className="relative z-20 mx-auto mt-7 mb-28 w-full max-w-3xl"';

if (fixedCart.test(source)) {
  source = source.replace(fixedCart, cartReplacement);
  console.log('Sales cart converted from fixed positioning to document flow.');
} else if (oldFlowCart.test(source)) {
  source = source.replace(oldFlowCart, cartReplacement);
  console.log('Sales cart flow spacing normalized.');
} else {
  console.log('Sales cart is already in document flow or uses a different safe layout; no position change made.');
}

// Once a product is added, remove it from the product picker. This prevents
// accidental duplicate selection while allowing multiple different products
// to be accumulated in the cart. Cart contents remain available via checkout.
const filterNeedle = "p.quantity > 0 && (category === 'All' || p.category === category) && `${p.name} ${p.brand} ${p.model} ${p.sku}`.toLowerCase().includes(search.toLowerCase())";
const filterReplacement = "p.quantity > 0 && !cart.some(line => line.productId === p.id) && (category === 'All' || p.category === category) && `${p.name} ${p.brand} ${p.model} ${p.sku}`.toLowerCase().includes(search.toLowerCase())";
if (source.includes(filterNeedle) && !source.includes('!cart.some(line => line.productId === p.id)')) {
  source = source.replace(filterNeedle, filterReplacement);
  console.log('Selected sales products now disappear from the picker.');
}

fs.writeFileSync(file, source);
