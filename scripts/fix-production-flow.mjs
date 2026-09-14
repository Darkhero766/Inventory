import fs from 'node:fs';
import path from 'node:path';

const checkout = path.resolve('artifacts/electronics-inventory/src/pages/sales-checkout.tsx');
const auth = path.resolve('artifacts/electronics-inventory/src/auth.tsx');
const app = path.resolve('artifacts/electronics-inventory/src/App.tsx');

function replace(file, from, to, label) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(to)) return;
  if (!source.includes(from)) {
    console.warn(`Production patch target not found (${label}) in ${path.relative(process.cwd(), file)}; skipping.`);
    return;
  }
  fs.writeFileSync(file, source.replace(from, to), 'utf8');
}

function replaceRegex(file, pattern, replacement, label) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes(replacement)) return;
  if (!pattern.test(source)) {
    console.warn(`Production patch target not found (${label}) in ${path.relative(process.cwd(), file)}; skipping.`);
    return;
  }
  fs.writeFileSync(file, source.replace(pattern, replacement), 'utf8');
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

// Checkout writes sale, stock, customer and EMI data to Supabase. The database uses UUID primary
// keys plus browser-generated ids where supported; cloud-crud also supports older schemas.
replace(checkout,
  "import { hydrateInventoryState, resetCloudHydration } from '@/lib/cloud-sync';",
  "import { hydrateInventoryState, resetCloudHydration } from '@/lib/cloud-sync';\nimport { cloudAdjustStock, cloudCreateEmiPlan, cloudCreateSale, cloudUpsertCustomer } from '@/lib/cloud-crud';",
  'checkout cloud CRUD import');

replaceRegex(checkout,
  /if\(!cid&&customerName\.trim\(\)&&customerPhone\.trim\(\)\)\{[\s\S]*?\n   \}/,
  "if(!cid&&customerName.trim()&&customerPhone.trim()){\n    const existing=customers.find(c=>c.phone.trim()===customerPhone.trim());\n    if(existing)cid=existing.id;\n    else{cid=`cus-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;const c={id:cid,name:customerName.trim(),phone:customerPhone.trim(),createdAt:new Date().toISOString()} as Customer;await cloudUpsertCustomer(c);const next=[c,...customers];setCustomers(next);writeStore('keystone-customers',next)}\n   }",
  'checkout customer cloud persistence');

replace(checkout,
  "writeStore('keystone-sales',[sale,...readStore<Sale[]>('keystone-sales',[])]); writeStore('keystone-products',nextProducts); setProducts(nextProducts);",
  "const dbSaleId=await cloudCreateSale(sale,cost,profit); await Promise.all(items.map(i=>cloudAdjustStock(i.productId,-i.quantity))); writeStore('keystone-sales',[sale,...readStore<Sale[]>('keystone-sales',[])]); writeStore('keystone-products',nextProducts); setProducts(nextProducts);",
  'checkout sale and stock cloud persistence');
replace(checkout,
  "writeStore('keystone-emi-plans',[plan,...readStore<EmiPlan[]>('keystone-emi-plans',[])]); writeStore('keystone-emi-payments',[...payments,...readStore<EmiPayment[]>('keystone-emi-payments',[])]);",
  "await cloudCreateEmiPlan(plan,payments,dbSaleId); writeStore('keystone-emi-plans',[plan,...readStore<EmiPlan[]>('keystone-emi-plans',[])]); writeStore('keystone-emi-payments',[...payments,...readStore<EmiPayment[]>('keystone-emi-payments',[])]);",
  'checkout EMI cloud persistence');

// Product creation was previously local-only. On production the next inventory hydration
// therefore replaced the newly-created local product with the relational cloud dataset.
// Persist NEW products to Supabase first, then keep the existing local state/navigation behavior.
replace(app,
  "import NotFound from '@/pages/not-found';",
  "import NotFound from '@/pages/not-found';\nimport { cloudSaveProduct } from '@/lib/cloud-crud';",
  'product cloud persistence import');

replace(app,
  "const submit=(e:FormEvent)=>{e.preventDefault();saveProduct({name:form.name,brand:form.brand,category:form.category as Product['category'],model:form.model,sku:form.sku,purchasePrice:Number(form.purchasePrice),sellingPrice:Number(form.sellingPrice),mrp:Number(form.mrp),quantity:Number(form.quantity),minStock:Number(form.minStock),warranty:form.warranty,image:form.image||seedProducts[0].image},id);setLocation(id?`/product/${id}`:'/inventory')};",
  "const submit=async(e:FormEvent)=>{e.preventDefault();const data={name:form.name,brand:form.brand,category:form.category as Product['category'],model:form.model,sku:form.sku,purchasePrice:Number(form.purchasePrice),sellingPrice:Number(form.sellingPrice),mrp:Number(form.mrp),quantity:Number(form.quantity),minStock:Number(form.minStock),warranty:form.warranty,image:form.image||seedProducts[0].image};try{if(!id){const clientId=`p-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;await cloudSaveProduct({...data,id:clientId,createdAt:new Date().toISOString()});}saveProduct(data,id);setLocation(id?`/product/${id}`:'/inventory')}catch(error){console.error('[inventory] product save failed:',error);window.alert(error instanceof Error?error.message:'Product could not be saved. Please try again.')}};",
  'new product cloud persistence');

console.log('Production flow patches applied: non-blocking startup hydration and durable Supabase sales/stock/customer/EMI checkout.');
console.log('New product creation now persists to Supabase before returning to inventory.');
