-- Keystone Platform / Multi-tenant SaaS layer
-- One authenticated account owns one shop. Existing inventory rows remain
-- isolated by owner_id = auth.uid(). This migration adds shop metadata and
-- a secure platform-admin analytics boundary.

create extension if not exists pgcrypto;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  business_type text not null default 'Electronics Shop',
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shops_owner_idx on public.shops(owner_id);
create index if not exists shops_status_idx on public.shops(status);

alter table public.shops enable row level security;
drop policy if exists shops_owner_select on public.shops;
create policy shops_owner_select on public.shops for select using (owner_id = auth.uid());
drop policy if exists shops_owner_update on public.shops;
create policy shops_owner_update on public.shops for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Never allow a normal authenticated user to insert a profile and choose
-- role='admin'. The auth trigger is the trusted profile creator.
drop policy if exists profiles_self_insert on public.profiles;
revoke insert on public.profiles from authenticated;
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());
grant update on public.profiles to authenticated;

-- Existing accounts get one shop. The generated name is intentionally safe;
-- owners can edit it later from the shop settings UI.
insert into public.shops(owner_id,name,slug,business_type,status,created_at,updated_at)
select p.id,
       coalesce(nullif(trim(p.name),'') || '''s Shop','My Electronics Shop'),
       'shop-' || replace(p.id::text,'-',''),
       'Electronics Shop',
       'ACTIVE',
       coalesce(p.created_at,now()),
       now()
from public.profiles p
where not exists (select 1 from public.shops s where s.owner_id=p.id)
on conflict (owner_id) do nothing;

-- Replace the signup trigger so every new shop-owner account gets a shop.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  display_name text;
  base_slug text;
  final_slug text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'),''),
    nullif(trim(new.raw_user_meta_data->>'name'),''),
    split_part(new.email,'@',1),
    'Shop Owner'
  );

  insert into public.profiles(id,name,email,role,created_at,updated_at)
  values(
    new.id,
    display_name,
    lower(new.email),
    case when lower(new.email)='nightowlclub72@gmail.com' then 'admin' else 'staff' end,
    coalesce(new.created_at,now()),
    now()
  )
  on conflict(id) do update set
    email=excluded.email,
    name=coalesce(nullif(public.profiles.name,''),excluded.name),
    updated_at=now();

  base_slug := 'shop-' || replace(new.id::text,'-','');
  final_slug := base_slug;
  insert into public.shops(owner_id,name,slug,business_type,status,created_at,updated_at)
  values(new.id,display_name || '''s Shop',final_slug,'Electronics Shop','ACTIVE',coalesce(new.created_at,now()),now())
  on conflict(owner_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- Platform admin is deliberately checked in the database, not just in React.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role='admin'
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- Platform-wide read model. SECURITY DEFINER lets the platform admin see
-- tenant aggregates without weakening tenant RLS policies on business data.
create or replace function public.platform_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin access required';
  end if;

  select jsonb_build_object(
    'owners', (select count(*) from public.profiles where role <> 'admin'),
    'shops', (select count(*) from public.shops),
    'active_shops', (select count(*) from public.shops where status='ACTIVE'),
    'products', (select count(*) from public.products),
    'customers', (select count(*) from public.customers),
    'sales', (select count(*) from public.sales where status='COMPLETED'),
    'revenue', coalesce((select sum(final_amount) from public.sales where status='COMPLETED'),0),
    'profit', coalesce((select sum(profit) from public.sales where status='COMPLETED'),0),
    'emi_plans', (select count(*) from public.emi_plans),
    'emi_outstanding', coalesce((select sum(outstanding_amount) from public.emi_plans where status <> 'PAID'),0),
    'shops_detail', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select
          s.id as shop_id,
          s.name as shop_name,
          s.business_type,
          s.status,
          s.created_at,
          p.id as owner_id,
          p.name as owner_name,
          p.email as owner_email,
          (select count(*) from public.products pr where pr.owner_id=s.owner_id) as products,
          (select count(*) from public.customers c where c.owner_id=s.owner_id) as customers,
          (select count(*) from public.sales sa where sa.owner_id=s.owner_id and sa.status='COMPLETED') as sales,
          coalesce((select sum(sa.final_amount) from public.sales sa where sa.owner_id=s.owner_id and sa.status='COMPLETED'),0) as revenue,
          coalesce((select sum(sa.profit) from public.sales sa where sa.owner_id=s.owner_id and sa.status='COMPLETED'),0) as profit,
          coalesce((select sum(ep.outstanding_amount) from public.emi_plans ep where ep.owner_id=s.owner_id and ep.status <> 'PAID'),0) as emi_outstanding
        from public.shops s
        join public.profiles p on p.id=s.owner_id
      ) x
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.platform_admin_overview() from public;
grant execute on function public.platform_admin_overview() to authenticated;

-- Owner-safe shop metadata helper. It is intentionally not an admin bypass.
create or replace function public.get_my_shop()
returns setof public.shops
language sql
stable
security invoker
set search_path=public
as $$
  select * from public.shops where owner_id=auth.uid();
$$;

grant execute on function public.get_my_shop() to authenticated;
