alter table public.nightwatch_preferences
  add column if not exists monitor_symbol text check (monitor_symbol is null or monitor_symbol ~ '^[A-Z0-9]{2,24}USDT$');

create or replace function public.nightwatch_tick_scheduled(
  p_user_id uuid,
  p_symbol text,
  p_as_of_ms bigint,
  p_reference_price numeric,
  p_fast_sma numeric,
  p_slow_sma numeric,
  p_signal text,
  p_snapshot jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_enabled boolean;
  v_symbol text;
  v_paused boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Scheduled Nightwatch checks require the protected service role.' using errcode = '42501';
  end if;
  if p_user_id is null or p_symbol is null or p_symbol !~ '^[A-Z0-9]{2,24}USDT$' then
    raise exception 'Invalid scheduled Nightwatch request.' using errcode = '22023';
  end if;

  select p.trigger_mode = 'every_check', p.monitor_symbol, a.paused
    into v_enabled, v_symbol, v_paused
    from public.nightwatch_preferences p
    join public.nightwatch_accounts a on a.user_id = p.user_id
    where p.user_id = p_user_id
    for update of p, a;
  if not found or not coalesce(v_enabled, false) or v_symbol <> p_symbol or coalesce(v_paused, true) then
    return jsonb_build_object('outcome', 'skipped', 'reason', 'Schedule is disabled, symbol changed, or the paper agent is paused.');
  end if;

  -- Only service_role can invoke this wrapper. Set the authenticated owner claim
  -- inside this transaction so the existing account-scoped, guarded tick owns
  -- all position, daily-loss, fill-limit and idempotency behavior.
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  return nightwatch_private.nightwatch_tick(p_symbol, p_as_of_ms, p_reference_price, p_fast_sma, p_slow_sma, p_signal, coalesce(p_snapshot, '{}'::jsonb) || jsonb_build_object('trigger', 'scheduled_opt_in'));
end;
$function$;

revoke all on function public.nightwatch_tick_scheduled(uuid, text, bigint, numeric, numeric, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.nightwatch_tick_scheduled(uuid, text, bigint, numeric, numeric, numeric, text, jsonb) to service_role;
