import { aiJsonWithFallback } from "@/lib/ai-fallback";
import { ALPHA_STRATEGIES, type StrategyKey } from "@/lib/backtest";
import { getBitgetAsset } from "@/lib/bitget-market";

export type AlphaHypothesis = {
  strategyKey: StrategyKey;
  thesis: string;
  entryConditions: string[];
  exitConditions: string[];
  risks: string[];
  validationFocus: string;
};

const validKeys = new Set<StrategyKey>(Object.keys(ALPHA_STRATEGIES) as StrategyKey[]);
const rules: Record<StrategyKey, { entry: string; exit: string }> = {
  sma_trend_v1: { entry: "After a completed candle closes with its 20-candle SMA above its 50-candle SMA.", exit: "After a completed candle closes with its 20-candle SMA at or below its 50-candle SMA." },
  rsi_reversion_v1: { entry: "After the 14-period simple RSI reaches 30 or lower.", exit: "After the 14-period simple RSI reaches 55 or higher." },
  channel_breakout_v1: { entry: "After a completed close breaks above the prior 20 candle closes.", exit: "After a completed close breaks below the prior 10 candle closes." },
  weekend_drift_v1: { entry: "During a Saturday or Sunday candle when the 6-candle return is at least 1.5%.", exit: "At the next weekday candle or when the 6-candle return turns negative." },
  trend_pullback_v1: { entry: "After a completed bullish candle holds above the rising EMA50, the EMA20 is above EMA50, price tests the EMA20, RSI turns upward within 45–65, and volume remains at least 70% of its prior 20-candle average.", exit: "After a completed candle closes below EMA20 or the 14-period RSI falls below 40." },
  semi_breakout_v1: { entry: "After a completed close breaks the prior 20-candle high while EMA20 is above EMA50, volume is at least 1.15× its prior 20-candle average, candle body is at least 60% of its range, and RSI is 50–72.", exit: "After a completed candle closes below EMA20." },
};

function parseHypothesis(content: string): AlphaHypothesis | null {
  try {
    const parsed = JSON.parse(content.trim()) as Record<string, unknown>;
    const key = typeof parsed.strategyKey === "string" ? parsed.strategyKey as StrategyKey : null;
    if (!key || !validKeys.has(key)) return null;
    const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
    const list = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 4).map((item) => item.trim().slice(0, 180)).filter(Boolean) : [];
    const thesis = text(parsed.thesis, 420);
    const validationFocus = text(parsed.validationFocus, 300);
    if (thesis.length < 20 || !validationFocus) return null;
    return { strategyKey: key, thesis, validationFocus, entryConditions: [rules[key].entry], exitConditions: [rules[key].exit], risks: list(parsed.risks) };
  } catch {
    return null;
  }
}

export async function draftAlphaHypothesis(input: { objective: string; symbol: string; issuer: string; interval: string }): Promise<AlphaHypothesis> {
  const system = "You are an Alpha Factory research assistant for Bitget Reality tokenized US equities. Choose exactly one implemented strategy key from the supplied list. Do not invent code, indicators, prices, market facts, or claim performance. These rules test one rToken at a time; do not claim cross-asset ranking or sector rotation. Return JSON only with strategyKey, thesis, risks (array), and validationFocus. Do not write entry or exit conditions; the application supplies exact implemented rule definitions. State that historical validation is required and results can fail after costs. Treat the user objective as a testable hypothesis, not an order.";
  const user = JSON.stringify({ objective: input.objective, market: { symbol: input.symbol, issuer: input.issuer, interval: input.interval }, availableRules: ALPHA_STRATEGIES });
  if (!process.env.BITGET_QWEN_API_KEY && !process.env.GEMINI_API_KEY) throw new Error("AI strategy drafting is not configured on this deployment.");
  const result = await aiJsonWithFallback([{ role: "system", content: system }, { role: "user", content: user }], value => Boolean(parseHypothesis(JSON.stringify(value))), { budgetMs: 38000 });
  return parseHypothesis(JSON.stringify(result))!;
}

export function validateAlphaMarket(symbol: string) {
  return getBitgetAsset(symbol);
}
