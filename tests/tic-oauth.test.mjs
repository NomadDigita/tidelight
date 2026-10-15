import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createOAuthClientId, createOAuthSecret, hashOAuthSecret, isOAuthAccessToken, isOAuthRefreshToken, isValidOAuthRedirectUri, parseOAuthScopes, pkceChallengeMatches, validateOAuthRedirectUris } from "../lib/tic/oauth.ts";
import { createMcpInternalRequest, isMcpInternalRequest } from "../lib/tic/mcp-internal-request.ts";
import { safeInternalRedirect } from "../lib/auth/safe-redirect.ts";
import { getTicMcpAllowedOrigins, ticMcpCorsHeaders } from "../lib/tic/mcp-cors.ts";

test("OAuth public client credentials are unguessable opaque strings and only hashes are stored", () => {
  const client = createOAuthClientId();
  const access = createOAuthSecret("access");
  const refresh = createOAuthSecret("refresh");
  assert.match(client, /^tlic_[A-Za-z0-9_-]{32}$/);
  assert.equal(isOAuthAccessToken(access), true);
  assert.equal(isOAuthRefreshToken(refresh), true);
  assert.equal(hashOAuthSecret(access).length, 64);
  assert.notEqual(hashOAuthSecret(access), access);
});

test("OAuth redirect registration permits HTTPS and explicit loopback only", () => {
  assert.equal(isValidOAuthRedirectUri("https://client.example/callback"), true);
  assert.equal(isValidOAuthRedirectUri("http://127.0.0.1:43123/callback"), true);
  assert.equal(isValidOAuthRedirectUri("http://localhost:43123/callback"), true);
  assert.equal(isValidOAuthRedirectUri("http://client.example/callback"), false);
  assert.equal(isValidOAuthRedirectUri("https://user:pass@client.example/callback"), false);
  assert.equal(isValidOAuthRedirectUri("https://client.example/callback#fragment"), false);
  assert.equal(isValidOAuthRedirectUri("https://*.example/callback"), false);
  assert.deepEqual(validateOAuthRedirectUris(["https://client.example/callback", "http://127.0.0.1:43123/callback"]), ["https://client.example/callback", "http://127.0.0.1:43123/callback"]);
  assert.equal(validateOAuthRedirectUris(["https://client.example/callback", "https://client.example/callback"]), null);
});

test("OAuth scopes are bounded and cannot be duplicated or broadened", () => {
  assert.deepEqual(parseOAuthScopes("market:read research:run"), ["market:read", "research:run"]);
  assert.deepEqual(parseOAuthScopes("research:run", ["research:run"]), ["research:run"]);
  assert.equal(parseOAuthScopes("market:read admin:write"), null);
  assert.equal(parseOAuthScopes("market:read market:read"), null);
  assert.equal(parseOAuthScopes(null), null);
});

test("OAuth authorization code PKCE validation accepts S256 only for the matching verifier", () => {
  const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  assert.equal(pkceChallengeMatches(verifier, challenge), true);
  assert.equal(pkceChallengeMatches(`${verifier}x`, challenge), false);
  assert.equal(pkceChallengeMatches("short", challenge), false);
});

test("OAuth MCP resource tokens cannot be presented to public REST routes", () => {
  const bearer = `Bearer ${createOAuthSecret("access")}`;
  const externalRequest = new Request("https://tidelight.app/api/v1/market/instruments", { headers: { Authorization: bearer, "X-Tidelight-MCP-Internal": "true" } });
  assert.equal(isMcpInternalRequest(externalRequest), false);
  const internalRequest = createMcpInternalRequest("https://tidelight.app/api/v1/market/instruments", { headers: { Authorization: bearer } });
  assert.equal(isMcpInternalRequest(internalRequest), true);
});

test("OAuth sign-in return paths cannot become external redirects", () => {
  assert.equal(safeInternalRedirect("/developers/oauth/consent?flow=abc", "https://tidelight.app"), "/developers/oauth/consent?flow=abc");
  assert.equal(safeInternalRedirect("//attacker.example/path", "https://tidelight.app"), null);
  assert.equal(safeInternalRedirect("/\\\\attacker.example", "https://tidelight.app"), null);
  assert.equal(safeInternalRedirect("https://attacker.example", "https://tidelight.app"), null);
});

test("MCP browser origins must be explicit HTTPS allowlist entries", () => {
  const allowed = getTicMcpAllowedOrigins("https://client.example,https://bad.example/path,http://unsafe.example,https://client.example", "production");
  assert.equal(allowed.includes("https://client.example"), true);
  assert.equal(allowed.includes("https://bad.example/path"), false);
  assert.equal(allowed.includes("http://unsafe.example"), false);
  assert.equal(allowed.includes("http://localhost:3000"), false);
  assert.equal(getTicMcpAllowedOrigins(undefined, "development").includes("http://localhost:3000"), true);
  assert.equal(ticMcpCorsHeaders("https://client.example", allowed).get("access-control-allow-origin"), "https://client.example");
  assert.equal(ticMcpCorsHeaders("https://untrusted.example", allowed).get("access-control-allow-origin"), null);
});
