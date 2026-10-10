import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
  if (specifier === "./agentkey" || specifier === "./agent-flow-sources") return nextResolve(`${specifier}.ts`, context);
  return nextResolve(specifier, context);
} });
const { agentKeyIssuerEvidence } = await import("../lib/agentkey-flow-sources.ts");
hooks.deregister();

const today = new Date().toISOString();
function client({ cost = 1, result, discover = "agentkey_search", fail = false } = {}) {
  const calls = [];
  return { calls, api: {
    async findTools(query) { calls.push(["find", query]); return { content: [{ text: JSON.stringify({ tools: [{ name: discover }] }) }] }; },
    async describeTool(name) { calls.push(["describe", name]); return { content: [{ text: JSON.stringify({ name, cost }) }] }; },
    async executeTool(name, params) { calls.push(["execute", name, params]); if (fail) throw new Error("no service"); return { content: [{ text: JSON.stringify(result) }] }; },
  } };
}

test("AgentKey admits attributable, relevant HTTPS headlines with provenance and bounded tool params", async () => {
  const { api, calls } = client({ result: { results: [
    { title: "NVDA earnings outlook", url: "https://publisher.example/news", publisher: "Publisher", publishedAt: today, snippet: "NVDA result" },
    { title: "unrelated story", url: "https://publisher.example/unrelated", publishedAt: today },
    { title: "NVDA link without date", url: "https://publisher.example/undated" },
    { title: "NVDA unsafe link", url: "http://publisher.example/a", publishedAt: today },
  ] } });
  const evidence = await agentKeyIssuerEvidence("NVDA", "NVIDIA", api);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].via, "AgentKey");
  assert.equal(calls[2][1], "agentkey_search");
  assert.deepEqual(calls[2][2], { query: "NVIDIA NVDA stock latest news", type: "news", num: 5 });
});

test("no execution with undiscovered tool or ambiguous and over-budget cost", async () => {
  for (const options of [{ discover: "agentkey_social" }, { cost: 3 }, { cost: "unknown" }]) {
    const { api, calls } = client(options);
    assert.deepEqual(await agentKeyIssuerEvidence("TSLA", "Tesla", api), []);
    assert.equal(calls.some(([name]) => name === "execute"), false);
  }
});

test("upstream failure returns empty evidence so public feeds can continue", async () => {
  const { api } = client({ fail: true });
  assert.deepEqual(await agentKeyIssuerEvidence("NVDA", "NVIDIA", api), []);
});
