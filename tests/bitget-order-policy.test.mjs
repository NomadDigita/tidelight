import test from "node:test";
import assert from "node:assert/strict";
import { estimateOrderNotional, isLimitPriceWithinBand, MAX_ORDER_NOTIONAL_USDT, MAX_ORDER_ATTEMPTS_PER_HOUR } from "../lib/bitget-order-policy.ts";

test("market buys measure quote-currency spend while sells use token quantity", () => {
  assert.equal(estimateOrderNotional({ side: "buy", orderType: "market", quantity: 25, referencePrice: 100 }), 25);
  assert.equal(estimateOrderNotional({ side: "sell", orderType: "market", quantity: 0.2, referencePrice: 100 }), 20);
});

test("limit exposure uses the limit price and rejects missing or invalid values", () => {
  assert.equal(estimateOrderNotional({ side: "buy", orderType: "limit", quantity: 0.2, referencePrice: 100, limitPrice: 90 }), 18);
  assert.equal(estimateOrderNotional({ side: "sell", orderType: "limit", quantity: 0.2, referencePrice: 100 }), null);
  assert.equal(estimateOrderNotional({ side: "buy", orderType: "market", quantity: Number.NaN, referencePrice: 100 }), null);
});

test("Reality desk uses conservative fixed attempt and notional caps", () => {
  assert.equal(MAX_ORDER_NOTIONAL_USDT, 250);
  assert.equal(MAX_ORDER_ATTEMPTS_PER_HOUR, 5);
  assert.equal(estimateOrderNotional({ side: "buy", orderType: "market", quantity: 250, referencePrice: 100 }) <= MAX_ORDER_NOTIONAL_USDT, true);
  assert.equal(estimateOrderNotional({ side: "buy", orderType: "market", quantity: 250.01, referencePrice: 100 }) > MAX_ORDER_NOTIONAL_USDT, true);
});

test("limit orders cannot drift more than five percent from current reference", () => {
  assert.equal(isLimitPriceWithinBand(105, 100), true);
  assert.equal(isLimitPriceWithinBand(106, 100), false);
  assert.equal(isLimitPriceWithinBand(100, 0), false);
});
