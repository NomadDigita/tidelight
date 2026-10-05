import test from "node:test";
import assert from "node:assert/strict";
import { runBacktest } from "../lib/backtest.ts";

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const start = Date.UTC(2025, 0, 1);

function fixture(count = 1_000) {
  const candles = [];
  let prior = 100;
  for (let i = 0; i < count; i += 1) {
    const close = 100 + i * 0.025 + 6 * Math.sin(i / 17) + 2 * Math.sin(i / 5);
    const open = prior;
    candles.push({
      timestamp: start + i * FOUR_HOURS,
      open,
      high: Math.max(open, close) + 0.15,
      low: Math.min(open, close) - 0.15,
      close,
      volume: 1_000 + i,
      turnover: 100_000 + i,
    });
    prior = close;
  }
  return candles;
}

test("runs a chronological holdout over at least 60 days with costs and a trade ledger", () => {
  const candles = fixture();
  const result = runBacktest("RAAPLUSDT", "4H", candles);
  assert.equal(result.candleCount, 1_000);
  assert.ok(result.dataEnd - result.dataStart >= 60 * 24 * 60 * 60 * 1000);
  assert.ok(result.dataEnd - candles[result.splitIndex].timestamp >= 30 * 24 * 60 * 60 * 1000);
  assert.ok(result.test.candles >= 20);
  assert.ok(result.test.tradeLog.length > 0);
  assert.ok(result.test.tradeLog.every((trade) => Number.isFinite(trade.returnPct)));
  assert.ok(result.test.equityCurve.every((point) => Number.isFinite(point.equity) && point.equity > 0));
});

test("produces the same result when provider candles arrive in reverse order", () => {
  const candles = fixture();
  assert.deepEqual(runBacktest("RAAPLUSDT", "4H", candles), runBacktest("RAAPLUSDT", "4H", [...candles].reverse()));
});

test("rejects malformed OHLC, negative volume, and duplicate timestamps", () => {
  const badOhlc = fixture();
  badOhlc[900] = { ...badOhlc[900], high: 1 };
  assert.throws(() => runBacktest("RAAPLUSDT", "4H", badOhlc), /inconsistent OHLC/);

  const badVolume = fixture();
  badVolume[900] = { ...badVolume[900], volume: -1 };
  assert.throws(() => runBacktest("RAAPLUSDT", "4H", badVolume), /invalid volume/);

  const duplicate = fixture();
  duplicate[900] = { ...duplicate[900], timestamp: duplicate[899].timestamp };
  assert.throws(() => runBacktest("RAAPLUSDT", "4H", duplicate), /duplicate timestamps/);
});

test("rejects data that cannot support the required overall and holdout windows", () => {
  assert.throws(() => runBacktest("RAAPLUSDT", "4H", fixture(79)), /At least 80/);
  assert.throws(() => runBacktest("RAAPLUSDT", "4H", fixture(400)), /holdout is shorter than 30 days/);
});

test("changing a future candle cannot rewrite trades that already exited", () => {
  const original = fixture();
  const changedAt = 850;
  const revised = [...original];
  revised[changedAt] = { ...revised[changedAt], open: 220, high: 230, low: 210, close: 225 };
  const before = runBacktest("RAAPLUSDT", "4H", original);
  const after = runBacktest("RAAPLUSDT", "4H", revised);
  const cutoff = original[changedAt].timestamp;
  assert.deepEqual(
    after.test.tradeLog.filter((trade) => trade.exitTime < cutoff),
    before.test.tradeLog.filter((trade) => trade.exitTime < cutoff),
  );
});
