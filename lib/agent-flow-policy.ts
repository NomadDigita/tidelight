export type FlowSource = { title: string; url: string; publisher: string; publishedAt: string | null; via?: "Public feeds" | "AgentKey" };
export type FlowStance = "bullish" | "bearish" | "mixed" | "unclear";
export type FlowAssessment = { summary: string; stance: FlowStance; confidence: number; citedUrls: string[]; risks: string[]; nextCheck: string };
export type FlowGateInput = {
  assessment: FlowAssessment;
  sources: FlowSource[];
  marketVerified: boolean;
  marketTimestamp: number | null;
  lastCompletedCandleEnd: number | null;
  completedCandles: number;
  currentSignal: boolean;
  previousSignal: boolean;
  now: number;
};

const aliases: Record<string, string[]> = {
  NVDA: ["NVIDIA"], TSLA: ["TESLA"], AAPL: ["APPLE"], AMD: ["ADVANCED MICRO DEVICES"],
  MSFT: ["MICROSOFT"], META: ["META PLATFORMS"], AMZN: ["AMAZON"],
  GOOGL: ["ALPHABET", "GOOGLE"], INTC: ["INTEL"], ASML: ["ASML"],
  QCOM: ["QUALCOMM"], MU: ["MICRON"],
};

/** Only supported Bitget stock perpetual underlyings are inferred, not arbitrary tickers. */
export function extractFlowTickers(question: string, supportedContracts: readonly string[], max = 3): string[] {
  const upper = question.toUpperCase();
  const found = new Set<string>();
  for (const contract of supportedContracts) {
    const ticker = contract.slice(0, -4);
    const terms = [ticker, `R${ticker}`, `R${ticker}USDT`, `${ticker}USDT`, ...(aliases[ticker] ?? [])];
    if (terms.some(term => new RegExp(`(^|[^A-Z0-9])${term}([^A-Z0-9]|$)`, "i").test(upper))) found.add(ticker);
  }
  return [...found].slice(0, max);
}

/** An explanation alone cannot unlock a trade destination. */
export function gateFlowTrade(input: FlowGateInput) {
  const reasons: string[] = [];
  const recent = input.sources.filter(source => source.publishedAt &&
    Date.parse(source.publishedAt) <= input.now + 60_000 &&
    input.now - Date.parse(source.publishedAt) <= 7 * 86_400_000);
  const allowed = new Set(recent.map(source => source.url));
  const cited = new Set(input.assessment.citedUrls.filter(url => allowed.has(url)));
  const publishers = new Set(recent.filter(source => cited.has(source.url)).map(source => source.publisher.trim().toLowerCase()).filter(Boolean));
  if (publishers.size < 2 || cited.size < 2) reasons.push("Fewer than two distinct, recent publishers are cited.");
  const validNow = Number.isFinite(input.now) && input.now > 0;
  if (!validNow || !input.marketVerified || !Number.isFinite(input.marketTimestamp) || !input.marketTimestamp || input.marketTimestamp <= 0 || input.now - input.marketTimestamp > 120_000 || input.marketTimestamp > input.now + 60_000) reasons.push("The verified Bitget market price is unavailable or stale.");
  if (!validNow || !Number.isInteger(input.completedCandles) || input.completedCandles < 60 || !Number.isFinite(input.lastCompletedCandleEnd) || !input.lastCompletedCandleEnd || input.lastCompletedCandleEnd <= 0 || input.now - input.lastCompletedCandleEnd > 6 * 3_600_000 || input.lastCompletedCandleEnd > input.now) reasons.push("The completed Bitget candle series is incomplete or stale.");
  if (!Number.isFinite(input.assessment.confidence) || input.assessment.confidence < 0.75 || input.assessment.confidence > 1) reasons.push("Research confidence is below the 75% review threshold.");
  if (input.assessment.stance !== "bullish" && input.assessment.stance !== "bearish") reasons.push("The evidence does not support a directional scenario.");
  const freshLong = input.currentSignal && !input.previousSignal;
  const freshShort = !input.currentSignal && input.previousSignal;
  if ((input.assessment.stance === "bullish" && !freshLong) || (input.assessment.stance === "bearish" && !freshShort)) reasons.push("No fresh Alpha Factory signal agrees with that scenario.");
  return { tradeable: reasons.length === 0, reasons, direction: input.assessment.stance === "bullish" ? "long" as const : input.assessment.stance === "bearish" ? "short" as const : null };
}

export function normalizeFlowAssessment(value: Record<string, unknown>, sources: FlowSource[]): FlowAssessment | null {
  const summary = typeof value.summary === "string" ? value.summary.trim().slice(0, 700) : "";
  const stance = value.stance;
  const confidence = typeof value.confidence === "number" ? value.confidence : NaN;
  if (summary.length < 25 || typeof stance !== "string" || !["bullish", "bearish", "mixed", "unclear"].includes(stance) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  const valid = new Set(sources.map(source => source.url));
  return {
    summary, stance: stance as FlowStance, confidence,
    citedUrls: Array.isArray(value.citedUrls) ? [...new Set(value.citedUrls.filter((url): url is string => typeof url === "string" && valid.has(url)))].slice(0, 6) : [],
    risks: Array.isArray(value.risks) ? value.risks.filter((item): item is string => typeof item === "string").slice(0, 4).map(item => item.slice(0, 200)) : [],
    nextCheck: typeof value.nextCheck === "string" ? value.nextCheck.slice(0, 220) : "Review issuer filings and completed candles.",
  };
}

/** A partial or malformed provider response must allow the next provider to try. */
export function normalizeFlowAssessments(value: Record<string, unknown>, sourcesByTicker: Record<string, FlowSource[]>): Record<string, FlowAssessment> | null {
  const requested = Object.keys(sourcesByTicker);
  if (!requested.length || !Array.isArray(value.assets)) return null;
  const assessments: Record<string, FlowAssessment> = {};
  for (const item of value.assets) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as Record<string, unknown>;
    const ticker = typeof candidate.ticker === "string" ? candidate.ticker.trim().toUpperCase() : "";
    if (!Object.hasOwn(sourcesByTicker, ticker) || Object.hasOwn(assessments, ticker)) continue;
    const normalized = normalizeFlowAssessment(candidate, sourcesByTicker[ticker]);
    if (normalized) assessments[ticker] = normalized;
  }
  return requested.every(ticker => Object.hasOwn(assessments, ticker)) ? assessments : null;
}
