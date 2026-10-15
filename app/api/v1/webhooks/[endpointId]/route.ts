import { ALERTS_SCOPE, apiError, authorizeDeveloperRequest, finishUsage } from "@/lib/tic/credentials";
import { assertPublicWebhookDestination, createWebhookSecret } from "@/lib/tic/webhook-security";
import { readBoundedWebhookJson, WebhookInputError } from "@/lib/tic/webhook-input";

export const runtime = "nodejs";
const FIELDS = "id,project_id,organization_id,name,url,events,enabled,created_at,updated_at";
const EVENTS = ["research.job.completed", "research.job.failed"];

export async function PATCH(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  const started = performance.now();
  const { endpointId } = await params;
  const endpoint = `/v1/webhooks/${endpointId}`;
  const auth = await authorizeDeveloperRequest(request, endpoint, ALERTS_SCOPE);
  if (auth.error) return auth.error;
  const { admin, requestId, usageId, projectId } = auth;
  const fail = async (status: number, code: string, message: string) => { await finishUsage(admin, usageId, status, started); return apiError(status, code, message, requestId); };
  let body: unknown;
  try { body = await readBoundedWebhookJson(request); }
  catch (cause) { return cause instanceof WebhookInputError && cause.code === "too_large" ? fail(413, "request_too_large", "Webhook changes must be under 8 KB.") : fail(400, "invalid_request", "Send a valid JSON object."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "invalid_request", "Send a valid JSON object.");
  const input = body as Record<string, unknown>;
  const { data: current, error: currentError } = await admin.from("tic_webhook_endpoints").select("id").eq("id", endpointId).eq("project_id", projectId).maybeSingle();
  if (currentError) return fail(503, "service_unavailable", "Webhook endpoint is temporarily unavailable.");
  if (!current) return fail(404, "not_found", "Webhook endpoint was not found in this project.");
  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let signingSecret: string | undefined;
  if (typeof input.enabled === "boolean") changes.enabled = input.enabled;
  if (input.rotate_secret === true) {
    try { const value = createWebhookSecret(); changes.encrypted_secret = value.encryptedSecret; signingSecret = value.secret; }
    catch { return fail(503, "signing_unavailable", "Webhook signing is not configured for this environment."); }
  }
  if (typeof input.url === "string") {
    try { await assertPublicWebhookDestination(input.url); changes.url = input.url; }
    catch { return fail(400, "unsafe_destination", "Use public HTTPS on port 443. Private, local, reserved, and query-string destinations are not allowed."); }
  }
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80) return fail(400, "invalid_request", "Name must be 2 to 80 characters.");
    changes.name = name;
  }
  if (input.events !== undefined) {
    if (!Array.isArray(input.events) || input.events.length < 1 || input.events.length > 2 || input.events.some(value => typeof value !== "string" || !EVENTS.includes(value)) || new Set(input.events).size !== input.events.length) return fail(400, "invalid_request", "Choose one or more supported event types.");
    changes.events = input.events;
  }
  if (Object.keys(changes).length === 1) return fail(400, "invalid_request", "No supported endpoint changes were provided.");
  const { data, error } = await admin.from("tic_webhook_endpoints").update(changes).eq("id", endpointId).eq("project_id", projectId).select(FIELDS).single();
  if (error) return fail(503, "service_unavailable", "Webhook endpoint could not be updated.");
  if (input.enabled === false) {
    const { error: cancelError } = await admin.from("tic_webhook_deliveries").update({ status: "cancelled", last_error_code: "endpoint_disabled", completed_at: new Date().toISOString() }).eq("endpoint_id", endpointId).in("status", ["pending", "retry_wait"]);
    if (cancelError) return fail(503, "service_unavailable", "Endpoint was disabled, but queued deliveries could not be closed.");
  }
  await finishUsage(admin, usageId, 200, started);
  return Response.json({ endpoint: data, ...(signingSecret ? { signing_secret: signingSecret } : {}), request_id: requestId }, { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  const started = performance.now();
  const { endpointId } = await params;
  const endpoint = `/v1/webhooks/${endpointId}`;
  const auth = await authorizeDeveloperRequest(request, endpoint, ALERTS_SCOPE);
  if (auth.error) return auth.error;
  const { admin, requestId, usageId, projectId } = auth;
  const { data, error } = await admin.from("tic_webhook_endpoints").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", endpointId).eq("project_id", projectId).select("id").maybeSingle();
  if (error) { await finishUsage(admin, usageId, 503, started); return apiError(503, "service_unavailable", "Webhook endpoint could not be disabled.", requestId); }
  if (!data) { await finishUsage(admin, usageId, 404, started); return apiError(404, "not_found", "Webhook endpoint was not found in this project.", requestId); }
  const { error: cancelError } = await admin.from("tic_webhook_deliveries").update({ status: "cancelled", last_error_code: "endpoint_disabled", completed_at: new Date().toISOString() }).eq("endpoint_id", endpointId).in("status", ["pending", "retry_wait"]);
  if (cancelError) { await finishUsage(admin, usageId, 503, started); return apiError(503, "service_unavailable", "Endpoint was disabled, but queued deliveries could not be closed.", requestId); }
  await finishUsage(admin, usageId, 200, started);
  return Response.json({ disabled: true, request_id: requestId }, { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
}
