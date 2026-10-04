create schema if not exists nightwatch_private;
revoke all on schema nightwatch_private from public, anon;
grant usage on schema nightwatch_private to authenticated;

alter function public.nightwatch_tick(text, bigint, numeric, numeric, numeric, text, jsonb) set schema nightwatch_private;
alter function public.nightwatch_set_paused(boolean) set schema nightwatch_private;

revoke all on function nightwatch_private.nightwatch_tick(text, bigint, numeric, numeric, numeric, text, jsonb) from public, anon;
grant execute on function nightwatch_private.nightwatch_tick(text, bigint, numeric, numeric, numeric, text, jsonb) to authenticated;
revoke all on function nightwatch_private.nightwatch_set_paused(boolean) from public, anon;
grant execute on function nightwatch_private.nightwatch_set_paused(boolean) to authenticated;

create or replace function public.nightwatch_tick(
  p_symbol text,
  p_as_of_ms bigint,
  p_reference_price numeric,
  p_fast_sma numeric,
  p_slow_sma numeric,
  p_signal text,
  p_snapshot jsonb default '{}'::jsonb
) returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select nightwatch_private.nightwatch_tick($1, $2, $3, $4, $5, $6, $7);
$$;

create or replace function public.nightwatch_set_paused(p_paused boolean) returns boolean
language sql
security invoker
set search_path = pg_catalog
as $$
  select nightwatch_private.nightwatch_set_paused($1);
$$;

revoke all on function public.nightwatch_tick(text, bigint, numeric, numeric, numeric, text, jsonb) from public, anon;
grant execute on function public.nightwatch_tick(text, bigint, numeric, numeric, numeric, text, jsonb) to authenticated;
revoke all on function public.nightwatch_set_paused(boolean) from public, anon;
grant execute on function public.nightwatch_set_paused(boolean) to authenticated;

create index nightwatch_orders_account_created_idx on public.nightwatch_orders(account_id, created_at desc);
create index nightwatch_runs_account_created_idx on public.nightwatch_runs(account_id, created_at desc);
