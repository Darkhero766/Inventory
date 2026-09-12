import { supabase } from './supabase';

const KEYS = ['keystone-products','keystone-history','keystone-purchases','keystone-sales','keystone-customers','keystone-emi-plans','keystone-emi-payments'] as const;
const OWNER_KEY = 'keystone-active-owner-id-v1';
let hydrating = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let bootPromise: Promise<boolean> | null = null;
let syncInstalled = false;
let cloudReady = false;

const snapshot = () => Object.fromEntries(KEYS.map(key => {
  try { return [key, JSON.parse(localStorage.getItem(key) || 'null')]; }
  catch { return [key, null]; }
}));

const clearLocalInventoryCache = () => { for (const key of KEYS) localStorage.removeItem(key); };
const notifyHydrated = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('keystone-inventory-hydrated')); };

async function currentUserId() {
  const client = supabase;
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

async function ensureSession() {
  const client = supabase;
  if (!client) return false;
  const { data } = await client.auth.getSession();
  return Boolean(data.session);
}

async function hydrateRelational() {
  const client = supabase;
  if (!client || !(await ensureSession())) return false;
  const ownerId = await currentUserId();
  if (!ownerId) return false;

  // IMPORTANT: these selects intentionally use only columns that exist in the
  // current Supabase schema. The database UUID is also the app's stable ID;
  // there is no separate client_id column.
  const [productsRes, customersRes, salesRes, itemsRes, emiRes, paymentsRes] = await Promise.all([
    client.from('products').select('id,owner_id,name,brand,category,model,sku,serial_number,imei,purchase_price,selling_price,stock,image_url,created_at,updated_at').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    client.from('customers').select('id,owner_id,name,phone,alternate_phone,email,address,created_at').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    client.from('sales').select('id,owner_id,invoice_number,customer_id,sale_date,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method,status,customers(id,name)').eq('owner_id', ownerId).order('sale_date', { ascending: false }),
    client.from('sale_items').select('id,owner_id,sale_id,product_id,quantity,unit_price,discount,final_price,products(id,name,serial_number,imei)').eq('owner_id', ownerId),
    client.from('emi_plans').select('id,owner_id,sale_id,customer_id,total_amount,down_payment,financed_amount,emi_amount,installments,paid_installments,outstanding_amount,start_date,next_due_date,end_date,frequency,status').eq('owner_id', ownerId),
    client.from('emi_payments').select('id,owner_id,emi_plan_id,installment_number,due_date,amount,paid_date,status').eq('owner_id', ownerId).order('due_date', { ascending: true }),
  ]);

  const results = [productsRes, customersRes, salesRes, itemsRes, emiRes, paymentsRes];
  const failed = results.find(r => r.error);
  if (failed) {
    console.warn('[cloud] relational hydration failed:', failed.error?.message);
    return false;
  }

  const rawProducts = productsRes.data ?? [];
  const rawCustomers = customersRes.data ?? [];
  const rawSales = salesRes.data ?? [];
  const rawEmi = emiRes.data ?? [];

  const products = rawProducts.map((p: any) => ({
    id: p.id,
    name: p.name,
    brand: p.brand ?? '',
    category: p.category,
    model: p.model ?? '',
    sku: p.sku ?? '',
    purchasePrice: Number(p.purchase_price ?? 0),
    sellingPrice: Number(p.selling_price ?? 0),
    mrp: Number(p.selling_price ?? 0),
    quantity: Number(p.stock ?? 0),
    minStock: 0,
    warranty: '',
    image: p.image_url ?? '',
    createdAt: p.created_at,
    serialNumber: p.serial_number ?? undefined,
    imei: p.imei ?? undefined,
  }));

  const customers = rawCustomers.map((c: any) => ({
    id: c.id,
    name: c.name ?? '',
    phone: c.phone ?? '',
    alternatePhone: c.alternate_phone ?? undefined,
    email: c.email ?? undefined,
    address: c.address ?? undefined,
    createdAt: c.created_at,
  }));

  const itemsBySale = new Map<string, Array<Record<string, unknown>>>();
  for (const row of itemsRes.data ?? []) {
    const list = itemsBySale.get(row.sale_id) ?? [];
    list.push({
      productId: (row as any).products?.id ?? row.product_id,
      productName: (row as any).products?.name ?? 'Product',
      quantity: Number(row.quantity ?? 0),
      price: Number(row.unit_price ?? 0),
      discount: Number(row.discount ?? 0),
      serialNumber: (row as any).products?.serial_number ?? undefined,
      imei: (row as any).products?.imei ?? undefined,
    });
    itemsBySale.set(row.sale_id, list);
  }

  const sales = rawSales.map((s: any) => ({
    id: s.id,
    date: s.sale_date,
    invoice: s.invoice_number,
    customerId: s.customer_id ?? undefined,
    customerName: s.customers?.name ?? undefined,
    items: (itemsBySale.get(s.id) ?? []) as Array<Record<string, unknown>>,
    subtotal: Number(s.subtotal ?? 0),
    discount: Number(s.discount_amount ?? 0),
    total: Number(s.final_amount ?? 0),
    payment: s.payment_method ?? '',
    purchaseCost: Number(s.purchase_cost ?? 0),
    profit: Number(s.profit ?? 0),
    discountType: s.discount_type ?? undefined,
    discountValue: Number(s.discount_value ?? 0),
    status: s.status,
  }));

  const emiPlans = rawEmi.map((e: any) => ({
    id: e.id,
    saleId: e.sale_id,
    customerId: e.customer_id,
    totalAmount: Number(e.total_amount ?? 0),
    downPayment: Number(e.down_payment ?? 0),
    financedAmount: Number(e.financed_amount ?? 0),
    emiAmount: Number(e.emi_amount ?? 0),
    installments: Number(e.installments ?? 0),
    paidInstallments: Number(e.paid_installments ?? 0),
    outstandingAmount: Number(e.outstanding_amount ?? 0),
    startDate: e.start_date,
    nextDueDate: e.next_due_date,
    endDate: e.end_date,
    frequency: e.frequency,
    status: e.status,
  }));

  const emiPayments = (paymentsRes.data ?? []).map((p: any) => ({
    id: p.id,
    emiPlanId: p.emi_plan_id,
    installmentNumber: Number(p.installment_number ?? 0),
    dueDate: p.due_date,
    amount: Number(p.amount ?? 0),
    paidDate: p.paid_date ?? undefined,
    status: p.status,
  }));

  // Always replace the tenant cache with the authenticated owner's cloud
  // data. An empty result is valid for a brand-new shop and must never load
  // another account's cache.
  localStorage.setItem('keystone-products', JSON.stringify(products));
  localStorage.setItem('keystone-customers', JSON.stringify(customers));
  localStorage.setItem('keystone-sales', JSON.stringify(sales));
  localStorage.setItem('keystone-emi-plans', JSON.stringify(emiPlans));
  localStorage.setItem('keystone-emi-payments', JSON.stringify(emiPayments));
  cloudReady = true;
  return true;
}

export async function hydrateInventoryState() {
  const client = supabase;
  if (!client || typeof window === 'undefined') return false;
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    if (!(await ensureSession())) return false;
    hydrating = true;
    cloudReady = false;
    try {
      const ownerId = await currentUserId();
      if (!ownerId) return false;

      const cachedOwner = localStorage.getItem(OWNER_KEY);
      if (cachedOwner !== ownerId) clearLocalInventoryCache();
      localStorage.setItem(OWNER_KEY, ownerId);

      // Keep history/purchases if they are present in the snapshot table, but
      // products/customers/sales/EMI are rehydrated from their relational rows.
      const { data: stateRow, error: stateError } = await client
        .from('inventory_state')
        .select('state')
        .eq('owner_id', ownerId)
        .eq('workspace_key', 'default')
        .maybeSingle();

      if (!stateError && stateRow?.state) {
        const state = stateRow.state as Record<string, unknown>;
        for (const key of ['keystone-history', 'keystone-purchases'] as const) {
          if (state[key] !== undefined && state[key] !== null) localStorage.setItem(key, JSON.stringify(state[key]));
        }
      }

      const loaded = await hydrateRelational();
      notifyHydrated();
      return loaded;
    } finally {
      hydrating = false;
    }
  })();

  return bootPromise;
}

export function resetCloudHydration() {
  bootPromise = null;
  cloudReady = false;
}

export function clearTenantCache() {
  if (timer) { clearTimeout(timer); timer = undefined; }
  clearLocalInventoryCache();
  localStorage.removeItem(OWNER_KEY);
  resetCloudHydration();
}

export function syncInventoryState() {
  const client = supabase;
  if (!client || typeof window === 'undefined' || hydrating || !cloudReady) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = undefined;
    if (!(await ensureSession())) return;
    const ownerId = await currentUserId();
    if (!ownerId) return;
    localStorage.setItem(OWNER_KEY, ownerId);
    const state = snapshot();
    const { error } = await client.rpc('sync_inventory_snapshot', { p_state: state });
    if (error) console.warn('[cloud] snapshot sync failed:', error.message);
  }, 350);
}

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
export const cloudSyncConfigured = () => Boolean(supabase);
