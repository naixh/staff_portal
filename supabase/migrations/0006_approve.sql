-- 0006_approve — approving a user also confirms their email so they can sign in.
--
-- Runs as SECURITY DEFINER (owner privileges), so it can touch auth.users — the
-- browser never needs the secret key. Only owner/admin may call it.
--
-- Apply with the Supabase CLI (`supabase db push`) or psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0006_approve.sql

create or replace function public.approve_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;

  update public.profiles
  set approved = true
  where id = target;

  -- `confirmed_at` is a generated column, so only set `email_confirmed_at`.
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = target;
end;
$$;

grant execute on function public.approve_user(uuid) to authenticated;

-- Ask PostgREST to pick up the new function immediately (otherwise the first
-- call right after applying this migration can fail with PGRST202).
notify pgrst, 'reload schema';
