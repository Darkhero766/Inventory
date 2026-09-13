-- Run after 007_conflict_indexes.sql.
-- Fixes EMI snapshot persistence by storing interest fields and failing loudly
-- when a sale/customer/EMI plan relationship cannot be resolved.

alter table public.emi_plans
  add column if not exists interest_rate numeric(7,3) not null default 0;

alter table public.emi_plans
  add column if not exists total_interest numeric(14,2) not null default 0;

create or replace function public.sync_inventory_snapshot(p_state jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  item jsonb;
  line jsonb;
  v_customer_id uuid;
  v_sale_id uuid;
  v_emi_id uuid;
  v_product_id uuid;
  v_owner uuid:=auth.uid();
  synced_products integer:=0;
  synced_customers integer:=0;
  synced_sales integer:=0;
  synced_items integer:=0;
  synced_emi integer:=0;
  synced_payments integer:=0;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_state)<>'object' then raise exception 'Invalid inventory snapshot'; end if;

  for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-products','[]'::jsonb)) loop
    insert into products(owner_id,client_id,name,brand,category,model,sku,serial_number,imei,purchase_price,selling_price,mrp,stock,min_stock,warranty,image_url)
    values(v_owner,item->>'id',coalesce(item->>'name','Unnamed'),coalesce(item->>'brand','Unknown'),coalesce(item->>'category','Accessories'),coalesce(item->>'model',''),coalesce(item->>'sku',item->>'id'),nullif(item->>'serialNumber',''),nullif(item->>'imei',''),coalesce((item->>'purchasePrice')::numeric,0),coalesce((item->>'sellingPrice')::numeric,0),coalesce((item->>'mrp')::numeric,0),greatest(0,coalesce((item->>'quantity')::integer,0)),greatest(0,coalesce((item->>'minStock')::integer,0)),coalesce(item->>'warranty',''),nullif(item->>'image',''))
    on conflict(owner_id,client_id) do update set name=excluded.name,brand=excluded.brand,category=excluded.category,model=excluded.model,sku=excluded.sku,serial_number=excluded.serial_number,imei=excluded.imei,purchase_price=excluded.purchase_price,selling_price=excluded.selling_price,mrp=excluded.mrp,stock=excluded.stock,min_stock=excluded.min_stock,warranty=excluded.warranty,image_url=excluded.image_url;
    synced_products:=synced_products+1;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-customers','[]'::jsonb)) loop
    insert into customers(owner_id,client_id,name,phone,alternate_phone,email,address)
    values(v_owner,item->>'id',coalesce(item->>'name','Customer'),coalesce(item->>'phone',''),nullif(item->>'alternatePhone',''),nullif(item->>'email',''),nullif(item->>'address',''))
    on conflict(owner_id,client_id) do update set name=excluded.name,phone=excluded.phone,alternate_phone=excluded.alternate_phone,email=excluded.email,address=excluded.address;
    synced_customers:=synced_customers+1;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-sales','[]'::jsonb)) loop
    v_customer_id:=null;
    if nullif(item->>'customerId','') is not null then
      select id into v_customer_id from customers where owner_id=v_owner and client_id=item->>'customerId' limit 1;
      if v_customer_id is null then raise exception 'Customer not found for sale %',item->>'id'; end if;
    end if;

    insert into sales(owner_id,client_id,invoice_number,customer_id,sale_date,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method,status)
    values(v_owner,item->>'id',coalesce(nullif(item->>'invoice',''),'INV-'||substr(item->>'id',1,8)),v_customer_id,coalesce((item->>'date')::timestamptz,now()),coalesce((item->>'subtotal')::numeric,0),item->>'discountType',coalesce((item->>'discountValue')::numeric,0),coalesce((item->>'discount')::numeric,0),coalesce((item->>'total')::numeric,0),coalesce((item->>'purchaseCost')::numeric,0),coalesce((item->>'profit')::numeric,0),coalesce(item->>'payment','Cash'),coalesce(item->>'status','COMPLETED'))
    on conflict(owner_id,client_id) do update set invoice_number=excluded.invoice_number,customer_id=excluded.customer_id,sale_date=excluded.sale_date,subtotal=excluded.subtotal,discount_type=excluded.discount_type,discount_value=excluded.discount_value,discount_amount=excluded.discount_amount,final_amount=excluded.final_amount,purchase_cost=excluded.purchase_cost,profit=excluded.profit,payment_method=excluded.payment_method,status=excluded.status
    returning id into v_sale_id;
    synced_sales:=synced_sales+1;

    delete from sale_items where sale_id=v_sale_id and owner_id=v_owner;
    for line in select * from jsonb_array_elements(coalesce(item->'items','[]'::jsonb)) loop
      select id into v_product_id from products where owner_id=v_owner and client_id=line->>'productId' limit 1;
      if v_product_id is null then raise exception 'Product % not found for sale %',line->>'productId',item->>'id'; end if;
      insert into sale_items(owner_id,client_id,sale_id,product_id,quantity,unit_price,discount,final_price)
      values(v_owner,(item->>'id')||':'||coalesce(line->>'productId','item'),v_sale_id,v_product_id,greatest(1,coalesce((line->>'quantity')::integer,1)),coalesce((line->>'price')::numeric,0),coalesce((line->>'discount')::numeric,0),greatest(0,(coalesce((line->>'price')::numeric,0)*greatest(1,coalesce((line->>'quantity')::integer,1)))-coalesce((line->>'discount')::numeric,0)))
      on conflict(owner_id,client_id) do update set sale_id=excluded.sale_id,product_id=excluded.product_id,quantity=excluded.quantity,unit_price=excluded.unit_price,discount=excluded.discount,final_price=excluded.final_price;
      synced_items:=synced_items+1;
    end loop;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-emi-plans','[]'::jsonb)) loop
    select id into v_customer_id from customers where owner_id=v_owner and client_id=item->>'customerId' limit 1;
    select id into v_sale_id from sales where owner_id=v_owner and client_id=item->>'saleId' limit 1;
    if v_customer_id is null then raise exception 'EMI customer not found for client id %',item->>'customerId'; end if;
    if v_sale_id is null then raise exception 'EMI sale not found for client id %',item->>'saleId'; end if;

    insert into emi_plans(owner_id,client_id,sale_id,customer_id,total_amount,down_payment,financed_amount,emi_amount,installments,paid_installments,outstanding_amount,start_date,next_due_date,end_date,frequency,status,interest_rate,total_interest)
    values(v_owner,item->>'id',v_sale_id,v_customer_id,coalesce((item->>'totalAmount')::numeric,0),coalesce((item->>'downPayment')::numeric,0),coalesce((item->>'financedAmount')::numeric,0),coalesce((item->>'emiAmount')::numeric,0),greatest(1,coalesce((item->>'installments')::integer,1)),greatest(0,coalesce((item->>'paidInstallments')::integer,0)),greatest(0,coalesce((item->>'outstandingAmount')::numeric,0)),coalesce(nullif(item->>'startDate','')::date,current_date),nullif(item->>'nextDueDate','')::date,coalesce(nullif(item->>'endDate','')::date,current_date),coalesce(item->>'frequency','MONTHLY'),coalesce(item->>'status','ACTIVE'),coalesce((item->>'interestRate')::numeric,0),coalesce((item->>'totalInterest')::numeric,0))
    on conflict(owner_id,client_id) do update set sale_id=excluded.sale_id,customer_id=excluded.customer_id,total_amount=excluded.total_amount,down_payment=excluded.down_payment,financed_amount=excluded.financed_amount,emi_amount=excluded.emi_amount,installments=excluded.installments,paid_installments=excluded.paid_installments,outstanding_amount=excluded.outstanding_amount,start_date=excluded.start_date,next_due_date=excluded.next_due_date,end_date=excluded.end_date,frequency=excluded.frequency,status=excluded.status,interest_rate=excluded.interest_rate,total_interest=excluded.total_interest
    returning id into v_emi_id;
    synced_emi:=synced_emi+1;
  end loop;

  for item in select * from jsonb_array_elements(coalesce(p_state->'keystone-emi-payments','[]'::jsonb)) loop
    select id into v_emi_id from emi_plans where owner_id=v_owner and client_id=item->>'emiPlanId' limit 1;
    if v_emi_id is null then raise exception 'EMI plan not found for payment %',item->>'id'; end if;
    insert into emi_payments(owner_id,client_id,emi_plan_id,installment_number,due_date,amount,paid_date,status)
    values(v_owner,item->>'id',v_emi_id,greatest(1,coalesce((item->>'installmentNumber')::integer,1)),coalesce(nullif(item->>'dueDate','')::date,current_date),coalesce((item->>'amount')::numeric,0),nullif(item->>'paidDate','')::timestamptz,coalesce(item->>'status','UPCOMING'))
    on conflict(owner_id,client_id) do update set emi_plan_id=excluded.emi_plan_id,installment_number=excluded.installment_number,due_date=excluded.due_date,amount=excluded.amount,paid_date=excluded.paid_date,status=excluded.status;
    synced_payments:=synced_payments+1;
  end loop;

  return jsonb_build_object('ok',true,'products',synced_products,'customers',synced_customers,'sales',synced_sales,'sale_items',synced_items,'emi_plans',synced_emi,'emi_payments',synced_payments);
end;
$$;

grant execute on function public.sync_inventory_snapshot(jsonb) to authenticated;
