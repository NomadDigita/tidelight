alter table public.nightwatch_preferences
  add column if not exists research_run_id uuid references public.research_runs(id) on delete set null;

drop function if exists public.nightwatch_tick_scheduled(uuid, text, bigint, numeric, numeric, numeric, text, jsonb);

create or replace function public.nightwatch_tick_scheduled(
  p_user_id uuid,
  p_symbol text,
  p_as_of_ms bigint,
  p_reference_price numeric,
  p_fast_sma numeric,
  p_slow_sma numeric,
  p_signal text,
  p_snapshot jsonb default '{}'::jsonb,
  p_research_run_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_enabled boolean;
  v_symbol text;
  v_paused boolean;
  v_research_run_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Scheduled Nightwatch checks require the protected service role.' using errcode = '42501';
  end if;
  if p_user_id is null or p_symbol is null or p_symbol !~ '^[A-Z0-9]{2,24}USDT$' then
    raise exception 'Invalid scheduled Nightwatch request.' using errcode = '22023';
  end if;

  select p.trigger_mode = 'every_check', p.monitor_symbol, a.paused, p.research_run_id
    into v_enabled, v_symbol, v_paused, v_research_run_id
    from public.nightwatch_preferences p
    join public.nightwatch_accounts a on a.user_id = p.user_id
    where p.user_id = p_user_id
    for update of p, a;
  if not found or not coalesce(v_enabled, false) or v_symbol <> p_symbol or coalesce(v_paused, true) then
    return jsonb_build_object('outcome', 'skipped', 'reason', 'Schedule is disabled, symbol changed, or the paper agent is paused.');
  end if;
  if v_research_run_id is distinct from p_research_run_id then
    return jsonb_build_object('outcome', 'skipped', 'reason', 'The linked research note changed; reload the current schedule before running it.');
  end if;
  if p_research_run_id is not null and not exists (select 1 from public.research_runs r where r.id = p_research_run_id and r.user_id = p_user_id) then
    raise exception 'The research note does not belong to the scheduled account.' using errcode = '42501';
  end if;

  -- Only service_role can invoke this wrapper. Set the authenticated owner claim
  -- inside this transaction so the existing account-scoped guardrail RPC owns
  -- position limits, daily loss limits, freshness, and idempotency.
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return nightwatch_private.nightwatch_tick(
    p_symbol,
    p_as_of_ms,
    p_reference_price,
    p_fast_sma,
    p_slow_sma,
    p_signal,
    coalesce(p_snapshot, '{}') || jsonb_build_object('trigger', 'scheduled_opt_in') ||
      case when p_research_run_id is null then '{}'::jsonb else jsonb_build_object('researchRunId', p_research_run_id) end
  );
end;
$function$;

revoke all on function public.nightwatch_tick_scheduled(uuid, text, bigint, numeric, numeric, numeric, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.nightwatch_tick_scheduled(uuid, text, bigint, numeric, numeric, numeric, text, jsonb, uuid) to service_role;
