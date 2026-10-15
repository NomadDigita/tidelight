import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueSecret, sameOrigin } from "@/lib/tic/credentials";
import { getProjectRole, listAccessibleProjects } from "@/lib/tic/organizations";
import { canRevokeOrganizationKey, canWriteOrganization } from "@/lib/tic/organization-rbac";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = "id,project_id,owner_id,name,environment,key_prefix,scopes,minute_limit,monthly_limit,expires_at,revoked_at,last_used_at,created_at";
const KEY_SCOPES = ["market:read", "research:run", "alerts:manage"] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to manage keys." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const projects = await listAccessibleProjects(admin, user.id);
    if (!projects.length) return Response.json({ keys: [] }, { headers: { "Cache-Control": "no-store" } });
    const { data, error } = await admin.from("developer_api_keys").select(FIELDS).in("project_id", projects.map(project => project.id)).order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ keys: data }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Keys are temporarily unavailable." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to create a key." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body");
    body = parsed as Record<string, unknown>;
  } catch { return Response.json({ error: "Send a JSON object." }, { status: 400 }); }
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const environment = body.environment;
  const expiresInDays = body.expiresInDays;
  const scopes = body.scopes === undefined ? ["market:read"] : body.scopes;
  if (!Array.isArray(scopes) || !scopes.length || scopes.some(scope => typeof scope !== "string" || !(KEY_SCOPES as readonly string[]).includes(scope)) || new Set(scopes).size !== scopes.length) return Response.json({ error: "Choose one or more supported scopes." }, { status: 400 });
  if (!UUID.test(projectId) || name.length < 2 || name.length > 80 || (environment !== "test" && environment !== "production") || !Number.isInteger(expiresInDays) || (expiresInDays as number) < 1 || (expiresInDays as number) > 365) return Response.json({ error: "Invalid project, name, environment, or expiration." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const role = await getProjectRole(admin, projectId, user.id);
    if (!role) return Response.json({ error: "Project not found." }, { status: 404 });
    if (!canWriteOrganization(role)) return Response.json({ error: "Your organization role cannot create credentials." }, { status: 403 });
    const key = issueSecret(environment);
    const expiresAt = new Date(Date.now() + (expiresInDays as number) * 86400000).toISOString();
    const { data: keyId, error } = await admin.rpc("create_developer_api_key_with_audit", {
      p_project_id: projectId,
      p_actor_id: user.id,
      p_actor_email: user.email ?? "",
      p_name: name,
      p_environment: environment,
      p_key_prefix: key.prefix,
      p_key_hash: key.hash,
      p_scopes: scopes,
      p_expires_at: expiresAt,
    });
    if (error?.message.includes("active key limit reached")) return Response.json({ error: "Active key limit reached." }, { status: 429 });
    if (error || typeof keyId !== "string") throw error ?? new Error("Invalid key creation result");
    return Response.json({ keyId, secret: key.secret }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Key could not be created." }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to revoke a key." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body");
    body = parsed as Record<string, unknown>;
  } catch { return Response.json({ error: "Send a JSON object." }, { status: 400 }); }
  if (typeof body.id !== "string" || !UUID.test(body.id)) return Response.json({ error: "Invalid key ID." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const { data: key, error: keyError } = await admin.from("developer_api_keys").select("id,project_id,owner_id").eq("id", body.id).maybeSingle();
    if (keyError) throw keyError;
    if (!key) return Response.json({ error: "Active key not found." }, { status: 404 });
    const role = await getProjectRole(admin, key.project_id, user.id);
    if (!role) return Response.json({ error: "Active key not found." }, { status: 404 });
    if (!canRevokeOrganizationKey(role, key.owner_id === user.id)) return Response.json({ error: "Your organization role cannot revoke this credential." }, { status: 403 });
    const { data, error } = await admin.rpc("revoke_developer_api_key_with_audit", {
      p_key_id: body.id,
      p_actor_id: user.id,
      p_actor_email: user.email ?? "",
    });
    if (error) throw error;
    if (data !== true) return Response.json({ error: "Active key not found." }, { status: 404 });
    return Response.json({ revoked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Key could not be revoked." }, { status: 503 }); }
}
