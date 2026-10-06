-- 0004_attendance — allow attendance records in the synced `records` table.
--
-- Apply with the Supabase CLI (`supabase db push`) or psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0004_attendance.sql

alter table public.records drop constraint if exists records_table_name_check;
alter table public.records
  add constraint records_table_name_check
  check (table_name in ('services', 'barbers', 'sales', 'attendance'));
