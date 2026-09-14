-- Recover inventory when an account was recreated with the same email address.
-- This is intentionally conservative: it only moves data when the CURRENT account
-- has no business data and an older profile with the exact same email owns data.
-- Run this once in the Supabase SQL Editor.

create or replace function public.recover_same_email_tenant()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_id uuid := auth.uid();
  current_email text;
  current_rows bigint;
  source_id uuid;
  source_rows bigint;
  moved bigint := 0;
begin
  if current_id is null then raise exception 'Authentication required'; end if;

  select lower(email) into current_email from auth.users where id=current_id;
  if current_email is null then raise exception 'Authenticated user email not found'; end if;

  select
    (select count(*) from public.products where owner_id=current_id) +
    (select count(*) from public.customers where owner_id=current_id) +
    (select count(*) from public.sales where owner_id=current_id) +
    (select count(*) from public.inventory_state where owner_id=current_id)
  into current_rows;

  if current_rows > 0 then
    return jsonb_build_object('status','already_has_data','owner_id',current_id,'rows',current_rows);
  end if;

  -- Pick the same-email legacy owner with the largest amount of business data.
  select x.id, x.row_count into source_id, source_rows
  from (
    select p.id,
      (select count(*) from public.products pr where pr.owner_id=p.id) +
      (select count(*) from public.customers c where c.owner_id=p.id) +
      (select count(*) from public.sales s where s.owner_id=p.id) +
      (select count(*) from public.inventory_state i where i.owner_id=p.id) as row_count
    from public.profiles p
    where p.id <> current_id and lower(p.email)=current_email
  ) x
  where x.row_count > 0
  order by x.row_count desc
  limit 1;

  if source_id is null then
    return jsonb_build_object('status','no_same_email_legacy_data','owner_id',current_id,'email',current_email);
  end if;

  -- Move child rows first/last is safe because owner_id is not part of their FK.
  update public.sale_items set owner_id=current_id where owner_id=source_id;
  update public.emi_payments set owner_id=current_id where owner_id=source_id;
  update public.emi_plans set owner_id=current_id where owner_id=source_id;
  update public.sales set owner_id=current_id where owner_id=source_id;
  update public.products set owner_id=current_id where owner_id=source_id;
  update public.customers set owner_id=current_id where owner_id=source_id;
  update public.inventory_state set owner_id=current_id where owner_id=source_id;

  -- Transfer the shop metadata if it exists. A current shop should not exist
  -- because current_rows was zero, but keep this conflict-safe.
  update public.shops set owner_id=current_id, updated_at=now()
  where owner_id=source_id
    and not exists (select 1 from public.shops where owner_id=current_id);

  select
    (select count(*) from public.products where owner_id=current_id) +
    (select count(*) from public.customers where owner_id=current_id) +
    (select count(*) from public.sales where owner_id=current_id) +
    (select count(*) from public.inventory_state where owner_id=current_id)
  into moved;

  return jsonb_build_object('status','recovered','from_owner_id',source_id,'to_owner_id',current_id,'rows',moved);
end;
$$;

revoke all on function public.recover_same_email_tenant() from public;
grant execute on function public.recover_same_email_tenant() to authenticated;
notify pgrst, 'reload schema';
