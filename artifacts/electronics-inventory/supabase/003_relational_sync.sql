-- Relational persistence upgrade.
-- Run after schema.sql and 002_auth_and_workspace.sql.
-- The browser never receives a service-role key. All calls require an authenticated session.

alter table public.customers add column if not exists client_id text;
alter table public.products add column if not exists client_id text;
alter table public.sales add column if not exists client_id text;
alter table public.sale_items add column if not exists client_id text;
alter table public.emi_plans add column if not exists client_id text;
alter table public.emi_payments add column if not exists client_id text;

update public.customers set client_id = 'legacy-customer-' || id::text where client_id is null;
update public.products set client_id = 'legacy-product-' || id::text where client_id is null;
update public.sales set client_id = 'legacy-sale-' || id::text where client_id is null;
update public.sale_items set client_id = 'legacy-sale-item-' || id::text where client_id is null;
update public.emi_plans set client_id = 'legacy-emi-plan-' || id::text where client_id is null;
update public.emi_payments set client_id = 'legacy-emi-payment-' || id::text where client_id is null;

alter table public.customers alter column client_id set default gen_random_uuid()::text;
alter table public.products alter column client_id set default gen_random_uuid()::text;
alter table public.sales alter column client_id set default gen_random_uuid()::text;
alter table public.sale_items alter column client_id set default gen_random_uuid()::text;
alter table public.emi_plans alter column client_id set default gen_random_uuid()::text;
alter table public.emi_payments alter column client_id set default gen_random_uuid()::text;

alter table public.customers alter column client_id set not null;
alter table public.products alter column client_id set not null;
alter table public.sales alter column client_id set not null;
alter table public.sale_items alter column client_id set not null;
alter table public.emi_plans alter column client_id set not null;
alter table public.emi_payments alter column client_id set not null;

do $$ begin create unique index customers_client_id_uidx on public.customers(client_id); exception when duplicate_object then null; end $$;
do $$ begin create unique index products_client_id_uidx on public.products(client_id); exception when duplicate_object then null; end $$;
do $$ begin create unique index sales_client_id_uidx on public.sales(client_id); exception when duplicate_object then null; end $$;
do $$ begin create unique index sale_items_client_id_uidx on public.sale_items(client_id); exception when duplicate_object then null; end $$;
do $$ begin create unique index emi_plans_client_id_uidx on public.emi_plans(client_id); exception when duplicate_object then null; end $$;
do $$ begin create unique index emi_payments_client_id_uidx on public.emi_payments(client_id); exception when duplicate_object then null; end $$;

create or replace function public.sync_inventory_snapshot(p_state jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  line jsonb;
  v_customer_id uuid;
  v_sale_id uuid;
  v_emi_id uuid;
  v_product_id uuid;
  synced_products integer := 0;
  synced_customers integer := 0;
  synced_sales integer := 0;
  synced_items integer := 0;
  synced_emi integer := 0;
  synced_payments integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_state) <> 'object' then raise exception 'Invalid inventory snapshot'; end if;

  for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-products','[]'::jsonb)) loop
    insert into products(client_id,name,brand,category,model,sku,serial_number,imei,purchase_price,selling_price,mrp,stock,min_stock,warranty,image_url)
    values(item->>'id',coalesce(item->>'name','Unnamed'),coalesce(item->>'brand','Unknown'),coalesce(item->>'category','Accessories'),coalesce(item->>'model',''),coalesce(item->>'sku',item->>'id'),nullif(item->>'serialNumber',''),nullif(item->>'imei',''),coalesce((item->>'purchasePrice')::numeric,0),coalesce((item->>'sellingPrice')::numeric,0),coalesce((item->>'mrp')::numeric,0),greatest(0,coalesce((item->>'quantity')::integer,0)),greatest(0,coalesce((item->>'minStock')::integer,0)),coalesce(item->>'warranty',''),nullif(item->>'image',''))
    on conflict (client_id) do update set name=excluded.name,brand=excluded.brand,category=excluded.category,model=excluded.model,sku=excluded.sku,serial_number=excluded.serial_number,imei=excluded.imei,purchase_price=excluded.purchase_price,selling_price=excluded.selling_price,mrp=excluded.mrp,stock=excluded.stock,min_stock=excluded.min_stock,warranty=excluded.warranty,image_url=excluded.image_url;
    synced_products := synced_products + 1;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-customers','[]'::jsonb)) loop
    insert into customers(client_id,name,phone,alternate_phone,email,address)
    values(item->>'id',coalesce(item->>'name','Customer'),coalesce(item->>'phone',''),nullif(item->>'alternatePhone',''),nullif(item->>'email',''),nullif(item->>'address',''))
    on conflict (client_id) do update set name=excluded.name,phone=excluded.phone,alternate_phone=excluded.alternate_phone,email=excluded.email,address=excluded.address;
    synced_customers := synced_customers + 1;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-sales','[]'::jsonb)) loop
    v_customer_id := null;
    if nullif(item->>'customerId','') is not null then select id into v_customer_id from customers where client_id=item->>'customerId' limit 1; end if;
    insert into sales(client_id,invoice_number,customer_id,sale_date,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method,status)
    values(item->>'id',coalesce(nullif(item->>'invoice',''),'INV-'||substr(item->>'id',1,8)),v_customer_id,coalesce((item->>'date')::timestamptz,now()),coalesce((item->>'subtotal')::numeric,0),item->>'discountType',coalesce((item->>'discountValue')::numeric,0),coalesce((item->>'discount')::numeric,0),coalesce((item->>'total')::numeric,0),coalesce((item->>'purchaseCost')::numeric,0),coalesce((item->>'profit')::numeric,0),coalesce(item->>'payment','CASH'),'COMPLETED')
    on conflict (client_id) do update set invoice_number=excluded.invoice_number,customer_id=excluded.customer_id,sale_date=excluded.sale_date,subtotal=excluded.subtotal,discount_type=excluded.discount_type,discount_value=excluded.discount_value,discount_amount=excluded.discount_amount,final_amount=excluded.final_amount,purchase_cost=excluded.purchase_cost,profit=excluded.profit,payment_method=excluded.payment_method,status=excluded.status
    returning id into v_sale_id;
    synced_sales := synced_sales + 1;

    delete from sale_items si where si.sale_id=v_sale_id;
    for line in select * from jsonb_array_elements(coalesce(item->'items','[]'::jsonb)) loop
      select id into v_product_id from products where client_id=line->>'productId' limit 1;
      if v_product_id is null then continue; end if;
      insert into sale_items(client_id,sale_id,product_id,quantity,unit_price,discount,final_price)
      values((item->>'id')||':'||coalesce(line->>'productId','item'),v_sale_id,v_product_id,greatest(1,coalesce((line->>'quantity')::integer,1)),coalesce((line->>'price')::numeric,0),coalesce((line->>'discount')::numeric,0),coalesce((line->>'price')::numeric,0))
      on conflict (client_id) do update set sale_id=excluded.sale_id,product_id=excluded.product_id,quantity=excluded.quantity,unit_price=excluded.unit_price,discount=excluded.discount,final_price=excluded.final_price;
      synced_items := synced_items + 1;
    end loop;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-emi-plans','[]'::jsonb)) loop
    v_customer_id := null; v_sale_id := null;
    select id into v_customer_id from customers where client_id=item->>'customerId' limit 1;
    select id into v_sale_id from sales where client_id=item->>'saleId' limit 1;
    if v_customer_id is null or v_sale_id is null then continue; end if;
    insert into emi_plans(client_id,sale_id,customer_id,total_amount,down_payment,financed_amount,emi_amount,installments,paid_installments,outstanding_amount,start_date,next_due_date,end_date,frequency,status)
    values(item->>'id',v_sale_id,v_customer_id,coalesce((item->>'totalAmount')::numeric,0),coalesce((item->>'downPayment')::numeric,0),coalesce((item->>'financedAmount')::numeric,0),coalesce((item->>'emiAmount')::numeric,0),greatest(1,coalesce((item->>'installments')::integer,1)),greatest(0,coalesce((item->>'paidInstallments')::integer,0)),greatest(0,coalesce((item->>'outstandingAmount')::numeric,0)),(item->>'startDate')::date,nullif(item->>'nextDueDate','')::date,(item->>'endDate')::date,coalesce(item->>'frequency','MONTHLY'),coalesce(item->>'status','ACTIVE'))
    on conflict (client_id) do update set sale_id=excluded.sale_id,customer_id=excluded.customer_id,total_amount=excluded.total_amount,down_payment=excluded.down_payment,financed_amount=excluded.financed_amount,emi_amount=excluded.emi_amount,installments=excluded.installments,paid_installments=excluded.paid_installments,outstanding_amount=excluded.outstanding_amount,start_date=excluded.start_date,next_due_date=excluded.next_due_date,end_date=excluded.end_date,frequency=excluded.frequency,status=excluded.status
    returning id into v_emi_id;
    synced_emi := synced_emi + 1;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-emi-payments','[]'::jsonb)) loop
    select id into v_emi_id from emi_plans where client_id=item->>'emiPlanId' limit 1;
    if v_emi_id is null then continue; end if;
    insert into emi_payments(client_id,emi_plan_id,installment_number,due_date,amount,paid_date,status)
    values(item->>'id',v_emi_id,greatest(1,coalesce((item->>'installmentNumber')::integer,1)),(item->>'dueDate')::date,coalesce((item->>'amount')::numeric,0),nullif(item->>'paidDate','')::timestamptz,coalesce(item->>'status','UPCOMING'))
    on conflict (client_id) do update set emi_plan_id=excluded.emi_plan_id,installment_number=excluded.installment_number,due_date=excluded.due_date,amount=excluded.amount,paid_date=excluded.paid_date,status=excluded.status;
    synced_payments := synced_payments + 1;
  end loop;

  return jsonb_build_object('products',synced_products,'customers',synced_customers,'sales',synced_sales,'sale_items',synced_items,'emi_plans',synced_emi,'emi_payments',synced_payments);
end;
$$;

grant execute on function public.sync_inventory_snapshot(jsonb) to authenticated;

create or replace function public.complete_sale(
  p_invoice_number text, p_customer_id uuid, p_subtotal numeric, p_discount_type text,
  p_discount_value numeric, p_discount_amount numeric, p_final_amount numeric,
  p_purchase_cost numeric, p_profit numeric, p_payment_method text, p_items jsonb
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_sale_id uuid; v_item jsonb; v_stock integer; v_line_cost numeric; v_cost numeric := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_final_amount < 0 or p_discount_amount < 0 or p_discount_amount > p_subtotal then raise exception 'Invalid sale totals'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select stock,purchase_price*(v_item->>'quantity')::numeric into v_stock,v_line_cost from products where id=(v_item->>'product_id')::uuid for update;
    if v_stock is null then raise exception 'Product not found'; end if;
    if v_stock < (v_item->>'quantity')::integer then raise exception 'Insufficient stock'; end if;
    v_cost := v_cost + v_line_cost;
  end loop;
  insert into sales(invoice_number,customer_id,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method)
  values(p_invoice_number,p_customer_id,p_subtotal,p_discount_type,p_discount_value,p_discount_amount,p_final_amount,v_cost,p_final_amount-v_cost,p_payment_method)
  returning id into v_sale_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into sale_items(sale_id,product_id,quantity,unit_price,discount,final_price)
    values(v_sale_id,(v_item->>'product_id')::uuid,(v_item->>'quantity')::integer,(v_item->>'unit_price')::numeric,coalesce((v_item->>'discount')::numeric,0),(v_item->>'final_price')::numeric);
    update products set stock=stock-(v_item->>'quantity')::integer where id=(v_item->>'product_id')::uuid;
  end loop;
  return v_sale_id;
end; $$;

grant execute on function public.complete_sale(text,uuid,numeric,text,numeric,numeric,numeric,numeric,numeric,text,jsonb) to authenticated;
