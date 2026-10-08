-- Separate US-stock perpetual paper book. No exchange credentials or orders.
create table public.futures_paper_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  cash_balance numeric(18,2) not null default 10000 check (cash_balance >= 0),
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.futures_paper_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null unique references public.futures_paper_accounts(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z]{2,10}USDT$'),
  direction text not null check (direction in ('long','short')),
  quantity numeric(24,8) not null check (quantity > 0),
  entry_fill numeric(24,10) not null check (entry_fill > 0),
  margin numeric(18,2) not null check (margin > 0 and margin <= 250),
  entry_fee numeric(18,2) not null check (entry_fee >= 0),
  opened_at timestamptz not null default now()
);

create table public.futures_paper_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.futures_paper_accounts(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z]{2,10}USDT$'),
  as_of timestamptz not null,
  action text not null check (action in ('open_long','open_short','close','hold')),
  outcome text not null check (outcome in ('filled','held','blocked')),
  reason text not null,
  reference_price numeric(24,10) not null check (reference_price > 0),
  realized_pnl numeric(18,2) not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id,symbol,as_of)
);

create table public.futures_paper_fills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.futures_paper_accounts(id) on delete cascade,
  decision_id uuid not null unique references public.futures_paper_decisions(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z]{2,10}USDT$'),
  action text not null check (action in ('open_long','open_short','close')),
  direction text not null check (direction in ('long','short')),
  quantity numeric(24,8) not null check (quantity > 0),
  fill_price numeric(24,10) not null check (fill_price > 0),
  notional numeric(18,2) not null check (notional > 0),
  fee numeric(18,2) not null check (fee >= 0),
  realized_pnl numeric(18,2) not null default 0,
  paper_only boolean not null default true check (paper_only),
  created_at timestamptz not null default now()
);

create index futures_paper_decisions_user_created_idx on public.futures_paper_decisions(user_id, created_at desc);
create index futures_paper_fills_account_created_idx on public.futures_paper_fills(account_id, created_at desc);
alter table public.futures_paper_accounts enable row level security;
alter table public.futures_paper_positions enable row level security;
alter table public.futures_paper_decisions enable row level security;
alter table public.futures_paper_fills enable row level security;
create policy "Owners read futures paper accounts" on public.futures_paper_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners read futures paper positions" on public.futures_paper_positions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners read futures paper decisions" on public.futures_paper_decisions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners read futures paper fills" on public.futures_paper_fills for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.futures_paper_accounts,public.futures_paper_positions,public.futures_paper_decisions,public.futures_paper_fills from public,anon,authenticated;
grant select on public.futures_paper_accounts,public.futures_paper_positions,public.futures_paper_decisions,public.futures_paper_fills to authenticated;
grant all on public.futures_paper_accounts,public.futures_paper_positions,public.futures_paper_decisions,public.futures_paper_fills to service_role;

-- Only the server-side service role can submit a proposal. The route verifies
-- the user session, supported instrument, completed candle and AI output.
create function public.futures_paper_apply(
  p_user_id uuid, p_symbol text, p_as_of_ms bigint, p_reference_price numeric,
  p_action text, p_snapshot jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_account public.futures_paper_accounts%rowtype;
  v_position public.futures_paper_positions%rowtype;
  v_decision public.futures_paper_decisions%rowtype;
  v_as_of timestamptz;
  v_action text := p_action;
  v_outcome text := 'held';
  v_reason text := 'No paper position changed.';
  v_fill numeric(24,10);
  v_qty numeric(24,8);
  v_notional numeric(18,2);
  v_fee numeric(18,2);
  v_pnl numeric(18,2) := 0;
  v_daily_pnl numeric(18,2);
  v_daily_fills integer;
  v_mark_pnl numeric(18,2);
begin
  if p_user_id is null or p_symbol is null or p_symbol !~ '^[A-Z]{2,10}USDT$'
    or p_reference_price is null or p_reference_price <= 0
    or p_as_of_ms is null or p_as_of_ms < 1 or p_action not in ('open_long','open_short','close','hold')
    or p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object'
  then raise exception 'Invalid paper decision.' using errcode = '22023'; end if;
  v_as_of := to_timestamp(p_as_of_ms / 1000.0);
  if v_as_of > now() + interval '1 minute' then raise exception 'Future paper timestamp.' using errcode = '22023'; end if;

  insert into public.futures_paper_accounts(user_id) values(p_user_id) on conflict(user_id) do nothing;
  select * into v_account from public.futures_paper_accounts where user_id = p_user_id for update;
  select * into v_decision from public.futures_paper_decisions where user_id = p_user_id and symbol = p_symbol and as_of = v_as_of;
  if found then return jsonb_build_object('id',v_decision.id,'outcome',v_decision.outcome,'reason',v_decision.reason,'idempotent',true); end if;
  select * into v_position from public.futures_paper_positions where account_id = v_account.id for update;
  select count(*)::integer, coalesce(sum(realized_pnl),0)::numeric(18,2) into v_daily_fills,v_daily_pnl
    from public.futures_paper_fills where account_id = v_account.id
    and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';

  -- A position breaching 80% adverse notional is closed at the observed mark;
  -- a gap can exceed this threshold. This is a paper circuit, not exchange liquidation.
  if v_position.id is not null and v_position.symbol = p_symbol then
    v_mark_pnl := round(v_position.quantity * (p_reference_price - v_position.entry_fill)
      * case when v_position.direction = 'long' then 1 else -1 end,2);
    if v_mark_pnl <= -0.8 * v_position.margin then v_action := 'close'; v_reason := 'Paper margin circuit closed an adverse position.'; end if;
  end if;

  if now() - v_as_of > interval '6 hours' then v_outcome := 'blocked'; v_reason := 'Market mark is stale.';
  elsif v_account.paused and v_action in ('open_long','open_short') then v_outcome := 'blocked'; v_reason := 'Paper agent is paused.';
  elsif v_action in ('open_long','open_short') and v_daily_pnl <= -200 then v_outcome := 'blocked'; v_reason := 'Daily realized loss circuit reached.';
  elsif v_action in ('open_long','open_short') and v_daily_fills >= 5 then v_outcome := 'blocked'; v_reason := 'Five paper fills reached today.';
  elsif v_action in ('open_long','open_short') and v_position.id is not null then v_outcome := 'blocked'; v_reason := 'Close the existing paper position first.';
  elsif v_action = 'close' and (v_position.id is null or v_position.symbol <> p_symbol) then v_outcome := 'blocked'; v_reason := 'No matching paper position to close.';
  elsif v_action in ('open_long','open_short') then
    v_fill := round(p_reference_price * case when v_action = 'open_long' then 1.0005 else 0.9995 end,10);
    v_qty := trunc(250 / v_fill,8);
    v_notional := round(v_qty * v_fill,2);
    v_fee := round(v_notional * 0.001,2);
    if v_qty <= 0 or v_notional <= 0 or v_account.cash_balance < v_notional + v_fee
    then v_outcome := 'blocked'; v_reason := 'Insufficient paper cash for one-times margin and fee.';
    else
      v_outcome := 'filled'; v_reason := 'One-times paper position opened with estimated fee and adverse slippage.';
      v_pnl := -v_fee;
    end if;
  elsif v_action = 'close' then
    v_fill := round(p_reference_price * case when v_position.direction = 'long' then 0.9995 else 1.0005 end,10);
    v_qty := v_position.quantity;
    v_notional := round(v_qty * v_fill,2);
    v_fee := round(v_notional * 0.001,2);
    v_pnl := round(v_qty * (v_fill - v_position.entry_fill)
      * case when v_position.direction = 'long' then 1 else -1 end - v_fee,2);
    v_outcome := 'filled';
    if v_reason = 'No paper position changed.' then v_reason := 'Paper position closed with estimated fee and adverse slippage.'; end if;
  end if;

  insert into public.futures_paper_decisions(user_id,account_id,symbol,as_of,action,outcome,reason,reference_price,realized_pnl,snapshot)
  values(p_user_id,v_account.id,p_symbol,v_as_of,v_action,v_outcome,v_reason,p_reference_price,case when v_outcome = 'filled' then v_pnl else 0 end,p_snapshot)
  returning * into v_decision;
  if v_outcome = 'filled' then
    insert into public.futures_paper_fills(user_id,account_id,decision_id,symbol,action,direction,quantity,fill_price,notional,fee,realized_pnl)
    values(p_user_id,v_account.id,v_decision.id,p_symbol,v_action,
      case when v_action = 'close' then v_position.direction when v_action = 'open_long' then 'long' else 'short' end,
      v_qty,v_fill,v_notional,v_fee,v_pnl);
    if v_action = 'close' then
      update public.futures_paper_accounts set cash_balance = greatest(0,cash_balance + v_position.margin + v_pnl),updated_at = now() where id = v_account.id;
      delete from public.futures_paper_positions where id = v_position.id;
    else
      update public.futures_paper_accounts set cash_balance = cash_balance - v_notional - v_fee,updated_at = now() where id = v_account.id;
      insert into public.futures_paper_positions(user_id,account_id,symbol,direction,quantity,entry_fill,margin,entry_fee)
      values(p_user_id,v_account.id,p_symbol,case when v_action = 'open_long' then 'long' else 'short' end,v_qty,v_fill,v_notional,v_fee);
    end if;
  end if;
  return jsonb_build_object('id',v_decision.id,'action',v_action,'outcome',v_outcome,'reason',v_reason,'realizedPnl',case when v_outcome = 'filled' then v_pnl else 0 end,'idempotent',false);
end;
$$;
revoke all on function public.futures_paper_apply(uuid,text,bigint,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.futures_paper_apply(uuid,text,bigint,numeric,text,jsonb) to service_role;
