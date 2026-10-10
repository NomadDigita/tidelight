import type { BacktestMetrics } from "./backtest";

/** The handbook calls out an OOS Sharpe below half the in-sample Sharpe. */
export function assessSharpeDecay(train: Pick<BacktestMetrics, "sharpeRatio" | "trades">, holdout: Pick<BacktestMetrics, "sharpeRatio" | "trades">) {
  if (train.trades < 2 || holdout.trades < 2 || train.sharpeRatio == null || train.sharpeRatio <= 0 || holdout.sharpeRatio == null) {
    return { state: "insufficient" as const, ratio: null };
  }
  const ratio = holdout.sharpeRatio / train.sharpeRatio;
  return { state: ratio < 0.5 ? "alert" as const : "no-alert" as const, ratio };
}
