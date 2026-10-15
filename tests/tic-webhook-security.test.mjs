import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createWebhookSecret, decryptWebhookSecret, isPublicWebhookAddress, signWebhookPayload, validateWebhookUrl } from "../lib/tic/webhook-security.ts";
import { readBoundedWebhookJson, WebhookInputError } from "../lib/tic/webhook-input.ts";

const previous = process.env.TIC_WEBHOOK_ENCRYPTION_KEY;
process.env.TIC_WEBHOOK_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64url");

test("webhook destination validation permits public HTTPS and rejects unsafe URL forms", () => {
  assert.equal(validateWebhookUrl("https://hooks.example.com/events").hostname, "hooks.example.com");
  for (const value of [
    "http://hooks.example.com/events",
    "https://user:pass@hooks.example.com/events",
    "https://hooks.example.com:8443/events",
    "https://localhost/events",
    "https://admin.local/events",
    "https://hooks.example.com/events?access_token=secret",
    "https://127.0.0.1/events",
    "https://[::1]/events",
  ]) assert.throws(() => validateWebhookUrl(value));
});

test("public address screening rejects private, loopback, reserved, and mapped addresses", () => {
  for (const address of ["0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.1.2", "172.16.0.1", "192.0.0.9", "192.168.1.1", "198.19.0.1", "203.0.113.4", "224.0.0.1", "::", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1", "2001:20::1", "2002:7f00:1::1"]) assert.equal(isPublicWebhookAddress(address), false, address);
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(isPublicWebhookAddress(address), true, address);
});

test("webhook signing secret is random, encrypted at rest, and decrypts only with the configured key", () => {
  const first = createWebhookSecret();
  const second = createWebhookSecret();
  assert.match(first.secret, /^whsec_[A-Za-z0-9_-]{40,}$/);
  assert.notEqual(first.secret, second.secret);
  assert.notEqual(first.encryptedSecret, first.secret);
  assert.equal(decryptWebhookSecret(first.encryptedSecret), first.secret);
  const payload = '{"id":"event-1","type":"research.job.completed"}';
  assert.equal(signWebhookPayload(first.secret, payload, "1792038400"), createHmac("sha256", first.secret).update(`1792038400.${payload}`).digest("hex"));
  assert.notEqual(signWebhookPayload(first.secret, payload, "1792038400"), signWebhookPayload(first.secret, payload, "1792038401"));
  const key = process.env.TIC_WEBHOOK_ENCRYPTION_KEY;
  process.env.TIC_WEBHOOK_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64url");
  assert.throws(() => decryptWebhookSecret(first.encryptedSecret));
  process.env.TIC_WEBHOOK_ENCRYPTION_KEY = key;
});

test("webhook management bodies are bounded even when content length is omitted", async () => {
  const parsed = await readBoundedWebhookJson(new Request("https://tidelight.app/api/v1/webhooks", { method: "POST", body: '{"name":"Research"}' }), 32);
  assert.deepEqual(parsed, { name: "Research" });
  await assert.rejects(() => readBoundedWebhookJson(new Request("https://tidelight.app/api/v1/webhooks", { method: "POST", body: "x".repeat(100) }), 32), error => error instanceof WebhookInputError && error.code === "too_large");
  await assert.rejects(() => readBoundedWebhookJson(new Request("https://tidelight.app/api/v1/webhooks", { method: "POST", body: "{" }), 32), error => error instanceof WebhookInputError && error.code === "invalid_json");
});

test.after(() => { if (previous === undefined) delete process.env.TIC_WEBHOOK_ENCRYPTION_KEY; else process.env.TIC_WEBHOOK_ENCRYPTION_KEY = previous; });
