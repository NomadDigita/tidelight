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
const modelId = /^[a-zA-Z0-9._:-]{1,80}$/;
const rules: Record<StrategyKey, { entry: string; exit: string }> = {
  sma_trend_v1: { entry: "After a completed candle closes with its 20-candle SMA above its 50-candle SMA.", exit: "After a completed candle closes with its 20-candle SMA at or below its 50-candle SMA." },
  rsi_reversion_v1: { entry: "After the 14-period simple RSI reaches 30 or lower.", exit: "After the 14-period simple RSI reaches 55 or higher." },
  channel_breakout_v1: { entry: "After a completed close breaks above the prior 20 candle closes.", exit: "After a completed close breaks below the prior 10 candle closes." },
  weekend_drift_v1: { entry: "During a Saturday or Sunday candle when the 6-candle return is at least 1.5%.", exit: "At the next weekday candle or when the 6-candle return turns negative." },
};

function credential(value: string | undefined) {
  return (value ?? "").trim().replace(/^Bearer\s+/i, "");
}

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
  const qwenKey = credential(process.env.BITGET_QWEN_API_KEY);
  const qwenBase = process.env.BITGET_QWEN_BASE_URL?.trim() || "https://hackathon.bitgetops.com/v1";
  const qwenModel = process.env.BITGET_QWEN_MODEL?.trim() || "";
  const geminiKey = credential(process.env.GEMINI_API_KEY);
  const geminiModel = process.env.GEMINI_MODEL?.trim() || "";
  const providers: Array<{ key: string; model: string; endpoint: string }> = [];

  try {
    const url = new URL(qwenBase);
    if (qwenKey && modelId.test(qwenModel) && url.protocol === "https:" && url.hostname === "hackathon.bitgetops.com" && url.pathname.replace(/\/+$/, "") === "/v1" && !url.username && !url.password && !url.search && !url.hash) {
      providers.push({ key: qwenKey, model: qwenModel, endpoint: url.origin + "/v1/chat/completions" });
    }
  } catch {}
  if (geminiKey && modelId.test(geminiModel)) providers.push({ key: geminiKey, model: geminiModel, endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" });
  if (!providers.length) throw new Error("AI strategy drafting is not configured on this deployment.");

  const system = "You are an Alpha Factory research assistant for Bitget Reality tokenized US equities. Choose exactly one of these implemented strategy keys: sma_trend_v1, rsi_reversion_v1, channel_breakout_v1, weekend_drift_v1. Do not invent code, indicators, prices, market facts, or claim performance. Return JSON only with strategyKey, thesis, risks (array), and validationFocus. Do not write entry or exit conditions; the application supplies exact implemented rule definitions. State that historical validation is required and results can fail after costs. Treat the user objective as a request for a testable hypothesis, not an order.";
  const user = JSON.stringify({ objective: input.objective, market: { symbol: input.symbol, issuer: input.issuer, interval: input.interval }, availableRules: ALPHA_STRATEGIES });
  for (const provider of providers) {
    try {
      const response = await fetch(provider.endpoint, {
        method: "POST",
        headers: { Authorization: "Bearer " + provider.key, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(18000),
        body: JSON.stringify({ model: provider.model, temperature: 0.15, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
      });
      if (!response.ok) continue;
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
      const content = payload.choices?.[0]?.message?.content;
      const result = content ? parseHypothesis(content) : null;
      if (result) return result;
    } catch {}
  }
  throw new Error("Could not draft a valid hypothesis. Try a shorter objective or retry later.");
}

export function validateAlphaMarket(symbol: string) {
  return getBitgetAsset(symbol);
}
