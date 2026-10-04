export type NightwatchSignal = "buy" | "sell" | "hold";

export type SmaCrossover = {
  signal: NightwatchSignal;
  fastSma: number;
  slowSma: number;
  previousFastSma: number;
  previousSlowSma: number;
};

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function evaluateSmaCrossover(closes: number[]): SmaCrossover {
  if (closes.length < 51) throw new Error("At least 51 completed candles are required.");
  if (closes.some((close) => !Number.isFinite(close) || close <= 0)) throw new Error("Candle closes must be positive finite prices.");
  const fastSma = mean(closes.slice(-20));
  const slowSma = mean(closes.slice(-50));
  const previousFastSma = mean(closes.slice(-21, -1));
  const previousSlowSma = mean(closes.slice(-51, -1));
  const signal = previousFastSma <= previousSlowSma && fastSma > slowSma
    ? "buy"
    : previousFastSma >= previousSlowSma && fastSma < slowSma
      ? "sell"
      : "hold";
  return { signal, fastSma, slowSma, previousFastSma, previousSlowSma };
}
