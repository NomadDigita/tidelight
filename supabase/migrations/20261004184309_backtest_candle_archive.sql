alter table public.strategy_backtest_runs
  add column candles jsonb not null default '[]'::jsonb
  check (jsonb_typeof(candles) = 'array');
