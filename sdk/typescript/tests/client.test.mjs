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

test("manages scoped webhooks and reads delivery history", async () => {
  const calls = [];
  const endpoint = { id: jobId, project_id: "p1", organization_id: "o1", name: "Research", url: "https://example.com/hook", events: ["research.job.completed"], enabled: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
  const client = new TidelightClient({ apiKey: key, fetch: async (url, init) => {
    calls.push({ url: String(url), init });
    const method = init.method;
    const data = method === "GET" && String(url).endsWith("/deliveries") ? { deliveries: [], request_id: "r5" }
      : method === "GET" ? { endpoints: [endpoint], request_id: "r1" }
        : method === "DELETE" ? { disabled: true, request_id: "r4" }
          : { endpoint, ...(method === "POST" || JSON.parse(init.body).rotate_secret ? { signing_secret: "once-only" } : {}), request_id: method === "POST" ? "r2" : "r3" };
    return Response.json(data, { status: method === "POST" ? 201 : 200 });
  } });
  assert.equal((await client.listWebhooks()).endpoints[0].id, jobId);
  assert.equal((await client.createWebhook({ name: "Research", url: "https://example.com/hook", events: ["research.job.completed"] })).signing_secret, "once-only");
  assert.equal((await client.updateWebhook(jobId, { rotate_secret: true })).signing_secret, "once-only");
  assert.equal((await client.disableWebhook(jobId)).disabled, true);
  assert.deepEqual((await client.listWebhookDeliveries()).deliveries, []);
  assert.deepEqual(calls.map(call => call.init.method), ["GET", "POST", "PATCH", "DELETE", "GET"]);
  assert.ok(calls.every(call => call.init.headers.Authorization === "Bearer " + key));
});

test("rejects unsafe or malformed webhook inputs before network access", async () => {
  const client = new TidelightClient({ apiKey: key, fetch: async () => assert.fail("network should not run") });
  await assert.rejects(client.createWebhook({ name: "x", url: "http://example.com/hook", events: ["research.job.completed"] }), TypeError);
  await assert.rejects(client.createWebhook({ name: "Valid", url: "https://example.com/hook", events: ["unknown.event"] }), TypeError);
  await assert.rejects(client.updateWebhook("bad-id", { enabled: false }), TypeError);
  await assert.rejects(client.updateWebhook(jobId, { rotate_secret: false }), TypeError);
});

test("does not retry webhook mutations without server idempotency support", async () => {
  let calls = 0;
  const client = new TidelightClient({ apiKey: key, maxRetries: 3, fetch: async () => { calls++; return Response.json({ error: { code: "service_unavailable", message: "Try later" } }, { status: 503 }); } });
  await assert.rejects(client.createWebhook({ name: "Research", url: "https://example.com/hook", events: ["research.job.completed"] }), error => error instanceof TidelightApiError && error.code === "service_unavailable");
  assert.equal(calls, 1);
});
