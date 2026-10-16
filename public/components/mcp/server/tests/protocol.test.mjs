import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTidelightMcpServer, isTicMcpCredentialActive } from "../dist/index.js";

async function connect(scopes, invoke) {
  const server = createTidelightMcpServer(new Set(scopes), invoke);
  const client = new Client({ name: "tidelight-mcp-core-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

test("market scope exposes only the two market tools and preserves structured source data", async () => {
  const calls = [];
  const { server, client } = await connect(["market:read"], async operation => {
    calls.push(operation);
    const instruments = [{ underlying_ticker: "NVDA", source: "Bitget Reality spot" }, { underlying_ticker: "AAPL", source: "Bitget Reality spot" }];
    return Response.json({ data: operation.underlyingTicker ? instruments.filter(item => item.underlying_ticker === operation.underlyingTicker) : instruments.slice(0, operation.limit), request_id: "req-test" });
  });
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), ["tidelight_get_tokenized_equity", "tidelight_search_tokenized_equities"]);
  const result = await client.callTool({ name: "tidelight_get_tokenized_equity", arguments: { ticker: "nvda" } });
  assert.equal(result.structuredContent.request_id, "req-test");
  assert.equal(result.structuredContent.data[0].source, "Bitget Reality spot");
  assert.deepEqual(calls, [{ operation: "market.list", limit: 100, underlyingTicker: "NVDA" }]);
  const filtered = await client.callTool({ name: "tidelight_search_tokenized_equities", arguments: { underlying_ticker: "AAPL", limit: 1 } });
  assert.equal(filtered.structuredContent.data[0].underlying_ticker, "AAPL");
  assert.deepEqual(calls[1], { operation: "market.list", limit: 1, underlyingTicker: "AAPL" });
  await client.close();
  await server.close();
});

test("research scope validates inputs and invokes durable job operations", async () => {
  const calls = [];
  const { server, client } = await connect(["research:run"], async operation => {
    calls.push(operation);
    return Response.json({ job_id: "3d7fbd5c-a03c-4ba1-ae77-8ecf44dbdb5e", status: "queued", error: null });
  });
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name).sort(), ["tidelight_cancel_research_job", "tidelight_get_research_job", "tidelight_start_company_research"]);
  const invalid = await client.callTool({ name: "tidelight_start_company_research", arguments: { ticker: "NVDA;DROP" } });
  assert.equal(invalid.isError, true);
  assert.equal(calls.length, 0);
  const started = await client.callTool({ name: "tidelight_start_company_research", arguments: { ticker: "nvda", idempotency_key: "mcp-test-0001" } });
  assert.equal(started.structuredContent.status, "queued");
  assert.equal(calls[0].ticker, "NVDA");
  assert.equal(calls[0].idempotencyKey, "mcp-test-0001");
  await client.close();
  await server.close();
});

test("credential activity requires a supported scope and a current, unrevoked key", () => {
  const now = Date.parse("2026-10-15T00:00:00Z");
  assert.equal(isTicMcpCredentialActive({ scopes: ["market:read"], revoked_at: null, expires_at: "2026-10-16T00:00:00Z" }, now), true);
  assert.equal(isTicMcpCredentialActive({ scopes: ["research:run"], revoked_at: "2026-10-14T00:00:00Z", expires_at: null }, now), false);
  assert.equal(isTicMcpCredentialActive({ scopes: ["evidence:read"], revoked_at: null, expires_at: null }, now), false);
});
