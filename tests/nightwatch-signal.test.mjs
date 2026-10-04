import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSmaCrossover } from "../lib/nightwatch-signal.ts";

test("holds when consecutive completed-candle averages do not cross", () => {
  const result = evaluateSmaCrossover(Array(60).fill(100));
  assert.equal(result.signal, "hold");
  assert.equal(result.fastSma, 100);
  assert.equal(result.slowSma, 100);
});

test("emits a buy only when the fast average crosses above the slow average", () => {
  const result = evaluateSmaCrossover([...Array(59).fill(100), 160]);
  assert.equal(result.signal, "buy");
  assert.ok(result.previousFastSma <= result.previousSlowSma);
  assert.ok(result.fastSma > result.slowSma);
});

test("emits a sell only when the fast average crosses below the slow average", () => {
  const result = evaluateSmaCrossover([...Array(59).fill(100), 40]);
  assert.equal(result.signal, "sell");
  assert.ok(result.previousFastSma >= result.previousSlowSma);
  assert.ok(result.fastSma < result.slowSma);
});

test("rejects short or invalid price history", () => {
  assert.throws(() => evaluateSmaCrossover(Array(50).fill(1)), /51 completed candles/);
  assert.throws(() => evaluateSmaCrossover([...Array(50).fill(1), Number.NaN]), /positive finite prices/);
});
