import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    if (specifier.startsWith("@/lib/")) return { url: new URL(`../lib/${specifier.slice(6)}.ts`, import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { parseDecision } = await import("../lib/nightwatch-agent.ts");
hooks.deregister();

const proposal = { action: "buy", confidence: 0.8, rationale: "The completed-bar rule and source evidence support a paper review.", evidence: ["Completed-bar candidate"], risks: ["Gap risk"], invalidation: "Next completed close falls below the trend.", horizon: "Next completed candle" };

test("malformed confidence cannot turn an AI proposal into a paper fill signal", () => {
  for (const confidence of [true, false, null, [], [1], "0.9", NaN, Infinity, -0.1, 1.1]) {
    assert.equal(parseDecision({ ...proposal, confidence }), null, String(confidence));
  }
});

test("valid low-confidence proposals hold while threshold decisions preserve their action", () => {
  assert.equal(parseDecision({ ...proposal, confidence: 0.659 }).signal, "hold");
  assert.equal(parseDecision({ ...proposal, confidence: 0.66 }).signal, "buy");
  assert.equal(parseDecision({ ...proposal, action: "sell", confidence: 1 }).signal, "sell");
  assert.equal(parseDecision({ ...proposal, action: "hold", confidence: 1 }).signal, "hold");
  assert.equal(parseDecision({ ...proposal, confidence: 0 }).signal, "hold");
});

test("invalid actions and unusable explanations trigger provider fallback", () => {
  assert.equal(parseDecision({ ...proposal, action: "withdraw" }), null);
  assert.equal(parseDecision({ ...proposal, rationale: "yes" }), null);
  assert.equal(parseDecision({ ...proposal, rationale: "x".repeat(501) }), null);
});
