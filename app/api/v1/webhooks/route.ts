import { ALERTS_SCOPE, apiError, authorizeDeveloperRequest, finishUsage } from "@/lib/tic/credentials";
import { assertPublicWebhookDestination, createWebhookSecret } from "@/lib/tic/webhook-security";
import { readBoundedWebhookJson, WebhookInputError } from "@/lib/tic/webhook-input";

export const runtime = "nodejs";
const FIELDS = "id,project_id,organization_id,name,url,events,enabled,created_at,updated_at";
const EVENTS = ["research.job.completed", "research.job.failed"] as const;

export async function GET(request: Request) {
  const started = performance.now();
  const auth = await authorizeDeveloperRequest(request, "/v1/webhooks", ALERTS_SCOPE);
  if (auth.error) return auth.error;
  const { admin, requestId, usageId, projectId } = auth;
  try {
    const { data, error } = await admin.from("tic_webhook_endpoints").select(FIELDS).eq("project_id", projectId).order("created_at", { ascending: false });
    if (error) throw error;
    await finishUsage(admin, usageId, 200, started);
    return Response.json({ endpoints: data, request_id: requestId }, { headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
  } catch {
    await finishUsage(admin, usageId, 503, started);
    return apiError(503, "service_unavailable", "Webhook endpoints are temporarily unavailable.", requestId);
  }
}

export async function POST(request: Request) {
  const started = performance.now();
  const auth = await authorizeDeveloperRequest(request, "/v1/webhooks", ALERTS_SCOPE);
  if (auth.error) return auth.error;
  const { admin, requestId, usageId, projectId, ownerId } = auth;
  const fail = async (status: number, code: string, message: string) => { await finishUsage(admin, usageId, status, started); return apiError(status, code, message, requestId); };
  let body: unknown;
  try { body = await readBoundedWebhookJson(request); }
  catch (cause) { return cause instanceof WebhookInputError && cause.code === "too_large" ? fail(413, "request_too_large", "Webhook configuration must be under 8 KB.") : fail(400, "invalid_request", "Send a valid JSON object."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "invalid_request", "Send a valid JSON object.");
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const destination = typeof input.url === "string" ? input.url.trim() : "";
  const events = input.events;
  if (name.length < 2 || name.length > 80 || destination.length < 10 || destination.length > 2048 || !Array.isArray(events) || events.length < 1 || events.length > 2 || events.some(event => typeof event !== "string" || !(EVENTS as readonly string[]).includes(event)) || new Set(events).size !== events.length) {
    return fail(400, "invalid_request", "Provide a 2 to 80 character name, a public HTTPS destination, and supported event types.");
  }
  try {
    await assertPublicWebhookDestination(destination);
    const { data: project, error: projectError } = await admin.from("developer_projects").select("organization_id").eq("id", projectId).single();
    if (projectError || !project) throw projectError ?? new Error("project_unavailable");
    const { count, error: countError } = await admin.from("tic_webhook_endpoints").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("enabled", true);
    if (countError) throw countError;
    if ((count ?? 0) >= 10) return fail(429, "webhook_limit", "This project has reached its 10 active endpoint limit.");
    const credentials = createWebhookSecret();
    const { data, error } = await admin.from("tic_webhook_endpoints").insert({ project_id: projectId, organization_id: project.organization_id, created_by: ownerId, name, url: destination, encrypted_secret: credentials.encryptedSecret, events }).select(FIELDS).single();
    if (error) throw error;
    await finishUsage(admin, usageId, 201, started);
    return Response.json({ endpoint: data, signing_secret: credentials.secret, request_id: requestId }, { status: 201, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    if (message === "invalid_webhook_url" || message === "unsafe_webhook_destination") return fail(400, "unsafe_destination", "Use public HTTPS on port 443. Private, local, reserved, and query-string destinations are not allowed.");
    if (message === "webhook_encryption_unconfigured") return fail(503, "signing_unavailable", "Webhook signing is not configured for this environment.");
    console.error("tic-webhook-api-create-failed", cause instanceof Error ? cause.name : "unknown");
    return fail(503, "service_unavailable", "Webhook endpoint could not be created.");
  }
}
