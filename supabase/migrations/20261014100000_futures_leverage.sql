alter table public.futures_paper_positions add column if not exists leverage integer not null default 1 check (leverage between 1 and 100);

drop function if exists public.futures_paper_manual_order(uuid,text,bigint,numeric,text,numeric);

create or replace function public.futures_paper_manual_order(
  p_user_id uuid, p_symbol text, p_as_of_ms bigint, p_reference_price numeric, p_action text, p_margin numeric, p_leverage integer
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_account public.futures_paper_accounts%rowtype;
  v_position public.futures_paper_positions%rowtype;
  v_decision public.futures_paper_decisions%rowtype;
  v_as_of timestamptz;
  v_fill numeric(24,10);
  v_qty numeric(24,8);
  v_notional numeric(18,2);
  v_fee numeric(18,2);
  v_pnl numeric(18,2) := 0;
  v_daily_pnl numeric(18,2);
  v_daily_fills integer;
  v_outcome text := 'blocked';
  v_reason text := 'Paper order was not filled.';
  v_direction text;
begin
  if p_user_id is null or p_symbol !~ '^[A-Z]{2,10}USDT$' or p_reference_price is null or p_reference_price <= 0
    or p_as_of_ms is null or p_as_of_ms < 1 or p_action not in ('open_long','open_short','close')
    or p_leverage is null or p_leverage < 1 or p_leverage > 100
    or (p_action in ('open_long','open_short') and (p_margin is null or p_margin < 10 or p_margin > 250))
  then raise exception 'Invalid workstation order.' using errcode = '22023'; end if;
  v_as_of := clock_timestamp();
  if v_as_of < now() - interval '60 seconds' or v_as_of > now() + interval '60 seconds'
  then raise exception 'Market mark is stale.' using errcode = '22023'; end if;

  insert into public.futures_paper_accounts(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into v_account from public.futures_paper_accounts where user_id = p_user_id for update;
  select * into v_position from public.futures_paper_positions where account_id = v_account.id for update;
  select count(*)::integer, coalesce(sum(realized_pnl),0)::numeric(18,2)
    into v_daily_fills,v_daily_pnl from public.futures_paper_fills
    where account_id = v_account.id and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';

  if p_action in ('open_long','open_short') and v_account.paused then v_reason := 'Paper entries are paused.';
  elsif p_action in ('open_long','open_short') and v_daily_pnl <= -200 then v_reason := 'Daily realized loss circuit reached.';
  elsif p_action in ('open_long','open_short') and v_daily_fills >= 5 then v_reason := 'Five paper fills reached today.';
  elsif p_action in ('open_long','open_short') and v_position.id is not null then v_reason := 'Close the existing paper position first.';
  elsif p_action = 'close' and (v_position.id is null or v_position.symbol <> p_symbol) then v_reason := 'No matching paper position to close.';
  elsif p_action in ('open_long','open_short') then
    v_direction := case when p_action = 'open_long' then 'long' else 'short' end;
    v_fill := round(p_reference_price * case when v_direction = 'long' then 1.0005 else 0.9995 end,10);
    v_qty := trunc((p_margin * p_leverage) / v_fill,8);
    v_notional := round(v_qty * v_fill,2);
    v_fee := round(v_notional * 0.001,2);
    if v_qty <= 0 or v_notional <= 0 or v_account.cash_balance < p_margin + v_fee then v_reason := 'Insufficient paper cash.';
    else
      insert into public.futures_paper_decisions(user_id,account_id,symbol,as_of,action,outcome,reason,reference_price,realized_pnl,snapshot)
      values(p_user_id,v_account.id,p_symbol,v_as_of,p_action,'filled','Manual leveraged paper market order with estimated fee and adverse slippage.',p_reference_price,-v_fee,jsonb_build_object('source','manual workstation','margin',p_margin,'leverage',p_leverage,'notional',v_notional))
      returning * into v_decision;
      insert into public.futures_paper_fills(user_id,account_id,decision_id,symbol,action,direction,quantity,fill_price,notional,fee,realized_pnl)
      values(p_user_id,v_account.id,v_decision.id,p_symbol,p_action,v_direction,v_qty,v_fill,v_notional,v_fee,-v_fee);
      update public.futures_paper_accounts set cash_balance = cash_balance - p_margin - v_fee,updated_at = now() where id = v_account.id;
      insert into public.futures_paper_positions(user_id,account_id,symbol,direction,quantity,entry_fill,margin,entry_fee,leverage)
      values(p_user_id,v_account.id,p_symbol,v_direction,v_qty,v_fill,p_margin,v_fee,p_leverage);
      return jsonb_build_object('id',v_decision.id,'action',p_action,'outcome','filled','reason',p_leverage::text || '-times paper position opened with estimated fee and adverse slippage.','fillPrice',v_fill,'quantity',v_qty,'realizedPnl',-v_fee,'leverage',p_leverage,'notional',v_notional);
    end if;
  else
    v_direction := v_position.direction;
    v_fill := round(p_reference_price * case when v_direction = 'long' then 0.9995 else 1.0005 end,10);
    v_qty := v_position.quantity;
    v_notional := round(v_qty * v_fill,2);
    v_fee := round(v_notional * 0.001,2);
    v_pnl := round(v_qty * (v_fill - v_position.entry_fill) * case when v_direction = 'long' then 1 else -1 end - v_fee,2);
    insert into public.futures_paper_decisions(user_id,account_id,symbol,as_of,action,outcome,reason,reference_price,realized_pnl,snapshot)
    values(p_user_id,v_account.id,p_symbol,v_as_of,'close','filled','Paper position closed with estimated fee and adverse slippage.',p_reference_price,v_pnl,jsonb_build_object('source','manual workstation','leverage',v_position.leverage))
    returning * into v_decision;
    insert into public.futures_paper_fills(user_id,account_id,decision_id,symbol,action,direction,quantity,fill_price,notional,fee,realized_pnl)
    values(p_user_id,v_account.id,v_decision.id,p_symbol,'close',v_direction,v_qty,v_fill,v_notional,v_fee,v_pnl);
    update public.futures_paper_accounts set cash_balance = greatest(0,cash_balance + v_position.margin + v_qty * (v_fill - v_position.entry_fill) * case when v_direction = 'long' then 1 else -1 end - v_fee),updated_at = now() where id = v_account.id;
    delete from public.futures_paper_positions where id = v_position.id;
    return jsonb_build_object('id',v_decision.id,'action','close','outcome','filled','reason','Paper position closed with estimated fee and adverse slippage.','leverage',v_position.leverage,'fillPrice',v_fill,'quantity',v_qty,'realizedPnl',v_pnl);
  end if;

  insert into public.futures_paper_decisions(user_id,account_id,symbol,as_of,action,outcome,reason,reference_price)
  values(p_user_id,v_account.id,p_symbol,v_as_of,p_action,'blocked',v_reason,p_reference_price)
  returning * into v_decision;
  return jsonb_build_object('id',v_decision.id,'action',p_action,'outcome',v_outcome,'reason',v_reason,'realizedPnl',0);
end;
$$;
revoke all on function public.futures_paper_manual_order(uuid,text,bigint,numeric,text,numeric,integer) from public,anon,authenticated;
grant execute on function public.futures_paper_manual_order(uuid,text,bigint,numeric,text,numeric,integer) to service_role;
