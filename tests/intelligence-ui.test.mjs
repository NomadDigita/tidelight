import test from "node:test";
import assert from "node:assert/strict";
import { composeIntelligenceBlocks, parseIntelligenceResult } from "../lib/intelligence-ui.ts";

const result = {
  researchRunId: "5405bd14-f2a9-4b56-9c48-4f35c774b7c0",
  question: "Compare NVDA and TSLA after the latest evidence",
  tradeable: false,
  trace: [{ id: "stage-1", agent: "Market scout", status: "complete", title: "Market check complete", detail: "Verified the instrument and retrieved completed 4H candles.", at: "2026-10-12T15:00:00.000Z" }],
  assets: [{
    ticker: "NVDA", issuer: "NVIDIA", summary: "The available reports describe a change that requires checking the original filing and a fresh quote.", stance: "mixed", confidence: 0.55, tradeable: false,
    gateReasons: ["The evidence does not support a directional scenario."],
    sources: [{ title: "Company update", url: "https://example.com/company-update", publisher: "Example News", publishedAt: "2026-10-12T14:00:00.000Z", via: "Public feeds" }],
    market: { perpSymbol: "NVDAUSDT", spotSymbol: "RNVDAUSDT", lastPrice: 200.12, providerTimestamp: 1791813600000, interval: "4H", candles: [{ timestamp: 1791800000000, close: 198.2 }, { timestamp: 1791810000000, close: 200.12 }] },
    handoff: null, risks: ["Headlines may omit material context."], nextCheck: "Read the issuer filing.",
  }],
};

test("valid completed research maps only to the trusted component registry", () => {
  const parsed = parseIntelligenceResult(result);
  assert.ok(parsed);
  assert.deepEqual(composeIntelligenceBlocks(parsed).map((block) => block.type), ["activity", "comparison", "charts", "evidence", "scenarios", "risk", "actions"]);
});

test("invalid, unsafe, or out of range payloads are rejected before rendering", () => {
  assert.equal(parseIntelligenceResult(null), null);
  assert.equal(parseIntelligenceResult({ ...result, arbitraryComponent: "<script>" })?.assets[0].ticker, "NVDA");
  assert.equal(parseIntelligenceResult({ ...result, trace: [{ ...result.trace[0], detail: "x".repeat(701) }] }), null);
  assert.equal(parseIntelligenceResult({ ...result, assets: [{ ...result.assets[0], sources: [{ ...result.assets[0].sources[0], url: "javascript:alert(1)" }] }] }), null);
  assert.equal(parseIntelligenceResult({ ...result, assets: [{ ...result.assets[0], confidence: 1.01 }] }), null);
  assert.equal(parseIntelligenceResult({ ...result, assets: [{ ...result.assets[0], ticker: "<svg>" }] }), null);
  assert.equal(parseIntelligenceResult({ ...result, trace: Array(61).fill(result.trace[0]) }), null);
  assert.equal(parseIntelligenceResult({ ...result, tradeable: true }), null);
  assert.equal(parseIntelligenceResult({ ...result, assets: [{ ...result.assets[0], handoff: { destinations: [{ mode: "live_spot", label: "Go", href: "https://evil.example" }], reason: "review" } }] }), null);
  assert.equal(parseIntelligenceResult({ ...result, assets: [{ ...result.assets[0], market: { ...result.assets[0].market, candles: [{ timestamp: 1, close: Infinity }] } }] }), null);
});

test("optional structured evidence renders only source-linked catalysts and validated private or replay data", () => {
  const asset = {
    ...result.assets[0],
    catalysts: [
      { title: "Earnings call", date: "2026-11-18", sourceUrl: result.assets[0].sources[0].url },
      { title: "Uncited item", date: "2026-11-18", sourceUrl: "https://fake.example/event" },
    ],
    portfolioExposure: { symbol: "RNVDAUSDT", exposurePct: 12.4, capturedAt: "2026-10-12T14:30:00.000Z" },
    historicalBacktest: { strategy: "Trend · SMA 20/50", interval: "4H", candleCount: 900, dataStart: "2026-05-01T00:00:00.000Z", dataEnd: "2026-10-01T00:00:00.000Z", testReturnPct: 2.4, buyAndHoldReturnPct: 5.1, maxDrawdownPct: -8.3, trades: 4 },
  };
  const parsed = parseIntelligenceResult({ ...result, assets: [asset] });
  assert.ok(parsed);
  assert.deepEqual(parsed.assets[0].catalysts, [{ title: "Earnings call", date: "2026-11-18", sourceUrl: result.assets[0].sources[0].url }]);
  assert.deepEqual(composeIntelligenceBlocks(parsed).map((block) => block.type), ["activity", "comparison", "charts", "evidence", "scenarios", "catalysts", "exposure", "backtests", "risk", "actions"]);
  assert.equal(parseIntelligenceResult({ ...result, assets: [{ ...asset, portfolioExposure: { ...asset.portfolioExposure, exposurePct: 150 } }] })?.assets[0].portfolioExposure, undefined);
});
