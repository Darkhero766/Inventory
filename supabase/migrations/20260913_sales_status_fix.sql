-- Fix schema drift in older Supabase databases where sales_status_check
-- does not accept the status emitted by the current POS.
-- Safe to run repeatedly.
alter table public.sales drop constraint if exists sales_status_check;
alter table public.sales add constraint sales_status_check
  check (status in ('COMPLETED','completed','PENDING','pending','CANCELLED','cancelled','REFUNDED','refunded'));

alter table public.sales alter column status set default 'COMPLETED';
