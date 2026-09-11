-- Inventory cloud schema for Supabase/Postgres.
-- Run this once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), name text not null, phone text not null,
  alternate_phone text, email text, address text, created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), name text not null, brand text not null,
  category text not null, model text not null, sku text not null unique, serial_number text,
  imei text, purchase_price numeric(12,2) not null default 0, selling_price numeric(12,2) not null default 0,
  mrp numeric(12,2) not null default 0, stock integer not null default 0, min_stock integer not null default 0,
  warranty text, image_url text, created_at timestamptz not null default now()
);
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(), invoice_number text not null unique,
  customer_id uuid references public.customers(id) on delete set null, sale_date timestamptz not null default now(),
  subtotal numeric(12,2) not null default 0, discount_type text check (discount_type in ('fixed','percent')),
  discount_value numeric(12,2) not null default 0, discount_amount numeric(12,2) not null default 0,
  final_amount numeric(12,2) not null default 0, purchase_cost numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0, payment_method text not null, status text not null default 'COMPLETED'
);
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null, discount numeric(12,2) not null default 0, final_price numeric(12,2) not null
);
create table if not exists public.emi_plans (
  id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.sales(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade, total_amount numeric(12,2) not null,
  down_payment numeric(12,2) not null default 0, financed_amount numeric(12,2) not null default 0,
  emi_amount numeric(12,2) not null default 0, installments integer not null check (installments > 0),
  paid_installments integer not null default 0, outstanding_amount numeric(12,2) not null default 0,
  start_date date not null, next_due_date date, end_date date not null, frequency text not null default 'MONTHLY', status text not null default 'ACTIVE'
);
create table if not exists public.emi_payments (
  id uuid primary key default gen_random_uuid(), emi_plan_id uuid not null references public.emi_plans(id) on delete cascade,
  installment_number integer not null, due_date date not null, amount numeric(12,2) not null, paid_date timestamptz, status text not null default 'UPCOMING'
);
create table if not exists public.inventory_state (
  workspace_key text primary key default 'default',
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_customer_id on public.sales(customer_id);
create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);
create index if not exists idx_sale_items_product_id on public.sale_items(product_id);
create index if not exists idx_emi_plans_customer_id on public.emi_plans(customer_id);
create index if not exists idx_emi_payments_plan_id on public.emi_payments(emi_plan_id);

alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.emi_plans enable row level security;
alter table public.emi_payments enable row level security;
alter table public.inventory_state enable row level security;

do $$ begin create policy "authenticated customers" on public.customers for all to authenticated using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "authenticated products" on public.products for all to authenticated using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "authenticated sales" on public.sales for all to authenticated using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "authenticated sale items" on public.sale_items for all to authenticated using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "authenticated emi plans" on public.emi_plans for all to authenticated using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "authenticated emi payments" on public.emi_payments for all to authenticated using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "authenticated inventory state" on public.inventory_state for all to authenticated using (true) with check (true); exception when duplicate_object then null; end $$;

create or replace function public.complete_sale(
  p_invoice_number text, p_customer_id uuid, p_subtotal numeric, p_discount_type text,
  p_discount_value numeric, p_discount_amount numeric, p_final_amount numeric,
  p_purchase_cost numeric, p_profit numeric, p_payment_method text, p_items jsonb
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_sale_id uuid; v_item jsonb; v_stock integer;
begin
  if p_final_amount < 0 or p_discount_amount < 0 or p_discount_amount > p_subtotal then raise exception 'Invalid sale totals'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select stock into v_stock from products where id = (v_item->>'product_id')::uuid for update;
    if v_stock is null then raise exception 'Product not found'; end if;
    if v_stock < (v_item->>'quantity')::integer then raise exception 'Insufficient stock'; end if;
  end loop;
  insert into sales(invoice_number, customer_id, subtotal, discount_type, discount_value, discount_amount, final_amount, purchase_cost, profit, payment_method)
  values(p_invoice_number,p_customer_id,p_subtotal,p_discount_type,p_discount_value,p_discount_amount,p_final_amount,p_purchase_cost,p_profit,p_payment_method)
  returning id into v_sale_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into sale_items(sale_id,product_id,quantity,unit_price,discount,final_price)
    values(v_sale_id,(v_item->>'product_id')::uuid,(v_item->>'quantity')::integer,(v_item->>'unit_price')::numeric,coalesce((v_item->>'discount')::numeric,0),(v_item->>'final_price')::numeric);
    update products set stock = stock - (v_item->>'quantity')::integer where id = (v_item->>'product_id')::uuid;
  end loop;
  return v_sale_id;
exception when others then raise;
end; $$;

grant execute on function public.complete_sale(text,uuid,numeric,text,numeric,numeric,numeric,numeric,numeric,text,jsonb) to authenticated;
