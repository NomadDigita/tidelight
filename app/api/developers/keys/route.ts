import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueSecret, sameOrigin } from "@/lib/tic/credentials";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = "id,project_id,name,environment,key_prefix,scopes,minute_limit,monthly_limit,expires_at,revoked_at,last_used_at,created_at";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to manage keys." }, { status: 401 });
  try {
    const { data, error } = await createAdminClient().from("developer_api_keys").select(FIELDS).eq("owner_id", user.id).order("created_at", { ascending: false });
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
  if (!UUID.test(projectId) || name.length < 2 || name.length > 80 || (environment !== "test" && environment !== "production") || !Number.isInteger(expiresInDays) || (expiresInDays as number) < 1 || (expiresInDays as number) > 365) return Response.json({ error: "Invalid project, name, environment, or expiration." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const { data: project, error: projectError } = await admin.from("developer_projects").select("id").eq("id", projectId).eq("owner_id", user.id).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    const { count, error: countError } = await admin.from("developer_api_keys").select("id", { count: "exact", head: true }).eq("project_id", projectId).is("revoked_at", null);
    if (countError) throw countError;
    if ((count ?? 0) >= 10) return Response.json({ error: "Active key limit reached." }, { status: 429 });
    const key = issueSecret(environment);
    const expiresAt = new Date(Date.now() + (expiresInDays as number) * 86400000).toISOString();
    const { data, error } = await admin.from("developer_api_keys").insert({ project_id: projectId, owner_id: user.id, name, environment, key_prefix: key.prefix, key_hash: key.hash, scopes: ["market:read"], expires_at: expiresAt }).select(FIELDS).single();
    if (error) throw error;
    return Response.json({ key: data, secret: key.secret }, { status: 201, headers: { "Cache-Control": "no-store" } });
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
    const { data, error } = await createAdminClient().from("developer_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", body.id).eq("owner_id", user.id).is("revoked_at", null).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Active key not found." }, { status: 404 });
    return Response.json({ revoked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Key could not be revoked." }, { status: 503 }); }
}
