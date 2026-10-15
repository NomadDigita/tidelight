import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashOAuthSecret, isOAuthAccessToken } from "@/lib/tic/oauth";
import { isMcpInternalRequest } from "@/lib/tic/mcp-internal-request";

export const MARKET_SCOPE = "market:read";
export const RESEARCH_SCOPE = "research:run";
export const ALERTS_SCOPE = "alerts:manage";
const DEVELOPER_KEY_PATTERN = /^Bearer (tl_(?:test|live)_[A-Za-z0-9_-]{43})$/i;
const OAUTH_ACCESS_PATTERN = /^Bearer (tic_at_[A-Za-z0-9_-]{43})$/i;

export function issueSecret(environment: "test" | "production") {
  const secret = `tl_${environment === "test" ? "test" : "live"}_${randomBytes(32).toString("base64url")}`;
  return { secret, prefix: secret.slice(0, 16), hash: hashSecret(secret) };
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function developerKeyHashFromRequest(request: Request) {
  const match = DEVELOPER_KEY_PATTERN.exec(request.headers.get("authorization") ?? "");
  return match ? hashSecret(match[1]) : null;
}

export async function resolveDeveloperCredential(request: Request, scope: string): Promise<{ keyHash: string; oauthScopes?: string[] } | { reason: "invalid_key" | "insufficient_scope" } | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const direct = DEVELOPER_KEY_PATTERN.exec(authorization);
  if (direct) return { keyHash: hashSecret(direct[1]) };
  const match = OAUTH_ACCESS_PATTERN.exec(authorization);
  if (!match || !isOAuthAccessToken(match[1])) return null;
  if (!isMcpInternalRequest(request)) return { reason: "invalid_key" };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: token, error } = await admin.from("tic_oauth_sessions").select("id,key_id,scopes").eq("access_token_hash", hashOAuthSecret(match[1])).is("revoked_at", null).gt("access_token_expires_at", now).eq("resource", "https://mcp.tidelight.app/mcp").maybeSingle();
  if (error) throw error;
  if (!token) return { reason: "invalid_key" };
  const scopes = Array.isArray(token.scopes) ? token.scopes.filter((item: unknown): item is string => typeof item === "string") : [];
  if (!scopes.includes(scope)) return { reason: "insufficient_scope" };
  const { data: key, error: keyError } = await admin.from("developer_api_keys").select("key_hash,scopes,revoked_at,expires_at").eq("id", token.key_id).maybeSingle();
  if (keyError) throw keyError;
  if (!key || key.revoked_at || (key.expires_at && Date.parse(key.expires_at) <= Date.now())) return { reason: "invalid_key" };
  if (!Array.isArray(key.scopes) || !key.scopes.includes(scope) || !scopes.every(item => key.scopes.includes(item))) return { reason: "insufficient_scope" };
  return { keyHash: key.key_hash, oauthScopes: scopes };
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

export function apiError(status: number, code: string, message: string, requestId: string) {
  return Response.json({ error: { code, message, request_id: requestId } }, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
}

export async function authorizeDeveloperRequest(request: Request, endpoint: string, scope = MARKET_SCOPE) {
  const requestId = crypto.randomUUID();
  let credential: Awaited<ReturnType<typeof resolveDeveloperCredential>>;
  try {
    credential = await resolveDeveloperCredential(request, scope);
    if (credential && "reason" in credential) return { error: apiError(credential.reason === "insufficient_scope" ? 403 : 401, credential.reason, credential.reason === "insufficient_scope" ? `This credential lacks ${scope} access.` : "This credential is invalid, expired, or revoked.", requestId) };
    if (!credential) return { error: apiError(401, "unauthorized", "Provide a valid Tidelight bearer key.", requestId) };
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("reserve_developer_request", { p_hash: credential.keyHash, p_scope: scope, p_endpoint: endpoint });
    if (error) throw error;
    const record = Array.isArray(data) ? data[0] : null;
    if (!record || record.reason) {
      const reason = record?.reason;
      return { error: apiError(reason === "quota_exceeded" ? 429 : reason === "insufficient_scope" ? 403 : 401, reason ?? "unauthorized", reason === "quota_exceeded" ? "This key has reached its request limit." : reason === "insufficient_scope" ? `This key lacks ${scope} access.` : "This key is invalid, expired, or revoked.", requestId) };
    }
    return { admin, requestId, usageId: record.request_id as string, projectId: record.project_id as string, ownerId: record.owner_id as string, keyId: record.key_id as string };
  } catch {
    return { error: apiError(503, "service_unavailable", "Credential validation is temporarily unavailable.", requestId) };
  }
}

export function authorizeMarketRequest(request: Request, endpoint: string) {
  return authorizeDeveloperRequest(request, endpoint, MARKET_SCOPE);
}

export async function finishUsage(admin: ReturnType<typeof createAdminClient>, usageId: string, statusCode: number, started: number) {
  const { error } = await admin.from("developer_api_requests").update({ status_code: statusCode, duration_ms: Math.max(0, Math.round(performance.now() - started)) }).eq("id", usageId);
  if (error) console.error("tic-usage-update-failed", error.code);
}
