import test from "node:test";
import assert from "node:assert/strict";
import {
  isBitgetMarketRedistributionAllowed,
  MarketRedistributionNotAuthorizedError,
  requireBitgetMarketRedistributionAllowed,
} from "../lib/tic/market-terms.ts";

test("Bitget redistribution fails closed unless the explicit permission flag is true", () => {
  for (const value of [undefined, "", "false", "1", "TRUE", "yes"]) {
    assert.equal(isBitgetMarketRedistributionAllowed(value), false);
    assert.throws(() => requireBitgetMarketRedistributionAllowed(value), MarketRedistributionNotAuthorizedError);
  }
  assert.equal(isBitgetMarketRedistributionAllowed("true"), true);
  assert.doesNotThrow(() => requireBitgetMarketRedistributionAllowed("true"));
});
