import { apiError, developerKeyHashFromRequest, finishUsage, RESEARCH_SCOPE } from "@/lib/tic/credentials";
import { normalizeResearchTicker } from "@/lib/tic/research-snapshot";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_BODY_BYTES = 16 * 1024;

async function readBoundedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) throw new Error("body_too_large");
  if (!request.body) throw new Error("invalid_json");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("body_too_large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error("invalid_json"); }
}

export async function POST(request: Request) {
  const started = performance.now();
  const keyHash = developerKeyHashFromRequest(request);
  if (!keyHash) return apiError(401, "unauthorized", "Provide a valid Tidelight bearer key.", crypto.randomUUID());
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await readBoundedJson(request);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body");
    body = parsed as Record<string, unknown>;
  } catch (cause) {
    return apiError(400, cause instanceof Error && cause.message === "body_too_large" ? "request_too_large" : "invalid_request", cause instanceof Error && cause.message === "body_too_large" ? "The request body must be 16 KB or smaller." : "Send a valid JSON object.", crypto.randomUUID());
  }
  const ticker = normalizeResearchTicker(body.ticker);
  if (!ticker) return apiError(400, "invalid_request", "Name a supported US stock ticker.", crypto.randomUUID());
  const idempotencyKey = request.headers.get("idempotency-key") ?? "";
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) return apiError(400, "invalid_idempotency_key", "Provide an Idempotency-Key between 8 and 128 letters, numbers, dots, underscores, colons, or hyphens.", crypto.randomUUID());
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("enqueue_tic_research_job", { p_hash: keyHash, p_ticker: ticker, p_idempotency_key: idempotencyKey });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : null;
    const requestId = row?.request_id ?? crypto.randomUUID();
    if (!row || row.reason) {
      const reason = row?.reason;
      const status = reason === "quota_exceeded" || reason === "job_quota_exceeded" ? 429 : reason === "insufficient_scope" ? 403 : reason === "idempotency_conflict" ? 409 : reason === "invalid_request" ? 400 : reason === "invalid_key" ? 401 : 503;
      const message = reason === "job_quota_exceeded" ? "This project has reached its limit of 10 research jobs per hour." : reason === "idempotency_conflict" ? "This idempotency key was already used with a different ticker." : reason === "insufficient_scope" ? `This key lacks ${RESEARCH_SCOPE} access.` : reason === "quota_exceeded" ? "This key has reached its request limit." : reason === "invalid_request" ? "The research request is invalid." : reason === "invalid_key" ? "This key is invalid, expired, or revoked." : "Research capacity is temporarily unavailable.";
      if (row?.request_id) await finishUsage(admin, row.request_id, status, started);
      return apiError(status, reason ?? "service_unavailable", message, requestId);
    }
    await finishUsage(admin, requestId, row.is_duplicate ? 200 : 202, started);
    return Response.json({ job_id: row.job_id, status: row.job_status, duplicate: row.is_duplicate, request_id: requestId }, {
      status: row.is_duplicate ? 200 : 202,
      headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    });
  } catch {
    return apiError(503, "service_unavailable", "Research capacity is temporarily unavailable.", crypto.randomUUID());
  }
}
