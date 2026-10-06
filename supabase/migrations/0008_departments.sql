-- 0008_departments — make departments configurable.
--
-- Departments were a fixed `salon` / `other` pair. They are now a configurable
-- list stored in `settings` (key `departments`), and each department declares
-- whether its staff get the salon sales tools. `profiles.department` becomes
-- free text so custom departments can be assigned.
--
-- Apply with the Supabase CLI (`supabase db push`) or psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0008_departments.sql

alter table public.profiles drop constraint if exists profiles_department_check;

-- Seed the list with the previous behaviour so nothing changes until an admin
-- edits it: "Salon staff" gets the sales tools, "Other staff" does not.
insert into public.settings (key, value)
values (
  'departments',
  '{"departments":[{"id":"salon","label":"Salon staff","salonTools":true},{"id":"other","label":"Other staff","salonTools":false}]}'::jsonb
)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
