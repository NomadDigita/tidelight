import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, finishUsage, sameOrigin } from "@/lib/tic/credentials";
import { listTokenizedEquityInstruments, validateInstrumentQuery } from "@/lib/tic/market";
import { getProjectRole, listAccessibleProjects } from "@/lib/tic/organizations";
import { canWriteOrganization } from "@/lib/tic/organization-rbac";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const started = performance.now();
  if (!sameOrigin(request)) return apiError(403, "invalid_origin", "Invalid request origin.", requestId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError(401, "unauthorized", "Sign in to use the API explorer.", requestId);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body");
    body = parsed as Record<string, unknown>;
  } catch { return apiError(400, "invalid_request", "Send a JSON object.", requestId); }
  const keyId = typeof body.keyId === "string" ? body.keyId : "";
  const query = validateInstrumentQuery(body.kind ?? "rtoken", String(body.limit ?? "20"), body.cursor ?? null);
  if (!UUID.test(keyId) || !query) return apiError(400, "invalid_request", "Select a key and valid instrument parameters.", requestId);
  try {
    const admin = createAdminClient();
    const projects = await listAccessibleProjects(admin, user.id);
    const projectIds = projects.map(project => project.id);
    if (!projectIds.length) return apiError(404, "key_not_found", "This credential is unavailable in your organization.", requestId);
    const { data: key, error: keyError } = await admin.from("developer_api_keys").select("id,key_hash,project_id").eq("id", keyId).in("project_id", projectIds).maybeSingle();
    if (keyError) throw keyError;
    if (!key) return apiError(404, "key_not_found", "This credential is unavailable in your account.", requestId);
    const role = await getProjectRole(admin, key.project_id, user.id);
    if (!role || !canWriteOrganization(role)) return apiError(403, "forbidden", "Your organization role cannot run API explorer requests.", requestId);
    const { data: reserved, error: reserveError } = await admin.rpc("reserve_developer_request", { p_hash: key.key_hash, p_scope: "market:read", p_endpoint: "/v1/market/instruments" });
    if (reserveError) throw reserveError;
    const record = Array.isArray(reserved) ? reserved[0] : null;
    if (!record || record.reason) {
      const reason = record?.reason;
      return apiError(reason === "quota_exceeded" ? 429 : reason === "insufficient_scope" ? 403 : 401, reason ?? "unauthorized", reason === "quota_exceeded" ? "This key has reached its request limit." : "This key is expired, revoked, or lacks market:read access.", requestId);
    }
    try {
      const result = await listTokenizedEquityInstruments(query.limit, query.cursor);
      await finishUsage(admin, record.request_id, 200, started);
      return Response.json({ ...result, request_id: requestId, duration_ms: Math.round(performance.now() - started), usage: { requests: 1, credits: null } }, { headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
    } catch {
      await finishUsage(admin, record.request_id, 503, started);
      return apiError(503, "provider_unavailable", "Verified tokenized equity data is temporarily unavailable.", requestId);
    }
  } catch {
    return apiError(503, "service_unavailable", "The API explorer is temporarily unavailable.", requestId);
  }
}
