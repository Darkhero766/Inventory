-- Keystone Inventory: Supabase persistence + RLS
-- Run this migration in Supabase SQL Editor.
-- Frontend must only use VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY.

create extension if not exists pgcrypto;

create table if not exists public.inventory_state (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_key text not null default 'default',
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(owner_id, workspace_key)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id text not null,
  name text not null,
  phone text not null,
  alternate_phone text,
  email text,
  address text,
  created_at timestamptz not null default now(),
  unique(owner_id, client_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id text not null,
  name text not null,
  brand text not null,
  category text not null,
  model text,
  sku text,
  serial_number text,
  imei text,
  purchase_price numeric(14,2) not null default 0,
  selling_price numeric(14,2) not null default 0,
  mrp numeric(14,2) not null default 0,
  stock integer not null default 0,
  min_stock integer not null default 0,
  warranty text,
  image_url text,
  created_at timestamptz not null default now(),
  unique(owner_id, client_id)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id text not null,
  invoice_number text,
  customer_id uuid references public.customers(id) on delete set null,
  sale_date timestamptz not null default now(),
  subtotal numeric(14,2) not null default 0,
  discount_type text check (discount_type in ('fixed','percent')),
  discount_value numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  final_amount numeric(14,2) not null default 0,
  purchase_cost numeric(14,2) not null default 0,
  profit numeric(14,2) not null default 0,
  payment_method text not null default 'Cash',
  status text not null default 'COMPLETED',
  unique(owner_id, client_id)
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id text not null,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  final_price numeric(14,2) not null default 0,
  unique(owner_id, client_id)
);

create table if not exists public.emi_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id text not null,
  sale_id uuid not null references public.sales(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  total_amount numeric(14,2) not null default 0,
  down_payment numeric(14,2) not null default 0,
  financed_amount numeric(14,2) not null default 0,
  emi_amount numeric(14,2) not null default 0,
  installments integer not null check (installments > 0),
  paid_installments integer not null default 0,
  outstanding_amount numeric(14,2) not null default 0,
  start_date date not null,
  next_due_date date,
  end_date date not null,
  frequency text not null default 'MONTHLY',
  status text not null default 'ACTIVE',
  unique(owner_id, client_id)
);

create table if not exists public.emi_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id text not null,
  emi_plan_id uuid not null references public.emi_plans(id) on delete cascade,
  installment_number integer not null,
  due_date date not null,
  amount numeric(14,2) not null default 0,
  paid_date timestamptz,
  status text not null default 'UPCOMING',
  unique(owner_id, client_id)
);

create index if not exists customers_owner_phone_idx on public.customers(owner_id, phone);
create index if not exists products_owner_sku_idx on public.products(owner_id, sku);
create index if not exists sales_owner_date_idx on public.sales(owner_id, sale_date desc);
create index if not exists emi_owner_due_idx on public.emi_plans(owner_id, next_due_date);

alter table public.inventory_state enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.emi_plans enable row level security;
alter table public.emi_payments enable row level security;

drop policy if exists inventory_owner on public.inventory_state;
create policy inventory_owner on public.inventory_state for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists customers_owner on public.customers;
create policy customers_owner on public.customers for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists products_owner on public.products;
create policy products_owner on public.products for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists sales_owner on public.sales;
create policy sales_owner on public.sales for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists sale_items_owner on public.sale_items;
create policy sale_items_owner on public.sale_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists emi_plans_owner on public.emi_plans;
create policy emi_plans_owner on public.emi_plans for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists emi_payments_owner on public.emi_payments;
create policy emi_payments_owner on public.emi_payments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Keep the snapshot compatibility path safe and user-scoped.
create or replace function public.sync_inventory_snapshot(p_state jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.inventory_state(owner_id, workspace_key, state, updated_at)
  values (auth.uid(), 'default', coalesce(p_state, '{}'::jsonb), now())
  on conflict (owner_id, workspace_key)
  do update set state = excluded.state, updated_at = now();
end;
$$;

grant execute on function public.sync_inventory_snapshot(jsonb) to authenticated;
