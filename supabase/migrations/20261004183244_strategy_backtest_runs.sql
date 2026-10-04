create table public.strategy_backtest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9]{2,32}$'),
  interval text not null check (interval in ('1H', '4H', '1D')),
  strategy_key text not null check (strategy_key = 'sma_trend_v1'),
  parameters jsonb not null default '{}'::jsonb,
  train_metrics jsonb not null,
  test_metrics jsonb not null,
  data_start timestamptz not null,
  data_end timestamptz not null,
  candle_count integer not null check (candle_count >= 1),
  created_at timestamptz not null default now(),
  check (data_start <= data_end)
);

create index strategy_backtest_runs_user_created_idx
  on public.strategy_backtest_runs (user_id, created_at desc);

alter table public.strategy_backtest_runs enable row level security;
create policy "Owners manage strategy backtests"
  on public.strategy_backtest_runs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.strategy_backtest_runs from anon, public;
grant select, insert, update, delete on public.strategy_backtest_runs to authenticated;
