import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

async function loadContract() {
  try {
    return parse(await readFile(new URL("../openapi/tidelight.yaml", import.meta.url), "utf8"));
  } catch {
    // In the mother repository, OpenAPI is maintained once in docs/ and copied
    // into this distribution only by the mirror manifest.
    return parse(await readFile(new URL("../../../../docs/tic-openapi.yaml", import.meta.url), "utf8"));
  }
}
const spec = await loadContract();
const methods = (path) => Object.keys(spec.paths[path]).filter(method => ["get", "post", "patch", "delete"].includes(method));

test("contract is versioned OpenAPI 3.1 on the production API origin", () => {
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(spec.servers[0].url, "https://api.tidelight.app/v1");
  assert.deepEqual(spec.security, [{ tidelightKey: [] }]);
  assert.equal(spec.components.securitySchemes.tidelightKey.scheme, "bearer");
});

test("contract covers every currently supported public operation with unique IDs", () => {
  assert.deepEqual(methods("/market/instruments"), ["get"]);
  assert.deepEqual(methods("/research/jobs"), ["post"]);
  assert.deepEqual(methods("/research/jobs/{job_id}"), ["get", "delete"]);
  assert.deepEqual(methods("/webhooks"), ["get", "post"]);
  assert.deepEqual(methods("/webhooks/{endpoint_id}"), ["patch", "delete"]);
  assert.deepEqual(methods("/webhooks/deliveries"), ["get"]);
  const ids = Object.values(spec.paths).flatMap(path => Object.values(path)).map(operation => operation.operationId).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 8);
});

test("contract preserves async idempotency and distinct financial instrument provenance", () => {
  const start = spec.paths["/research/jobs"].post;
  assert.equal(start.parameters.find(parameter => parameter.name === "Idempotency-Key")?.required, true);
  assert.ok(start.responses["202"]);
  const schemas = spec.components.schemas;
  assert.equal(schemas.Instrument.properties.instrument_type.const, "tokenized_equity_spot");
  assert.equal(schemas.StockPerpetual.properties.instrument_type.const, "stock_perpetual");
  assert.notEqual(schemas.Instrument.properties.source.const, schemas.StockPerpetual.properties.source.const);
  assert.equal(spec.paths["/market/instruments"].get.parameters.find(parameter => parameter.name === "underlying_ticker")?.schema.pattern, "^[A-Za-z][A-Za-z0-9.]{0,9}$");
});

test("webhook secrets are documented as one-time output and excluded from list schema", () => {
  const create = spec.paths["/webhooks"].post.responses["201"].content["application/json"].schema;
  const mutation = create.$ref ? spec.components.schemas[create.$ref.split("/").at(-1)] : create;
  assert.ok(mutation.properties.signing_secret);
  assert.match(mutation.properties.signing_secret.description, /not returned again/i);
  const endpoint = spec.components.schemas.WebhookEndpoint;
  assert.equal(endpoint.properties.signing_secret, undefined);
});
