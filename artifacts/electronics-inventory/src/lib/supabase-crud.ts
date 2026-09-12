import { supabase } from './supabase';

export async function getOwnerId() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('You must be signed in.');
  return data.user.id;
}

export async function insertProduct(input: Record<string, unknown>) {
  const owner_id = await getOwnerId();
  const { data, error } = await supabase!.from('products').insert({ ...input, owner_id }).select().single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, input: Record<string, unknown>) {
  const owner_id = await getOwnerId();
  const { data, error } = await supabase!.from('products').update(input).eq('id', id).eq('owner_id', owner_id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string) {
  const owner_id = await getOwnerId();
  const { error } = await supabase!.from('products').delete().eq('id', id).eq('owner_id', owner_id);
  if (error) throw error;
}

export async function insertCustomer(input: Record<string, unknown>) {
  const owner_id = await getOwnerId();
  const { data, error } = await supabase!.from('customers').insert({ ...input, owner_id }).select().single();
  if (error) throw error;
  return data;
}

export async function updateCustomer(id: string, input: Record<string, unknown>) {
  const owner_id = await getOwnerId();
  const { data, error } = await supabase!.from('customers').update(input).eq('id', id).eq('owner_id', owner_id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCustomer(id: string) {
  const owner_id = await getOwnerId();
  const { error } = await supabase!.from('customers').delete().eq('id', id).eq('owner_id', owner_id);
  if (error) throw error;
}

export async function insertSale(input: Record<string, unknown>) {
  const owner_id = await getOwnerId();
  const { data, error } = await supabase!.from('sales').insert({ ...input, owner_id }).select().single();
  if (error) throw error;
  return data;
}

export async function insertSaleItems(items: Array<Record<string, unknown>>) {
  const owner_id = await getOwnerId();
  const { data, error } = await supabase!.from('sale_items').insert(items.map(item => ({ ...item, owner_id }))).select();
  if (error) throw error;
  return data;
}

export async function insertEmiPlan(input: Record<string, unknown>) {
  const owner_id = await getOwnerId();
  const { data, error } = await supabase!.from('emi_plans').insert({ ...input, owner_id }).select().single();
  if (error) throw error;
  return data;
}

export async function insertEmiPayments(items: Array<Record<string, unknown>>) {
  const owner_id = await getOwnerId();
  const { data, error } = await supabase!.from('emi_payments').insert(items.map(item => ({ ...item, owner_id }))).select();
  if (error) throw error;
  return data;
}

export async function updateEmiPlan(id: string, input: Record<string, unknown>) {
  const owner_id = await getOwnerId();
  const { data, error } = await supabase!.from('emi_plans').update(input).eq('id', id).eq('owner_id', owner_id).select().single();
  if (error) throw error;
  return data;
}
