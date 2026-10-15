import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sameOrigin } from "@/lib/tic/credentials";
import { getProjectRole, listAccessibleProjects } from "@/lib/tic/organizations";
import { canWriteOrganization } from "@/lib/tic/organization-rbac";
import { assertPublicWebhookDestination, createWebhookSecret } from "@/lib/tic/webhook-security";
import { readBoundedWebhookJson, WebhookInputError } from "@/lib/tic/webhook-input";

export const runtime = "nodejs";
const EVENTS = ["research.job.completed", "research.job.failed"] as const;
const FIELDS = "id,project_id,organization_id,created_by,name,url,events,enabled,created_at,updated_at";

async function signedIn() {
  const supabase = await createClient();
  return (await supabase.auth.getUser()).data.user;
}

export async function GET() {
  const user = await signedIn();
  if (!user) return Response.json({ error: "Sign in to manage webhooks." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const projects = await listAccessibleProjects(admin, user.id);
    if (!projects.length) return Response.json({ endpoints: [] }, { headers: { "Cache-Control": "no-store" } });
    const { data, error } = await admin.from("tic_webhook_endpoints").select(FIELDS).in("project_id", projects.map(project => project.id)).order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ endpoints: data }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Webhook endpoints are temporarily unavailable." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await signedIn();
  if (!user) return Response.json({ error: "Sign in to create a webhook." }, { status: 401 });
  let body: unknown;
  try { body = await readBoundedWebhookJson(request); }
  catch (cause) { return Response.json({ error: cause instanceof WebhookInputError && cause.code === "too_large" ? "Webhook configuration must be under 8 KB." : "Invalid JSON." }, { status: cause instanceof WebhookInputError && cause.code === "too_large" ? 413 : 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Send a JSON object." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const projectId = typeof input.projectId === "string" ? input.projectId : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const destination = typeof input.url === "string" ? input.url.trim() : "";
  const events = input.events;
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || name.length < 2 || name.length > 80 || destination.length < 10 || destination.length > 2048 || !Array.isArray(events) || events.length < 1 || events.length > 2 || events.some(event => typeof event !== "string" || !(EVENTS as readonly string[]).includes(event)) || new Set(events).size !== events.length) {
    return Response.json({ error: "Choose a project, a 2 to 80 character name, and one or more supported event types." }, { status: 400 });
  }
  try {
    const admin = createAdminClient();
    const role = await getProjectRole(admin, projectId, user.id);
    if (!role) return Response.json({ error: "Project not found." }, { status: 404 });
    if (!canWriteOrganization(role)) return Response.json({ error: "Your organization role cannot create webhooks." }, { status: 403 });
    await assertPublicWebhookDestination(destination);
    const { data: project, error: projectError } = await admin.from("developer_projects").select("organization_id").eq("id", projectId).single();
    if (projectError || !project) throw projectError ?? new Error("project_unavailable");
    const { count, error: countError } = await admin.from("tic_webhook_endpoints").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("enabled", true);
    if (countError) throw countError;
    if ((count ?? 0) >= 10) return Response.json({ error: "This project has reached its 10 active webhooks limit." }, { status: 429 });
    const credentials = createWebhookSecret();
    const { data, error } = await admin.from("tic_webhook_endpoints").insert({ project_id: projectId, organization_id: project.organization_id, created_by: user.id, name, url: destination, encrypted_secret: credentials.encryptedSecret, events }).select(FIELDS).single();
    if (error) throw error;
    return Response.json({ endpoint: data, signing_secret: credentials.secret }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";
    if (code === "invalid_webhook_url" || code === "unsafe_webhook_destination") return Response.json({ error: "Use a public HTTPS endpoint on port 443. Private, local, and reserved destinations are not allowed." }, { status: 400 });
    if (code === "webhook_encryption_unconfigured") return Response.json({ error: "Webhook signing is not configured for this environment." }, { status: 503 });
    console.error("tic-webhook-create-failed", cause instanceof Error ? cause.name : "unknown");
    return Response.json({ error: "Webhook could not be created." }, { status: 503 });
  }
}
