-- Run after schema.sql in the Supabase SQL Editor.
-- This migration adds a profile row for Supabase Auth users (including Google).

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

do $$ begin
  create policy "users can read their own profile"
    on public.user_profiles for select to authenticated
    using (id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users can update their own profile"
    on public.user_profiles for update to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users can insert their own profile"
    on public.user_profiles for insert to authenticated
    with check (id = auth.uid());
exception when duplicate_object then null; end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    case when lower(coalesce(new.email,'')) = 'nightowlclub72@gmail.com' then 'admin' else 'staff' end
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Keep the existing inventory_state table available to authenticated Supabase sessions.
-- Do not expose a service-role key in the browser.
