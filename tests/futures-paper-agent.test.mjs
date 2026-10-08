import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFuturesProposal } from "../lib/futures-paper-policy.ts";

const proposal = (action, confidence = 0.8) => ({ action, confidence, rationale: "A completed candle changed the testable market state.", evidence: ["Completed Bitget 4H candle confirmed"], risks: ["Gap risk"], invalidation: "Next completed reversal" });

test("fresh candidate transition can propose one paper long", () => {
  assert.equal(normalizeFuturesProposal(proposal("open_long"), null, true, false)?.action, "open_long");
  assert.equal(normalizeFuturesProposal(proposal("open_long"), null, true, true)?.action, "hold");
  assert.equal(normalizeFuturesProposal(proposal("open_long", 0.69), null, true, false)?.action, "hold");
});

test("short requires a new move out of the candidate state; no stacking", () => {
  assert.equal(normalizeFuturesProposal(proposal("open_short"), null, false, true)?.action, "open_short");
  assert.equal(normalizeFuturesProposal(proposal("open_short"), null, false, false)?.action, "hold");
  assert.equal(normalizeFuturesProposal(proposal("open_short"), "long", false, true)?.action, "hold");
  assert.equal(normalizeFuturesProposal(proposal("close"), "long", false, true)?.action, "close");
});

test("malformed decisions cannot reach the paper ledger as trade proposals", () => {
  assert.equal(normalizeFuturesProposal({ ...proposal("open_long"), evidence: [] }, null, true, false), null);
  assert.equal(normalizeFuturesProposal(proposal("buy"), null, true, false), null);
});
