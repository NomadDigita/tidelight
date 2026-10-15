import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const MARKET_SCOPE = "market:read";

export function issueSecret(environment: "test" | "production") {
  const secret = `tl_${environment === "test" ? "test" : "live"}_${randomBytes(32).toString("base64url")}`;
  return { secret, prefix: secret.slice(0, 16), hash: hashSecret(secret) };
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin;
}

export function apiError(status: number, code: string, message: string, requestId: string) {
  return Response.json({ error: { code, message, request_id: requestId } }, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
}

export async function authorizeMarketRequest(request: Request, endpoint: string) {
  const requestId = crypto.randomUUID();
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer (tl_(?:test|live)_[A-Za-z0-9_-]{43})$/.exec(authorization);
  if (!match) return { error: apiError(401, "unauthorized", "Provide a valid Tidelight bearer key.", requestId) };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("reserve_developer_request", { p_hash: hashSecret(match[1]), p_scope: MARKET_SCOPE, p_endpoint: endpoint });
    if (error) throw error;
    const record = Array.isArray(data) ? data[0] : null;
    if (!record || record.reason) {
      const reason = record?.reason;
      return { error: apiError(reason === "quota_exceeded" ? 429 : reason === "insufficient_scope" ? 403 : 401, reason ?? "unauthorized", reason === "quota_exceeded" ? "This key has reached its request limit." : reason === "insufficient_scope" ? "This key lacks market:read access." : "This key is invalid, expired, or revoked.", requestId) };
    }
    return { admin, requestId, usageId: record.request_id as string };
  } catch {
    return { error: apiError(503, "service_unavailable", "Credential validation is temporarily unavailable.", requestId) };
  }
}

export async function finishUsage(admin: ReturnType<typeof createAdminClient>, usageId: string, statusCode: number, started: number) {
  const { error } = await admin.from("developer_api_requests").update({ status_code: statusCode, duration_ms: Math.max(0, Math.round(performance.now() - started)) }).eq("id", usageId);
  if (error) console.error("tic-usage-update-failed", error.code);
}
