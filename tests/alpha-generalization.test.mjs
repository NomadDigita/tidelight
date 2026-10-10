import assert from "node:assert/strict";
import test from "node:test";
import { assessSharpeDecay } from "../lib/alpha-generalization.ts";

test("flags Sharpe below half the training figure", () => {
  assert.deepEqual(assessSharpeDecay({ sharpeRatio: 2, trades: 4 }, { sharpeRatio: 0.8, trades: 3 }), { state: "alert", ratio: 0.4 });
  assert.deepEqual(assessSharpeDecay({ sharpeRatio: 2, trades: 4 }, { sharpeRatio: -0.2, trades: 3 }), { state: "alert", ratio: -0.1 });
});

test("uses the handbook's strict half threshold and requires meaningful samples", () => {
  assert.deepEqual(assessSharpeDecay({ sharpeRatio: 2, trades: 4 }, { sharpeRatio: 1, trades: 3 }), { state: "no-alert", ratio: 0.5 });
  assert.deepEqual(assessSharpeDecay({ sharpeRatio: 2, trades: 1 }, { sharpeRatio: 1, trades: 3 }), { state: "insufficient", ratio: null });
  assert.deepEqual(assessSharpeDecay({ sharpeRatio: null, trades: 4 }, { sharpeRatio: 1, trades: 3 }), { state: "insufficient", ratio: null });
  assert.deepEqual(assessSharpeDecay({ sharpeRatio: -1, trades: 4 }, { sharpeRatio: 1, trades: 3 }), { state: "insufficient", ratio: null });
});
