import fs from 'node:fs';
import path from 'node:path';

const checkout = path.resolve('artifacts/electronics-inventory/src/pages/sales-checkout.tsx');
const auth = path.resolve('artifacts/electronics-inventory/src/auth.tsx');

function replace(file, from, to, label) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(to)) return;
  if (!source.includes(from)) {
    console.warn(`Production patch target not found (${label}) in ${path.relative(process.cwd(), file)}; skipping.`);
    return;
  }
  fs.writeFileSync(file, source.replace(from, to), 'utf8');
}

// Never make login wait for the complete inventory hydration. The UI can render immediately;
// hydration updates the tenant cache in the background.
replace(auth,
  "const s=await buildSession(data.session.user);await hydrateInventoryState();write(SESSION_KEY,s);write(PROFILE_KEY,s);onLogin(s);return;",
  "const s=await buildSession(data.session.user);write(SESSION_KEY,s);write(PROFILE_KEY,s);onLogin(s);void hydrateInventoryState();return;",
  'signup non-blocking hydration');
replace(auth,
  "const s=await buildSession(data.user); await hydrateInventoryState(); write(SESSION_KEY,s); write(PROFILE_KEY,s); onLogin(s);",
  "const s=await buildSession(data.user); write(SESSION_KEY,s); write(PROFILE_KEY,s); onLogin(s); void hydrateInventoryState();",
  'login non-blocking hydration');
replace(auth,
  "const s=await buildSession(user);write(SESSION_KEY,s);write(PROFILE_KEY,s);if(alive)setSession(s);await hydrateInventoryState();",
  "const s=await buildSession(user);write(SESSION_KEY,s);write(PROFILE_KEY,s);if(alive)setSession(s);void hydrateInventoryState();",
  'session non-blocking hydration');

// Checkout must write the sale, stock, customer and EMI plan to Supabase, not only to the browser cache.
replace(checkout,
  "import { hydrateInventoryState, resetCloudHydration } from '@/lib/cloud-sync';",
  "import { hydrateInventoryState, resetCloudHydration } from '@/lib/cloud-sync';\nimport { cloudAdjustStock, cloudCreateEmiPlan, cloudCreateSale, cloudUpsertCustomer } from '@/lib/cloud-crud';",
  'checkout cloud CRUD import');
replace(checkout,
  "else {cid=`cus-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;const next={id:cid,name:customerName.trim(),phone:customerPhone.trim(),createdAt:new Date().toISOString()} as Customer;const all=[next,...customers];writeStore('keystone-customers',all);setCustomers(all);}",
  "else {cid=`cus-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;const next={id:cid,name:customerName.trim(),phone:customerPhone.trim(),createdAt:new Date().toISOString()} as Customer;await cloudUpsertCustomer(next);const all=[next,...customers];writeStore('keystone-customers',all);setCustomers(all);}",
  'checkout customer cloud persistence');
replace(checkout,
  "writeStore('keystone-sales',[sale,...readStore<Sale[]>('keystone-sales',[])]); writeStore('keystone-products',nextProducts); setProducts(nextProducts);",
  "await cloudCreateSale(sale,cost,profit); await Promise.all(items.map(i=>cloudAdjustStock(i.productId,-i.quantity))); writeStore('keystone-sales',[sale,...readStore<Sale[]>('keystone-sales',[])]); writeStore('keystone-products',nextProducts); setProducts(nextProducts);",
  'checkout sale and stock cloud persistence');
replace(checkout,
  "writeStore('keystone-emi-plans',[plan,...readStore<EmiPlan[]>('keystone-emi-plans',[])]); writeStore('keystone-emi-payments',[...payments,...readStore<EmiPayment[]>('keystone-emi-payments',[])]);",
  "await cloudCreateEmiPlan(plan,payments); writeStore('keystone-emi-plans',[plan,...readStore<EmiPlan[]>('keystone-emi-plans',[])]); writeStore('keystone-emi-payments',[...payments,...readStore<EmiPayment[]>('keystone-emi-payments',[])]);",
  'checkout EMI cloud persistence');

console.log('Production flow patches applied: non-blocking startup hydration and durable Supabase sales/stock/customer/EMI checkout.');
