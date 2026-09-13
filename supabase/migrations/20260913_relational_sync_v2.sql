-- Run this migration in Supabase SQL Editor after the existing inventory/EMI migrations.
-- It fixes the browser-ID vs database-UUID mismatch that can prevent EMI plans
-- from finding their parent sale/customer.

alter table public.emi_plans
  add column if not exists interest_rate numeric(7,3) not null default 0;

alter table public.emi_plans
  add column if not exists total_interest numeric(14,2) not null default 0;

create or replace function public.sync_inventory_snapshot(p_state jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  customer_row jsonb;
  product_row jsonb;
  sale_row jsonb;
  item_row jsonb;
  emi_row jsonb;
  payment_row jsonb;
  sale_uuid uuid;
  customer_uuid uuid;
  product_uuid uuid;
  emi_uuid uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  for customer_row in select value from jsonb_array_elements(coalesce(p_state->'keystone-customers','[]'::jsonb)) loop
    insert into customers(owner_id,client_id,name,phone,alternate_phone,email,address,created_at)
    values(
      auth.uid(), customer_row->>'id', coalesce(customer_row->>'name',''), coalesce(customer_row->>'phone',''),
      nullif(customer_row->>'alternatePhone',''), nullif(customer_row->>'email',''), nullif(customer_row->>'address',''),
      coalesce(nullif(customer_row->>'createdAt','')::timestamptz,now())
    )
    on conflict(owner_id,client_id) do update set
      name=excluded.name, phone=excluded.phone, alternate_phone=excluded.alternate_phone,
      email=excluded.email, address=excluded.address;
  end loop;

  for product_row in select value from jsonb_array_elements(coalesce(p_state->'keystone-products','[]'::jsonb)) loop
    insert into products(owner_id,client_id,name,brand,category,model,sku,serial_number,imei,purchase_price,selling_price,mrp,stock,min_stock,warranty,image_url,created_at)
    values(
      auth.uid(), product_row->>'id', coalesce(product_row->>'name',''), coalesce(product_row->>'brand',''),
      coalesce(product_row->>'category',''), product_row->>'model', product_row->>'sku', product_row->>'serialNumber', product_row->>'imei',
      coalesce((product_row->>'purchasePrice')::numeric,0), coalesce((product_row->>'sellingPrice')::numeric,0), coalesce((product_row->>'mrp')::numeric,0),
      coalesce((product_row->>'quantity')::int,0), coalesce((product_row->>'minStock')::int,0), product_row->>'warranty', product_row->>'image',
      coalesce(nullif(product_row->>'createdAt','')::timestamptz,now())
    )
    on conflict(owner_id,client_id) do update set
      name=excluded.name, brand=excluded.brand, category=excluded.category, model=excluded.model,
      sku=excluded.sku, serial_number=excluded.serial_number, imei=excluded.imei, purchase_price=excluded.purchase_price,
      selling_price=excluded.selling_price, mrp=excluded.mrp, stock=excluded.stock, min_stock=excluded.min_stock,
      warranty=excluded.warranty, image_url=excluded.image_url;
  end loop;

  for sale_row in select value from jsonb_array_elements(coalesce(p_state->'keystone-sales','[]'::jsonb)) loop
    customer_uuid := null;
    select id into customer_uuid from customers
      where owner_id=auth.uid() and client_id=sale_row->>'customerId' limit 1;

    insert into sales(owner_id,client_id,invoice_number,customer_id,sale_date,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method,status)
    values(
      auth.uid(), sale_row->>'id', sale_row->>'invoice', customer_uuid,
      coalesce(nullif(sale_row->>'date','')::timestamptz,now()), coalesce((sale_row->>'subtotal')::numeric,0),
      sale_row->>'discountType', coalesce((sale_row->>'discountValue')::numeric,0), coalesce((sale_row->>'discount')::numeric,0),
      coalesce((sale_row->>'total')::numeric,0), coalesce((sale_row->>'purchaseCost')::numeric,0), coalesce((sale_row->>'profit')::numeric,0),
      coalesce(sale_row->>'payment','Cash'), coalesce(sale_row->>'status','COMPLETED')
    )
    on conflict(owner_id,client_id) do update set
      invoice_number=excluded.invoice_number, customer_id=excluded.customer_id, sale_date=excluded.sale_date,
      subtotal=excluded.subtotal, discount_type=excluded.discount_type, discount_value=excluded.discount_value,
      discount_amount=excluded.discount_amount, final_amount=excluded.final_amount, purchase_cost=excluded.purchase_cost,
      profit=excluded.profit, payment_method=excluded.payment_method, status=excluded.status;

    select id into sale_uuid from sales
      where owner_id=auth.uid() and client_id=sale_row->>'id' limit 1;

    for item_row in select value from jsonb_array_elements(coalesce(sale_row->'items','[]'::jsonb)) loop
      select id into product_uuid from products
        where owner_id=auth.uid() and client_id=item_row->>'productId' limit 1;
      if product_uuid is not null then
        insert into sale_items(owner_id,client_id,sale_id,product_id,quantity,unit_price,discount,final_price)
        values(
          auth.uid(), md5(sale_uuid::text||':'||coalesce(item_row->>'productId','')), sale_uuid, product_uuid,
          coalesce((item_row->>'quantity')::int,1), coalesce((item_row->>'price')::numeric,0),
          coalesce((item_row->>'discount')::numeric,0),
          coalesce((item_row->>'price')::numeric,0)*coalesce((item_row->>'quantity')::numeric,1)-coalesce((item_row->>'discount')::numeric,0)
        )
        on conflict(owner_id,client_id) do update set
          quantity=excluded.quantity, unit_price=excluded.unit_price, discount=excluded.discount, final_price=excluded.final_price;
      end if;
    end loop;
  end loop;

  for emi_row in select value from jsonb_array_elements(coalesce(p_state->'keystone-emi-plans','[]'::jsonb)) loop
    select id into sale_uuid from sales
      where owner_id=auth.uid() and client_id=emi_row->>'saleId' limit 1;
    select id into customer_uuid from customers
      where owner_id=auth.uid() and client_id=emi_row->>'customerId' limit 1;

    if sale_uuid is null then
      raise exception 'EMI sale not found for client id %', emi_row->>'saleId';
    end if;
    if customer_uuid is null then
      raise exception 'EMI customer not found for client id %', emi_row->>'customerId';
    end if;

    insert into emi_plans(owner_id,client_id,sale_id,customer_id,total_amount,down_payment,financed_amount,emi_amount,installments,paid_installments,outstanding_amount,start_date,next_due_date,end_date,frequency,status,interest_rate,total_interest)
    values(
      auth.uid(), emi_row->>'id', sale_uuid, customer_uuid, coalesce((emi_row->>'totalAmount')::numeric,0),
      coalesce((emi_row->>'downPayment')::numeric,0), coalesce((emi_row->>'financedAmount')::numeric,0), coalesce((emi_row->>'emiAmount')::numeric,0),
      greatest(coalesce((emi_row->>'installments')::int,1),1), coalesce((emi_row->>'paidInstallments')::int,0),
      coalesce((emi_row->>'outstandingAmount')::numeric,0), coalesce(nullif(emi_row->>'startDate','')::date,current_date),
      nullif(emi_row->>'nextDueDate','')::date, coalesce(nullif(emi_row->>'endDate','')::date,current_date),
      coalesce(emi_row->>'frequency','MONTHLY'), coalesce(emi_row->>'status','ACTIVE'),
      coalesce((emi_row->>'interestRate')::numeric,0), coalesce((emi_row->>'totalInterest')::numeric,0)
    )
    on conflict(owner_id,client_id) do update set
      sale_id=excluded.sale_id, customer_id=excluded.customer_id, total_amount=excluded.total_amount,
      down_payment=excluded.down_payment, financed_amount=excluded.financed_amount, emi_amount=excluded.emi_amount,
      installments=excluded.installments, paid_installments=excluded.paid_installments, outstanding_amount=excluded.outstanding_amount,
      start_date=excluded.start_date, next_due_date=excluded.next_due_date, end_date=excluded.end_date,
      frequency=excluded.frequency, status=excluded.status, interest_rate=excluded.interest_rate, total_interest=excluded.total_interest;
  end loop;

  for payment_row in select value from jsonb_array_elements(coalesce(p_state->'keystone-emi-payments','[]'::jsonb)) loop
    select id into emi_uuid from emi_plans
      where owner_id=auth.uid() and client_id=payment_row->>'emiPlanId' limit 1;
    if emi_uuid is null then
      raise exception 'EMI plan not found for payment %', payment_row->>'id';
    end if;
    insert into emi_payments(owner_id,client_id,emi_plan_id,installment_number,due_date,amount,paid_date,status)
    values(
      auth.uid(), payment_row->>'id', emi_uuid, coalesce((payment_row->>'installmentNumber')::int,1),
      coalesce(nullif(payment_row->>'dueDate','')::date,current_date), coalesce((payment_row->>'amount')::numeric,0),
      nullif(payment_row->>'paidDate','')::timestamptz, coalesce(payment_row->>'status','UPCOMING')
    )
    on conflict(owner_id,client_id) do update set
      emi_plan_id=excluded.emi_plan_id, installment_number=excluded.installment_number, due_date=excluded.due_date,
      amount=excluded.amount, paid_date=excluded.paid_date, status=excluded.status;
  end loop;

  insert into inventory_state(owner_id,workspace_key,state,updated_at)
  values(auth.uid(),'default',coalesce(p_state,'{}'::jsonb),now())
  on conflict(owner_id,workspace_key) do update set state=excluded.state,updated_at=now();
end;
$$;

grant execute on function public.sync_inventory_snapshot(jsonb) to authenticated;
