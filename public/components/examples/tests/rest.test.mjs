import assert from "node:assert/strict";
import test from "node:test";
import { listTokenizedEquities } from "../rest/market.mjs";
import { runCompanyResearch } from "../rest/research.mjs";

test("market example authenticates and emits only service-returned data", async () => {
  let request;
  const fetchImpl = async (url, init) => {
    request = { url, init };
    return Response.json({ request_id: "request-example", data: [{ symbol: "NVDAx", underlying_ticker: "NVDA", source: "Bitget Reality spot" }] });
  };
  const result = await listTokenizedEquities("tl_test_example", fetchImpl);
  assert.equal(request.url, "https://api.tidelight.app/v1/market/instruments?kind=rtoken&limit=10");
  assert.equal(request.init.headers.Authorization, "Bearer tl_test_example");
  assert.equal(result.data[0].source, "Bitget Reality spot");
  assert.equal(JSON.stringify(result).includes("tl_test_example"), false);
});

test("research example uses stable idempotency and bounded polling until terminal state", async () => {
  const calls = [];
  let polls = 0;
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (init.method === "POST") return Response.json({ job_id: "3d7fbd5c-a03c-4ba1-ae77-8ecf44dbdb5e", status: "queued" }, { status: 202 });
    polls++;
    return Response.json({ job_id: "3d7fbd5c-a03c-4ba1-ae77-8ecf44dbdb5e", status: polls === 1 ? "running" : "complete", ticker: "NVDA", result: null });
  };
  const result = await runCompanyResearch("tl_test_example", "nvda", { fetchImpl, pause: async () => {}, maxPolls: 2 });
  assert.equal(result.status, "complete");
  assert.equal(calls.length, 3);
  assert.match(calls[0].init.headers["Idempotency-Key"], /^example-/);
  assert.equal(JSON.parse(calls[0].init.body).ticker, "NVDA");
});

test("research rejects malformed tickers before making a request", async () => {
  let called = false;
  await assert.rejects(runCompanyResearch("tl_test_example", "NVDA;DROP", { fetchImpl: async () => { called = true; } }), /supported stock ticker/);
  assert.equal(called, false);
});
