-- 0005_settings — shared app settings (payment methods) + allow attendance rows.
--
-- Supersedes 0004 (this also relaxes the records `table_name` check, so running
-- this file alone is enough for attendance).

alter table public.records drop constraint if exists records_table_name_check;
alter table public.records
  add constraint records_table_name_check
  check (table_name in ('services', 'barbers', 'sales', 'attendance'));

-- Shared, salon-wide settings. Any signed-in user can read them; only the
-- owner/admin can change them.
create table if not exists public.settings (
  key        text        primary key,
  value      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "settings_select_auth" on public.settings;
create policy "settings_select_auth" on public.settings
  for select to authenticated using (true);

drop policy if exists "settings_write_admin" on public.settings;
create policy "settings_write_admin" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Default payment methods: cash + transfer only.
insert into public.settings (key, value)
values (
  'payment_methods',
  '{"methods":[{"id":"cash","label":"Cash"},{"id":"transfer","label":"Transfer"}]}'::jsonb
)
on conflict (key) do nothing;
