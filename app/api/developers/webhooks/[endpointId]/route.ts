import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sameOrigin } from "@/lib/tic/credentials";
import { getProjectRole } from "@/lib/tic/organizations";
import { canWriteOrganization } from "@/lib/tic/organization-rbac";
import { assertPublicWebhookDestination, createWebhookSecret } from "@/lib/tic/webhook-security";
import { readBoundedWebhookJson, WebhookInputError } from "@/lib/tic/webhook-input";

export const runtime = "nodejs";
const FIELDS = "id,project_id,organization_id,created_by,name,url,events,enabled,created_at,updated_at";

export async function PATCH(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to update a webhook." }, { status: 401 });
  const { endpointId } = await params;
  let body: unknown;
  try { body = await readBoundedWebhookJson(request); }
  catch (cause) { return Response.json({ error: cause instanceof WebhookInputError && cause.code === "too_large" ? "Webhook changes must be under 8 KB." : "Invalid JSON." }, { status: cause instanceof WebhookInputError && cause.code === "too_large" ? 413 : 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Send a JSON object." }, { status: 400 });
  const input = body as Record<string, unknown>;
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch { return Response.json({ error: "Webhook service is not configured." }, { status: 503 }); }
  const { data: endpoint, error: readError } = await admin.from("tic_webhook_endpoints").select("id,project_id").eq("id", endpointId).maybeSingle();
  if (readError) return Response.json({ error: "Webhook could not be loaded." }, { status: 503 });
  if (!endpoint) return Response.json({ error: "Webhook not found." }, { status: 404 });
  let role;
  try { role = await getProjectRole(admin, endpoint.project_id, user.id); } catch { return Response.json({ error: "Webhook permissions are temporarily unavailable." }, { status: 503 }); }
  if (!role) return Response.json({ error: "Webhook not found." }, { status: 404 });
  if (!canWriteOrganization(role)) return Response.json({ error: "Your organization role cannot update webhooks." }, { status: 403 });
  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let secret: string | undefined;
  if (typeof input.enabled === "boolean") changes.enabled = input.enabled;
  if (input.rotate_secret === true) {
    try { const created = createWebhookSecret(); changes.encrypted_secret = created.encryptedSecret; secret = created.secret; }
    catch { return Response.json({ error: "Webhook signing is not configured for this environment." }, { status: 503 }); }
  }
  if (typeof input.url === "string") {
    try { await assertPublicWebhookDestination(input.url); changes.url = input.url; }
    catch { return Response.json({ error: "Use a public HTTPS endpoint on port 443. Private, local, and reserved destinations are not allowed." }, { status: 400 }); }
  }
  if (input.events !== undefined) {
    const allowed = ["research.job.completed", "research.job.failed"];
    if (!Array.isArray(input.events) || input.events.length < 1 || input.events.length > 2 || input.events.some(event => typeof event !== "string" || !allowed.includes(event)) || new Set(input.events).size !== input.events.length) return Response.json({ error: "Choose one or more supported event types." }, { status: 400 });
    changes.events = input.events;
  }
  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 80) return Response.json({ error: "Name must be 2 to 80 characters." }, { status: 400 });
    changes.name = name;
  }
  if (Object.keys(changes).length === 1) return Response.json({ error: "No supported webhook changes were provided." }, { status: 400 });
  const { data, error } = await admin.from("tic_webhook_endpoints").update(changes).eq("id", endpointId).select(FIELDS).single();
  if (error) return Response.json({ error: "Webhook could not be updated." }, { status: 503 });
  if (input.enabled === false) {
    const { error: cancelError } = await admin.from("tic_webhook_deliveries").update({ status: "cancelled", last_error_code: "endpoint_disabled", completed_at: new Date().toISOString() }).eq("endpoint_id", endpointId).in("status", ["pending", "retry_wait"]);
    if (cancelError) return Response.json({ error: "Webhook was disabled, but pending deliveries could not be closed." }, { status: 503 });
  }
  return Response.json({ endpoint: data, ...(secret ? { signing_secret: secret } : {}) }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to disable a webhook." }, { status: 401 });
  const { endpointId } = await params;
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch { return Response.json({ error: "Webhook service is not configured." }, { status: 503 }); }
  const { data: endpoint, error: endpointError } = await admin.from("tic_webhook_endpoints").select("id,project_id").eq("id", endpointId).maybeSingle();
  if (endpointError) return Response.json({ error: "Webhook could not be loaded." }, { status: 503 });
  if (!endpoint) return Response.json({ error: "Webhook not found." }, { status: 404 });
  let role;
  try { role = await getProjectRole(admin, endpoint.project_id, user.id); } catch { return Response.json({ error: "Webhook permissions are temporarily unavailable." }, { status: 503 }); }
  if (!role) return Response.json({ error: "Webhook not found." }, { status: 404 });
  if (!canWriteOrganization(role)) return Response.json({ error: "Your organization role cannot disable webhooks." }, { status: 403 });
  const { error } = await admin.from("tic_webhook_endpoints").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", endpointId);
  if (error) return Response.json({ error: "Webhook could not be disabled." }, { status: 503 });
  const { error: cancelError } = await admin.from("tic_webhook_deliveries").update({ status: "cancelled", last_error_code: "endpoint_disabled", completed_at: new Date().toISOString() }).eq("endpoint_id", endpointId).in("status", ["pending", "retry_wait"]);
  if (cancelError) return Response.json({ error: "Webhook was disabled, but pending deliveries could not be closed." }, { status: 503 });
  return Response.json({ disabled: true });
}
