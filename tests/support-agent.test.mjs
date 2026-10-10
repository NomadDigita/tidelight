import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  const mocked = {
    "server-only": "export {};",
    "@/lib/ai-fallback": "export const configuredAiProviders=()=>globalThis.supportProviders;export const aiJsonWithFallback=(...args)=>globalThis.supportGenerate(...args);",
    "@/lib/supabase/server": "export const createClient=async()=>globalThis.supportDatabase;",
    "@/lib/support-knowledge": "export * from " + JSON.stringify(new URL("../lib/support-knowledge.ts", import.meta.url).href) + ";",
  };
  if (mocked[specifier]) return { url: "data:text/javascript," + encodeURIComponent(mocked[specifier]), shortCircuit: true };
  return nextResolve(specifier, context);
}});
const { POST } = await import("../app/api/support/route.ts");
const { supportTopicsFor, supportFallback, allowedSupportLinks } = await import("../lib/support-knowledge.ts");
hooks.deregister();

function ask(question, extra = {}, origin = "https://tidelight.test") {
  return POST(new Request("https://tidelight.test/api/support", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ question, pathname: "/flow", ...extra }) }));
}

test("demo API answer follows official verified setup and links only approved destinations", () => {
  const topics = supportTopicsFor("How do I get a Bitget demo API key?", "/trading");
  assert.equal(topics[0].id, "demo-key");
  const answer = supportFallback(topics);
  assert.match(answer.answer, /Demo mode.*Personal Center.*API Key Management.*Create Demo API Key/);
  assert.match(answer.answer, /Never paste credentials into this chat/);
  assert.deepEqual(allowedSupportLinks(topics, ["https://attacker.test", "/trading"]), [{ label: "Open Tidelight Trading", href: "/trading" }]);
});

test("guest receives a useful grounded answer without provider or database access", async () => {
  globalThis.supportProviders = [{ label: "qwen" }];
  globalThis.supportDatabase = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } };
  globalThis.supportGenerate = () => { throw new Error("Must not call provider"); };
  const reply = await (await ask("How does Agent Flow work?")).json();
  assert.equal(reply.source, "knowledge");
  assert.match(reply.answer, /checkpoint/);
  assert.equal(reply.links[0].href, "/flow");
});

test("never sends pasted credentials to AI even for an authenticated user", async () => {
  globalThis.supportGenerate = () => { throw new Error("Must not call provider"); };
  const reply = await (await ask("My api secret: verysecretvalue is failing")).json();
  assert.match(reply.answer, /remove it/);
  assert.equal(reply.source, "knowledge");
});

test("signed-in AI uses reserved budget and cannot emit unapproved links", async () => {
  let reserved = 0;
  globalThis.supportProviders = [{ label: "qwen" }];
  globalThis.supportDatabase = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) },
    rpc: async name => { assert.equal(name, "reserve_support_agent_request"); reserved++; return { data: true, error: null }; },
  };
  globalThis.supportGenerate = async (messages, valid, options) => {
    assert.match(messages[0].content, /PRODUCT KNOWLEDGE/);
    assert.equal(messages[1].content, "How do I use research?");
    assert.equal(options.budgetMs, 14000);
    const value = { answer: "Ask one focused question, then inspect cited passages and their dates.", linkHrefs: ["https://attacker.test", "/research"] };
    assert.equal(valid(value), true);
    return value;
  };
  const reply = await (await ask("How do I use research?")).json();
  assert.equal(reserved, 1);
  assert.equal(reply.source, "ai");
  assert.deepEqual(reply.links, [{ label: "Open Research", href: "/research" }]);
});

test("failed reservation and provider failures return the reviewed instructions", async () => {
  globalThis.supportDatabase.rpc = async () => ({ data: false, error: null });
  globalThis.supportGenerate = () => { throw new Error("Must not call provider after limit"); };
  assert.equal((await (await ask("How do I use research?")).json()).source, "knowledge");
  globalThis.supportDatabase.rpc = async () => ({ data: true, error: null });
  assert.equal((await (await ask("How do I use research?")).json()).source, "knowledge");
});

test("origin and input bounds are enforced", async () => {
  assert.equal((await ask("Help", {}, "https://outside.test")).status, 403);
  assert.equal((await ask("x".repeat(1201))).status, 400);
  assert.equal((await ask("")).status, 400);
});
