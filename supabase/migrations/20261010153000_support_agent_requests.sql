-- Reserve AI support calls atomically per account without storing chat content.
create table if not exists public.support_agent_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists support_agent_requests_user_created_idx
  on public.support_agent_requests (user_id, created_at desc);
alter table public.support_agent_requests enable row level security;
revoke all on public.support_agent_requests from anon, authenticated;

create or replace function public.reserve_support_agent_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 12011));
  if (select count(*) from public.support_agent_requests
      where user_id = v_user and created_at >= now() - interval '1 hour') >= 12 then
    return false;
  end if;
  insert into public.support_agent_requests (user_id) values (v_user);
  return true;
end;
$$;
revoke all on function public.reserve_support_agent_request() from public, anon;
grant execute on function public.reserve_support_agent_request() to authenticated;
