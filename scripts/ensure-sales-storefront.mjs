import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'artifacts/electronics-inventory/src/App.tsx');
let source = fs.readFileSync(file, 'utf8');

const storefrontImport = "import SalesStorefront from '@/pages/sales-storefront';";
const checkoutImport = "import SalesCheckoutPage from '@/pages/sales-checkout';";

if (!source.includes(storefrontImport)) {
  const anchor = "import NotFound from '@/pages/not-found';";
  if (!source.includes(anchor)) throw new Error('Sales storefront patch anchor not found in App.tsx');
  source = source.replace(anchor, `${anchor}\n${storefrontImport}\n${checkoutImport}`);
}

if (!source.includes('function LegacySalesPage(')) {
  if (!source.includes('function SalesPage(')) throw new Error('SalesPage function not found in App.tsx');
  source = source.replace('function SalesPage(', 'function LegacySalesPage(');
  source = source.replace('function LegacySalesPage(', 'function SalesPage(){ return <SalesStorefront/>; }\n\nfunction LegacySalesPage(');
}

if (!source.includes('path="/sales/checkout"')) {
  const switchAnchor = '<Switch>';
  if (!source.includes(switchAnchor)) throw new Error('Router Switch anchor not found in App.tsx');
  source = source.replace(switchAnchor, `${switchAnchor}<Route path="/sales/checkout" component={SalesCheckoutPage} />`);
}

fs.writeFileSync(file, source);
console.log('Sales storefront enabled: /sales is product picker with multi-cart; /sales/checkout is checkout.');
