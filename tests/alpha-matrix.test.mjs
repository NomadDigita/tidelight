import test from "node:test";
import assert from "node:assert/strict";
import { hasAlignedHoldout } from "../lib/alpha-matrix.ts";

const run = (trainEnd, times) => ({
  train: { equityCurve: [{ timestamp: trainEnd }] },
  test: { equityCurve: times.map(timestamp => ({ timestamp })) },
});

test("basket leader selection requires the same untouched holdout bars", () => {
  const reference = run(100, [200, 300, 400]);
  assert.equal(hasAlignedHoldout([reference, run(150, [200, 300, 400])]), true);
  assert.equal(hasAlignedHoldout([reference, run(150, [200, 350, 400])]), false);
  assert.equal(hasAlignedHoldout([reference, run(150, [300, 400])]), false);
});

test("a later training observation cannot leak into another market's holdout", () => {
  const reference = run(100, [200, 300, 400]);
  assert.equal(hasAlignedHoldout([reference, run(200, [200, 300, 400])]), false);
  assert.equal(hasAlignedHoldout([reference]), false);
  assert.equal(hasAlignedHoldout([reference, run(150, [])]), false);
});
