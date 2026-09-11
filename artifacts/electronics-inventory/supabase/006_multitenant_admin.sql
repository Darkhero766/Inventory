-- Multi-tenant hardening. Run after 003_complete_backend.sql and 005_customer_sales_rls.sql.
-- This migration makes formerly-global SKU/invoice/client IDs tenant-scoped and adds the owner admin dashboard RPC.

-- Remove legacy global uniqueness that would block two shops from using the same SKU/invoice number.
alter table public.products drop constraint if exists products_sku_key;
alter table public.sales drop constraint if exists sales_invoice_number_key;
drop index if exists public.products_client_id_uidx;
drop index if exists public.sales_client_id_uidx;
drop index if exists public.customers_client_id_uidx;
drop index if exists public.sale_items_client_id_uidx;
drop index if exists public.emi_plans_client_id_uidx;
drop index if exists public.emi_payments_client_id_uidx;

create unique index if not exists idx_products_owner_client_id on public.products(owner_id,client_id) where owner_id is not null;
create unique index if not exists idx_customers_owner_client_id on public.customers(owner_id,client_id) where owner_id is not null;
create unique index if not exists idx_sales_owner_client_id on public.sales(owner_id,client_id) where owner_id is not null;
create unique index if not exists idx_sale_items_owner_client_id on public.sale_items(owner_id,client_id) where owner_id is not null;
create unique index if not exists idx_emi_plans_owner_client_id on public.emi_plans(owner_id,client_id) where owner_id is not null;
create unique index if not exists idx_emi_payments_owner_client_id on public.emi_payments(owner_id,client_id) where owner_id is not null;
create unique index if not exists idx_products_owner_sku_v2 on public.products(owner_id,sku) where owner_id is not null;
create unique index if not exists idx_sales_owner_invoice_v2 on public.sales(owner_id,invoice_number) where owner_id is not null;

-- workspace_key used to be the primary key, which made the default workspace global. Ownership is now part of the key.
alter table public.inventory_state drop constraint if exists inventory_state_pkey;
create unique index if not exists idx_inventory_state_owner_workspace_v2 on public.inventory_state(owner_id,workspace_key) where owner_id is not null;

-- Replace snapshot sync with an owner-scoped version. Existing legacy rows with NULL owner_id remain isolated from new accounts.
create or replace function public.sync_inventory_snapshot(p_state jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare item jsonb; line jsonb; v_customer_id uuid; v_sale_id uuid; v_emi_id uuid; v_product_id uuid; v_owner uuid:=auth.uid();
begin
 if v_owner is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(p_state)<>'object' then raise exception 'Invalid inventory snapshot'; end if;
 for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-products','[]'::jsonb)) loop
  insert into products(owner_id,client_id,name,brand,category,model,sku,serial_number,imei,purchase_price,selling_price,mrp,stock,min_stock,warranty,image_url)
  values(v_owner,item->>'id',coalesce(item->>'name','Unnamed'),coalesce(item->>'brand','Unknown'),coalesce(item->>'category','Accessories'),coalesce(item->>'model',''),coalesce(item->>'sku',item->>'id'),nullif(item->>'serialNumber',''),nullif(item->>'imei',''),coalesce((item->>'purchasePrice')::numeric,0),coalesce((item->>'sellingPrice')::numeric,0),coalesce((item->>'mrp')::numeric,0),greatest(0,coalesce((item->>'quantity')::integer,0)),greatest(0,coalesce((item->>'minStock')::integer,0)),coalesce(item->>'warranty',''),nullif(item->>'image',''))
  on conflict (owner_id,client_id) do update set name=excluded.name,brand=excluded.brand,category=excluded.category,model=excluded.model,sku=excluded.sku,serial_number=excluded.serial_number,imei=excluded.imei,purchase_price=excluded.purchase_price,selling_price=excluded.selling_price,mrp=excluded.mrp,stock=excluded.stock,min_stock=excluded.min_stock,warranty=excluded.warranty,image_url=excluded.image_url;
 end loop;
 for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-customers','[]'::jsonb)) loop
  insert into customers(owner_id,client_id,name,phone,alternate_phone,email,address) values(v_owner,item->>'id',coalesce(item->>'name','Customer'),coalesce(item->>'phone',''),nullif(item->>'alternatePhone',''),nullif(item->>'email',''),nullif(item->>'address',''))
  on conflict (owner_id,client_id) do update set name=excluded.name,phone=excluded.phone,alternate_phone=excluded.alternate_phone,email=excluded.email,address=excluded.address;
 end loop;
 for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-sales','[]'::jsonb)) loop
  v_customer_id:=null; if nullif(item->>'customerId','') is not null then select id into v_customer_id from customers where owner_id=v_owner and client_id=item->>'customerId' limit 1; end if;
  insert into sales(owner_id,client_id,invoice_number,customer_id,sale_date,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method,status)
  values(v_owner,item->>'id',coalesce(nullif(item->>'invoice',''),'INV-'||substr(item->>'id',1,8)),v_customer_id,coalesce((item->>'date')::timestamptz,now()),coalesce((item->>'subtotal')::numeric,0),item->>'discountType',coalesce((item->>'discountValue')::numeric,0),coalesce((item->>'discount')::numeric,0),coalesce((item->>'total')::numeric,0),coalesce((item->>'purchaseCost')::numeric,0),coalesce((item->>'profit')::numeric,0),coalesce(item->>'payment','CASH'),'COMPLETED')
  on conflict (owner_id,client_id) do update set invoice_number=excluded.invoice_number,customer_id=excluded.customer_id,sale_date=excluded.sale_date,subtotal=excluded.subtotal,discount_type=excluded.discount_type,discount_value=excluded.discount_value,discount_amount=excluded.discount_amount,final_amount=excluded.final_amount,purchase_cost=excluded.purchase_cost,profit=excluded.profit,payment_method=excluded.payment_method,status=excluded.status
  returning id into v_sale_id;
  delete from sale_items where sale_id=v_sale_id and owner_id=v_owner;
  for line in select * from jsonb_array_elements(coalesce(item->'items','[]'::jsonb)) loop
   select id into v_product_id from products where owner_id=v_owner and client_id=line->>'productId' limit 1; if v_product_id is null then continue; end if;
   insert into sale_items(owner_id,client_id,sale_id,product_id,quantity,unit_price,discount,final_price) values(v_owner,(item->>'id')||':'||coalesce(line->>'productId','item'),v_sale_id,greatest(1,coalesce((line->>'quantity')::integer,1)),coalesce((line->>'price')::numeric,0),coalesce((line->>'discount')::numeric,0),greatest(0,coalesce((line->>'price')::numeric,0)-(coalesce((line->>'discount')::numeric,0)/greatest(1,coalesce((line->>'quantity')::integer,1))))) on conflict (owner_id,client_id) do update set sale_id=excluded.sale_id,product_id=excluded.product_id,quantity=excluded.quantity,unit_price=excluded.unit_price,discount=excluded.discount,final_price=excluded.final_price;
  end loop;
 end loop;
 for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-emi-plans','[]'::jsonb)) loop
  select id into v_customer_id from customers where owner_id=v_owner and client_id=item->>'customerId' limit 1; select id into v_sale_id from sales where owner_id=v_owner and client_id=item->>'saleId' limit 1; if v_customer_id is null or v_sale_id is null then continue; end if;
  insert into emi_plans(owner_id,client_id,sale_id,customer_id,total_amount,down_payment,financed_amount,emi_amount,installments,paid_installments,outstanding_amount,start_date,next_due_date,end_date,frequency,status)
  values(v_owner,item->>'id',v_sale_id,v_customer_id,coalesce((item->>'totalAmount')::numeric,0),coalesce((item->>'downPayment')::numeric,0),coalesce((item->>'financedAmount')::numeric,0),coalesce((item->>'emiAmount')::numeric,0),greatest(1,coalesce((item->>'installments')::integer,1)),greatest(0,coalesce((item->>'paidInstallments')::integer,0)),greatest(0,coalesce((item->>'outstandingAmount')::numeric,0)),(item->>'startDate')::date,nullif(item->>'nextDueDate','')::date,(item->>'endDate')::date,coalesce(item->>'frequency','MONTHLY'),coalesce(item->>'status','ACTIVE'))
  on conflict (owner_id,client_id) do update set sale_id=excluded.sale_id,customer_id=excluded.customer_id,total_amount=excluded.total_amount,down_payment=excluded.down_payment,financed_amount=excluded.financed_amount,emi_amount=excluded.emi_amount,installments=excluded.installments,paid_installments=excluded.paid_installments,outstanding_amount=excluded.outstanding_amount,start_date=excluded.start_date,next_due_date=excluded.next_due_date,end_date=excluded.end_date,frequency=excluded.frequency,status=excluded.status returning id into v_emi_id;
 end loop;
 for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-emi-payments','[]'::jsonb)) loop
  select id into v_emi_id from emi_plans where owner_id=v_owner and client_id=item->>'emiPlanId' limit 1; if v_emi_id is null then continue; end if;
  insert into emi_payments(owner_id,client_id,emi_plan_id,installment_number,due_date,amount,paid_date,status) values(v_owner,item->>'id',v_emi_id,greatest(1,coalesce((item->>'installmentNumber')::integer,1)),(item->>'dueDate')::date,coalesce((item->>'amount')::numeric,0),nullif(item->>'paidDate','')::timestamptz,coalesce(item->>'status','UPCOMING'))
  on conflict (owner_id,client_id) do update set emi_plan_id=excluded.emi_plan_id,installment_number=excluded.installment_number,due_date=excluded.due_date,amount=excluded.amount,paid_date=excluded.paid_date,status=excluded.status;
 end loop;
 return jsonb_build_object('ok',true,'owner_id',v_owner);
end; $$;
grant execute on function public.sync_inventory_snapshot(jsonb) to authenticated;

-- Owner-only platform dashboard. It exposes aggregate business metrics, not credentials or secrets.
create or replace function public.admin_get_workspace_overview()
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if lower(coalesce(auth.jwt()->>'email','')) <> 'nightowlclub72@gmail.com' then raise exception 'Admin access denied'; end if;
 select jsonb_build_object(
  'total_owners',(select count(*) from auth.users where lower(coalesce(email,'')) <> 'nightowlclub72@gmail.com'),
  'total_products',(select count(*) from products where owner_id is not null),
  'total_customers',(select count(*) from customers where owner_id is not null),
  'total_sales',(select count(*) from sales where owner_id is not null),
  'total_revenue',(select coalesce(sum(final_amount),0) from sales where owner_id is not null and status='COMPLETED'),
  'total_outstanding_emi',(select coalesce(sum(outstanding_amount),0) from emi_plans where owner_id is not null and status <> 'PAID'),
  'owners',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'name',coalesce(p.full_name,split_part(coalesce(u.email,''),'@',1)),'created_at',u.created_at,'products',(select count(*) from products x where x.owner_id=u.id),'customers',(select count(*) from customers x where x.owner_id=u.id),'sales',(select count(*) from sales x where x.owner_id=u.id),'revenue',(select coalesce(sum(x.final_amount),0) from sales x where x.owner_id=u.id and x.status='COMPLETED'),'outstanding_emi',(select coalesce(sum(x.outstanding_amount),0) from emi_plans x where x.owner_id=u.id and x.status <> 'PAID')) order by u.created_at desc) from auth.users u left join public.user_profiles p on p.id=u.id where lower(coalesce(u.email,'')) <> 'nightowlclub72@gmail.com'),'[]'::jsonb)
 ) into result;
 return result;
end; $$;
revoke all on function public.admin_get_workspace_overview() from public;
grant execute on function public.admin_get_workspace_overview() to authenticated;
