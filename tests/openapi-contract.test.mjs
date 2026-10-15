import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDocument } from "yaml";

const document = parseDocument(readFileSync(new URL("../docs/tic-openapi.yaml", import.meta.url), "utf8"), { uniqueKeys: true });
const spec = document.toJS();

test("OpenAPI contract targets the dedicated versioned API service", () => {
  assert.deepEqual(spec.servers, [{ url: "https://api.tidelight.app/v1" }]);
});

test("OpenAPI document parses without YAML errors and every local reference resolves", () => {
  assert.deepEqual(document.errors, []);
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string") {
      assert.match(value.$ref, /^#\//, "refs must remain local to the contract");
      const resolved = value.$ref.slice(2).split("/").reduce((parent, segment) => parent?.[segment.replaceAll("~1", "/").replaceAll("~0", "~")], spec);
      assert.notEqual(resolved, undefined, "unresolved ref: " + value.$ref);
    }
    Object.values(value).forEach(visit);
  }
  visit(spec);
});

test("versioned API contract covers every implemented public endpoint and method", () => {
  const operations = new Set();
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of ["get", "post", "patch", "put", "delete"]) {
      if (!item[method]) continue;
      assert.ok(item[method].operationId, method.toUpperCase() + " " + path + " needs an operationId");
      assert.ok(!operations.has(item[method].operationId), "duplicate operationId " + item[method].operationId);
      operations.add(item[method].operationId);
    }
  }
  assert.deepEqual([...operations].sort(), [
    "cancelResearchJob", "createWebhook", "disableWebhook", "getResearchJob",
    "listTokenizedEquityInstruments", "listWebhookDeliveries", "listWebhooks",
    "startCompanySnapshot", "updateWebhook",
  ]);
});

test("webhook contract matches the supported event set and keeps secrets one-time", () => {
  const schemas = spec.components.schemas;
  assert.deepEqual(schemas.WebhookEvent.enum, ["research.job.completed", "research.job.failed"]);
  assert.ok(!("signing_secret" in schemas.WebhookEndpoint.properties));
  assert.match(schemas.WebhookMutationResponse.properties.signing_secret.description, /not returned again/);
  assert.deepEqual(schemas.WebhookDelivery.properties.status.enum, ["pending", "sending", "retry_wait", "succeeded", "failed", "cancelled"]);
  assert.match(spec.paths["/webhooks"].post.responses["201"].description, /not be returned again/);
});
