-- Production hardening: per-user ownership, safe sales, EMI payments, and auth profile rules.
create extension if not exists pgcrypto;

alter table public.customers add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.products add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.sales add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.sale_items add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.emi_plans add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.emi_payments add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.inventory_state add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_customers_owner_id on public.customers(owner_id);
create index if not exists idx_products_owner_id on public.products(owner_id);
create index if not exists idx_sales_owner_id on public.sales(owner_id);
create index if not exists idx_sale_items_owner_id on public.sale_items(owner_id);
create index if not exists idx_emi_plans_owner_id on public.emi_plans(owner_id);
create index if not exists idx_emi_payments_owner_id on public.emi_payments(owner_id);
create unique index if not exists idx_inventory_state_owner_workspace on public.inventory_state(owner_id, workspace_key);

-- Replace permissive policies with owner-scoped policies.
do $$ declare p record; begin
  for p in select policyname, schemaname, tablename from pg_policies where schemaname='public' and tablename in ('customers','products','sales','sale_items','emi_plans','emi_payments','inventory_state') loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

do $$ begin create policy "customers owner access" on public.customers for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "products owner access" on public.products for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "sales owner access" on public.sales for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "sale items owner access" on public.sale_items for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "emi plans owner access" on public.emi_plans for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "emi payments owner access" on public.emi_payments for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "inventory state owner access" on public.inventory_state for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid()); exception when duplicate_object then null; end $$;

-- Safe sale RPC. All rows created by this function are owned by the caller.
create or replace function public.complete_sale(
  p_invoice_number text, p_customer_id uuid, p_subtotal numeric, p_discount_type text,
  p_discount_value numeric, p_discount_amount numeric, p_final_amount numeric,
  p_purchase_cost numeric, p_profit numeric, p_payment_method text, p_items jsonb
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_sale_id uuid; v_item jsonb; v_stock integer; v_owner uuid := auth.uid(); v_product_owner uuid;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if coalesce(jsonb_array_length(p_items),0) = 0 then raise exception 'Sale must contain at least one item'; end if;
  if p_final_amount < 0 or p_discount_amount < 0 or p_discount_amount > p_subtotal then raise exception 'Invalid sale totals'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select stock, owner_id into v_stock, v_product_owner from products where id = (v_item->>'product_id')::uuid for update;
    if v_product_owner is distinct from v_owner then raise exception 'Product access denied'; end if;
    if v_stock is null then raise exception 'Product not found'; end if;
    if (v_item->>'quantity')::integer <= 0 then raise exception 'Invalid quantity'; end if;
    if v_stock < (v_item->>'quantity')::integer then raise exception 'Insufficient stock'; end if;
  end loop;
  if p_customer_id is not null and not exists(select 1 from customers where id=p_customer_id and owner_id=v_owner) then raise exception 'Customer access denied'; end if;
  insert into sales(owner_id,invoice_number,customer_id,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method,status)
  values(v_owner,p_invoice_number,p_customer_id,p_subtotal,p_discount_type,p_discount_value,p_discount_amount,p_final_amount,p_purchase_cost,p_profit,p_payment_method,'COMPLETED')
  returning id into v_sale_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into sale_items(owner_id,sale_id,product_id,quantity,unit_price,discount,final_price)
    values(v_owner,v_sale_id,(v_item->>'product_id')::uuid,(v_item->>'quantity')::integer,(v_item->>'unit_price')::numeric,coalesce((v_item->>'discount')::numeric,0),(v_item->>'final_price')::numeric);
    update products set stock = stock - (v_item->>'quantity')::integer where id = (v_item->>'product_id')::uuid and owner_id=v_owner;
  end loop;
  return v_sale_id;
exception when others then raise;
end; $$;

grant execute on function public.complete_sale(text,uuid,numeric,text,numeric,numeric,numeric,numeric,numeric,text,jsonb) to authenticated;

-- Atomic EMI installment payment + plan update.
create or replace function public.mark_emi_payment_paid(p_payment_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_payment public.emi_payments%rowtype; v_plan public.emi_plans%rowtype; v_next date; v_paid integer; v_outstanding numeric; v_status text; v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  select * into v_payment from emi_payments where id=p_payment_id and owner_id=v_owner for update;
  if v_payment.id is null then raise exception 'EMI payment not found'; end if;
  if v_payment.status = 'PAID' then return jsonb_build_object('status','already_paid'); end if;
  select * into v_plan from emi_plans where id=v_payment.emi_plan_id and owner_id=v_owner for update;
  if v_plan.id is null then raise exception 'EMI plan not found'; end if;
  update emi_payments set status='PAID', paid_date=now() where id=v_payment.id and owner_id=v_owner;
  v_paid := v_plan.paid_installments + 1;
  v_outstanding := greatest(0, v_plan.outstanding_amount - v_payment.amount);
  select min(due_date) into v_next from emi_payments where emi_plan_id=v_plan.id and owner_id=v_owner and status <> 'PAID';
  v_status := case when v_outstanding <= 0 then 'PAID' when v_next is not null and v_next < current_date then 'OVERDUE' else 'ACTIVE' end;
  update emi_plans set paid_installments=v_paid, outstanding_amount=v_outstanding, next_due_date=v_next, status=v_status where id=v_plan.id and owner_id=v_owner;
  return jsonb_build_object('status','paid','paid_installments',v_paid,'outstanding_amount',v_outstanding,'next_due_date',v_next,'plan_status',v_status);
end; $$;

grant execute on function public.mark_emi_payment_paid(uuid) to authenticated;
