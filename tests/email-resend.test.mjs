import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/email/resend.ts", import.meta.url), "utf8");
const javascript = ts.transpile(source.replace(/^import\s+["']server-only["'];\s*/m, ""), { module: ts.ModuleKind.ESNext });
const { sendWithResend } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);

test("Resend requests remain server-side, branded, and idempotent", async () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = "resend-test-key";
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({ id: "mail_123" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await sendWithResend({ from: "Tidelight <alerts@tidelight.app>", to: "safe@example.test", replyTo: "owner@example.test", subject: "Nightwatch signal", html: "<p>Paper only</p>", idempotencyKey: "nightwatch:run-1:signal" });
    assert.deepEqual(result, { id: "mail_123" });
    assert.equal(captured.url, "https://api.resend.com/emails");
    assert.equal(captured.options.headers.Authorization, "Bearer resend-test-key");
    assert.equal(captured.options.headers["Idempotency-Key"], "nightwatch:run-1:signal");
    assert.deepEqual(JSON.parse(captured.options.body).to, ["safe@example.test"]);
    assert.equal(JSON.parse(captured.options.body).reply_to, "owner@example.test");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  }
});

test("provider errors expose only a bounded status code, never provider response content", async () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = "resend-test-key";
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "private@example.test rejected <script>" }), { status: 422 });
  try {
    await assert.rejects(sendWithResend({ from: "Tidelight <alerts@tidelight.app>", to: "private@example.test", subject: "Update", html: "body", idempotencyKey: "event-key-2" }), (error) => {
      assert.equal(error.code, "resend_422");
      assert.doesNotMatch(error.message, /private@example|script/i);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  }
});
