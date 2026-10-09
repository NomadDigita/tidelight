import test from "node:test";
import assert from "node:assert/strict";
import { extractFlowTickers, gateFlowTrade, normalizeFlowAssessment, normalizeFlowAssessments } from "../lib/agent-flow-policy.ts";

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

test("uncited publishers cannot supply the independent evidence required for a handoff", () => {
  const samePublisher = { ...sources[0], url: "https://example.com/second-story" };
  assert.equal(gateFlowTrade({ ...base, sources: [...sources, samePublisher], assessment: { ...assessment, citedUrls: [sources[0].url, samePublisher.url] } }).tradeable, false);
});

test("market freshness rejects invalid clocks and preserves the two-minute boundary", () => {
  for (const marketTimestamp of [null, 0, NaN, Infinity, -Infinity, now - 120001, now + 60001]) {
    assert.equal(gateFlowTrade({ ...base, marketTimestamp }).tradeable, false, String(marketTimestamp));
  }
  for (const marketTimestamp of [now - 120000, now + 60000]) {
    assert.equal(gateFlowTrade({ ...base, marketTimestamp }).tradeable, true);
  }
  assert.equal(gateFlowTrade({ ...base, now: NaN }).tradeable, false);
});

test("only valid completed-candle counts and times satisfy the Alpha gate", () => {
  for (const completedCandles of [NaN, Infinity, 59, 60.5]) {
    assert.equal(gateFlowTrade({ ...base, completedCandles }).tradeable, false);
  }
  for (const lastCompletedCandleEnd of [null, 0, NaN, Infinity, now + 1, now - 6 * 3600000 - 1]) {
    assert.equal(gateFlowTrade({ ...base, lastCompletedCandleEnd }).tradeable, false);
  }
  assert.equal(gateFlowTrade({ ...base, completedCandles: 60, lastCompletedCandleEnd: now - 6 * 3600000 }).tradeable, true);
});

test("provider confidence must be a finite numeric probability, never coerced from other JSON types", () => {
  for (const confidence of [true, false, null, [], [1], "0.9", NaN, Infinity, -1, 1.1]) {
    assert.equal(normalizeFlowAssessment({ ...assessment, confidence }, sources), null, String(confidence));
  }
  for (const confidence of [NaN, Infinity, -1, 1.1]) {
    assert.equal(gateFlowTrade({ ...base, assessment: { ...assessment, confidence } }).tradeable, false);
  }
  assert.equal(normalizeFlowAssessment({ ...assessment, confidence: 0.75 }, sources)?.confidence, 0.75);
});

test("provider responses must include a valid assessment for each requested company", () => {
  const requested = { NVDA: sources, TSLA: sources };
  const nvda = { ...assessment, ticker: "NVDA" };
  const tsla = { ...assessment, ticker: " tsla " };
  for (const response of [{}, { assets: [] }, { assets: [nvda] }, { assets: [nvda, { ...tsla, confidence: true }] }]) {
    assert.equal(normalizeFlowAssessments(response, requested), null);
  }
  const normalized = normalizeFlowAssessments({ assets: [nvda, tsla] }, requested);
  assert.deepEqual(Object.keys(normalized), ["NVDA", "TSLA"]);
  assert.equal(normalized.TSLA.confidence, 0.8);
  assert.equal(normalizeFlowAssessments({ assets: [nvda] }, {}), null);
});

test("unknown companies and duplicate provider assessments cannot overwrite the first valid requested result", () => {
  const nvda = { ...assessment, ticker: "NVDA" };
  const response = { assets: [null, [], { ...nvda, ticker: "__proto__" }, { ...nvda, confidence: null }, nvda, { ...nvda, confidence: 1 }, { ...nvda, ticker: "TSLA" }] };
  const normalized = normalizeFlowAssessments(response, { NVDA: sources });
  assert.deepEqual(Object.keys(normalized), ["NVDA"]);
  assert.equal(normalized.NVDA.confidence, 0.8);
  assert.equal(normalizeFlowAssessment({ ...assessment, stance: ["bullish"] }, sources), null);
});
