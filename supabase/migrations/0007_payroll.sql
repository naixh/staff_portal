-- 0007_payroll — departments (salon vs. other staff), payroll and work permits.
--
-- Apply with the Supabase CLI (`supabase db push`) or psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0007_payroll.sql

-- ─────────────────────────────────────────────────────────────────────────
-- Profiles: department determines which app sections a staff member sees.
-- Payroll defaults are edited by an admin on the Team page; the work permit is
-- stored as a (compressed) image data URL so no storage bucket is required.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists department text not null default 'salon',
  add column if not exists salary numeric(12, 2) not null default 0,
  add column if not exists food numeric(12, 2) not null default 0,
  add column if not exists bonus numeric(12, 2) not null default 0,
  add column if not exists work_permit text,
  add column if not exists work_permit_name text;

alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles
  add constraint profiles_department_check
  check (department in ('salon', 'other'));

-- ─────────────────────────────────────────────────────────────────────────
-- Payroll payments. An admin runs salary (inserts a row + signs it); the staff
-- member then signs the same row to acknowledge receipt.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.payroll_payments (
  id              uuid          primary key default gen_random_uuid(),
  staff_id        uuid          not null references auth.users (id) on delete cascade,
  -- Payroll period as YYYY-MM (e.g. 2026-10).
  period          text          not null,
  salary          numeric(12, 2) not null default 0,
  food            numeric(12, 2) not null default 0,
  bonus           numeric(12, 2) not null default 0,
  deductions      numeric(12, 2) not null default 0,
  total           numeric(12, 2) generated always as
                    (salary + food + bonus - deductions) stored,
  note            text,
  status          text          not null default 'pending',
  staff_signature text,
  staff_signed_at timestamptz,
  admin_signature text,
  admin_signed_at timestamptz,
  created_by      uuid          default auth.uid(),
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

alter table public.payroll_payments
  drop constraint if exists payroll_payments_status_check;
alter table public.payroll_payments
  add constraint payroll_payments_status_check
  check (status in ('pending', 'signed'));

create index if not exists payroll_staff_idx
  on public.payroll_payments (staff_id, period);

drop trigger if exists payroll_set_updated_at on public.payroll_payments;
create trigger payroll_set_updated_at
  before update on public.payroll_payments
  for each row execute function public.set_updated_at();

alter table public.payroll_payments enable row level security;

drop policy if exists "payroll_select" on public.payroll_payments;
create policy "payroll_select" on public.payroll_payments
  for select using (staff_id = auth.uid() or public.is_admin());

drop policy if exists "payroll_insert_admin" on public.payroll_payments;
create policy "payroll_insert_admin" on public.payroll_payments
  for insert with check (public.is_admin());

drop policy if exists "payroll_update_admin" on public.payroll_payments;
create policy "payroll_update_admin" on public.payroll_payments
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payroll_delete_admin" on public.payroll_payments;
create policy "payroll_delete_admin" on public.payroll_payments
  for delete using (public.is_admin());

-- Staff acknowledge a payment by signing it. SECURITY DEFINER so a staff member
-- can write only their own signature and can never touch the amounts.
create or replace function public.sign_payroll(payment uuid, signature text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select staff_id into owner_id
  from public.payroll_payments
  where id = payment;

  if owner_id is null then
    raise exception 'payment not found';
  end if;
  if owner_id <> auth.uid() then
    raise exception 'not authorised';
  end if;
  if signature is null or length(signature) < 10 then
    raise exception 'a signature is required';
  end if;

  update public.payroll_payments
  set staff_signature = signature,
      staff_signed_at = now(),
      status = 'signed'
  where id = payment;
end;
$$;

grant execute on function public.sign_payroll(uuid, text) to authenticated;

notify pgrst, 'reload schema';
