-- Store only keyed, short-lived rate-limit fingerprints; never persist feedback text or raw IPs.
create table if not exists public.feedback_rate_windows (
  fingerprint text primary key check (fingerprint ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);
alter table public.feedback_rate_windows enable row level security;
revoke all on public.feedback_rate_windows from anon, authenticated, public;
grant all on public.feedback_rate_windows to service_role;

create or replace function public.reserve_feedback_rate_limit(p_fingerprints text[])
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fingerprint text;
  v_count integer;
  v_allowed boolean := true;
begin
  if p_fingerprints is null or cardinality(p_fingerprints) < 1 or cardinality(p_fingerprints) > 2 then
    return false;
  end if;

  foreach v_fingerprint in array p_fingerprints loop
    if v_fingerprint !~ '^[a-f0-9]{64}$' then return false; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_fingerprint, 931));
    insert into public.feedback_rate_windows(fingerprint, window_started_at, request_count)
    values (v_fingerprint, now(), 1)
    on conflict (fingerprint) do update
      set request_count = case
            when public.feedback_rate_windows.window_started_at < now() - interval '1 hour' then 1
            else public.feedback_rate_windows.request_count + 1
          end,
          window_started_at = case
            when public.feedback_rate_windows.window_started_at < now() - interval '1 hour' then now()
            else public.feedback_rate_windows.window_started_at
          end
    returning request_count into v_count;
    if v_count > 5 then v_allowed := false; end if;
  end loop;
  return v_allowed;
end;
$$;
revoke all on function public.reserve_feedback_rate_limit(text[]) from public, anon, authenticated;
grant execute on function public.reserve_feedback_rate_limit(text[]) to service_role;

create index if not exists feedback_rate_windows_expiry_idx
  on public.feedback_rate_windows(window_started_at);
