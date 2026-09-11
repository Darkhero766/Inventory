import { supabase } from './supabase';

const KEYS = ['keystone-products','keystone-history','keystone-purchases','keystone-sales','keystone-customers','keystone-emi-plans','keystone-emi-payments'] as const;
let hydrating = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let bootPromise: Promise<boolean> | null = null;
let syncInstalled = false;

const snapshot = () => Object.fromEntries(KEYS.map(key => {
  try { return [key, JSON.parse(localStorage.getItem(key) || 'null')]; } catch { return [key, null]; }
}));

async function ensureSession() {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

async function hydrateRelational() {
  if (!supabase || !(await ensureSession())) return false;
  const [productsRes, customersRes, salesRes, itemsRes, emiRes, paymentsRes] = await Promise.all([
    supabase.from('products').select('client_id,name,brand,category,model,sku,serial_number,imei,purchase_price,selling_price,mrp,stock,min_stock,warranty,image_url,created_at').order('created_at', { ascending: false }),
    supabase.from('customers').select('client_id,name,phone,alternate_phone,email,address,created_at').order('created_at', { ascending: false }),
    supabase.from('sales').select('client_id,invoice_number,customer_id,sale_date,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method,status,customers(client_id,name)').order('sale_date', { ascending: false }),
    supabase.from('sale_items').select('client_id,sale_id,product_id,quantity,unit_price,discount,final_price,products(client_id,name,serial_number,imei)'),
    supabase.from('emi_plans').select('client_id,sale_id,customer_id,total_amount,down_payment,financed_amount,emi_amount,installments,paid_installments,outstanding_amount,start_date,next_due_date,end_date,frequency,status'),
    supabase.from('emi_payments').select('client_id,emi_plan_id,installment_number,due_date,amount,paid_date,status').order('due_date', { ascending: true }),
  ]);
  if ([productsRes, customersRes, salesRes, itemsRes, emiRes, paymentsRes].some(r => r.error)) return false;

  const products = (productsRes.data ?? []).map((p: any) => ({
    id:p.client_id,name:p.name,brand:p.brand,category:p.category,model:p.model,sku:p.sku,purchasePrice:Number(p.purchase_price),sellingPrice:Number(p.selling_price),mrp:Number(p.mrp),quantity:Number(p.stock),minStock:Number(p.min_stock),warranty:p.warranty ?? '',image:p.image_url ?? '',createdAt:p.created_at,serialNumber:p.serial_number ?? undefined,imei:p.imei ?? undefined,
  }));
  const customers = (customersRes.data ?? []).map((c:any) => ({ id:c.client_id,name:c.name,phone:c.phone,alternatePhone:c.alternate_phone ?? undefined,email:c.email ?? undefined,address:c.address ?? undefined,createdAt:c.created_at }));
  const itemsBySale = new Map<string, any[]>();
  for (const row of itemsRes.data ?? []) { const list=itemsBySale.get(row.sale_id) ?? []; list.push(row); itemsBySale.set(row.sale_id,list); }
  const sales = (salesRes.data ?? []).map((s:any) => ({
    id:s.client_id,date:s.sale_date,invoice:s.invoice_number,customerId:s.customers?.client_id,customerName:s.customers?.name,
    items:[],subtotal:Number(s.subtotal),discount:Number(s.discount_amount),total:Number(s.final_amount),payment:s.payment_method,purchaseCost:Number(s.purchase_cost),profit:Number(s.profit),discountType:s.discount_type ?? undefined,discountValue:Number(s.discount_value ?? 0),status:s.status,
  }));
  for (const sale of sales) {
    const raw = (salesRes.data ?? []).find((s:any) => s.client_id === sale.id);
    sale.items = (itemsBySale.get(raw?.id) ?? []).map((i:any) => ({ productId:i.products?.client_id ?? i.product_id,productName:i.products?.name ?? 'Product',quantity:Number(i.quantity),price:Number(i.unit_price),discount:Number(i.discount ?? 0),serialNumber:i.products?.serial_number ?? undefined,imei:i.products?.imei ?? undefined }));
  }
  const emiDbToClient = new Map((emiRes.data ?? []).map((e:any) => [e.id,e.client_id]));
  const emiPlans = (emiRes.data ?? []).map((e:any) => ({ id:e.client_id,saleId:(salesRes.data ?? []).find((s:any)=>s.id===e.sale_id)?.client_id ?? e.sale_id,customerId:(customersRes.data ?? []).find((c:any)=>c.id===e.customer_id)?.client_id ?? e.customer_id,totalAmount:Number(e.total_amount),downPayment:Number(e.down_payment),financedAmount:Number(e.financed_amount),emiAmount:Number(e.emi_amount),installments:Number(e.installments),paidInstallments:Number(e.paid_installments),outstandingAmount:Number(e.outstanding_amount),startDate:e.start_date,nextDueDate:e.next_due_date,endDate:e.end_date,frequency:e.frequency,status:e.status }));
  const emiPayments = (paymentsRes.data ?? []).map((p:any) => ({ id:p.client_id,emiPlanId:emiDbToClient.get(p.emi_plan_id) ?? p.emi_plan_id,installmentNumber:Number(p.installment_number),dueDate:p.due_date,amount:Number(p.amount),paidDate:p.paid_date ?? undefined,status:p.status }));
  if (products.length) localStorage.setItem('keystone-products',JSON.stringify(products));
  localStorage.setItem('keystone-customers',JSON.stringify(customers));
  localStorage.setItem('keystone-sales',JSON.stringify(sales));
  localStorage.setItem('keystone-emi-plans',JSON.stringify(emiPlans));
  localStorage.setItem('keystone-emi-payments',JSON.stringify(emiPayments));
  return true;
}

export async function hydrateInventoryState() {
  if (!supabase || typeof window === 'undefined') return false;
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    if (!(await ensureSession())) return false;
    hydrating = true;
    try {
      const relational = await hydrateRelational();
      if (relational) return true;
      const { data, error } = await supabase.from('inventory_state').select('state').eq('workspace_key','default').maybeSingle();
      if (error || !data?.state) return false;
      const state=data.state as Record<string,unknown>;
      for (const key of KEYS) if (state[key] !== undefined && state[key] !== null) localStorage.setItem(key,JSON.stringify(state[key]));
      return true;
    } finally { hydrating=false; }
  })();
  return bootPromise;
}

export function syncInventoryState() {
  if (!supabase || typeof window === 'undefined' || hydrating) return;
  if (timer) clearTimeout(timer);
  timer=setTimeout(async()=>{
    if (!(await ensureSession())) return;
    const state=snapshot();
    const { error: relationalError } = await supabase.rpc('sync_inventory_snapshot',{p_state:state});
    if (relationalError) console.warn('[cloud] relational sync failed:',relationalError.message);
    const { error } = await supabase.from('inventory_state').upsert({workspace_key:'default',state,updated_at:new Date().toISOString()},{onConflict:'workspace_key'});
    if (error) console.warn('[cloud] compatibility snapshot failed:',error.message);
  },350);
}

/**
 * The UI intentionally keeps a fast local cache. This bridge makes every
 * inventory/customer/sale/EMI write cloud-backed without forcing every page
 * to know about Supabase. Hydration is ignored so boot cannot echo data back.
 */
function installLocalStorageSync() {
  if (syncInstalled || typeof window === 'undefined') return;
  syncInstalled = true;
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key: string, value: string) {
    original.call(this, key, value);
    if (this === window.localStorage && (KEYS as readonly string[]).includes(key)) syncInventoryState();
  };
}

installLocalStorageSync();
export const cloudSyncConfigured=()=>Boolean(supabase);
