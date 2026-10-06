-- 0001_init — SalonOS schema: synced records + accounts with admin approval.
--
-- Apply with the Supabase CLI (`supabase db push`) or psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql

-- ─────────────────────────────────────────────────────────────────────────
-- Domain records (services / barbers / sales) — JSONB documents per user.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  table_name text        not null check (table_name in ('services', 'barbers', 'sales', 'attendance')),
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, table_name, id)
);

create index if not exists records_lookup_idx
  on public.records (user_id, table_name, updated_at);

-- Keep updated_at server-authoritative so the pull cursor never depends on client clocks.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists records_set_updated_at on public.records;
create trigger records_set_updated_at
  before update on public.records
  for each row execute function public.set_updated_at();

alter table public.records enable row level security;

drop policy if exists "records_select_own" on public.records;
create policy "records_select_own" on public.records
  for select using (user_id = auth.uid());

drop policy if exists "records_insert_own" on public.records;
create policy "records_insert_own" on public.records
  for insert with check (user_id = auth.uid());

drop policy if exists "records_update_own" on public.records;
create policy "records_update_own" on public.records
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "records_delete_own" on public.records;
create policy "records_delete_own" on public.records
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- Accounts: every auth user gets a profile. New users start *unapproved* and
-- can only use the app once an admin approves them.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid        primary key references auth.users (id) on delete cascade,
  name       text        not null default '',
  phone      text,
  role       text        not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  approved   boolean     not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Is the current user an owner or admin? SECURITY DEFINER avoids RLS recursion.
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

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- Auto-create a pending profile whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
