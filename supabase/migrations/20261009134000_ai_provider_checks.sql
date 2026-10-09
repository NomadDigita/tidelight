-- Private checks have their own accounting, separate from research history.
create table if not exists public.ai_provider_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'running' check (status in ('running', 'complete', 'failed')),
  result jsonb
);
create index if not exists ai_provider_checks_user_created_idx on public.ai_provider_checks(user_id, created_at desc);
alter table public.ai_provider_checks enable row level security;
create policy "Owner sees provider checks" on public.ai_provider_checks for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owner completes provider checks" on public.ai_provider_checks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.ai_provider_checks from anon, authenticated;
grant select, update on public.ai_provider_checks to authenticated;

-- All concurrent checks for an account serialize before counting and reserving.
create or replace function public.reserve_ai_provider_check() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_id uuid;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 11992));
  if (select count(*) from public.ai_provider_checks where user_id = v_user and created_at >= now() - interval '1 hour') >= 2 then
    return null;
  end if;
  insert into public.ai_provider_checks (user_id) values (v_user) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.reserve_ai_provider_check() from public, anon;
grant execute on function public.reserve_ai_provider_check() to authenticated;
