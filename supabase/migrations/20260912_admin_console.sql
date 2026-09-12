-- Admin console prerequisites.
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, name text, email text, role text not null default 'staff', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.profiles enable row level security;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id=auth.uid() or public.is_admin());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles for insert with check (id=auth.uid());
grant select,insert,update on public.profiles to authenticated;
update public.profiles set role='admin',updated_at=now() where lower(email)='nightowlclub72@gmail.com';
insert into public.profiles(id,name,email,role,created_at,updated_at) select u.id,coalesce(u.raw_user_meta_data->>'full_name',split_part(u.email,'@',1)),lower(u.email),case when lower(u.email)='nightowlclub72@gmail.com' then 'admin' else 'staff' end,u.created_at,now() from auth.users u where not exists(select 1 from public.profiles p where p.id=u.id);