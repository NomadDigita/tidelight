import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Next's server-only marker guards client bundles. This Node test process is a
// server context; substitute only that marker while importing the actual helper.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { aiJsonWithFallback, configuredAiProviders } = await import("../lib/ai-fallback.ts");
hooks.deregister();

const messages = [{ role: "system", content: "Return JSON" }, { role: "user", content: "Assess supplied facts" }];
const valid = value => value.summary === "Grounded result";
const answer = { summary: "Grounded result" };
const qwen = content => Response.json({ choices: [{ finish_reason: "stop", message: { content } }] });
const gemini = (parts, finishReason = "STOP") => Response.json({ candidates: [{ finishReason, content: { parts } }] });

function configure(t, both = true) {
  const keys = ["BITGET_QWEN_API_KEY", "BITGET_QWEN_MODEL", "BITGET_QWEN_BASE_URL", "GEMINI_API_KEY", "GEMINI_MODEL"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.BITGET_QWEN_API_KEY = both ? "test-qwen-key" : "";
  process.env.BITGET_QWEN_MODEL = "qwen-test";
  process.env.BITGET_QWEN_BASE_URL = "https://hackathon.bitgetops.com/v1";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GEMINI_MODEL = "gemini-test";
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

test("Qwen receives JSON instructions and a valid result avoids fallback", async t => {
  configure(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://hackathon.bitgetops.com/v1/chat/completions");
    assert.equal(init.headers.Authorization, "Bearer test-qwen-key");
    assert.deepEqual(JSON.parse(init.body).response_format, { type: "json_object" });
    return qwen(JSON.stringify(answer));
  });
  assert.deepEqual(await aiJsonWithFallback(messages, valid), answer);
  assert.equal(fetch.mock.callCount(), 1);
});

test("native Gemini excludes thought text and joins only final answer parts", async t => {
  configure(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url, init) => {
    if (url.includes("bitgetops")) return qwen('{"summary":"Rejected assessment"}');
    assert.equal(init.headers["x-goog-api-key"], "test-gemini-key");
    assert.equal(new URL(url).search, "");
    const body = JSON.parse(init.body);
    assert.deepEqual(body.systemInstruction, { parts: [{ text: messages[0].content }] });
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    return gemini([{ text: "Internal thought summary", thought: true }, { text: '{"summary":' }, { text: '"Grounded result"}' }]);
  });
  assert.deepEqual(await aiJsonWithFallback(messages, valid), answer);
  assert.equal(fetch.mock.callCount(), 2);
});

test("blocked Gemini response cannot pass validation even with plausible JSON", async t => {
  configure(t, false);
  t.mock.method(globalThis, "fetch", async () => gemini([{ text: JSON.stringify(answer) }], "SAFETY"));
  await assert.rejects(aiJsonWithFallback(messages, valid), /gemini-invalid-response/);
});

test("complete MAX_TOKENS JSON remains usable but truncated JSON is rejected", async t => {
  configure(t, false);
  const fetch = t.mock.method(globalThis, "fetch", async () => gemini([{ text: JSON.stringify(answer) }], "MAX_TOKENS"));
  assert.deepEqual(await aiJsonWithFallback(messages, valid), answer);
  fetch.mock.mockImplementation(async () => gemini([{ text: '{"summary":"Grounded' }], "MAX_TOKENS"));
  await assert.rejects(aiJsonWithFallback(messages, valid), /gemini-invalid-response/);
});

test("transient HTTP retries remain bounded before switching provider", async t => {
  configure(t);
  let qwenCalls = 0;
  t.mock.method(globalThis, "fetch", async url => {
    if (url.includes("bitgetops")) { qwenCalls++; return new Response("Unavailable", { status: 503 }); }
    return gemini([{ text: JSON.stringify(answer) }]);
  });
  assert.deepEqual(await aiJsonWithFallback(messages, valid), answer);
  assert.equal(qwenCalls, 2);
});

test("stalled Qwen response body is aborted and leaves time for Gemini", async t => {
  configure(t);
  let qwenSignal;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (url.includes("bitgetops")) {
      qwenSignal = init.signal;
      return { ok: true, json: () => new Promise(() => {}) };
    }
    return gemini([{ text: JSON.stringify(answer) }]);
  });
  assert.deepEqual(await aiJsonWithFallback(messages, valid, { budgetMs: 150 }), answer);
  assert.equal(qwenSignal.aborted, true);
});

test("an elapsed route deadline prevents new provider requests", async t => {
  configure(t);
  const fetch = t.mock.method(globalThis, "fetch", async () => qwen(JSON.stringify(answer)));
  await assert.rejects(aiJsonWithFallback(messages, valid, { budgetMs: 42000, deadlineAt: Date.now() - 1 }), /ai-budget-exhausted/);
  assert.equal(fetch.mock.callCount(), 0);
});

test("a stalled final provider aborts without retrying after the total budget", async t => {
  configure(t, false);
  let signal;
  const fetch = t.mock.method(globalThis, "fetch", async (_url, init) => {
    signal = init.signal;
    return { ok: true, json: () => new Promise(() => {}) };
  });
  await assert.rejects(aiJsonWithFallback(messages, valid, { budgetMs: 30 }), /gemini-timeout/);
  assert.equal(signal.aborted, true);
  assert.equal(fetch.mock.callCount(), 1);
});

test("research can opt into a longer Gemini window within its route deadline", async t => {
  configure(t, false);
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "fetch", async () => {
    now += 21000;
    return gemini([{ text: JSON.stringify(answer) }]);
  });
  assert.deepEqual(await aiJsonWithFallback(messages, valid, { budgetMs: 42000, deadlineAt: 53000 }), answer);
});

test("retries cannot reset a deadline consumed during source gathering", async t => {
  configure(t);
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const fetch = t.mock.method(globalThis, "fetch", async url => {
    if (url.includes("bitgetops")) { now = 1004; return new Response(null, { status: 503 }); }
    now = 1011;
    return gemini([{ text: JSON.stringify(answer) }]);
  });
  await assert.rejects(aiJsonWithFallback(messages, valid, { budgetMs: 42000, deadlineAt: 1010 }), /ai-budget-exhausted/);
  assert.equal(fetch.mock.callCount(), 2);
});

test("default budget is bounded even with a much later caller deadline", async t => {
  configure(t, false);
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    now += 20001;
    return new Response(null, { status: 503 });
  });
  await assert.rejects(aiJsonWithFallback(messages, valid, { deadlineAt: 1000000 }), /ai-budget-exhausted/);
  assert.equal(fetch.mock.callCount(), 1);
});

test("provider credentials cannot be redirected through custom URLs", t => {
  configure(t);
  process.env.BITGET_QWEN_BASE_URL = "https://hackathon.bitgetops.com.attacker.invalid/v1";
  assert.deepEqual(configuredAiProviders().map(provider => provider.label), ["gemini"]);
});
