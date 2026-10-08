import type { CandleInterval, MarketCandle } from "@/lib/bitget-market";

export const BACKTEST_STRATEGY = "sma_trend_v1" as const;
export type StrategyKey = "sma_trend_v1" | "rsi_reversion_v1" | "channel_breakout_v1" | "weekend_drift_v1" | "trend_pullback_v1" | "semi_breakout_v1";
export const ALPHA_STRATEGIES: Record<StrategyKey, { label: string; description: string }> = {
  sma_trend_v1: { label: "Trend · SMA 20/50", description: "20-period trend above the 50-period trend." },
  rsi_reversion_v1: { label: "Mean reversion · RSI 14", description: "Enter oversold and exit after rebound." },
  channel_breakout_v1: { label: "Momentum · 20/10 channel", description: "Enter above prior high and exit below prior low." },
  weekend_drift_v1: { label: "After-hours · weekend drift", description: "Test positive weekend continuation on 24/7 tokens." },
  trend_pullback_v1: { label: "Trend pullback · EMA / RSI", description: "Test a cooled pullback inside a rising trend, confirmed by a completed bullish candle." },
  semi_breakout_v1: { label: "Semiconductor · volume breakout", description: "Test a long-only channel break with trend, participation, candle-quality, and momentum filters." },
};

export const BACKTEST_PARAMETERS = {
  fastWindow: 20,
  slowWindow: 50,
  // Bitget currently serves about 90 days of 4H candles. A 66/34 split
  // leaves enough room for a 30-day OOS window while preserving 30+ days
  // of evaluated training data after the 50-candle warm-up.
  trainFraction: 0.66,
  feeBpsPerSide: 10,
  slippageBpsPerSide: 5,
  initialEquity: 10_000,
} as const;

export type BacktestMetrics = {
  totalReturnPct: number;
  buyAndHoldReturnPct: number;
  maxDrawdownPct: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  trades: number;
  winRatePct: number | null;
  endingEquity: number;
  candles: number;
  tradeLog: Array<{ entryTime: number; exitTime: number; entryPrice: number; exitPrice: number; returnPct: number }>;
  equityCurve: Array<{ timestamp: number; equity: number }>;
};

export type BacktestResult = {
  symbol: string;
  interval: CandleInterval;
  strategyKey: StrategyKey;
  parameters: typeof BACKTEST_PARAMETERS & { strategyLabel: string };
  train: BacktestMetrics;
  test: BacktestMetrics;
  dataStart: number;
  dataEnd: number;
  candleCount: number;
  splitIndex: number;
};

export type WalkForwardFold = { index: number; trainStart: number; testStart: number; testEnd: number; metrics: BacktestMetrics };
export type WalkForwardResult = { folds: WalkForwardFold[]; meanReturnPct: number; positiveFolds: number; totalFolds: number; evaluationStart: number; evaluationEnd: number };

function validateCandles(input: MarketCandle[]) {
  const candles = [...input].sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    const prices = [candle.open, candle.high, candle.low, candle.close];
    if (!Number.isSafeInteger(candle.timestamp) || candle.timestamp <= 0 || prices.some((price) => !Number.isFinite(price) || price <= 0)) {
      throw new Error("Bitget candle history contains an invalid timestamp or price.");
    }
    if (candle.high < Math.max(candle.open, candle.close, candle.low) || candle.low > Math.min(candle.open, candle.close, candle.high)) {
      throw new Error("Bitget candle history contains inconsistent OHLC values.");
    }
    if ((candle.volume !== null && (!Number.isFinite(candle.volume) || candle.volume < 0)) || (candle.turnover !== null && (!Number.isFinite(candle.turnover) || candle.turnover < 0))) {
      throw new Error("Bitget candle history contains invalid volume data.");
    }
    if (i > 0 && candle.timestamp <= candles[i - 1].timestamp) {
      throw new Error("Bitget candle history contains duplicate timestamps.");
    }
  }
  return candles;
}

function candleDuration(interval: CandleInterval) {
  return interval === "1H" ? 60 * 60 * 1000 : interval === "4H" ? 4 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

/** Return the exact validated data set eligible for a historical replay. */
export function prepareBacktestCandles(input: MarketCandle[], interval: CandleInterval, asOf = Date.now()) {
  const duration = candleDuration(interval);
  for (const candle of input) {
    if (!Number.isSafeInteger(candle.timestamp) || candle.timestamp <= 0) {
      throw new Error("Bitget candle history contains an invalid timestamp or price.");
    }
  }
  const completed = input.filter((candle) => candle.timestamp + duration <= asOf);
  return validateCandles(completed);
}

function movingAverages(candles: MarketCandle[], window: number) {
  const values: (number | null)[] = Array(candles.length).fill(null);
  let sum = 0;
  for (let i = 0; i < candles.length; i += 1) {
    sum += candles[i].close;
    if (i >= window) sum -= candles[i - window].close;
    if (i >= window - 1) values[i] = sum / window;
  }
  return values;
}

function exponentialAverages(candles: MarketCandle[], window: number) {
  const values: (number | null)[] = Array(candles.length).fill(null);
  if (candles.length < window) return values;
  let average = candles.slice(0, window).reduce((sum, candle) => sum + candle.close, 0) / window;
  values[window - 1] = average;
  const alpha = 2 / (window + 1);
  for (let i = window; i < candles.length; i += 1) {
    average = alpha * candles[i].close + (1 - alpha) * average;
    values[i] = average;
  }
  return values;
}

function relativeStrengthIndex(candles: MarketCandle[], index: number, window = 14) {
  if (index < window) return null;
  let gains = 0;
  let losses = 0;
  for (let i = index - window + 1; i <= index; i += 1) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }
  const averageGain = gains / window;
  const averageLoss = losses / window;
  return averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
}

function averageVolume(candles: MarketCandle[], end: number, window: number) {
  const values = candles.slice(Math.max(0, end - window), end).map((candle) => candle.volume).filter((value): value is number => value !== null && Number.isFinite(value));
  return values.length === window ? values.reduce((sum, value) => sum + value, 0) / window : null;
}

/** Signals are decided from completed candles only and become effective on the next bar. */
export function buildSignals(candles: MarketCandle[], key: StrategyKey): boolean[] {
  const out = Array(candles.length).fill(false) as boolean[];
  if (key === "sma_trend_v1") {
    const fast = movingAverages(candles, 20);
    const slow = movingAverages(candles, 50);
    return candles.map((_, index) => fast[index] !== null && slow[index] !== null && (fast[index] as number) > (slow[index] as number));
  }

  const ema20 = key === "trend_pullback_v1" || key === "semi_breakout_v1" ? exponentialAverages(candles, 20) : [];
  const ema50 = key === "trend_pullback_v1" || key === "semi_breakout_v1" ? exponentialAverages(candles, 50) : [];
  let held = false;
  for (let i = 1; i < candles.length; i += 1) {
    const candle = candles[i];
    if (key === "rsi_reversion_v1" && i >= 14) {
      const rsi = relativeStrengthIndex(candles, i);
      if (rsi !== null && rsi <= 30) held = true;
      else if (rsi !== null && rsi >= 55) held = false;
    } else if (key === "channel_breakout_v1" && i >= 20) {
      const priorHigh = Math.max(...candles.slice(i - 20, i).map((item) => item.high));
      const priorLow = Math.min(...candles.slice(i - 10, i).map((item) => item.low));
      if (candle.close > priorHigh) held = true;
      else if (candle.close < priorLow) held = false;
    } else if (key === "weekend_drift_v1") {
      const day = new Date(candle.timestamp).getUTCDay();
      const weekend = day === 0 || day === 6;
      const start = Math.max(0, i - 6);
      const return6 = candle.close / candles[start].close - 1;
      if (weekend && return6 >= 0.015) held = true;
      else if (!weekend || return6 < 0) held = false;
    } else if (key === "trend_pullback_v1" && i >= 51) {
      const currentRsi = relativeStrengthIndex(candles, i);
      const priorRsi = relativeStrengthIndex(candles, i - 1);
      const volumeMean = averageVolume(candles, i, 20);
      const trendUp = ema20[i] !== null && ema50[i] !== null && ema20[i]! > ema50[i]! && ema50[i]! > ema50[i - 1]!;
      const pullbackHeld = ema20[i] !== null && candle.low <= ema20[i]! * 1.01 && candle.close >= ema50[i]!;
      const cooledAndTurned = currentRsi !== null && priorRsi !== null && priorRsi <= 58 && currentRsi > priorRsi && currentRsi >= 45 && currentRsi <= 65;
      const participation = volumeMean !== null && candle.volume !== null && candle.volume >= volumeMean * 0.7;
      const bullishClose = candle.close > candle.open;
      if (!held && trendUp && pullbackHeld && cooledAndTurned && participation && bullishClose) held = true;
      else if (held && (ema20[i] === null || candle.close < ema20[i]! || (currentRsi !== null && currentRsi < 40))) held = false;
    } else if (key === "semi_breakout_v1" && i >= 51) {
      const currentRsi = relativeStrengthIndex(candles, i);
      const volumeMean = averageVolume(candles, i, 20);
      const priorHigh = Math.max(...candles.slice(i - 20, i).map((item) => item.high));
      const range = candle.high - candle.low;
      const bodyQuality = range > 0 ? (candle.close - candle.open) / range : 0;
      const trendUp = ema20[i] !== null && ema50[i] !== null && ema20[i]! > ema50[i]! && candle.close > ema50[i]!;
      const volumeConfirm = volumeMean !== null && candle.volume !== null && candle.volume >= volumeMean * 1.15;
      const momentumInRange = currentRsi !== null && currentRsi >= 50 && currentRsi <= 72;
      if (!held && trendUp && candle.close > priorHigh && volumeConfirm && bodyQuality >= 0.6 && momentumInRange) held = true;
      else if (held && (ema20[i] === null || candle.close < ema20[i]!)) held = false;
    }
    out[i] = held;
  }
  return out;
}
function intervalBarsPerYear(interval: CandleInterval) {
  return interval === "1H" ? 8760 : interval === "4H" ? 2190 : 365;
}

function measure(candles: MarketCandle[], fast: (number | null)[], slow: (number | null)[], start: number, end: number, interval: CandleInterval, feeBps: number = BACKTEST_PARAMETERS.feeBpsPerSide, slippageBps: number = BACKTEST_PARAMETERS.slippageBpsPerSide, signals?: boolean[]): BacktestMetrics {
  const cost = (feeBps + slippageBps) / 10_000;
  let cash: number = BACKTEST_PARAMETERS.initialEquity;
  let quantity = 0;
  let entryPrice = 0;
  let entryTime = 0;
  let peak = cash;
  let maxDrawdown = 0;
  let trades = 0;
  let wins = 0;
  let firstClose: number | null = null;
  let priorEquity = cash;
  const periodReturns: number[] = [];
  const tradeLog: BacktestMetrics["tradeLog"] = [];
  const equityCurve: BacktestMetrics["equityCurve"] = [];

  for (let i = start; i < end; i += 1) {
    if (firstClose === null) firstClose = candles[i].close;
    const hasSignal = i > 0 && (signals ? signals[i - 1] === true : fast[i - 1] !== null && slow[i - 1] !== null && (fast[i - 1] as number) > (slow[i - 1] as number));
    if (quantity === 0 && hasSignal) {
      entryPrice = candles[i].open;
      entryTime = candles[i].timestamp;
      quantity = cash / (entryPrice * (1 + cost));
      cash = 0;
    } else if (quantity > 0 && !hasSignal) {
      const exitPrice = candles[i].open;
      cash = quantity * exitPrice * (1 - cost);
      const tradeReturn = entryPrice > 0 ? ((exitPrice * (1 - cost)) / (entryPrice * (1 + cost)) - 1) : 0;
      tradeLog.push({ entryTime, exitTime: candles[i].timestamp, entryPrice, exitPrice, returnPct: tradeReturn * 100 });
      trades += 1;
      if (tradeReturn > 0) wins += 1;
      quantity = 0;
    }
    const equity = cash + quantity * candles[i].close;
    periodReturns.push(priorEquity > 0 ? equity / priorEquity - 1 : 0);
    priorEquity = equity;
    equityCurve.push({ timestamp: candles[i].timestamp, equity });
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - equity) / peak : 0);
  }

  if (quantity > 0 && end > start) {
    const exitPrice = candles[end - 1].close;
    cash = quantity * exitPrice * (1 - cost);
    const tradeReturn = entryPrice > 0 ? ((exitPrice * (1 - cost)) / (entryPrice * (1 + cost)) - 1) : 0;
    tradeLog.push({ entryTime, exitTime: candles[end - 1].timestamp, entryPrice, exitPrice, returnPct: tradeReturn * 100 });
    trades += 1;
    if (tradeReturn > 0) wins += 1;
    quantity = 0;
    if (periodReturns.length) periodReturns[periodReturns.length - 1] = priorEquity > 0 ? cash / priorEquity - 1 : 0;
    if (equityCurve.length) equityCurve[equityCurve.length - 1].equity = cash;
    peak = Math.max(peak, cash);
    maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - cash) / peak : 0);
  }

  const endingEquity = cash;
  const totalReturn = endingEquity / BACKTEST_PARAMETERS.initialEquity - 1;
  const buyAndHold = firstClose && end > start
    ? (candles[end - 1].close * (1 - cost)) / (firstClose * (1 + cost)) - 1
    : 0;
  const mean = periodReturns.length ? periodReturns.reduce((sum, value) => sum + value, 0) / periodReturns.length : 0;
  const variance = periodReturns.length ? periodReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / periodReturns.length : 0;
  const deviation = Math.sqrt(variance);
  const sharpe = deviation > 0 ? (mean / deviation) * Math.sqrt(intervalBarsPerYear(interval)) : null;
  const downside = periodReturns.filter((value) => value < 0);
  const downsideDeviation = Math.sqrt(downside.length ? downside.reduce((sum, value) => sum + value ** 2, 0) / periodReturns.length : 0);
  const sortino = downsideDeviation > 0 ? (mean / downsideDeviation) * Math.sqrt(intervalBarsPerYear(interval)) : null;

  return {
    totalReturnPct: totalReturn * 100,
    buyAndHoldReturnPct: buyAndHold * 100,
    maxDrawdownPct: maxDrawdown * 100,
    sharpeRatio: sharpe !== null && Number.isFinite(sharpe) ? sharpe : null,
    sortinoRatio: sortino !== null && Number.isFinite(sortino) ? sortino : null,
    trades,
    winRatePct: trades ? (wins / trades) * 100 : null,
    endingEquity,
    candles: Math.max(0, end - start),
    tradeLog,
    equityCurve,
  };
}

export function runBacktest(symbol: string, interval: CandleInterval, input: MarketCandle[], asOf = Date.now(), strategyKey: StrategyKey = BACKTEST_STRATEGY): BacktestResult {
  const candles = prepareBacktestCandles(input, interval, asOf);
  if (candles.length < 80) throw new Error("At least 80 Bitget candles are required to evaluate a 50-period strategy with an out-of-sample window.");
  const splitIndex = Math.floor(candles.length * BACKTEST_PARAMETERS.trainFraction);
  if (splitIndex < BACKTEST_PARAMETERS.slowWindow + 5 || candles.length - splitIndex < 20) throw new Error("This candle history is too short for a meaningful chronological holdout.");
  const fast = movingAverages(candles, BACKTEST_PARAMETERS.fastWindow);
  const slow = movingAverages(candles, BACKTEST_PARAMETERS.slowWindow);
  const signals = buildSignals(candles, strategyKey);
  const day = 24 * 60 * 60 * 1000;
  if (candles.at(-1)!.timestamp - candles[0].timestamp < 60 * day) throw new Error("Bitget returned less than 60 days of candles. Choose a longer interval; this run cannot meet the Alpha Factory window requirement.");
  if (candles.at(-1)!.timestamp - candles[splitIndex].timestamp < 30 * day) throw new Error("The chronological holdout is shorter than 30 days. This market history is insufficient for the Alpha Factory window requirement.");
  const warmup = BACKTEST_PARAMETERS.slowWindow;
  if (candles[splitIndex - 1].timestamp - candles[warmup].timestamp < 30 * day) throw new Error("The evaluated training window is shorter than 30 days after the 50-candle warm-up. Choose a history with more data.");
  const train = measure(candles, fast, slow, warmup, splitIndex, interval, BACKTEST_PARAMETERS.feeBpsPerSide, BACKTEST_PARAMETERS.slippageBpsPerSide, signals);
  const test = measure(candles, fast, slow, splitIndex, candles.length, interval, BACKTEST_PARAMETERS.feeBpsPerSide, BACKTEST_PARAMETERS.slippageBpsPerSide, signals);
  return {
    symbol,
    interval,
    strategyKey,
    parameters: { ...BACKTEST_PARAMETERS, strategyLabel: ALPHA_STRATEGIES[strategyKey].label },
    train,
    test,
    dataStart: candles[0].timestamp,
    dataEnd: candles.at(-1)!.timestamp,
    candleCount: candles.length,
    splitIndex,
  };
}

/** Three disjoint trailing evaluation windows, each using only earlier candles to warm the rule. */
export function runWalkForward(symbol: string, interval: CandleInterval, input: MarketCandle[], asOf = Date.now(), strategyKey: StrategyKey = BACKTEST_STRATEGY): WalkForwardResult {
  const candles = prepareBacktestCandles(input, interval, asOf);
  const fast = movingAverages(candles, BACKTEST_PARAMETERS.fastWindow);
  const slow = movingAverages(candles, BACKTEST_PARAMETERS.slowWindow);
  const signals = buildSignals(candles, strategyKey);
  const warmup = BACKTEST_PARAMETERS.slowWindow;
  const foldSize = Math.floor((candles.length - warmup) / 4);
  if (foldSize < 60) throw new Error("Walk-forward validation needs at least 60 completed candles in each evaluation window.");
  const firstTest = candles.length - foldSize * 3;
  const folds: WalkForwardFold[] = [];
  for (let index = 0; index < 3; index += 1) {
    const testStart = firstTest + index * foldSize;
    const testEnd = index === 2 ? candles.length : testStart + foldSize;
    if (testStart - warmup < 60) throw new Error("Walk-forward validation needs at least 60 earlier candles before every evaluation window.");
    folds.push({ index: index + 1, trainStart: candles[warmup].timestamp, testStart: candles[testStart].timestamp, testEnd: candles[testEnd - 1].timestamp, metrics: measure(candles, fast, slow, testStart, testEnd, interval, BACKTEST_PARAMETERS.feeBpsPerSide, BACKTEST_PARAMETERS.slippageBpsPerSide, signals) });
  }
  const meanReturnPct = folds.reduce((sum, fold) => sum + fold.metrics.totalReturnPct, 0) / folds.length;
  return { folds, meanReturnPct, positiveFolds: folds.filter((fold) => fold.metrics.totalReturnPct > 0).length, totalFolds: folds.length, evaluationStart: folds[0].testStart, evaluationEnd: folds.at(-1)!.testEnd };
}

/** Stress the same fixed holdout under higher execution-cost assumptions. */
export function runCostSensitivity(symbol: string, interval: CandleInterval, input: MarketCandle[], asOf = Date.now(), strategyKey: StrategyKey = BACKTEST_STRATEGY) {
  const candles = prepareBacktestCandles(input, interval, asOf);
  if (candles.length < 80) throw new Error("Cost sensitivity needs at least 80 completed candles.");
  const splitIndex = Math.floor(candles.length * BACKTEST_PARAMETERS.trainFraction);
  const fast = movingAverages(candles, BACKTEST_PARAMETERS.fastWindow);
  const slow = movingAverages(candles, BACKTEST_PARAMETERS.slowWindow);
  const signals = buildSignals(candles, strategyKey);
  return [
    { label: "Base", feeBpsPerSide: 10, slippageBpsPerSide: 5 },
    { label: "Elevated", feeBpsPerSide: 15, slippageBpsPerSide: 10 },
    { label: "Stress", feeBpsPerSide: 25, slippageBpsPerSide: 25 },
  ].map((scenario) => ({ ...scenario, returnPct: measure(candles, fast, slow, splitIndex, candles.length, interval, scenario.feeBpsPerSide, scenario.slippageBpsPerSide, signals).totalReturnPct }));
}
