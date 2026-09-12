-- Keep the public profile name in sync with Supabase Auth metadata.
-- The frontend already updates auth.users.raw_user_meta_data.full_name.
-- This makes the database profile (used by the platform admin console) follow it.
create or replace function public.sync_profile_name_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set name = coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1),
    name
  ),
  email = lower(new.email),
  updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated_profile_name on auth.users;
create trigger on_auth_user_updated_profile_name
after update of raw_user_meta_data, email on auth.users
for each row execute function public.sync_profile_name_from_auth();
