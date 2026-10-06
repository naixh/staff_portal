-- 0002_seed_admin — create the owner account (owner + admin can approve users).
--
-- Requires 0001_init.sql to have run (creates `public.profiles`).
-- The auth user must already exist — create it first:
--   Supabase → Authentication → Users → Add user
--     Email:    vinsaloon@gmail.com
--     Password: 482913
--     [x] Auto Confirm User
-- (or via the Auth admin API).
--
-- Apply with the Supabase CLI (`supabase db push`) or psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_seed_admin.sql
--
-- Safe to re-run (idempotent).

insert into public.profiles (id, name, phone, role, approved)
select u.id, 'Vinsaloon', null, 'owner', true
from auth.users u
where u.email = 'vinsaloon@gmail.com'
on conflict (id) do update
  set role = 'owner', approved = true;
