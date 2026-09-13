-- Keystone Inventory: repair an already-provisioned/older Supabase database.
-- Run this manually in Supabase SQL Editor.
-- Keep RLS ENABLED. This migration only repairs schema/constraints and refreshes PostgREST.

create extension if not exists pgcrypto;

-- 1) Make the browser/client identity columns available on every relational table.
alter table public.customers add column if not exists client_id text;
alter table public.products add column if not exists client_id text;
alter table public.sales add column if not exists client_id text;
alter table public.sale_items add column if not exists client_id text;
alter table public.emi_plans add column if not exists client_id text;
alter table public.emi_payments add column if not exists client_id text;

-- Backfill existing rows with stable text IDs before enforcing NOT NULL.
update public.customers set client_id = id::text where client_id is null;
update public.products set client_id = id::text where client_id is null;
update public.sales set client_id = id::text where client_id is null;
update public.sale_items set client_id = id::text where client_id is null;
update public.emi_plans set client_id = id::text where client_id is null;
update public.emi_payments set client_id = id::text where client_id is null;

alter table public.customers alter column client_id set not null;
alter table public.products alter column client_id set not null;
alter table public.sales alter column client_id set not null;
alter table public.sale_items alter column client_id set not null;
alter table public.emi_plans alter column client_id set not null;
alter table public.emi_payments alter column client_id set not null;

-- 2) The current POS stores EMI rate/interest explicitly.
alter table public.emi_plans add column if not exists interest_rate numeric(7,3) not null default 0;
alter table public.emi_plans add column if not exists total_interest numeric(14,2) not null default 0;

-- 3) Accept the values used by the current application, while retaining
-- compatibility with older lowercase data already in the database.
alter table public.emi_plans drop constraint if exists emi_plans_frequency_check;
alter table public.emi_plans add constraint emi_plans_frequency_check
  check (frequency in ('DAILY','WEEKLY','MONTHLY','YEARLY','daily','weekly','monthly','yearly'));

alter table public.emi_plans drop constraint if exists emi_plans_status_check;
alter table public.emi_plans add constraint emi_plans_status_check
  check (status in ('ACTIVE','PAID','CANCELLED','active','paid','cancelled'));

alter table public.emi_payments drop constraint if exists emi_payments_status_check;
alter table public.emi_payments add constraint emi_payments_status_check
  check (status in ('UPCOMING','PAID','OVERDUE','CANCELLED','upcoming','paid','overdue','cancelled'));

alter table public.sales drop constraint if exists sales_payment_method_check;
alter table public.sales add constraint sales_payment_method_check
  check (payment_method in ('Cash','UPI','Card','Bank Transfer','EMI','Mixed Payment','cash','upi','card','bank transfer','emi','mixed payment'));

alter table public.sales drop constraint if exists sales_status_check;
alter table public.sales add constraint sales_status_check
  check (status in ('COMPLETED','completed','PENDING','pending','CANCELLED','cancelled','REFUNDED','refunded'));

-- 4) Required tenant indexes for the upsert paths used by checkout/sync.
create unique index if not exists customers_owner_client_id_uidx on public.customers(owner_id, client_id);
create unique index if not exists products_owner_client_id_uidx on public.products(owner_id, client_id);
create unique index if not exists sales_owner_client_id_uidx on public.sales(owner_id, client_id);
create unique index if not exists sale_items_owner_client_id_uidx on public.sale_items(owner_id, client_id);
create unique index if not exists emi_plans_owner_client_id_uidx on public.emi_plans(owner_id, client_id);
create unique index if not exists emi_payments_owner_client_id_uidx on public.emi_payments(owner_id, client_id);

-- 5) Ensure RLS remains on for tenant isolation.
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.emi_plans enable row level security;
alter table public.emi_payments enable row level security;

-- 6) Refresh PostgREST's schema cache immediately.
notify pgrst, 'reload schema';
