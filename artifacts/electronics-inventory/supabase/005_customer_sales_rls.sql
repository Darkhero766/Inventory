-- Idempotent ownership backfill for existing rows created before owner_id existed.
-- Existing rows cannot safely be attributed to a user automatically. After running this file,
-- only new/current-user rows are accessible. Review any legacy rows with NULL owner_id in Supabase.

update public.customers c set owner_id = u.id
from auth.users u
where c.owner_id is null and lower(coalesce(c.email,'')) = lower(coalesce(u.email,''));

update public.inventory_state s set owner_id = u.id
from auth.users u
where s.owner_id is null and lower(coalesce(u.email,'')) = lower('nightowlclub72@gmail.com') and s.workspace_key='default';

-- Helpful duplicate protection per workspace/user.
create unique index if not exists idx_products_owner_sku on public.products(owner_id, sku) where owner_id is not null;
create unique index if not exists idx_sales_owner_invoice on public.sales(owner_id, invoice_number) where owner_id is not null;

-- Keep child rows owned by the same user as their parent where possible.
update public.sale_items si
set owner_id=s.owner_id
from public.sales s
where si.owner_id is null and si.sale_id=s.id;
update public.emi_plans ep
set owner_id=s.owner_id
from public.sales s
where ep.owner_id is null and ep.sale_id=s.id;
update public.emi_payments epp
set owner_id=ep.owner_id
from public.emi_plans ep
where epp.owner_id is null and epp.emi_plan_id=ep.id;
