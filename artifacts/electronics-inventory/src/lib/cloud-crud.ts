import { supabase } from './supabase';

async function ownerId() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('You must be signed in.');
  return data.user.id;
}

export async function cloudSaveProduct(product: any, existingId?: string) {
  if (!supabase) return product.id;
  const owner_id = await ownerId(); const client_id = String(product.id || crypto.randomUUID());
  const row = { owner_id, client_id, name: product.name, brand: product.brand ?? '', category: product.category ?? '', model: product.model ?? '', sku: product.sku ?? '', serial_number: product.serialNumber ?? null, imei: product.imei ?? null, purchase_price: Number(product.purchasePrice ?? 0), selling_price: Number(product.sellingPrice ?? 0), mrp: Number(product.mrp ?? product.sellingPrice ?? 0), stock: Number(product.quantity ?? 0), min_stock: Number(product.minStock ?? 0), warranty: product.warranty ?? '', image_url: product.image ?? null, updated_at: new Date().toISOString() };
  if (existingId) { const { error } = await supabase.from('products').update(row).eq('id', existingId).eq('owner_id', owner_id); if (error) throw error; return existingId; }
  const { data, error } = await supabase.from('products').insert(row).select('id').single(); if (error) throw error; return data.id;
}

export async function cloudDeleteProduct(id: string) { if (!supabase) return; const owner_id = await ownerId(); const { error } = await supabase.from('products').delete().eq('id', id).eq('owner_id', owner_id); if (error) throw error; }

export async function cloudAdjustStock(id: string, amount: number) {
  if (!supabase || amount === 0) return; const owner_id = await ownerId();
  const { data, error } = await supabase.from('products').select('stock').eq('id', id).eq('owner_id', owner_id).single(); if (error) throw error;
  const stock = Number(data.stock ?? 0) + amount; if (stock < 0) throw new Error('Insufficient stock.');
  const { error: updateError } = await supabase.from('products').update({ stock, updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', owner_id); if (updateError) throw updateError;
}

async function resolveCustomerDbId(value: string | undefined, owner_id: string) {
  if (!supabase || !value) return null;
  const byId = await supabase.from('customers').select('id').eq('id', value).eq('owner_id', owner_id).maybeSingle(); if (byId.data?.id) return byId.data.id;
  const byClient = await supabase.from('customers').select('id').eq('client_id', value).eq('owner_id', owner_id).maybeSingle(); return byClient.data?.id ?? null;
}

export async function cloudUpsertCustomer(customer: any, existingId?: string) {
  if (!supabase) return customer.id; const owner_id = await ownerId(); const client_id = String(customer.id || crypto.randomUUID());
  const row = { owner_id, client_id, name: customer.name ?? '', phone: customer.phone ?? '', alternate_phone: customer.alternatePhone ?? null, email: customer.email ?? null, address: customer.address ?? null, created_at: customer.createdAt ?? new Date().toISOString() };
  if (existingId) { const { error } = await supabase.from('customers').update(row).eq('id', existingId).eq('owner_id', owner_id); if (error) throw error; return existingId; }
  const { data, error } = await supabase.from('customers').insert(row).select('id').single(); if (error) throw error; return data.id;
}

export async function cloudCreateSale(sale: any, purchaseCost: number, profit: number) {
  if (!supabase) return sale.id; const owner_id = await ownerId(); const client_id = String(sale.id || crypto.randomUUID());
  const customer_id = await resolveCustomerDbId(sale.customerId, owner_id);
  const payment_method = String(sale.payment ?? 'Cash');
  const baseSaleRow = { owner_id, invoice_number: sale.invoice ?? `INV-${Date.now()}`, customer_id, sale_date: sale.date ?? new Date().toISOString(), subtotal: Number(sale.subtotal ?? 0), discount_type: sale.discountType ?? null, discount_value: Number(sale.discountValue ?? 0), discount_amount: Number(sale.discount ?? 0), final_amount: Number(sale.total ?? 0), purchase_cost: purchaseCost, profit, payment_method, status: 'COMPLETED' };
  let saleInsert = await supabase.from('sales').insert({ ...baseSaleRow, client_id }).select('id').single();
  if (saleInsert.error && /client_id.*sales|sales.*client_id/i.test(saleInsert.error.message)) saleInsert = await supabase.from('sales').insert(baseSaleRow).select('id').single();

  // Some already-provisioned databases use the older lowercase sales status enum/check
  // (for example: 'completed') while newer migrations use 'COMPLETED'. Retry with the
  // legacy spelling so an otherwise valid sale is not blocked by schema drift.
  if (saleInsert.error && /sales_status_check|status/i.test(saleInsert.error.message)) {
    const legacyStatusRow = { ...baseSaleRow, status: 'completed' };
    saleInsert = await supabase.from('sales').insert({ ...legacyStatusRow, client_id }).select('id').single();
    if (saleInsert.error && /client_id.*sales|sales.*client_id/i.test(saleInsert.error.message)) saleInsert = await supabase.from('sales').insert(legacyStatusRow).select('id').single();
  }

  // Older deployed databases may reject the newer EMI payment method. Store the sale as
  // Cash only as a compatibility fallback; the linked EMI plan remains the source of truth.
  if (saleInsert.error && payment_method === 'EMI' && /sales_payment_method_check|payment_method/i.test(saleInsert.error.message)) {
    const legacyRow = { ...baseSaleRow, payment_method: 'Cash' };
    saleInsert = await supabase.from('sales').insert({ ...legacyRow, client_id }).select('id').single();
    if (saleInsert.error && /client_id.*sales|sales.*client_id/i.test(saleInsert.error.message)) saleInsert = await supabase.from('sales').insert(legacyRow).select('id').single();
  }
  if (saleInsert.error) {
    const detail = saleInsert.error.message;
    if (/sales_payment_method_check|payment_method/i.test(detail)) throw new Error(`Sale could not be saved: Supabase rejected payment method "${payment_method}". Run migration 20260913_emi_payment_method_fix.sql in Supabase SQL Editor, then retry.`);
    if (/sales_status_check|status/i.test(detail)) throw new Error('Sale could not be saved: the Supabase sales status constraint is using an incompatible value. Run migration 20260913_sales_status_fix.sql in Supabase SQL Editor, then retry.');
    throw new Error(`Sale could not be saved: ${detail}`);
  }
  const dbSaleId = saleInsert.data.id;
  const modernItems = (sale.items ?? []).map((item: any) => ({ id: crypto.randomUUID(), owner_id, client_id: `${client_id}:${item.productId}`, sale_id: dbSaleId, product_id: item.productId, quantity: Number(item.quantity ?? 0), unit_price: Number(item.price ?? 0), discount: Number(item.discount ?? 0), final_price: Number(item.price ?? 0) * Number(item.quantity ?? 0) - Number(item.discount ?? 0) }));
  const legacyItems = modernItems.map(({ client_id: _clientId, ...item }: any) => item);
  if (modernItems.length) { let itemInsert = await supabase.from('sale_items').insert(modernItems); if (itemInsert.error && /client_id.*sale_items|sale_items.*client_id/i.test(itemInsert.error.message)) itemInsert = await supabase.from('sale_items').insert(legacyItems); if (itemInsert.error) { await supabase.from('sales').delete().eq('id', dbSaleId).eq('owner_id', owner_id); throw new Error(`Sale items could not be saved: ${itemInsert.error.message}`); } }
  return dbSaleId;
}

export async function cloudCreateEmiPlan(plan: any, payments: any[], dbSaleId?: string) {
  if (!supabase) return plan.id; const owner_id = await ownerId(); let sale_id = dbSaleId ?? null;
  if (!sale_id) { const saleRes = await supabase.from('sales').select('id').eq('client_id', plan.saleId).eq('owner_id', owner_id).maybeSingle(); sale_id = saleRes.data?.id ?? null; }
  const customer_id = await resolveCustomerDbId(plan.customerId, owner_id); if (!sale_id) throw new Error('The sale record could not be found for the EMI plan.'); if (!customer_id) throw new Error('The EMI customer could not be found.');
  const client_id = String(plan.id || crypto.randomUUID());
  const baseEmiRow = { owner_id, sale_id, customer_id, total_amount: Number(plan.totalAmount ?? 0), down_payment: Number(plan.downPayment ?? 0), financed_amount: Number(plan.financedAmount ?? 0), emi_amount: Number(plan.emiAmount ?? 0), installments: Number(plan.installments ?? 1), paid_installments: 0, outstanding_amount: Number(plan.outstandingAmount ?? plan.financedAmount ?? 0), start_date: plan.startDate, next_due_date: plan.nextDueDate ? String(plan.nextDueDate).slice(0,10) : null, end_date: plan.endDate, frequency: plan.frequency ?? 'MONTHLY', status: plan.status ?? 'ACTIVE', interest_rate: Number(plan.interestRate ?? 0), total_interest: Number(plan.totalInterest ?? 0) };
  let emiInsert = await supabase.from('emi_plans').insert({ ...baseEmiRow, client_id }).select('id').single();
  if (emiInsert.error && /client_id.*emi_plans|emi_plans.*client_id/i.test(emiInsert.error.message)) emiInsert = await supabase.from('emi_plans').insert(baseEmiRow).select('id').single();
  if (emiInsert.error && /interest_rate|total_interest|emi_plans.*column/i.test(emiInsert.error.message)) {
    const legacyEmiRow = { ...baseEmiRow }; delete (legacyEmiRow as any).interest_rate; delete (legacyEmiRow as any).total_interest;
    let retry = await supabase.from('emi_plans').insert({ ...legacyEmiRow, client_id }).select('id').single();
    if (retry.error && /client_id.*emi_plans|emi_plans.*client_id/i.test(retry.error.message)) retry = await supabase.from('emi_plans').insert(legacyEmiRow).select('id').single();
    emiInsert = retry;
  }
  if (emiInsert.error) throw new Error(`EMI plan could not be saved: ${emiInsert.error.message}`);
  const dbEmiId = emiInsert.data.id;
  const modernRows = payments.map((p: any) => ({ id: crypto.randomUUID(), owner_id, client_id: `${client_id}:${p.installmentNumber}`, emi_plan_id: dbEmiId, installment_number: Number(p.installmentNumber), due_date: String(p.dueDate).slice(0,10), amount: Number(p.amount ?? 0), paid_date: p.paidDate ?? null, status: p.status ?? 'UPCOMING' }));
  const legacyRows = modernRows.map(({ client_id: _clientId, ...row }: any) => row);
  if (modernRows.length) { let paymentInsert = await supabase.from('emi_payments').insert(modernRows); if (paymentInsert.error && /client_id.*emi_payments|emi_payments.*client_id/i.test(paymentInsert.error.message)) paymentInsert = await supabase.from('emi_payments').insert(legacyRows); if (paymentInsert.error) { await supabase.from('emi_plans').delete().eq('id', dbEmiId).eq('owner_id', owner_id); throw new Error(`EMI schedule could not be saved: ${paymentInsert.error.message}`); } }
  return dbEmiId;
}

export async function cloudMarkEmiPaid(payment: any, plan: any) { if (!supabase) return; const owner_id = await ownerId(); const paidDate = new Date().toISOString().slice(0, 10); const { error: paymentError } = await supabase.from('emi_payments').update({ status: 'PAID', paid_date: paidDate }).eq('id', payment.id).eq('owner_id', owner_id); if (paymentError) throw paymentError; const { error: planError } = await supabase.from('emi_plans').update({ paid_installments: plan.paidInstallments, outstanding_amount: plan.outstandingAmount, next_due_date: plan.nextDueDate, status: plan.status }).eq('id', plan.id).eq('owner_id', owner_id); if (planError) throw planError; }
