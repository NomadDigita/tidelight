import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createTidelightMcpServer } from "../dist/index.js";
import { createTidelightMcpProxy, validateTidelightMcpProxyOptions, DEFAULT_TIDELIGHT_MCP_URL } from "../dist/proxy.js";

const API_KEY = `tl_test_${"a".repeat(43)}`;

test("package metadata keeps registry publication disabled and exposes the executable", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.name, "@tidelight/mcp");
  assert.equal(pkg.private, true);
  assert.equal(pkg.bin["tidelight-mcp"], "bin/tidelight-mcp.mjs");
  assert.equal(pkg.exports["./proxy"].import, "./dist/proxy.js");
  assert.ok(pkg.files.includes("CHANGELOG.md"));
  assert.equal(pkg.scripts.prepack, "npm run build");
});

function fakeTidelightFetch(scopes, invoke, received) {
  return async (input, init) => {
    received.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization") });
    const server = createTidelightMcpServer(scopes, invoke);
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(new Request(input, init));
  };
}

async function connectLocalClient(server) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "mcp-proxy-test", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

test("proxy validates API key and rejects unsafe or malformed endpoints before connecting", () => {
  assert.equal(DEFAULT_TIDELIGHT_MCP_URL, "https://mcp.tidelight.app/mcp");
  assert.equal(validateTidelightMcpProxyOptions({ apiKey: API_KEY }).endpoint.href, DEFAULT_TIDELIGHT_MCP_URL);
  assert.throws(() => validateTidelightMcpProxyOptions({ apiKey: "not-a-key" }), /valid Tidelight API key/);
  for (const endpoint of ["http://example.com/mcp", "https://user:secret@example.com/mcp", "https://example.com/mcp?token=x", "https://example.com/mcp#fragment"]) {
    assert.throws(() => validateTidelightMcpProxyOptions({ apiKey: API_KEY, endpoint }), /HTTPS/);
  }
  assert.equal(validateTidelightMcpProxyOptions({ apiKey: API_KEY, endpoint: "http://127.0.0.1:4444/mcp" }).endpoint.hostname, "127.0.0.1");
});

test("proxy forwards scoped tool discovery and tool calls over MCP without exposing its credential", async () => {
  const requests = [], operations = [];
  const proxy = await createTidelightMcpProxy({
    apiKey: API_KEY,
    endpoint: "https://mcp.tidelight.app/mcp",
    fetch: fakeTidelightFetch(new Set(["market:read"]), async operation => {
      operations.push(operation);
      return Response.json({ data: [{ symbol: "RNVDAUSDT", underlying_ticker: operation.underlyingTicker ?? "NVDA", instrument_type: "tokenized_equity_spot", source: "Bitget Reality spot" }], next_cursor: null, generated_at: 1, request_id: "market-req" });
    }, requests),
  });
  const localClient = await connectLocalClient(proxy.server);
  try {
    const tools = await localClient.listTools();
    assert.deepEqual(tools.tools.map(tool => tool.name), ["tidelight_search_tokenized_equities", "tidelight_get_tokenized_equity"]);
    const result = await localClient.callTool({ name: "tidelight_get_tokenized_equity", arguments: { ticker: "nvda" } });
    assert.equal(result.structuredContent.data[0].source, "Bitget Reality spot");
    assert.deepEqual(operations, [{ operation: "market.list", limit: 100, underlyingTicker: "NVDA" }]);
    assert.ok(requests.length >= 3);
    assert.ok(requests.every(request => request.authorization === `Bearer ${API_KEY}`));
    assert.equal(JSON.stringify({ tools, result, operations }).includes(API_KEY), false);
  } finally {
    await localClient.close();
    await proxy.close();
  }
});

test("proxy forwards upstream authentication failures without echoing the API key", async () => {
  await assert.rejects(createTidelightMcpProxy({
    apiKey: API_KEY,
    fetch: async () => Response.json({ error: "invalid bearer token", leaked: API_KEY }, { status: 401 }),
  }), error => error.message.includes("Could not connect") && !error.message.includes(API_KEY));
});
