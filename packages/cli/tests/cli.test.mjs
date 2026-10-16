import test from "node:test";
import assert from "node:assert/strict";
import { runCli } from "../dist/cli.js";
import { TidelightApiError } from "@tidelight/sdk";

const apiKey = `tl_test_${"x".repeat(43)}`;
function harness(overrides = {}) {
  const out = [], err = [], state = { key: null }, calls = [];
  const deps = {
    stdout: { write: value => out.push(String(value)) },
    stderr: { write: value => err.push(String(value)) },
    env: {},
    credentialStore: {
      get: () => state.key,
      set: value => { state.key = value; },
      delete: () => { state.key = null; },
    },
    promptSecret: async () => apiKey,
    createClient: key => {
      calls.push(["client", key]);
      if (overrides.createClient) return overrides.createClient(key, calls);
      return {
        listTokenizedEquities: async options => { calls.push(["market", options]); return { data: [], next_cursor: null, generated_at: 10, request_id: "r-market" }; },
        startCompanyResearch: async (...args) => { calls.push(["start", ...args]); return { job_id: "00000000-0000-4000-8000-000000000001", status: "queued", duplicate: false, request_id: "r-start" }; },
        getResearchJob: async (...args) => { calls.push(["get", ...args]); return { job_id: args[0], status: "complete", result: { summary: "source-backed" }, request_id: "r-get" }; },
        waitForResearchJob: async (...args) => { calls.push(["wait", ...args]); return { job_id: args[0], status: "complete", request_id: "r-wait" }; },
        cancelResearchJob: async (...args) => { calls.push(["cancel", ...args]); return { job_id: args[0], status: "cancelled", request_id: "r-cancel" }; },
        listWebhooks: async () => ({ endpoints: [], request_id: "r-webhooks" }),
        createWebhook: async (...args) => { calls.push(["webhook-create", ...args]); return { endpoint: { id: "endpoint-1" }, signing_secret: "secret-once", request_id: "r-hook" }; },
        updateWebhook: async (...args) => { calls.push(["webhook-update", ...args]); return { endpoint: { id: args[0] }, signing_secret: "secret-rotated", request_id: "r-hook" }; },
        disableWebhook: async id => ({ disabled: true, request_id: "r-disable", id }),
        listWebhookDeliveries: async () => ({ deliveries: [], request_id: "r-deliveries" }),
      };
    },
    ...overrides,
  };
  return { deps, out, err, state, calls };
}

test("help and version work without credentials", async () => {
  const h = harness();
  assert.equal(await runCli(["--help"], h.deps), 0);
  assert.match(h.out.join(""), /market instruments/);
  assert.equal(await runCli(["--version"], h.deps), 0);
  assert.match(h.out.join(""), /0\.1\.0.*unpublished/);
  assert.equal(h.calls.length, 0);
});

test("auth status reports configured credentials without claiming they are valid", async () => {
  const h = harness();
  h.deps.env.TIDELIGHT_API_KEY = apiKey;
  assert.equal(await runCli(["auth", "status"], h.deps), 0);
  assert.match(h.out.join(""), /Credential configured/);
  assert.match(h.out.join(""), /validity has not been checked/);
  assert.doesNotMatch(h.out.join(""), /Authenticated/);
});

test("login stores a valid key without printing it and environment key takes precedence", async () => {
  const h = harness();
  assert.equal(await runCli(["auth", "login"], h.deps), 0);
  assert.equal(h.state.key, apiKey);
  assert.equal(h.out.join("").includes(apiKey), false);
  h.deps.env.TIDELIGHT_API_KEY = `tl_live_${"y".repeat(43)}`;
  assert.equal(await runCli(["market", "instruments", "--json"], h.deps), 0);
  assert.equal(h.calls.find(item => item[0] === "client")[1], h.deps.env.TIDELIGHT_API_KEY);
  assert.match(h.out.join(""), /"request_id": "r-market"/);
});

test("market command validates bounds and forwards normalized source filters", async () => {
  const h = harness(); h.deps.env.TIDELIGHT_API_KEY = apiKey;
  assert.equal(await runCli(["market", "instruments", "--ticker", "nvda", "--limit", "101"], h.deps), 2);
  assert.match(h.err.join(""), /--limit must be an integer/);
  assert.equal(h.calls.some(item => item[0] === "market"), false);
  assert.equal(await runCli(["market", "instruments", "--ticker", "nvda", "--limit", "12"], h.deps), 0);
  const call = h.calls.find(item => item[0] === "market");
  assert.equal(call[1].underlyingTicker, "nvda");
  assert.equal(call[1].limit, 12);
  assert.match(h.out.join(""), /No instruments returned/);
});

test("provider redistribution gate stays visible without a fallback feed", async () => {
  const h = harness({ createClient: () => ({ listTokenizedEquities: async () => { throw new TidelightApiError(503, "provider_terms_unconfirmed", "Market feed is unavailable.", "market-req"); } }) });
  h.deps.env.TIDELIGHT_API_KEY = apiKey;
  assert.equal(await runCli(["market", "instruments"], h.deps), 1);
  assert.match(h.err.join(""), /provider_terms_unconfirmed/);
  assert.match(h.err.join(""), /redistribution terms/);
  assert.doesNotMatch(h.err.join(""), /tl_test_|market-req.*secret/);
});

test("research start uses an idempotency key and wait respects SDK bounds", async () => {
  const h = harness(); h.deps.env.TIDELIGHT_API_KEY = apiKey;
  assert.equal(await runCli(["research", "start", "NVDA", "--wait", "--interval-ms", "249"], h.deps), 2);
  assert.match(h.err.join(""), /--interval-ms must be an integer/);
  assert.equal(h.calls.some(item => item[0] === "start"), false);
  assert.equal(await runCli(["research", "start", "NVDA", "--idempotency-key", "stable-key-123", "--wait"], h.deps), 0);
  const start = h.calls.find(item => item[0] === "start");
  const wait = h.calls.find(item => item[0] === "wait");
  assert.equal(start[1], "NVDA");
  assert.equal(start[2], "stable-key-123");
  assert.equal(wait[1], "00000000-0000-4000-8000-000000000001");
  assert.match(h.out.join(""), /complete/);
});

test("JSON research start preserves the accepted job if wait times out", async () => {
  const h = harness({ createClient: () => ({ startCompanyResearch: async () => ({ job_id: "00000000-0000-4000-8000-000000000001", status: "queued", request_id: "r-start" }), waitForResearchJob: async () => { throw new Error("Timed out waiting for research job."); } }) });
  h.deps.env.TIDELIGHT_API_KEY = apiKey;
  assert.equal(await runCli(["research", "start", "NVDA", "--wait", "--json"], h.deps), 1);
  const response = JSON.parse(h.out.join(""));
  assert.equal(response.accepted.job_id, "00000000-0000-4000-8000-000000000001");
  assert.equal(response.polling_error.job_id, response.accepted.job_id);
  assert.match(h.err.join(""), /job .* was accepted/);
});

test("webhook signing secret is shown once with an explicit warning", async () => {
  const h = harness(); h.deps.env.TIDELIGHT_API_KEY = apiKey;
  assert.equal(await runCli(["webhooks", "create", "--name", "Research events", "--url", "https://example.com/hooks", "--events", "research.job.completed", "--json"], h.deps), 0);
  assert.equal(h.out.join("").split("secret-once").length - 1, 1);
  assert.match(h.err.join(""), /shown once/);
  const call = h.calls.find(item => item[0] === "webhook-create");
  assert.deepEqual(call[1], { name: "Research events", url: "https://example.com/hooks", events: ["research.job.completed"] });
});

test("bad credentials and unknown options fail before a request", async () => {
  const h = harness(); h.deps.env.TIDELIGHT_API_KEY = "not-a-key";
  assert.equal(await runCli(["research", "get", "00000000-0000-4000-8000-000000000001"], h.deps), 2);
  assert.equal(h.calls.some(item => item[0] === "get"), false);
  h.deps.env.TIDELIGHT_API_KEY = apiKey;
  assert.equal(await runCli(["market", "instruments", "--unknown", "value"], h.deps), 2);
  assert.equal(h.calls.some(item => item[0] === "market"), false);
});
