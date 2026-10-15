import test from "node:test";
import assert from "node:assert/strict";
import { resolveServiceHostRoute } from "../lib/tic/service-host-routing.ts";

test("the API hostname exposes only the versioned API service", () => {
  assert.deepEqual(resolveServiceHostRoute("API.TIDELIGHT.APP", "/v1/market/instruments"), { kind: "rewrite", pathname: "/api/v1/market/instruments" });
  assert.deepEqual(resolveServiceHostRoute("api.tidelight.app", "/"), { kind: "rewrite", pathname: "/api/v1" });
  assert.deepEqual(resolveServiceHostRoute("api.tidelight.app", "/developers"), { kind: "not-found" });
});

test("the MCP hostname maps only its public Streamable HTTP path", () => {
  for (const path of ["/", "/mcp", "/api/mcp"]) assert.deepEqual(resolveServiceHostRoute("mcp.tidelight.app", path), { kind: "rewrite", pathname: "/api/mcp" });
  assert.deepEqual(resolveServiceHostRoute("mcp.tidelight.app", "/.well-known/oauth-protected-resource/mcp"), { kind: "rewrite", pathname: "/api/oauth/mcp-resource" });
  assert.deepEqual(resolveServiceHostRoute("mcp.tidelight.app", "/developers"), { kind: "not-found" });
});

test("the status hostname serves the page and live health check only", () => {
  assert.deepEqual(resolveServiceHostRoute("status.tidelight.app", "/"), { kind: "rewrite", pathname: "/status" });
  assert.deepEqual(resolveServiceHostRoute("status.tidelight.app", "/health"), { kind: "rewrite", pathname: "/api/health" });
  assert.deepEqual(resolveServiceHostRoute("status.tidelight.app", "/admin"), { kind: "not-found" });
  assert.equal(resolveServiceHostRoute("tidelight.app", "/developers"), null);
});

test("the developer docs hostname serves only the existing documentation page", () => {
  assert.deepEqual(resolveServiceHostRoute("dev.tidelight.app", "/"), { kind: "rewrite", pathname: "/developers/docs" });
  assert.deepEqual(resolveServiceHostRoute("dev.tidelight.app", "/api"), { kind: "rewrite", pathname: "/developers/docs" });
  assert.deepEqual(resolveServiceHostRoute("dev.tidelight.app", "/developers/docs"), { kind: "rewrite", pathname: "/developers/docs" });
  assert.deepEqual(resolveServiceHostRoute("dev.tidelight.app", "/developers/console"), { kind: "not-found" });
  assert.equal(resolveServiceHostRoute("docs.tidelight.app", "/"), null);
});
