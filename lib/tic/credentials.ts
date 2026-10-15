import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const MARKET_SCOPE = "market:read";
export const RESEARCH_SCOPE = "research:run";
const DEVELOPER_KEY_PATTERN = /^Bearer (tl_(?:test|live)_[A-Za-z0-9_-]{43})$/;

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

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

export function apiError(status: number, code: string, message: string, requestId: string) {
  return Response.json({ error: { code, message, request_id: requestId } }, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
}

export async function authorizeDeveloperRequest(request: Request, endpoint: string, scope = MARKET_SCOPE) {
  const requestId = crypto.randomUUID();
  const keyHash = developerKeyHashFromRequest(request);
  if (!keyHash) return { error: apiError(401, "unauthorized", "Provide a valid Tidelight bearer key.", requestId) };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("reserve_developer_request", { p_hash: keyHash, p_scope: scope, p_endpoint: endpoint });
    if (error) throw error;
    const record = Array.isArray(data) ? data[0] : null;
    if (!record || record.reason) {
      const reason = record?.reason;
      return { error: apiError(reason === "quota_exceeded" ? 429 : reason === "insufficient_scope" ? 403 : 401, reason ?? "unauthorized", reason === "quota_exceeded" ? "This key has reached its request limit." : reason === "insufficient_scope" ? `This key lacks ${scope} access.` : "This key is invalid, expired, or revoked.", requestId) };
    }
    return { admin, requestId, usageId: record.request_id as string, projectId: record.project_id as string, keyId: record.key_id as string };
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
