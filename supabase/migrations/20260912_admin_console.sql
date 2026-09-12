-- Admin console database prerequisites.
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, name text, email text, role text not null default 'staff', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text not null default 'staff';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
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

create or replace function public.handle_new_user_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,name,email,role,created_at,updated_at)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),lower(new.email),case when lower(new.email)='nightowlclub72@gmail.com' then 'admin' else 'staff' end,coalesce(new.created_at,now()),now())
  on conflict(id) do update set email=excluded.email,name=coalesce(public.profiles.name,excluded.name),updated_at=now();
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.handle_new_user_profile();

update public.profiles set role='admin',updated_at=now() where lower(email)='nightowlclub72@gmail.com';
insert into public.profiles(id,name,email,role,created_at,updated_at)
select u.id,coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',split_part(u.email,'@',1)),lower(u.email),case when lower(u.email)='nightowlclub72@gmail.com' then 'admin' else 'staff' end,coalesce(u.created_at,now()),now()
from auth.users u where not exists(select 1 from public.profiles p where p.id=u.id);
