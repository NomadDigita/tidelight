import test from "node:test";
import assert from "node:assert/strict";
import { isPaperLimitImmediatelyMarketable, isPaperOrderTriggered, paperLimitReferencePrice } from "../lib/futures-paper-order-policy.ts";

test("limit orders trigger only on a favorable touch of their limit", () => {
  assert.equal(isPaperOrderTriggered("limit", "open_long", 99, 100), true);
  assert.equal(isPaperOrderTriggered("limit", "open_long", 101, 100), false);
  assert.equal(isPaperOrderTriggered("limit", "open_short", 101, 100), true);
  assert.equal(isPaperOrderTriggered("limit", "open_short", 99, 100), false);
});

test("conditional entries trigger in the stop direction", () => {
  assert.equal(isPaperOrderTriggered("conditional", "open_long", 101, 100), true);
  assert.equal(isPaperOrderTriggered("conditional", "open_long", 99, 100), false);
  assert.equal(isPaperOrderTriggered("conditional", "open_short", 99, 100), true);
  assert.equal(isPaperOrderTriggered("conditional", "open_short", 101, 100), false);
});

test("limit reference adjustment keeps adverse paper slippage within the limit", () => {
  const longFill = paperLimitReferencePrice("open_long", 100, 100) * 1.0005;
  const shortFill = paperLimitReferencePrice("open_short", 100, 100) * 0.9995;
  assert.ok(longFill <= 100.00000001);
  assert.ok(shortFill >= 99.99999999);
  assert.equal(isPaperLimitImmediatelyMarketable("open_long", 100, 101), true);
  assert.equal(isPaperLimitImmediatelyMarketable("open_short", 100, 99), true);
});

test("invalid market prices never trigger paper execution", () => {
  assert.equal(isPaperOrderTriggered("limit", "open_long", 0, 100), false);
  assert.equal(isPaperOrderTriggered("conditional", "open_short", 100, Number.NaN), false);
});
