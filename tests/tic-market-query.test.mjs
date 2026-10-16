import test from "node:test";
import assert from "node:assert/strict";
import { filterAndPageTokenizedEquities, validateInstrumentQuery } from "../lib/tic/market-query.ts";

const assets = [
  { symbol: "RNVDAUSDT", kind: "rtoken", isReality: true, underlyingTicker: "NVDA" },
  { symbol: "RAAPLUSDT", kind: "rtoken", isReality: true, underlyingTicker: "AAPL" },
  { symbol: "RMSFTUSDT", kind: "rtoken", isReality: true, underlyingTicker: "MSFT" },
  { symbol: "AAPLUSDT", kind: "rtoken", isReality: false, underlyingTicker: "AAPL" },
  { symbol: "AAPL", kind: "SPOT", isReality: false, underlyingTicker: "AAPL" },
];

test("underlying ticker filters before cursor pagination", () => {
  const query = validateInstrumentQuery("rtoken", "1", null, "aapl");
  assert.deepEqual(query, { limit: 1, cursor: null, underlyingTicker: "AAPL" });
  const first = filterAndPageTokenizedEquities(assets, query);
  assert.deepEqual(first.assets.map(asset => asset.symbol), ["RAAPLUSDT"]);
  assert.equal(first.hasMore, false);
});

test("ticker-filtered pages keep cursor semantics and exclude non-Reality assets", () => {
  const query = validateInstrumentQuery("rtoken", "1", null, null);
  const first = filterAndPageTokenizedEquities(assets, query);
  assert.deepEqual(first.assets.map(asset => asset.symbol), ["RAAPLUSDT"]);
  assert.equal(first.hasMore, true);
  const next = filterAndPageTokenizedEquities(assets, { ...query, cursor: "RAAPLUSDT" });
  assert.deepEqual(next.assets.map(asset => asset.symbol), ["RMSFTUSDT"]);
  assert.equal(next.hasMore, true);
});

test("market instrument filters reject invalid tickers and pagination values", () => {
  assert.equal(validateInstrumentQuery("spot", "1", null, "AAPL"), null);
  assert.equal(validateInstrumentQuery("rtoken", "101", null, "AAPL"), null);
  assert.equal(validateInstrumentQuery("rtoken", "1", null, "NVDA?"), null);
  assert.equal(validateInstrumentQuery("rtoken", "1", "../../etc", null), null);
});
