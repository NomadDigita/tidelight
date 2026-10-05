import type { CandleInterval, MarketCandle } from "@/lib/bitget-market";

export const BACKTEST_STRATEGY = "sma_trend_v1" as const;
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
  strategyKey: typeof BACKTEST_STRATEGY;
  parameters: typeof BACKTEST_PARAMETERS;
  train: BacktestMetrics;
  test: BacktestMetrics;
  dataStart: number;
  dataEnd: number;
  candleCount: number;
  splitIndex: number;
};

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

function intervalBarsPerYear(interval: CandleInterval) {
  return interval === "1H" ? 8760 : interval === "4H" ? 2190 : 365;
}

function measure(candles: MarketCandle[], fast: (number | null)[], slow: (number | null)[], start: number, end: number, interval: CandleInterval): BacktestMetrics {
  const cost = (BACKTEST_PARAMETERS.feeBpsPerSide + BACKTEST_PARAMETERS.slippageBpsPerSide) / 10_000;
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
    const hasSignal = i > 0 && fast[i - 1] !== null && slow[i - 1] !== null && (fast[i - 1] as number) > (slow[i - 1] as number);
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

export function runBacktest(symbol: string, interval: CandleInterval, input: MarketCandle[], asOf = Date.now()): BacktestResult {
  const candles = prepareBacktestCandles(input, interval, asOf);
  if (candles.length < 80) throw new Error("At least 80 Bitget candles are required to evaluate a 50-period strategy with an out-of-sample window.");
  const splitIndex = Math.floor(candles.length * BACKTEST_PARAMETERS.trainFraction);
  if (splitIndex < BACKTEST_PARAMETERS.slowWindow + 5 || candles.length - splitIndex < 20) throw new Error("This candle history is too short for a meaningful chronological holdout.");
  const fast = movingAverages(candles, BACKTEST_PARAMETERS.fastWindow);
  const slow = movingAverages(candles, BACKTEST_PARAMETERS.slowWindow);
  const day = 24 * 60 * 60 * 1000;
  if (candles.at(-1)!.timestamp - candles[0].timestamp < 60 * day) throw new Error("Bitget returned less than 60 days of candles. Choose a longer interval; this run cannot meet the Alpha Factory window requirement.");
  if (candles.at(-1)!.timestamp - candles[splitIndex].timestamp < 30 * day) throw new Error("The chronological holdout is shorter than 30 days. This market history is insufficient for the Alpha Factory window requirement.");
  const warmup = BACKTEST_PARAMETERS.slowWindow;
  if (candles[splitIndex - 1].timestamp - candles[warmup].timestamp < 30 * day) throw new Error("The evaluated training window is shorter than 30 days after the 50-candle warm-up. Choose a history with more data.");
  const train = measure(candles, fast, slow, warmup, splitIndex, interval);
  const test = measure(candles, fast, slow, splitIndex, candles.length, interval);
  return {
    symbol,
    interval,
    strategyKey: BACKTEST_STRATEGY,
    parameters: BACKTEST_PARAMETERS,
    train,
    test,
    dataStart: candles[0].timestamp,
    dataEnd: candles.at(-1)!.timestamp,
    candleCount: candles.length,
    splitIndex,
  };
}
