import test from "node:test";
import assert from "node:assert/strict";
import { TidelightClient } from "../dist/index.js";
import { runCompanyResearch } from "../examples/research-flow.mjs";
const key = `tl_test_${"a".repeat(43)}`;
const jobId = "01234567-89ab-4cde-8fab-0123456789ab";
const job = (status, result = null, error = null) => ({
  job_id: jobId, ticker: "NVDA", status, attempts: 1, max_attempts: 3, result, error,
  created_at: "2026-10-16T00:00:00Z", started_at: null, completed_at: null, retry_at: null, request_id: "research-result",
});
test("source example exercises the actual SDK idempotent research flow", async () => {
  const requests = [];
  const client = new TidelightClient({ apiKey: key, fetch: async (url, init) => {
    requests.push({ url: String(url), init });
    if (init.method === "POST") return Response.json({ job_id: jobId, status: "queued", duplicate: false, request_id: "research-accepted" }, { status: 202 });
    return Response.json(job("complete", { source: "contract-shaped test fixture" }));
  } });
  const result = await runCompanyResearch(client, { ticker: "NVDA", idempotencyKey: "example-run-0001", intervalMs: 250, timeoutMs: 1_000 });
  assert.equal(result.accepted.status, "queued");
  assert.equal(result.job.status, "complete");
  assert.deepEqual(result.job.result, { source: "contract-shaped test fixture" });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].init.headers["Idempotency-Key"], "example-run-0001");
  assert.equal(requests[0].init.headers.Authorization, `Bearer ${key}`);
  assert.match(requests[0].url, /\/v1\/research\/jobs$/);
  assert.match(requests[1].url, new RegExp(jobId));
});
test("source example preserves failed terminal state without inventing a result", async () => {
  const client = new TidelightClient({ apiKey: key, fetch: async (_url, init) => init.method === "POST"
    ? Response.json({ job_id: jobId, status: "queued", duplicate: false, request_id: "accepted" }, { status: 202 })
    : Response.json(job("failed", null, { code: "provider_unavailable", message: "Unavailable" })) });
  const result = await runCompanyResearch(client, { ticker: "NVDA", idempotencyKey: "example-run-0002", intervalMs: 250, timeoutMs: 1_000 });
  assert.equal(result.job.status, "failed");
  assert.equal(result.job.result, null);
  assert.equal(result.job.error.code, "provider_unavailable");
});
