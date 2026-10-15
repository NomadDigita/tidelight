import test from "node:test";
import assert from "node:assert/strict";
import { TidelightClient, TidelightApiError } from "../sdk/typescript/src/index.ts";

const key = `tl_test_${"a".repeat(43)}`;
const instrument = { symbol: "RNVDAUSDT", instrument_type: "tokenized_equity_spot", underlying_ticker: "NVDA", issuer_name: "NVIDIA", quote_currency: "USDT", last_price: 1, change_24h: null, provider_timestamp: null, market_session_status: "available", source: "Bitget Reality spot" };

test("client preserves bearer credentials and paginates without leaking them in errors", async () => {
  const urls = [];
  const client = new TidelightClient({ apiKey: key, maxRetries: 0, fetch: async (url, init) => {
    assert.equal(init.headers.Authorization, `Bearer ${key}`);
    urls.push(String(url));
    return Response.json({ data: [instrument], next_cursor: urls.length === 1 ? "RNVDAUSDT" : null, generated_at: 1, request_id: "request-test" });
  } });
  assert.equal((await client.listTokenizedEquities()).data[0].instrument_type, "tokenized_equity_spot");
  urls.length = 0;
  const items = [];
  for await (const item of client.tokenizedEquities()) items.push(item);
  assert.equal(items.length, 2);
  assert.match(urls[1], /cursor=RNVDAUSDT/);
});

test("client retries transient failures once and preserves structured request errors", async () => {
  let count = 0;
  const client = new TidelightClient({ apiKey: key, maxRetries: 1, fetch: async () => {
    count++;
    return count === 1 ? Response.json({ error: { code: "provider_unavailable", message: "Retry", request_id: "first" } }, { status: 503, headers: { "Retry-After": "0" } }) : Response.json({ data: [], next_cursor: null, generated_at: 1, request_id: "second" });
  } });
  assert.equal((await client.listTokenizedEquities()).request_id, "second");
  assert.equal(count, 2);
  const denied = new TidelightClient({ apiKey: key, fetch: async () => Response.json({ error: { code: "unauthorized", message: "Invalid key", request_id: "denied" } }, { status: 401 }) });
  await assert.rejects(denied.listTokenizedEquities(), error => error instanceof TidelightApiError && error.status === 401 && error.requestId === "denied" && !error.message.includes(key));
});

test("client rejects unsafe URLs and malformed parameters before making calls", async () => {
  assert.throws(() => new TidelightClient({ apiKey: key, baseUrl: "http://example.com/api/v1" }), /HTTPS/);
  const client = new TidelightClient({ apiKey: key, fetch: async () => { throw new Error("should not call"); } });
  await assert.rejects(client.listTokenizedEquities({ limit: 101 }), /limit/);
  await assert.rejects(client.listTokenizedEquities({ cursor: "../../etc" }), /cursor/);
});

test("research client submits an idempotent job and reads its completed snapshot", async () => {
  const calls = [];
  const jobId = "01234567-89ab-4cde-8fab-0123456789ab";
  const client = new TidelightClient({ apiKey: key, maxRetries: 0, fetch: async (url, init) => {
    calls.push({ url: String(url), init });
    return (init.method === "POST"
      ? Response.json({ job_id: jobId, status: "queued", duplicate: false, request_id: "start" }, { status: 202 })
      : Response.json({ job_id: jobId, ticker: "NVDA", status: "complete", attempts: 1, max_attempts: 3, result: { type: "company_snapshot" }, error: null, created_at: "2026-01-01T00:00:00Z", started_at: null, completed_at: "2026-01-01T00:01:00Z", retry_at: null, request_id: "status" }));
  } });
  const accepted = await client.startCompanyResearch("NVDA", "idem-key-0001");
  assert.equal(accepted.job_id, jobId);
  assert.equal(calls[0].init.headers["Idempotency-Key"], "idem-key-0001");
  const result = await client.waitForResearchJob(jobId, { intervalMs: 250, timeoutMs: 500 });
  assert.equal(result.status, "complete");
  assert.equal(result.result.type, "company_snapshot");
  assert.equal(calls[1].url, `https://tidelight.app/api/v1/research/jobs/${jobId}`);
});

test("research client validates job identifiers and preserves scope failures", async () => {
  const client = new TidelightClient({ apiKey: key, maxRetries: 0, fetch: async () => Response.json({ error: { code: "insufficient_scope", message: "Missing scope", request_id: "denied" } }, { status: 403 }) });
  await assert.rejects(client.getResearchJob("../secret"), /job ID/);
  await assert.rejects(client.startCompanyResearch("NVDA", "short"), /idempotencyKey/);
  await assert.rejects(client.startCompanyResearch("NVDA", "idem-key-0002"), error => error.code === "insufficient_scope" && error.requestId === "denied");
});
