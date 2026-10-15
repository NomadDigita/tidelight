import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { createHash } from "node:crypto";

const hook = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    if (specifier === "@/lib/supabase/admin") {
      return { url: `data:text/javascript,${encodeURIComponent("export const createAdminClient=()=>globalThis.oauthTestAdmin;")}`, shortCircuit: true };
    }
    if (specifier === "@/lib/tic/oauth-rate-limit") {
      return { url: `data:text/javascript,${encodeURIComponent("export const reserveOAuthRateLimit=async()=>true;")}`, shortCircuit: true };
    }
    if (specifier === "@/lib/tic/oauth") {
      return nextResolve(new URL("../../../../lib/tic/oauth.ts", context.parentURL).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { POST } = await import("../app/api/oauth/token/route.ts");
hook.deregister();

const token = `tic_rt_${"A".repeat(43)}`;
const digest = value => createHash("sha256").update(value).digest("hex");
const clientId = `tlic_${"a".repeat(32)}`;
const resource = "https://mcp.tidelight.app/mcp";

function request(fields) {
  return new Request("https://tidelight.app/api/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, resource, refresh_token: token, ...fields }),
  });
}

test("refresh grant delegates atomic rotation with only hashed bearer material", async () => {
  let call;
  globalThis.oauthTestAdmin = { rpc: async (name, args) => {
    call = { name, args };
    return { data: { status: "rotated", scopes: ["market:read"] }, error: null };
  } };
  const response = await POST(request({ scope: "market:read" }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.scope, "market:read");
  assert.equal(body.resource, resource);
  assert.equal(call.name, "rotate_tic_oauth_refresh_token");
  assert.equal(call.args.p_client_id, clientId);
  assert.equal(call.args.p_old_refresh_hash, digest(token));
  assert.notEqual(call.args.p_old_refresh_hash, token);
  assert.deepEqual(call.args.p_requested_scopes, ["market:read"]);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(body.access_token, /^tic_at_[A-Za-z0-9_-]{43}$/);
  assert.match(body.refresh_token, /^tic_rt_[A-Za-z0-9_-]{43}$/);
});

test("refresh reuse and invalid grants return OAuth invalid_grant", async () => {
  globalThis.oauthTestAdmin = { rpc: async () => ({ data: { status: "reuse_detected" }, error: null }) };
  const reused = await POST(request({}));
  assert.equal(reused.status, 400);
  assert.deepEqual(await reused.json(), { error: "invalid_grant" });

  globalThis.oauthTestAdmin = { rpc: async () => ({ data: { status: "invalid_grant" }, error: null }) };
  const invalid = await POST(request({}));
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: "invalid_grant" });
});

test("invalid requested scope is passed to the atomic verifier and denied", async () => {
  let call;
  globalThis.oauthTestAdmin = { rpc: async (name, args) => {
    call = { name, args };
    return { data: { status: "invalid_scope" }, error: null };
  } };
  const response = await POST(request({ scope: "market:read research:run" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_scope" });
  assert.equal(call.name, "rotate_tic_oauth_refresh_token");
  assert.deepEqual(call.args.p_requested_scopes, ["market:read", "research:run"]);
});
