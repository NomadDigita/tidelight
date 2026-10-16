import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createTidelightMcpServer, isTicMcpCredentialActive } from "../public/components/mcp/server/src/index.ts";

async function clientFor(scopes, invoke) {
  const fetch = async (input, init) => {
    const server = createTidelightMcpServer(scopes, invoke);
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(new Request(input, init));
  };
  const client = new Client({ name: "tic-protocol-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("https://tidelight.app/api/mcp"), { fetch }));
  return client;
}

test("MCP credentials must be active and carry a currently supported scope", () => {
  const now = Date.parse("2026-10-15T00:00:00Z");
  assert.equal(isTicMcpCredentialActive({ scopes: ["market:read"], revoked_at: null, expires_at: "2026-10-16T00:00:00Z" }, now), true);
  assert.equal(isTicMcpCredentialActive({ scopes: ["research:run"], revoked_at: null, expires_at: null }, now), true);
  assert.equal(isTicMcpCredentialActive({ scopes: ["research:run"], revoked_at: "2026-10-14T00:00:00Z", expires_at: null }, now), false);
  assert.equal(isTicMcpCredentialActive({ scopes: ["market:read"], revoked_at: null, expires_at: "2026-10-14T00:00:00Z" }, now), false);
  assert.equal(isTicMcpCredentialActive({ scopes: ["evidence:read"], revoked_at: null, expires_at: null }, now), false);
});

test("official Streamable HTTP client discovers scoped market tools and receives source-labeled results", async () => {
  const operations = [];
  const client = await clientFor(new Set(["market:read"]), async operation => {
    operations.push(operation);
    const instruments = [
      { symbol: "RNVDAUSDT", underlying_ticker: "NVDA", instrument_type: "tokenized_equity_spot", source: "Bitget Reality spot", provider_timestamp: "2026-10-15T00:00:00Z" },
      { symbol: "RAAPLUSDT", underlying_ticker: "AAPL", instrument_type: "tokenized_equity_spot", source: "Bitget Reality spot", provider_timestamp: "2026-10-15T00:00:00Z" },
    ];
    return Response.json({ data: operation.underlyingTicker ? instruments.filter(item => item.underlying_ticker === operation.underlyingTicker) : instruments.slice(0, operation.limit), next_cursor: null, generated_at: 1, request_id: "market-request" });
  });
  try {
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(tool => tool.name), ["tidelight_search_tokenized_equities", "tidelight_get_tokenized_equity"]);
    const result = await client.callTool({ name: "tidelight_get_tokenized_equity", arguments: { ticker: "NVDA" } });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent.data.length, 1);
    assert.equal(result.structuredContent.data[0].source, "Bitget Reality spot");
    assert.deepEqual(operations[0], { operation: "market.list", limit: 100, underlyingTicker: "NVDA" });
    const search = await client.callTool({ name: "tidelight_search_tokenized_equities", arguments: { underlying_ticker: "AAPL", limit: 1 } });
    assert.equal(search.structuredContent.data[0].underlying_ticker, "AAPL");
    assert.deepEqual(operations[1], { operation: "market.list", limit: 1, underlyingTicker: "AAPL" });
    const denied = await client.callTool({ name: "tidelight_start_company_research", arguments: { ticker: "NVDA" } });
    assert.equal(denied.isError, true);
  } finally { await client.close(); }
});

test("research scope exposes durable start, status, and cancellation tools over the official protocol", async () => {
  const operations = [];
  const client = await clientFor(new Set(["research:run"]), async operation => {
    operations.push(operation);
    if (operation.operation === "research.start") return Response.json({ job_id: "d475bd46-5035-4ae5-9f19-e2959a4f0734", status: "queued", duplicate: false, request_id: "start-request" }, { status: 202 });
    if (operation.operation === "research.get") return Response.json({ job_id: operation.jobId, ticker: "NVDA", status: "complete", result: { type: "company_snapshot" }, error: null, request_id: "status-request" });
    return Response.json({ job_id: operation.jobId, status: "cancelled", request_id: "cancel-request" }, { status: 202 });
  });
  try {
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(tool => tool.name), ["tidelight_start_company_research", "tidelight_get_research_job", "tidelight_cancel_research_job"]);
    const start = await client.callTool({ name: "tidelight_start_company_research", arguments: { ticker: "NVDA" } });
    const jobId = start.structuredContent.job_id;
    assert.equal(start.structuredContent.status, "queued");
    assert.match(operations[0].idempotencyKey, /^[A-Za-z0-9._:-]{8,128}$/);
    const status = await client.callTool({ name: "tidelight_get_research_job", arguments: { job_id: jobId } });
    assert.equal(status.isError, undefined);
    assert.equal(status.structuredContent.result.type, "company_snapshot");
    const cancel = await client.callTool({ name: "tidelight_cancel_research_job", arguments: { job_id: jobId } });
    assert.equal(cancel.structuredContent.status, "cancelled");
  } finally { await client.close(); }
});
