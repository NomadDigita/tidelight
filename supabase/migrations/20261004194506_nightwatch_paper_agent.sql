create table public.nightwatch_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  initial_cash numeric(18,2) not null default 10000 check (initial_cash = 10000),
  cash_balance numeric(18,2) not null default 10000 check (cash_balance >= 0),
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nightwatch_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.nightwatch_accounts(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9]{2,24}USDT$'),
  quantity numeric(24,10) not null check (quantity > 0),
  average_cost numeric(24,10) not null check (average_cost > 0),
  opened_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (account_id, symbol)
);

create table public.nightwatch_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.nightwatch_accounts(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9]{2,24}USDT$'),
  signal text not null check (signal in ('buy','sell','hold')),
  outcome text not null check (outcome in ('executed','rejected','no_action')),
  reason text not null, as_of timestamptz not null,
  reference_price numeric(24,10) not null check (reference_price > 0),
  fast_sma numeric(24,10) not null check (fast_sma > 0),
  slow_sma numeric(24,10) not null check (slow_sma > 0),
  snapshot jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique (user_id, symbol, as_of)
);

create table public.nightwatch_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.nightwatch_accounts(id) on delete cascade,
  run_id uuid not null unique references public.nightwatch_runs(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9]{2,24}USDT$'),
  side text not null check (side in ('buy','sell')),
  quantity numeric(24,10) not null check (quantity > 0),
  reference_price numeric(24,10) not null check (reference_price > 0),
  simulated_fill_price numeric(24,10) not null check (simulated_fill_price > 0),
  notional numeric(18,2) not null check (notional > 0), fee numeric(18,2) not null check (fee >= 0),
  realized_pnl numeric(18,2), paper_only boolean not null default true check (paper_only),
  created_at timestamptz not null default now()
);

create index nightwatch_runs_user_created_idx on public.nightwatch_runs(user_id, created_at desc);
create index nightwatch_orders_user_created_idx on public.nightwatch_orders(user_id, created_at desc);
create index nightwatch_positions_user_idx on public.nightwatch_positions(user_id, account_id);
alter table public.nightwatch_accounts enable row level security;
alter table public.nightwatch_positions enable row level security;
alter table public.nightwatch_runs enable row level security;
alter table public.nightwatch_orders enable row level security;
create policy "Owners read Nightwatch accounts" on public.nightwatch_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners read Nightwatch positions" on public.nightwatch_positions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners read Nightwatch runs" on public.nightwatch_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners read Nightwatch orders" on public.nightwatch_orders for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.nightwatch_accounts, public.nightwatch_positions, public.nightwatch_runs, public.nightwatch_orders from anon, public, authenticated;
grant usage on schema public to authenticated;
grant select on public.nightwatch_accounts, public.nightwatch_positions, public.nightwatch_runs, public.nightwatch_orders to authenticated;

create or replace function public.nightwatch_tick(p_symbol text, p_as_of_ms bigint, p_reference_price numeric, p_fast_sma numeric, p_slow_sma numeric, p_signal text, p_snapshot jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_user_id uuid := auth.uid(); v_account public.nightwatch_accounts%rowtype; v_position public.nightwatch_positions%rowtype;
  v_run public.nightwatch_runs%rowtype; v_order public.nightwatch_orders%rowtype; v_as_of timestamptz;
  v_outcome text := 'no_action'; v_reason text := 'No crossover on the last completed 4-hour candle.';
  v_quantity numeric(24,10); v_fill numeric(24,10); v_fee numeric(18,2); v_notional numeric(18,2); v_pnl numeric(18,2);
  v_daily_orders integer; v_daily_pnl numeric(18,2);
begin
  if v_user_id is null then raise exception 'Sign in to use Nightwatch.' using errcode = '42501'; end if;
  if p_symbol is null or p_symbol !~ '^[A-Z0-9]{2,24}USDT$' then raise exception 'Invalid market symbol.' using errcode = '22023'; end if;
  if p_as_of_ms is null or p_as_of_ms < 1 then raise exception 'Invalid candle timestamp.' using errcode = '22023'; end if;
  if p_reference_price is null or p_reference_price <= 0 or p_fast_sma is null or p_fast_sma <= 0 or p_slow_sma is null or p_slow_sma <= 0 then raise exception 'Invalid market snapshot.' using errcode = '22023'; end if;
  if p_signal not in ('buy','sell','hold') then raise exception 'Invalid signal.' using errcode = '22023'; end if;
  v_as_of := to_timestamp(p_as_of_ms / 1000.0);
  if v_as_of > now() + interval '1 minute' then raise exception 'Candle timestamp is in the future.' using errcode = '22023'; end if;
  insert into public.nightwatch_accounts(user_id) values (v_user_id) on conflict (user_id) do nothing;
  select * into v_account from public.nightwatch_accounts where user_id = v_user_id for update;
  select * into v_run from public.nightwatch_runs where user_id = v_user_id and symbol = p_symbol and as_of = v_as_of;
  if found then
    select * into v_order from public.nightwatch_orders where run_id = v_run.id;
    return jsonb_build_object('run_id', v_run.id, 'outcome', v_run.outcome, 'reason', v_run.reason, 'idempotent', true, 'order', case when v_order.id is null then null else to_jsonb(v_order) end);
  end if;
  select * into v_position from public.nightwatch_positions where account_id = v_account.id and symbol = p_symbol for update;
  select count(*)::integer, coalesce(sum(realized_pnl), 0)::numeric(18,2) into v_daily_orders, v_daily_pnl
    from public.nightwatch_orders where account_id = v_account.id and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if now() - v_as_of > interval '6 hours' then v_outcome := 'rejected'; v_reason := 'The completed candle is stale; no paper order was created.';
  elsif v_account.paused then v_outcome := 'rejected'; v_reason := 'Nightwatch is paused; the signal was recorded without an order.';
  elsif v_daily_pnl <= -200 then v_outcome := 'rejected'; v_reason := 'Daily loss guard reached $200. Paper execution is locked until the next UTC day.';
  elsif v_daily_orders >= 5 and p_signal <> 'hold' then v_outcome := 'rejected'; v_reason := 'Daily order limit reached (5 fills).';
  elsif p_signal = 'buy' and v_position.id is not null then v_outcome := 'rejected'; v_reason := 'A paper position already exists for this market.';
  elsif p_signal = 'sell' and v_position.id is null then v_outcome := 'rejected'; v_reason := 'No paper position exists to close.';
  elsif p_signal = 'buy' then
    v_fill := round(p_reference_price * 1.0005, 10);
    v_quantity := trunc(least(500::numeric, v_account.cash_balance / 1.0015) / v_fill, 10);
    v_notional := round(v_quantity * v_fill, 2); v_fee := round(v_notional * 0.001, 2);
    if v_quantity <= 0 or v_notional + v_fee > v_account.cash_balance then v_outcome := 'rejected'; v_reason := 'Insufficient paper cash for capped position and estimated fee.';
    else
      v_outcome := 'executed'; v_reason := 'Golden cross accepted. Paper buy filled with 0.05% slippage and 0.10% fee.';
      insert into public.nightwatch_runs(user_id, account_id, symbol, signal, outcome, reason, as_of, reference_price, fast_sma, slow_sma, snapshot)
      values (v_user_id, v_account.id, p_symbol, p_signal, v_outcome, v_reason, v_as_of, p_reference_price, p_fast_sma, p_slow_sma, coalesce(p_snapshot, '{}'::jsonb)) returning * into v_run;
      insert into public.nightwatch_orders(user_id, account_id, run_id, symbol, side, quantity, reference_price, simulated_fill_price, notional, fee)
      values (v_user_id, v_account.id, v_run.id, p_symbol, 'buy', v_quantity, p_reference_price, v_fill, v_notional, v_fee) returning * into v_order;
      update public.nightwatch_accounts set cash_balance = cash_balance - v_notional - v_fee, updated_at = now() where id = v_account.id;
      insert into public.nightwatch_positions(user_id, account_id, symbol, quantity, average_cost) values (v_user_id, v_account.id, p_symbol, v_quantity, (v_notional + v_fee) / v_quantity);
      return jsonb_build_object('run_id', v_run.id, 'outcome', v_outcome, 'reason', v_reason, 'idempotent', false, 'order', to_jsonb(v_order));
    end if;
  elsif p_signal = 'sell' then
    v_fill := round(p_reference_price * 0.9995, 10); v_notional := round(v_position.quantity * v_fill, 2); v_fee := round(v_notional * 0.001, 2);
    v_pnl := round(v_notional - v_fee - (v_position.quantity * v_position.average_cost), 2);
    v_outcome := 'executed'; v_reason := 'Death cross accepted. Paper position closed with 0.05% slippage and 0.10% fee.';
    insert into public.nightwatch_runs(user_id, account_id, symbol, signal, outcome, reason, as_of, reference_price, fast_sma, slow_sma, snapshot)
    values (v_user_id, v_account.id, p_symbol, p_signal, v_outcome, v_reason, v_as_of, p_reference_price, p_fast_sma, p_slow_sma, coalesce(p_snapshot, '{}'::jsonb)) returning * into v_run;
    insert into public.nightwatch_orders(user_id, account_id, run_id, symbol, side, quantity, reference_price, simulated_fill_price, notional, fee, realized_pnl)
    values (v_user_id, v_account.id, v_run.id, p_symbol, 'sell', v_position.quantity, p_reference_price, v_fill, v_notional, v_fee, v_pnl) returning * into v_order;
    update public.nightwatch_accounts set cash_balance = cash_balance + v_notional - v_fee, updated_at = now() where id = v_account.id;
    delete from public.nightwatch_positions where id = v_position.id;
    return jsonb_build_object('run_id', v_run.id, 'outcome', v_outcome, 'reason', v_reason, 'idempotent', false, 'order', to_jsonb(v_order));
  end if;
  insert into public.nightwatch_runs(user_id, account_id, symbol, signal, outcome, reason, as_of, reference_price, fast_sma, slow_sma, snapshot)
  values (v_user_id, v_account.id, p_symbol, p_signal, v_outcome, v_reason, v_as_of, p_reference_price, p_fast_sma, p_slow_sma, coalesce(p_snapshot, '{}'::jsonb)) returning * into v_run;
  return jsonb_build_object('run_id', v_run.id, 'outcome', v_outcome, 'reason', v_reason, 'idempotent', false, 'order', null);
end;
$$;
revoke all on function public.nightwatch_tick(text,bigint,numeric,numeric,numeric,text,jsonb) from public, anon;
grant execute on function public.nightwatch_tick(text,bigint,numeric,numeric,numeric,text,jsonb) to authenticated;

create or replace function public.nightwatch_set_paused(p_paused boolean) returns boolean
language plpgsql security definer set search_path = pg_catalog as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Sign in to manage Nightwatch.' using errcode = '42501'; end if;
  insert into public.nightwatch_accounts(user_id) values (v_user_id) on conflict (user_id) do nothing;
  update public.nightwatch_accounts set paused = p_paused, updated_at = now() where user_id = v_user_id;
  return p_paused;
end;
$$;
revoke all on function public.nightwatch_set_paused(boolean) from public, anon;
grant execute on function public.nightwatch_set_paused(boolean) to authenticated;
