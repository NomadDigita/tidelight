alter table public.strategy_backtest_runs
  drop constraint if exists strategy_backtest_runs_strategy_key_check;

alter table public.strategy_backtest_runs
  add constraint strategy_backtest_runs_strategy_key_check
  check (strategy_key in (
    'sma_trend_v1',
    'rsi_reversion_v1',
    'channel_breakout_v1',
    'weekend_drift_v1',
    'trend_pullback_v1',
    'semi_breakout_v1'
  ));

alter table public.nightwatch_preferences
  add column if not exists playbook_key text not null default 'sma_trend_v1';

alter table public.nightwatch_preferences
  add constraint nightwatch_preferences_playbook_key_check
  check (playbook_key in (
    'sma_trend_v1',
    'rsi_reversion_v1',
    'channel_breakout_v1',
    'weekend_drift_v1',
    'trend_pullback_v1',
    'semi_breakout_v1'
  ));
