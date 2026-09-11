-- Run after 006_multitenant_admin.sql.
-- PostgreSQL ON CONFLICT (owner_id, client_id) needs a directly inferable unique index.
-- owner_id NULL values may still coexist for legacy rows, while all authenticated rows use owner_id.

drop index if exists public.idx_products_owner_client_id;
drop index if exists public.idx_customers_owner_client_id;
drop index if exists public.idx_sales_owner_client_id;
drop index if exists public.idx_sale_items_owner_client_id;
drop index if exists public.idx_emi_plans_owner_client_id;
drop index if exists public.idx_emi_payments_owner_client_id;
drop index if exists public.idx_products_owner_sku_v2;
drop index if exists public.idx_sales_owner_invoice_v2;
drop index if exists public.idx_inventory_state_owner_workspace_v2;

create unique index idx_products_owner_client_id on public.products(owner_id,client_id);
create unique index idx_customers_owner_client_id on public.customers(owner_id,client_id);
create unique index idx_sales_owner_client_id on public.sales(owner_id,client_id);
create unique index idx_sale_items_owner_client_id on public.sale_items(owner_id,client_id);
create unique index idx_emi_plans_owner_client_id on public.emi_plans(owner_id,client_id);
create unique index idx_emi_payments_owner_client_id on public.emi_payments(owner_id,client_id);
create unique index idx_products_owner_sku_v2 on public.products(owner_id,sku);
create unique index idx_sales_owner_invoice_v2 on public.sales(owner_id,invoice_number);
create unique index idx_inventory_state_owner_workspace_v2 on public.inventory_state(owner_id,workspace_key);
