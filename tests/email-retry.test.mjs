import test from "node:test";
import assert from "node:assert/strict";
import { EMAIL_MAX_ATTEMPTS, nextEmailRetryAt } from "../lib/email/retry.ts";

test("delivery retries use bounded exponential backoff and stop at the retry limit", () => {
  const base = Date.parse("2026-10-12T12:00:00.000Z");
  assert.equal(EMAIL_MAX_ATTEMPTS, 8);
  assert.equal(nextEmailRetryAt(1, base), "2026-10-12T12:00:30.000Z");
  assert.equal(nextEmailRetryAt(2, base), "2026-10-12T12:01:00.000Z");
  assert.equal(nextEmailRetryAt(8, base), null);
  assert.equal(nextEmailRetryAt(0, base), null);
});
