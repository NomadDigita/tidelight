import test from "node:test";
import assert from "node:assert/strict";
import { getBitgetStockPerp, getBitgetCandles } from "../lib/bitget-market.ts";

function mockBitget(instrumentStatus = "online", instrumentType = "perpetual") {
  const calls = [];
  const prior = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    calls.push(parsed);
    const data = parsed.pathname.endsWith("/instruments")
      ? [{ symbol: "NVDAUSDT", category: "USDT-FUTURES", baseCoin: "NVDA", quoteCoin: "USDT", status: instrumentStatus, type: instrumentType }]
      : parsed.pathname.endsWith("/tickers")
        ? [{ symbol: "NVDAUSDT", category: "USDT-FUTURES", lastPrice: "231.50", ts: "1780000000000" }]
        : [["1780000000000", "230", "232", "229", "231", "150", "34650"]];
    return new Response(JSON.stringify({ code: "00000", data }), { status: 200 });
  };
  return { calls, restore: () => { globalThis.fetch = prior; } };
}

test("only a verified online stock perpetual enters the Alpha futures market", async () => {
  const mock = mockBitget();
  try {
    assert.equal(await getBitgetStockPerp("BTCUSDT"), null);
    assert.equal(mock.calls.length, 0);
    const asset = await getBitgetStockPerp("NVDAUSDT");
    assert.equal(asset?.underlyingTicker, "NVDA");
    assert.equal(asset?.name, "NVIDIA Corporation");
    assert.equal(asset?.isReality, false);
    assert.equal(asset?.lastPrice, 231.5);
    assert.ok(mock.calls.every(call => call.searchParams.get("category") === "USDT-FUTURES"));
    const candles = await getBitgetCandles("NVDAUSDT", "4H", 1000, "USDT-FUTURES");
    assert.equal(candles[0].close, 231);
    assert.equal(mock.calls.at(-1).searchParams.get("category"), "USDT-FUTURES");
  } finally { mock.restore(); }
});

test("a suspended or nonperpetual contract cannot be represented as tradable", async () => {
  for (const [status, kind] of [["offline", "perpetual"], ["online", "delivery"]]) {
    const mock = mockBitget(status, kind);
    try { assert.equal(await getBitgetStockPerp("NVDAUSDT"), null); }
    finally { mock.restore(); }
  }
});
