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
