import test from "node:test";
import assert from "node:assert/strict";
import { getSourceStarters } from "../lib/source-starters.ts";
import { validatePublicSourceUrl } from "../lib/public-source.ts";

test("each Mini company has an issuer source and a valid SEC filing entry point", () => {
  for (const ticker of ["AAPL", "AMZN", "MSFT", "NVDA", "TSLA"]) {
    const starters = getSourceStarters(ticker);
    assert.equal(starters.length, 2);
    assert.equal(starters[1].kind, "Primary filing");
    assert.ok(validatePublicSourceUrl(starters[0].url, ticker));
    assert.ok(validatePublicSourceUrl(starters[1].url, ticker));
    assert.match(starters[1].url, /CIK=\d{6,10}/);
  }
});
