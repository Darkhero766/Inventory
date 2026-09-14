import { supabase } from './supabase';

const KEYS = ['keystone-products','keystone-history','keystone-purchases','keystone-sales','keystone-customers','keystone-emi-plans','keystone-emi-payments'] as const;
const OWNER_KEY = 'keystone-active-owner-id-v1';
let hydrating = false;
let bootPromise: Promise<boolean> | null = null;
let bootOwner: string | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncChain: Promise<void> = Promise.resolve();

const clearLocalInventoryCache = () => { for (const key of KEYS) localStorage.removeItem(key); };
const notifyHydrated = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('keystone-inventory-hydrated')); };

async function currentUserId() { const client = supabase; if (!client) return null; const { data } = await client.auth.getUser(); return data.user?.id ?? null; }
async function ensureSession() { const client = supabase; if (!client) return false; const { data } = await client.auth.getSession(); return Boolean(data.session); }

async function hydrateRelational() {
  const client = supabase;
  if (!client || !(await ensureSession())) return false;
  const ownerId = await currentUserId();
  if (!ownerId) return false;

  const [productsRes, customersRes, salesRes, itemsRes, emiRes, paymentsRes] = await Promise.all([
    client.from('products').select('id,client_id,name,brand,category,model,sku,serial_number,imei,purchase_price,selling_price,mrp,stock,min_stock,warranty,image_url,created_at').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    client.from('customers').select('id,client_id,name,phone,alternate_phone,email,address,created_at').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    client.from('sales').select('id,client_id,invoice_number,customer_id,sale_date,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method,status,customers(id,client_id,name)').eq('owner_id', ownerId).order('sale_date', { ascending: false }),
    client.from('sale_items').select('id,client_id,sale_id,product_id,quantity,unit_price,discount,final_price,products(id,client_id,name,serial_number,imei)').eq('owner_id', ownerId),
    client.from('emi_plans').select('id,client_id,sale_id,customer_id,total_amount,down_payment,financed_amount,emi_amount,installments,paid_installments,outstanding_amount,start_date,next_due_date,end_date,frequency,status,interest_rate,total_interest').eq('owner_id', ownerId),
    client.from('emi_payments').select('id,client_id,emi_plan_id,installment_number,due_date,amount,paid_date,status').eq('owner_id', ownerId).order('due_date', { ascending: true }),
  ]);

  const results = [productsRes, customersRes, salesRes, itemsRes, emiRes, paymentsRes];
  const failed = results.find(r => r.error);
  if (failed) { console.warn('[cloud] relational hydration failed:', failed.error?.message); return false; }

  const rawProducts = productsRes.data ?? [];
  const rawCustomers = customersRes.data ?? [];
  const rawSales = salesRes.data ?? [];
  const rawEmi = emiRes.data ?? [];

  const productClientByDbId = new Map(rawProducts.map((p: any) => [String(p.id), String(p.client_id)]));
  const customerClientByDbId = new Map(rawCustomers.map((c: any) => [String(c.id), String(c.client_id)]));
  const saleClientByDbId = new Map(rawSales.map((s: any) => [String(s.id), String(s.client_id)]));
  const emiClientByDbId = new Map(rawEmi.map((e: any) => [String(e.id), String(e.client_id)]));

  const products = rawProducts.map((p: any) => ({
    id:String(p.client_id), name:p.name, brand:p.brand??'', category:p.category, model:p.model??'', sku:p.sku??'',
    purchasePrice:Number(p.purchase_price??0), sellingPrice:Number(p.selling_price??0), mrp:Number(p.mrp??p.selling_price??0),
    quantity:Number(p.stock??0), minStock:Number(p.min_stock??0), warranty:p.warranty??'', image:p.image_url??'', createdAt:p.created_at,
    serialNumber:p.serial_number??undefined, imei:p.imei??undefined,
  }));
  const customers = rawCustomers.map((c: any) => ({
    id:String(c.client_id), name:c.name??'', phone:c.phone??'', alternatePhone:c.alternate_phone??undefined,
    email:c.email??undefined, address:c.address??undefined, createdAt:c.created_at,
  }));

  const itemsBySale = new Map<string, Array<Record<string, unknown>>>();
  for (const row of itemsRes.data ?? []) {
    const product = (row as any).products;
    const saleKey = saleClientByDbId.get(String((row as any).sale_id)) ?? String((row as any).sale_id);
    const list = itemsBySale.get(saleKey) ?? [];
    list.push({
      productId:productClientByDbId.get(String(product?.id ?? (row as any).product_id)) ?? String(product?.client_id ?? (row as any).product_id),
      productName:product?.name??'Product', quantity:Number((row as any).quantity??0), price:Number((row as any).unit_price??0),
      discount:Number((row as any).discount??0), serialNumber:product?.serial_number??undefined, imei:product?.imei??undefined,
    });
    itemsBySale.set(saleKey,list);
  }

  const emiSaleIds = new Set(rawEmi.map((e:any) => String(e.sale_id)));
  const sales = rawSales.map((s:any) => ({
    id:String(s.client_id), date:s.sale_date, invoice:s.invoice_number,
    customerId:customerClientByDbId.get(String(s.customer_id)) ?? undefined, customerName:s.customers?.name??undefined,
    items:(itemsBySale.get(String(s.client_id))??[]) as Array<Record<string,unknown>>, subtotal:Number(s.subtotal??0),
    discount:Number(s.discount_amount??0), total:Number(s.final_amount??0), payment:emiSaleIds.has(String(s.id))?'EMI':(s.payment_method??''),
    purchaseCost:Number(s.purchase_cost??0), profit:Number(s.profit??0), discountType:s.discount_type??undefined,
    discountValue:Number(s.discount_value??0), status:s.status,
  }));

  const emiPlans = rawEmi.map((e:any) => ({
    id:String(e.client_id), saleId:saleClientByDbId.get(String(e.sale_id)) ?? String(e.sale_id),
    customerId:customerClientByDbId.get(String(e.customer_id)) ?? String(e.customer_id), totalAmount:Number(e.total_amount??0),
    downPayment:Number(e.down_payment??0), financedAmount:Number(e.financed_amount??0), emiAmount:Number(e.emi_amount??0),
    installments:Number(e.installments??0), paidInstallments:Number(e.paid_installments??0), outstandingAmount:Number(e.outstanding_amount??0),
    startDate:e.start_date, nextDueDate:e.next_due_date, endDate:e.end_date, frequency:e.frequency, status:e.status,
    interestRate:Number(e.interest_rate??0), totalInterest:Number(e.total_interest??0),
  }));
  const emiPayments = (paymentsRes.data??[]).map((p:any) => ({
    id:String(p.client_id), emiPlanId:emiClientByDbId.get(String(p.emi_plan_id)) ?? String(p.emi_plan_id),
    installmentNumber:Number(p.installment_number??0), dueDate:p.due_date, amount:Number(p.amount??0), paidDate:p.paid_date??undefined, status:p.status,
  }));

  localStorage.setItem('keystone-products',JSON.stringify(products));
  localStorage.setItem('keystone-customers',JSON.stringify(customers));
  localStorage.setItem('keystone-sales',JSON.stringify(sales));
  localStorage.setItem('keystone-emi-plans',JSON.stringify(emiPlans));
  localStorage.setItem('keystone-emi-payments',JSON.stringify(emiPayments));
  return true;
}

async function syncSnapshot() {
  const client = supabase;
  if (!client || typeof window === 'undefined' || hydrating || !(await ensureSession())) return;
  const ownerId = await currentUserId();
  const cachedOwner = localStorage.getItem(OWNER_KEY);
  // Never push stale state from the previous account into the newly signed-in account.
  if (!ownerId || cachedOwner !== ownerId) return;
  const state: Record<string, unknown> = {};
  for (const key of KEYS) {
    try { state[key] = JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { state[key] = []; }
  }
  const { error } = await client.rpc('sync_inventory_snapshot', { p_state: state });
  if (error) console.warn('[cloud] snapshot sync failed:', error.message);
}

export async function hydrateInventoryState() {
  const client = supabase;
  if (!client || typeof window === 'undefined') return false;
  const ownerId = await currentUserId();
  if (!ownerId || !(await ensureSession())) return false;

  // The previous implementation cached one boot promise forever. After a user
  // switch, that promise belonged to the previous owner, so the new account
  // never fetched its Supabase rows. Cache hydration per authenticated owner.
  if (bootPromise && bootOwner === ownerId) return bootPromise;
  if (bootOwner !== ownerId) {
    bootPromise = null;
    bootOwner = ownerId;
    const cachedOwner = localStorage.getItem(OWNER_KEY);
    if (cachedOwner !== ownerId) clearLocalInventoryCache();
  }

  bootPromise = (async () => {
    hydrating = true;
    try {
      const activeOwner = await currentUserId();
      if (!activeOwner || activeOwner !== ownerId) return false;
      localStorage.setItem(OWNER_KEY, ownerId);
      const loaded = await hydrateRelational();
      notifyHydrated();
      return loaded;
    } finally { hydrating = false; }
  })();
  return bootPromise;
}

export function resetCloudHydration() { bootPromise = null; bootOwner = null; }
export function clearTenantCache() { clearLocalInventoryCache(); localStorage.removeItem(OWNER_KEY); resetCloudHydration(); }
export function syncInventoryState() {
  if (!supabase || typeof window === 'undefined' || hydrating) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncChain = syncChain.then(() => syncSnapshot()).catch(error => console.warn('[cloud] snapshot sync queue failed:', error));
  }, 350);
}
export const cloudSyncConfigured = () => Boolean(supabase);
