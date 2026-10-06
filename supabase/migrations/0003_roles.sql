-- 0003_roles — introduce distinct owner / admin / staff roles.
--
-- Safe to run on a database that already has 0001_init applied (it drops and
-- recreates the role check constraint).
--
-- Apply with the Supabase CLI (`supabase db push`) or psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0003_roles.sql

alter table public.profiles drop constraint if exists profiles_role_check;

-- Fold the old "barber" role into "staff".
update public.profiles set role = 'staff' where role = 'barber';

alter table public.profiles alter column role set default 'staff';
alter table public.profiles
  add constraint profiles_role_check check (role in ('owner', 'admin', 'staff'));

-- Owners and admins manage the team; staff just use the app.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'admin') and approved
  );
$$;

-- The seeded account is the owner. (The display name is a person's name —
-- "Owner" is a *role*, shown as a badge in the app — so don't set it here.)
update public.profiles
set role = 'owner'
where id in (select id from auth.users where email = 'vinsaloon@gmail.com');
