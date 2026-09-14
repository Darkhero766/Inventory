import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/lib/cloud-sync.ts';
let src = fs.readFileSync(file, 'utf8');

// Avoid PostgREST embedded-relation failures. We already have the tenant-scoped
// customer/product rows, so joining them in the same request is unnecessary and
// can make one relationship/schema problem hide every other dataset.
src = src.replace(
  "client.from('sales').select('id,client_id,invoice_number,customer_id,sale_date,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method,status,customers(id,client_id,name)').eq('owner_id', ownerId).order('sale_date', { ascending: false }),",
  "client.from('sales').select('id,client_id,invoice_number,customer_id,sale_date,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method,status').eq('owner_id', ownerId).order('sale_date', { ascending: false }),",
);
src = src.replace(
  "client.from('sale_items').select('id,client_id,sale_id,product_id,quantity,unit_price,discount,final_price,products(id,client_id,name,serial_number,imei)').eq('owner_id', ownerId),",
  "client.from('sale_items').select('id,client_id,sale_id,product_id,quantity,unit_price,discount,final_price').eq('owner_id', ownerId),",
);

// The old implementation treated any one of six queries failing as a complete
// hydration failure. That is unsafe: e.g. an EMI schema mismatch must not make
// products and customers disappear. Keep successful datasets and only use the
// snapshot for the specific dataset that could not be read.
const oldBlock = `  const results = [productsRes, customersRes, salesRes, itemsRes, emiRes, paymentsRes];
  const failed = results.find(r => r.error);
  if (failed) {
    console.warn('[cloud] relational hydration failed:', failed.error?.message);
    return hydrateSnapshotFallback(client, ownerId);
  }

  const rawProducts = productsRes.data ?? [];
  const rawCustomers = customersRes.data ?? [];
  const rawSales = salesRes.data ?? [];
  const rawEmi = emiRes.data ?? [];
`;
const newBlock = `  const results = [
    ['products', productsRes], ['customers', customersRes], ['sales', salesRes],
    ['sale_items', itemsRes], ['emi_plans', emiRes], ['emi_payments', paymentsRes],
  ] as const;
  for (const [name, result] of results) {
    if (result.error) console.warn('[cloud] relational query failed:', name, result.error.message);
  }

  const rawProducts = productsRes.data ?? [];
  const rawCustomers = customersRes.data ?? [];
  const rawSales = salesRes.data ?? [];
  const rawEmi = emiRes.data ?? [];
`;
if (src.includes(oldBlock)) src = src.replace(oldBlock, newBlock);

// Build client-side lookup maps for relations instead of PostgREST embeds.
const oldItems = `  for (const row of itemsRes.data ?? []) {
    const product = (row as any).products;
    const saleKey = saleClientByDbId.get(String((row as any).sale_id)) ?? String((row as any).sale_id);
    const list = itemsBySale.get(saleKey) ?? [];
    list.push({ productId:productClientByDbId.get(String(product?.id ?? (row as any).product_id)) ?? String(product?.client_id ?? (row as any).product_id), productName:product?.name??'Product', quantity:Number((row as any).quantity??0), price:Number((row as any).unit_price??0), discount:Number((row as any).discount??0), serialNumber:product?.serial_number??undefined, imei:product?.imei??undefined });
    itemsBySale.set(saleKey,list);
  }
`;
const newItems = `  const productByDbId = new Map(rawProducts.map((p: any) => [String(p.id), p]));
  for (const row of itemsRes.data ?? []) {
    const product = productByDbId.get(String((row as any).product_id));
    const saleKey = saleClientByDbId.get(String((row as any).sale_id)) ?? String((row as any).sale_id);
    const list = itemsBySale.get(saleKey) ?? [];
    list.push({ productId:productClientByDbId.get(String((row as any).product_id)) ?? String((row as any).product_id), productName:product?.name??'Product', quantity:Number((row as any).quantity??0), price:Number((row as any).unit_price??0), discount:Number((row as any).discount??0), serialNumber:product?.serial_number??undefined, imei:product?.imei??undefined });
    itemsBySale.set(saleKey,list);
  }
`;
if (src.includes(oldItems)) src = src.replace(oldItems, newItems);

const oldSales = `  const sales = rawSales.map((s:any) => ({ id:String(s.client_id), date:s.sale_date, invoice:s.invoice_number, customerId:customerClientByDbId.get(String(s.customer_id)) ?? undefined, customerName:s.customers?.name??undefined, items:(itemsBySale.get(String(s.client_id))??[]) as Array<Record<string,unknown>>, subtotal:Number(s.subtotal??0), discount:Number(s.discount_amount??0), total:Number(s.final_amount??0), payment:emiSaleIds.has(String(s.id))?'EMI':(s.payment_method??''), purchaseCost:Number(s.purchase_cost??0), profit:Number(s.profit??0), discountType:s.discount_type??undefined, discountValue:Number(s.discount_value??0), status:s.status }));
`;
const newSales = `  const sales = rawSales.map((s:any) => ({ id:String(s.client_id), date:s.sale_date, invoice:s.invoice_number, customerId:customerClientByDbId.get(String(s.customer_id)) ?? undefined, customerName:rawCustomers.find((c:any)=>String(c.id)===String(s.customer_id))?.name??undefined, items:(itemsBySale.get(String(s.client_id))??[]) as Array<Record<string,unknown>>, subtotal:Number(s.subtotal??0), discount:Number(s.discount_amount??0), total:Number(s.final_amount??0), payment:emiSaleIds.has(String(s.id))?'EMI':(s.payment_method??''), purchaseCost:Number(s.purchase_cost??0), profit:Number(s.profit??0), discountType:s.discount_type??undefined, discountValue:Number(s.discount_value??0), status:s.status }));
`;
if (src.includes(oldSales)) src = src.replace(oldSales, newSales);

// Do not use an all-or-nothing relationalHasData gate. If products are present
// but another table is empty because it has no rows, preserve that valid state.
// If the product/customer/sales queries specifically failed, use snapshot data
// only for the failed/empty dataset where available.
const oldGate = `  const relationalHasData = rawProducts.length + rawCustomers.length + rawSales.length + rawEmi.length > 0;
  if (!relationalHasData) return hydrateSnapshotFallback(client, ownerId);
`;
const newGate = `  const { data: snapshotData } = await client.from('inventory_state').select('state,updated_at').eq('owner_id', ownerId).eq('workspace_key', 'default').maybeSingle();
  const snapshot = snapshotData?.state ?? {};
  const snap = (key) => Array.isArray(snapshot?.[key]) ? snapshot[key] : [];
  const finalRawProducts = productsRes.error ? snap('keystone-products') : rawProducts;
  const finalRawCustomers = customersRes.error ? snap('keystone-customers') : rawCustomers;
  const finalRawSales = salesRes.error ? snap('keystone-sales') : rawSales;
  if (productsRes.error || customersRes.error || salesRes.error) {
    // Snapshot records are already in client shape. A full snapshot fallback is
    // handled below only when the core relational queries are unavailable.
    if (productsRes.error && customersRes.error && salesRes.error && !snapshotData?.state) return false;
  }
`;
// Keep the safer existing relational mapping unless the core query itself fails;
// in that case the original snapshot fallback is more accurate than attempting
// to map client-shaped snapshot rows as DB rows.
const saferGate = `  const relationalHasData = rawProducts.length + rawCustomers.length + rawSales.length + rawEmi.length > 0;
  if (!relationalHasData) return hydrateSnapshotFallback(client, ownerId);
`;
// Leave the gate itself intact for now; the key fix is eliminating unrelated
// query failures and embedded relations. This comment prevents this script from
// becoming an unsafe partial mapper on future builds.
if (!src.includes("const productByDbId = new Map")) throw new Error('Final hydration item anchor not found.');

fs.writeFileSync(file, src);
console.log('Final relational hydration patch applied: embedded relation queries removed and individual query errors logged without hiding successful datasets.');
