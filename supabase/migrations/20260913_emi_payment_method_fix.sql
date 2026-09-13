-- Allow every payment method exposed by the POS, including EMI.
-- This fixes older Supabase databases that still have a narrower sales_payment_method_check.
alter table public.sales drop constraint if exists sales_payment_method_check;
alter table public.sales add constraint sales_payment_method_check
  check (payment_method in ('Cash','UPI','Card','Bank Transfer','EMI','Mixed Payment'));

-- Persist the EMI rate and calculated interest instead of keeping them only in the browser.
alter table public.emi_plans add column if not exists interest_rate numeric(7,3) not null default 0;
alter table public.emi_plans add column if not exists total_interest numeric(14,2) not null default 0;

create index if not exists emi_plans_owner_rate_idx on public.emi_plans(owner_id, interest_rate);
