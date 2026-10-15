import { createHash, randomBytes } from "node:crypto";

export const TIC_OAUTH_ISSUER = "https://tidelight.app";
export const TIC_MCP_RESOURCE = "https://mcp.tidelight.app/mcp";
export const TIC_OAUTH_SCOPES = ["market:read", "research:run"] as const;
export type TicOauthScope = typeof TIC_OAUTH_SCOPES[number];

export function hashOAuthSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function createOAuthSecret(kind: "code" | "access" | "refresh") {
  const prefix = kind === "code" ? "tic_code_" : kind === "access" ? "tic_at_" : "tic_rt_";
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

export function createOAuthClientId() {
  return `tlic_${randomBytes(24).toString("base64url")}`;
}

export function isOAuthAccessToken(secret: string) {
  return /^tic_at_[A-Za-z0-9_-]{43}$/.test(secret);
}

export function isOAuthRefreshToken(secret: string) {
  return /^tic_rt_[A-Za-z0-9_-]{43}$/.test(secret);
}

export function isValidOAuthRedirectUri(value: string) {
  if (value.length > 2048) return false;
  let uri: URL;
  try { uri = new URL(value); } catch { return false; }
  if (uri.username || uri.password || uri.hash || uri.hostname.includes("*") || uri.search.includes("\n")) return false;
  if (uri.protocol === "https:") return true;
  const loopback = uri.hostname === "localhost" || uri.hostname === "127.0.0.1" || uri.hostname === "[::1]";
  return loopback && uri.protocol === "http:" && !!uri.port;
}

export function validateOAuthRedirectUris(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > 20) return null;
  if (input.some(item => typeof item !== "string" || !isValidOAuthRedirectUri(item))) return null;
  const uris = input as string[];
  return new Set(uris).size === uris.length ? uris : null;
}

export function parseOAuthScopes(value: string | null, allowed: readonly string[] = TIC_OAUTH_SCOPES): string[] | null {
  const requested = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!requested.length || requested.length > allowed.length || requested.some(scope => !allowed.includes(scope)) || new Set(requested).size !== requested.length) return null;
  return requested;
}

export function pkceChallengeMatches(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

export function oauthNoStoreHeaders() {
  return { "Cache-Control": "no-store", Pragma: "no-cache" };
}
