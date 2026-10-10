import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { AgentKeyClient, configuredAgentKey } = await import("../lib/agentkey.ts");
hooks.deregister();

test("missing key leaves AgentKey disabled", t => {
  const previous = process.env.AGENTKEY_API_KEY;
  delete process.env.AGENTKEY_API_KEY;
  t.after(() => previous === undefined ? delete process.env.AGENTKEY_API_KEY : process.env.AGENTKEY_API_KEY = previous);
  assert.equal(configuredAgentKey(), null);
});

test("MCP handshake and discovery/description/execution preserve session and secret server-side", async () => {
  const calls = [];
  const transport = async (url, init) => {
    assert.equal(url, "https://api.agentkey.app/v1/mcp");
    assert.equal(init.headers.Authorization, "Bearer test-secret");
    assert.equal(init.headers.Accept, "application/json, text/event-stream");
    const body = JSON.parse(init.body);
    calls.push({ body, headers: init.headers });
    if (body.method === "initialize") return Response.json({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-06-18", capabilities: {} } }, { headers: { "Mcp-Session-Id": "session-123" } });
    if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
    return Response.json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: body.params.name }] } });
  };
  const client = new AgentKeyClient("test-secret", transport);
  await client.findTools("Find recent NVDA headlines");
  await client.describeTool("Brave/getWebSearch");
  await client.executeTool("Brave/getWebSearch", { query: "NVDA" });
  assert.deepEqual(calls.map(call => call.body.method), ["initialize", "notifications/initialized", "tools/call", "tools/call", "tools/call"]);
  assert.deepEqual(calls.slice(2).map(call => call.body.params.name), ["find_tools", "describe_tool", "execute_tool"]);
  assert.equal(calls[2].body.params.arguments.q, "Find recent NVDA headlines");
  assert.equal(calls[4].headers["Mcp-Session-Id"], "session-123");
});

test("SSE tool response selects matching JSON-RPC id", async () => {
  const transport = async (_url, init) => {
    const { id, method } = JSON.parse(init.body);
    if (method === "notifications/initialized") return new Response(null, { status: 202 });
    if (method === "initialize") return Response.json({ jsonrpc: "2.0", id, result: { protocolVersion: "2025-06-18" } });
    return new Response(`event: message\ndata: {"jsonrpc":"2.0","id":999,"result":"wrong"}\n\nevent: message\ndata: {"jsonrpc":"2.0","id":${id},"result":{"content":[]}}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
  };
  assert.deepEqual(await new AgentKeyClient("test", transport).findTools("research TSLA"), { content: [] });
});

test("authorization and upstream errors never echo credentials or response body", async () => {
  const client = new AgentKeyClient("private-secret", async () => new Response("private-secret", { status: 401 }));
  await assert.rejects(client.findTools("stocks"), error => error.message === "agentkey-unauthorized" && !error.message.includes("private-secret"));
});
