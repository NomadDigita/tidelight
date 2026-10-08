import test from "node:test";
import assert from "node:assert/strict";
import { extractFlowTickers, gateFlowTrade, normalizeFlowAssessment } from "../lib/agent-flow-policy.ts";

const now = Date.parse("2026-10-08T18:00:00.000Z");
const sources = [
  { title: "NVDA earnings", url: "https://example.com/a", publisher: "Publisher A", publishedAt: new Date(now - 3600000).toISOString() },
  { title: "NVDA outlook", url: "https://example.org/b", publisher: "Publisher B", publishedAt: new Date(now - 7200000).toISOString() },
];
const assessment = { summary: "Two recent publishers describe an earnings and outlook development requiring an original-source check.", stance: "bullish", confidence: 0.8, citedUrls: sources.map(item => item.url), risks: ["Gap risk"], nextCheck: "Read the issuer release" };
const base = { assessment, sources, marketVerified: true, marketTimestamp: now - 30000, lastCompletedCandleEnd: now - 3600000, completedCandles: 80, currentSignal: true, previousSignal: false, now };

test("the coordinator recognizes only supported US stock underlyings", () => {
  assert.deepEqual(extractFlowTickers("What do you think about NVDA and TSLA?", ["NVDAUSDT", "TSLAUSDT", "AMDUSDT"]), ["NVDA", "TSLA"]);
  assert.deepEqual(extractFlowTickers("rNVDAUSDT and NVIDIA", ["NVDAUSDT"]), ["NVDA"]);
  assert.deepEqual(extractFlowTickers("Should I check BTC?", ["NVDAUSDT"]), []);
});

test("a handoff requires independently cited current coverage, fresh verified market, and agreeing new signal", () => {
  assert.equal(gateFlowTrade(base).tradeable, true);
  assert.equal(gateFlowTrade({ ...base, currentSignal: false, previousSignal: false }).tradeable, false);
  assert.equal(gateFlowTrade({ ...base, marketTimestamp: now - 180000 }).tradeable, false);
  assert.equal(gateFlowTrade({ ...base, sources: sources.slice(0, 1) }).tradeable, false);
  assert.equal(gateFlowTrade({ ...base, assessment: { ...assessment, stance: "mixed" } }).tradeable, false);
  assert.equal(gateFlowTrade({ ...base, assessment: { ...assessment, confidence: 0.5 } }).tradeable, false);
});

test("source-bound assessment discards fabricated citations before the gate", () => {
  const result = normalizeFlowAssessment({ ...assessment, citedUrls: [sources[0].url, "https://elsewhere.invalid/claim"] }, sources);
  assert.deepEqual(result?.citedUrls, [sources[0].url]);
  assert.equal(gateFlowTrade({ ...base, assessment: result }).tradeable, false);
});
