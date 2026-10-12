export type IntelligenceStage = {
  id: string;
  agent: string;
  status: "running" | "complete" | "blocked";
  title: string;
  detail: string;
  at: string;
  asset?: string;
};

export type IntelligenceCandle = { timestamp: number; close: number };
export type IntelligenceSource = { title: string; url: string; publisher: string; publishedAt: string | null; via?: "Public feeds" | "AgentKey" };
export type IntelligenceCatalyst = { title: string; date: string | null; sourceUrl: string };
export type IntelligenceBacktest = { strategy: string; interval: string; candleCount: number; dataStart: string; dataEnd: string; testReturnPct: number; buyAndHoldReturnPct: number; maxDrawdownPct: number; trades: number };
export type IntelligenceDestination = { mode: "paper_futures" | "live_spot"; label: string; href: string };
export type IntelligenceAsset = {
  ticker: string;
  issuer: string;
  summary: string;
  stance: "bullish" | "bearish" | "mixed" | "unclear";
  confidence: number;
  tradeable: boolean;
  gateReasons: string[];
  sources: IntelligenceSource[];
  market: { perpSymbol: string | null; spotSymbol: string | null; lastPrice: number | null; providerTimestamp?: number | null; interval?: string; candles?: IntelligenceCandle[] };
  handoff: { destinations: IntelligenceDestination[]; reason: string } | null;
  risks?: string[];
  nextCheck?: string;
  catalysts?: IntelligenceCatalyst[];
  portfolioExposure?: { symbol: string; exposurePct: number; capturedAt: string } | null;
  historicalBacktest?: IntelligenceBacktest | null;
};
export type IntelligenceResult = {
  researchRunId: string;
  question: string;
  assets: IntelligenceAsset[];
  tradeable: boolean;
  trace: IntelligenceStage[];
  contextRunId?: string | null;
};

export type IntelligenceBlock =
  | { id: "activity"; type: "activity"; title: string }
  | { id: "comparison"; type: "comparison"; title: string; assets: IntelligenceAsset[] }
  | { id: "charts"; type: "charts"; title: string; assets: IntelligenceAsset[] }
  | { id: "evidence"; type: "evidence"; title: string; assets: IntelligenceAsset[] }
  | { id: "scenarios"; type: "scenarios"; title: string; assets: IntelligenceAsset[] }
  | { id: "catalysts"; type: "catalysts"; title: string; assets: IntelligenceAsset[] }
  | { id: "exposure"; type: "exposure"; title: string; assets: IntelligenceAsset[] }
  | { id: "backtests"; type: "backtests"; title: string; assets: IntelligenceAsset[] }
  | { id: "risk"; type: "risk"; title: string; assets: IntelligenceAsset[] }
  | { id: "actions"; type: "actions"; title: string; assets: IntelligenceAsset[] };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isText = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const isNullableNumber = (value: unknown) => value === null || (typeof value === "number" && Number.isFinite(value));
const validUrl = (value: unknown) => {
  if (typeof value !== "string" || value.length > 2048) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

/** Validate untrusted persisted/provider JSON before it reaches the trusted component registry. */
export function parseIntelligenceResult(value: unknown): IntelligenceResult | null {
  if (!isRecord(value) || !isText(value.researchRunId, 80) || !isText(value.question, 500) || !Array.isArray(value.assets) || value.assets.length < 1 || value.assets.length > 3 || !Array.isArray(value.trace) || value.trace.length > 60 || typeof value.tradeable !== "boolean") return null;
  const assets: IntelligenceAsset[] = [];
  for (const raw of value.assets) {
    if (!isRecord(raw) || !isText(raw.ticker, 16) || !/^[A-Z0-9.]{1,16}$/.test(raw.ticker as string) || !isText(raw.issuer, 120) || !isText(raw.summary, 900) || !["bullish", "bearish", "mixed", "unclear"].includes(String(raw.stance)) || typeof raw.confidence !== "number" || !Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1 || typeof raw.tradeable !== "boolean" || !Array.isArray(raw.gateReasons) || raw.gateReasons.length > 12 || !Array.isArray(raw.sources) || raw.sources.length > 20 || !isRecord(raw.market)) return null;
    if (!raw.gateReasons.every((reason) => isText(reason, 500))) return null;
    const sources: IntelligenceSource[] = [];
    for (const item of raw.sources) {
      if (!isRecord(item) || !isText(item.title, 300) || !validUrl(item.url) || !isText(item.publisher, 120) || !(item.publishedAt === null || (typeof item.publishedAt === "string" && Number.isFinite(Date.parse(item.publishedAt))))) return null;
      sources.push({ title: item.title as string, url: item.url as string, publisher: item.publisher as string, publishedAt: item.publishedAt as string | null, ...(item.via === "AgentKey" || item.via === "Public feeds" ? { via: item.via as IntelligenceSource["via"] } : {}) });
    }
    const market = raw.market;
    if (!(market.perpSymbol === null || isText(market.perpSymbol, 32)) || !(market.spotSymbol === null || isText(market.spotSymbol, 32)) || !isNullableNumber(market.lastPrice) || (typeof market.lastPrice === "number" && market.lastPrice <= 0) || !isNullableNumber(market.providerTimestamp) || (typeof market.providerTimestamp === "number" && market.providerTimestamp <= 0)) return null;
    let candles: IntelligenceCandle[] | undefined;
    if (market.candles !== undefined) {
      if (!Array.isArray(market.candles) || market.candles.length > 36) return null;
      candles = [];
      for (const candle of market.candles) {
        if (!isRecord(candle) || typeof candle.timestamp !== "number" || !Number.isSafeInteger(candle.timestamp) || candle.timestamp <= 0 || typeof candle.close !== "number" || !Number.isFinite(candle.close) || candle.close <= 0) return null;
        candles.push({ timestamp: candle.timestamp, close: candle.close });
      }
    }
    let handoff: IntelligenceAsset["handoff"] = null;
    if (raw.handoff !== null) {
      if (!isRecord(raw.handoff) || !Array.isArray(raw.handoff.destinations) || !isText(raw.handoff.reason, 500)) return null;
      const destinations: IntelligenceDestination[] = [];
      for (const destination of raw.handoff.destinations) {
        if (!isRecord(destination) || !["paper_futures", "live_spot"].includes(String(destination.mode)) || !isText(destination.label, 100) || !isText(destination.href, 250) || !(destination.href as string).startsWith("/")) return null;
        destinations.push({ mode: destination.mode as IntelligenceDestination["mode"], label: destination.label as string, href: destination.href as string });
      }
      handoff = { destinations, reason: raw.handoff.reason as string };
    }
    if (raw.tradeable !== (handoff !== null)) return null;
    const catalysts = Array.isArray(raw.catalysts) ? raw.catalysts.flatMap((item) => {
      if (!isRecord(item) || !isText(item.title, 180) || !validUrl(item.sourceUrl) || !(item.date === null || (typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isFinite(Date.parse(`${item.date}T00:00:00Z`)) && new Date(`${item.date}T00:00:00Z`).toISOString().slice(0, 10) === item.date)) || !sources.some((source) => source.url === item.sourceUrl)) return [];
      return [{ title: item.title as string, date: item.date as string | null, sourceUrl: item.sourceUrl as string }];
    }).slice(0, 5) : [];
    let portfolioExposure: IntelligenceAsset["portfolioExposure"];
    if (raw.portfolioExposure === null) portfolioExposure = null;
    else if (isRecord(raw.portfolioExposure) && isText(raw.portfolioExposure.symbol, 32) && typeof raw.portfolioExposure.exposurePct === "number" && Number.isFinite(raw.portfolioExposure.exposurePct) && raw.portfolioExposure.exposurePct >= 0 && raw.portfolioExposure.exposurePct <= 100 && typeof raw.portfolioExposure.capturedAt === "string" && Number.isFinite(Date.parse(raw.portfolioExposure.capturedAt))) {
      portfolioExposure = { symbol: raw.portfolioExposure.symbol as string, exposurePct: raw.portfolioExposure.exposurePct, capturedAt: raw.portfolioExposure.capturedAt };
    }
    let historicalBacktest: IntelligenceAsset["historicalBacktest"];
    const backtest = raw.historicalBacktest;
    if (backtest === null) historicalBacktest = null;
    else if (isRecord(backtest) && isText(backtest.strategy, 100) && isText(backtest.interval, 8) && Number.isInteger(backtest.candleCount) && (backtest.candleCount as number) >= 80 && typeof backtest.dataStart === "string" && Number.isFinite(Date.parse(backtest.dataStart)) && typeof backtest.dataEnd === "string" && Number.isFinite(Date.parse(backtest.dataEnd)) && [backtest.testReturnPct, backtest.buyAndHoldReturnPct, backtest.maxDrawdownPct].every((number) => typeof number === "number" && Number.isFinite(number)) && Number.isInteger(backtest.trades) && (backtest.trades as number) >= 0) {
      historicalBacktest = { strategy: backtest.strategy as string, interval: backtest.interval as string, candleCount: backtest.candleCount as number, dataStart: backtest.dataStart as string, dataEnd: backtest.dataEnd as string,
        testReturnPct: backtest.testReturnPct as number, buyAndHoldReturnPct: backtest.buyAndHoldReturnPct as number, maxDrawdownPct: backtest.maxDrawdownPct as number, trades: backtest.trades as number };
    }
    assets.push({ ticker: raw.ticker as string, issuer: raw.issuer as string, summary: raw.summary as string, stance: raw.stance as IntelligenceAsset["stance"], confidence: raw.confidence as number,
      tradeable: raw.tradeable, gateReasons: raw.gateReasons as string[], sources, market: { perpSymbol: market.perpSymbol as string | null, spotSymbol: market.spotSymbol as string | null, lastPrice: market.lastPrice as number | null,
        ...(typeof market.providerTimestamp === "number" ? { providerTimestamp: market.providerTimestamp } : {}), ...(typeof market.interval === "string" ? { interval: market.interval.slice(0, 8) } : {}), ...(candles ? { candles } : {}) }, handoff,
      risks: Array.isArray(raw.risks) ? raw.risks.filter((risk): risk is string => isText(risk, 250)).slice(0, 8) : [], nextCheck: isText(raw.nextCheck, 250) ? raw.nextCheck as string : undefined,
      catalysts, ...(portfolioExposure !== undefined ? { portfolioExposure } : {}), ...(historicalBacktest !== undefined ? { historicalBacktest } : {}) });
  }
  const trace: IntelligenceStage[] = [];
  for (const raw of value.trace) {
    if (!isRecord(raw) || !isText(raw.id, 80) || !isText(raw.agent, 80) || !["running", "complete", "blocked"].includes(String(raw.status)) || !isText(raw.title, 180) || !isText(raw.detail, 700) || typeof raw.at !== "string" || !Number.isFinite(Date.parse(raw.at))) return null;
    trace.push({ id: raw.id as string, agent: raw.agent as string, status: raw.status as IntelligenceStage["status"], title: raw.title as string, detail: raw.detail as string, at: raw.at as string, ...(isText(raw.asset, 16) ? { asset: raw.asset as string } : {}) });
  }
  if (value.tradeable !== assets.some((asset) => asset.tradeable)) return null;
  return { researchRunId: value.researchRunId as string, question: value.question as string, assets, tradeable: value.tradeable, trace, ...(typeof value.contextRunId === "string" ? { contextRunId: value.contextRunId } : {}) };
}

/** Trusted component registry selection is derived from validated fields, never model-authored component names. */
export function composeIntelligenceBlocks(result: IntelligenceResult): IntelligenceBlock[] {
  return [
    { id: "activity", type: "activity", title: "Agent activity" },
    { id: "comparison", type: "comparison", title: result.assets.length > 1 ? "Company comparison" : "Company read", assets: result.assets },
    ...(result.assets.some((asset) => (asset.market.candles?.length ?? 0) > 1) ? [{ id: "charts" as const, type: "charts" as const, title: "Verified market context", assets: result.assets }] : []),
    ...(result.assets.some((asset) => asset.sources.length) ? [{ id: "evidence" as const, type: "evidence" as const, title: "Evidence trail", assets: result.assets }] : []),
    { id: "scenarios", type: "scenarios", title: "Scenarios & what changes the view", assets: result.assets },
    ...(result.assets.some((asset) => asset.catalysts?.length) ? [{ id: "catalysts" as const, type: "catalysts" as const, title: "Reported catalyst timeline", assets: result.assets }] : []),
    ...(result.assets.some((asset) => asset.portfolioExposure) ? [{ id: "exposure" as const, type: "exposure" as const, title: "Your saved portfolio exposure", assets: result.assets }] : []),
    ...(result.assets.some((asset) => asset.historicalBacktest) ? [{ id: "backtests" as const, type: "backtests" as const, title: "Historical rule replay", assets: result.assets }] : []),
    { id: "risk", type: "risk", title: "Risk gates", assets: result.assets },
    { id: "actions", type: "actions", title: "Continue with Tidelight", assets: result.assets },
  ];
}
