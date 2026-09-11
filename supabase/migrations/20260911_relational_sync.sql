-- Replace the compatibility-only snapshot RPC with a relational upsert bridge.
-- Safe to run after 20260911_inventory_core.sql.
create or replace function public.sync_inventory_snapshot(p_state jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare r jsonb; sale_uuid uuid; customer_uuid uuid; product_uuid uuid; emi_uuid uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  for r in select * from jsonb_array_elements(coalesce(p_state->'keystone-customers','[]'::jsonb)) loop
    insert into customers(owner_id,client_id,name,phone,alternate_phone,email,address,created_at)
    values(auth.uid(),r->>'id',coalesce(r->>'name',''),coalesce(r->>'phone',''),nullif(r->>'alternatePhone',''),nullif(r->>'email',''),nullif(r->>'address',''),coalesce(nullif(r->>'createdAt','')::timestamptz,now()))
    on conflict(owner_id,client_id) do update set name=excluded.name,phone=excluded.phone,alternate_phone=excluded.alternate_phone,email=excluded.email,address=excluded.address;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_state->'keystone-products','[]'::jsonb)) loop
    insert into products(owner_id,client_id,name,brand,category,model,sku,serial_number,imei,purchase_price,selling_price,mrp,stock,min_stock,warranty,image_url,created_at)
    values(auth.uid(),r->>'id',coalesce(r->>'name',''),coalesce(r->>'brand',''),coalesce(r->>'category',''),r->>'model',r->>'sku',r->>'serialNumber',r->>'imei',coalesce((r->>'purchasePrice')::numeric,0),coalesce((r->>'sellingPrice')::numeric,0),coalesce((r->>'mrp')::numeric,0),coalesce((r->>'quantity')::int,0),coalesce((r->>'minStock')::int,0),r->>'warranty',r->>'image',coalesce(nullif(r->>'createdAt','')::timestamptz,now()))
    on conflict(owner_id,client_id) do update set name=excluded.name,brand=excluded.brand,category=excluded.category,model=excluded.model,sku=excluded.sku,serial_number=excluded.serial_number,imei=excluded.imei,purchase_price=excluded.purchase_price,selling_price=excluded.selling_price,mrp=excluded.mrp,stock=excluded.stock,min_stock=excluded.min_stock,warranty=excluded.warranty,image_url=excluded.image_url;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_state->'keystone-sales','[]'::jsonb)) loop
    customer_uuid := null;
    select id into customer_uuid from customers where owner_id=auth.uid() and client_id=r->>'customerId' limit 1;
    insert into sales(owner_id,client_id,invoice_number,customer_id,sale_date,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method,status)
    values(auth.uid(),r->>'id',r->>'invoice',customer_uuid,coalesce(nullif(r->>'date','')::timestamptz,now()),coalesce((r->>'subtotal')::numeric,0),r->>'discountType',coalesce((r->>'discountValue')::numeric,0),coalesce((r->>'discount')::numeric,0),coalesce((r->>'total')::numeric,0),coalesce((r->>'purchaseCost')::numeric,0),coalesce((r->>'profit')::numeric,0),coalesce(r->>'payment','Cash'),coalesce(r->>'status','COMPLETED'))
    on conflict(owner_id,client_id) do update set invoice_number=excluded.invoice_number,customer_id=excluded.customer_id,sale_date=excluded.sale_date,subtotal=excluded.subtotal,discount_type=excluded.discount_type,discount_value=excluded.discount_value,discount_amount=excluded.discount_amount,final_amount=excluded.final_amount,purchase_cost=excluded.purchase_cost,profit=excluded.profit,payment_method=excluded.payment_method,status=excluded.status;
    select id into sale_uuid from sales where owner_id=auth.uid() and client_id=r->>'id' limit 1;
    for r in select * from jsonb_array_elements(coalesce(r->'items','[]'::jsonb)) loop
      select id into product_uuid from products where owner_id=auth.uid() and client_id=r->>'productId' limit 1;
      if product_uuid is not null then
        insert into sale_items(owner_id,client_id,sale_id,product_id,quantity,unit_price,discount,final_price)
        values(auth.uid(),md5(sale_uuid::text||':'||coalesce(r->>'productId','')),sale_uuid,product_uuid,coalesce((r->>'quantity')::int,1),coalesce((r->>'price')::numeric,0),coalesce((r->>'discount')::numeric,0),coalesce((r->>'price')::numeric,0)*coalesce((r->>'quantity')::numeric,1)-coalesce((r->>'discount')::numeric,0))
        on conflict(owner_id,client_id) do update set quantity=excluded.quantity,unit_price=excluded.unit_price,discount=excluded.discount,final_price=excluded.final_price;
      end if;
    end loop;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_state->'keystone-emi-plans','[]'::jsonb)) loop
    select id into sale_uuid from sales where owner_id=auth.uid() and client_id=r->>'saleId' limit 1;
    select id into customer_uuid from customers where owner_id=auth.uid() and client_id=r->>'customerId' limit 1;
    if sale_uuid is not null and customer_uuid is not null then
      insert into emi_plans(owner_id,client_id,sale_id,customer_id,total_amount,down_payment,financed_amount,emi_amount,installments,paid_installments,outstanding_amount,start_date,next_due_date,end_date,frequency,status)
      values(auth.uid(),r->>'id',sale_uuid,customer_uuid,coalesce((r->>'totalAmount')::numeric,0),coalesce((r->>'downPayment')::numeric,0),coalesce((r->>'financedAmount')::numeric,0),coalesce((r->>'emiAmount')::numeric,0),coalesce((r->>'installments')::int,1),coalesce((r->>'paidInstallments')::int,0),coalesce((r->>'outstandingAmount')::numeric,0),(r->>'startDate')::date,nullif(r->>'nextDueDate','')::date,(r->>'endDate')::date,coalesce(r->>'frequency','MONTHLY'),coalesce(r->>'status','ACTIVE'))
      on conflict(owner_id,client_id) do update set paid_installments=excluded.paid_installments,outstanding_amount=excluded.outstanding_amount,next_due_date=excluded.next_due_date,end_date=excluded.end_date,status=excluded.status;
    end if;
  end loop;

  for r in select * from jsonb_array_elements(coalesce(p_state->'keystone-emi-payments','[]'::jsonb)) loop
    select id into emi_uuid from emi_plans where owner_id=auth.uid() and client_id=r->>'emiPlanId' limit 1;
    if emi_uuid is not null then
      insert into emi_payments(owner_id,client_id,emi_plan_id,installment_number,due_date,amount,paid_date,status)
      values(auth.uid(),r->>'id',emi_uuid,coalesce((r->>'installmentNumber')::int,1),(r->>'dueDate')::date,coalesce((r->>'amount')::numeric,0),nullif(r->>'paidDate','')::timestamptz,coalesce(r->>'status','UPCOMING'))
      on conflict(owner_id,client_id) do update set due_date=excluded.due_date,amount=excluded.amount,paid_date=excluded.paid_date,status=excluded.status;
    end if;
  end loop;

  insert into inventory_state(owner_id,workspace_key,state,updated_at) values(auth.uid(),'default',coalesce(p_state,'{}'::jsonb),now())
  on conflict(owner_id,workspace_key) do update set state=excluded.state,updated_at=now();
end;
$$;
grant execute on function public.sync_inventory_snapshot(jsonb) to authenticated;
