-- Inventory cloud schema for Supabase/Postgres.
-- Run this in Supabase SQL Editor before enabling cloud data sync.

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  alternate_phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  category text not null,
  model text not null,
  sku text not null unique,
  serial_number text,
  imei text,
  purchase_price numeric(12,2) not null default 0,
  selling_price numeric(12,2) not null default 0,
  mrp numeric(12,2) not null default 0,
  stock integer not null default 0,
  min_stock integer not null default 0,
  warranty text,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  sale_date timestamptz not null default now(),
  subtotal numeric(12,2) not null default 0,
  discount_type text check (discount_type in ('fixed','percent')),
  discount_value numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  final_amount numeric(12,2) not null default 0,
  purchase_cost numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0,
  payment_method text not null,
  status text not null default 'COMPLETED'
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  final_price numeric(12,2) not null
);

create table if not exists public.emi_plans (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  total_amount numeric(12,2) not null,
  down_payment numeric(12,2) not null default 0,
  financed_amount numeric(12,2) not null default 0,
  emi_amount numeric(12,2) not null default 0,
  installments integer not null check (installments > 0),
  paid_installments integer not null default 0,
  outstanding_amount numeric(12,2) not null default 0,
  start_date date not null,
  next_due_date date,
  end_date date not null,
  frequency text not null default 'MONTHLY',
  status text not null default 'ACTIVE'
);

create table if not exists public.emi_payments (
  id uuid primary key default gen_random_uuid(),
  emi_plan_id uuid not null references public.emi_plans(id) on delete cascade,
  installment_number integer not null,
  due_date date not null,
  amount numeric(12,2) not null,
  paid_date timestamptz,
  status text not null default 'UPCOMING'
);

create index if not exists idx_sales_customer_id on public.sales(customer_id);
create index if not exists idx_sale_items_sale_id on public.sale_items(sale_id);
create index if not exists idx_sale_items_product_id on public.sale_items(product_id);
create index if not exists idx_emi_plans_customer_id on public.emi_plans(customer_id);
create index if not exists idx_emi_payments_plan_id on public.emi_payments(emi_plan_id);

-- Prevent anonymous/public access. Authenticated users can access the shop data.
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.emi_plans enable row level security;
alter table public.emi_payments enable row level security;

do $$
begin
  create policy "authenticated customers" on public.customers for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$
begin
  create policy "authenticated products" on public.products for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$
begin
  create policy "authenticated sales" on public.sales for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$
begin
  create policy "authenticated sale items" on public.sale_items for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$
begin
  create policy "authenticated emi plans" on public.emi_plans for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$
begin
  create policy "authenticated emi payments" on public.emi_payments for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
