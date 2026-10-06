-- 0009_staff_break — per-staff daily break allowance, shared across accounts.
--
-- The allowance used to live on each account's private barber record, so an
-- admin could never set it for anyone else. Moving it onto `profiles` makes it
-- shared and admin-editable.
--
-- Apply with the Supabase CLI (`supabase db push`) or psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0009_staff_break.sql

alter table public.profiles add column if not exists break_minutes integer;

alter table public.profiles drop constraint if exists profiles_break_minutes_check;
alter table public.profiles
  add constraint profiles_break_minutes_check
  check (break_minutes is null or break_minutes >= 0);

notify pgrst, 'reload schema';
