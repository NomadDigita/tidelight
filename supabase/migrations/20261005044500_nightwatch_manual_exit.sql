create or replace function nightwatch_private.nightwatch_close_position(
  p_symbol text,
  p_reference_price numeric,
  p_reason text default 'Manual paper exit'
) returns jsonb
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid(); v_account public.nightwatch_accounts%rowtype; v_position public.nightwatch_positions%rowtype;
  v_run public.nightwatch_runs%rowtype; v_order public.nightwatch_orders%rowtype;
  v_fill numeric(24,10); v_notional numeric(18,2); v_fee numeric(18,2); v_pnl numeric(18,2); v_as_of timestamptz := now();
begin
  if v_user_id is null then raise exception 'Sign in to use Nightwatch.' using errcode = '42501'; end if;
  if p_symbol is null or p_symbol !~ '^[A-Z0-9]{2,24}USDT$' or p_reference_price is null or p_reference_price <= 0 then raise exception 'Invalid paper exit.' using errcode = '22023'; end if;
  select * into v_account from public.nightwatch_accounts where user_id = v_user_id for update;
  if not found then raise exception 'No Nightwatch paper account exists.' using errcode = 'P0002'; end if;
  select * into v_position from public.nightwatch_positions where account_id = v_account.id and symbol = p_symbol for update;
  if not found then raise exception 'No open paper position exists for this market.' using errcode = 'P0002'; end if;
  v_fill := round(p_reference_price * 0.9995, 10); v_notional := round(v_position.quantity * v_fill, 2); v_fee := round(v_notional * 0.001, 2);
  v_pnl := round(v_notional - v_fee - (v_position.quantity * v_position.average_cost), 2);
  insert into public.nightwatch_runs(user_id, account_id, symbol, signal, outcome, reason, as_of, reference_price, fast_sma, slow_sma, snapshot)
  values (v_user_id, v_account.id, p_symbol, 'sell', 'executed', left(coalesce(p_reason, 'Manual paper exit'), 240), v_as_of, p_reference_price, v_position.average_cost, v_position.average_cost, jsonb_build_object('manual', true)) returning * into v_run;
  insert into public.nightwatch_orders(user_id, account_id, run_id, symbol, side, quantity, reference_price, simulated_fill_price, notional, fee, realized_pnl)
  values (v_user_id, v_account.id, v_run.id, p_symbol, 'sell', v_position.quantity, p_reference_price, v_fill, v_notional, v_fee, v_pnl) returning * into v_order;
  update public.nightwatch_accounts set cash_balance = cash_balance + v_notional - v_fee, updated_at = now() where id = v_account.id;
  delete from public.nightwatch_positions where id = v_position.id;
  return jsonb_build_object('run_id', v_run.id, 'outcome', 'executed', 'reason', v_run.reason, 'order', to_jsonb(v_order));
end;
$$;
revoke all on function nightwatch_private.nightwatch_close_position(text,numeric,text) from public, anon;
grant execute on function nightwatch_private.nightwatch_close_position(text,numeric,text) to authenticated;
create or replace function public.nightwatch_close_position(p_symbol text, p_reference_price numeric, p_reason text default 'Manual paper exit') returns jsonb
language sql security invoker set search_path = pg_catalog as $$ select nightwatch_private.nightwatch_close_position($1, $2, $3); $$;
revoke all on function public.nightwatch_close_position(text,numeric,text) from public, anon;
grant execute on function public.nightwatch_close_position(text,numeric,text) to authenticated;
