import test from "node:test";
import assert from "node:assert/strict";
import { TidelightApiError, TidelightClient } from "../dist/index.js";

const key = `tl_test_${"a".repeat(43)}`;
const jobId = "01234567-89ab-4cde-8fab-0123456789ab";

test("starts, polls, and cancels an asynchronous research job", async () => {
  const calls = [];
  const client = new TidelightClient({ apiKey: key, fetch: async (url, init) => {
    calls.push({ url: String(url), init });
    const method = init?.method ?? "GET";
    const body = method === "POST" ? { job_id: jobId, status: "queued", duplicate: false, request_id: "r1" }
      : method === "DELETE" ? { job_id: jobId, status: "cancelled", request_id: "r3" }
        : { job_id: jobId, ticker: "NVDA", status: "complete", attempts: 1, max_attempts: 3, result: { type: "company_snapshot" }, error: null, created_at: "2026-01-01T00:00:00Z", started_at: null, completed_at: "2026-01-01T00:01:00Z", retry_at: null, request_id: "r2" };
    return Response.json(body, { status: method === "POST" ? 202 : method === "DELETE" ? 202 : 200 });
  } });
  const accepted = await client.startCompanyResearch("NVDA", "job-key-0001");
  assert.equal(accepted.job_id, jobId);
  assert.equal(calls[0].init.headers["Idempotency-Key"], "job-key-0001");
  const result = await client.waitForResearchJob(jobId, { intervalMs: 250, timeoutMs: 1000 });
  assert.equal(result.status, "complete");
  assert.equal(result.result.type, "company_snapshot");
  assert.equal((await client.cancelResearchJob(jobId)).status, "cancelled");
});

test("rejects malformed research input before making a request", async () => {
  const client = new TidelightClient({ apiKey: key, fetch: async () => assert.fail("network should not run") });
  await assert.rejects(client.startCompanyResearch("NVDA", "short"), TypeError);
  await assert.rejects(client.getResearchJob("../secrets"), TypeError);
});

test("preserves structured API errors", async () => {
  const client = new TidelightClient({ apiKey: key, maxRetries: 0, fetch: async () => Response.json({ error: { code: "insufficient_scope", message: "Missing research scope", request_id: "r4" } }, { status: 403 }) });
  await assert.rejects(client.startCompanyResearch("NVDA", "job-key-0002"), error => error instanceof TidelightApiError && error.code === "insufficient_scope" && error.requestId === "r4");
});
