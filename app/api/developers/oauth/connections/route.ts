import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sameOrigin } from "@/lib/tic/credentials";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to view MCP connections." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const { data: sessions, error } = await admin.from("tic_oauth_sessions").select("id,client_id,project_id,key_id,scopes,created_at,refreshed_at,refresh_token_expires_at,revoked_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const clientIds = [...new Set((sessions ?? []).map(session => session.client_id))];
    const projectIds = [...new Set((sessions ?? []).map(session => session.project_id))];
    const [{ data: clients, error: clientsError }, { data: projects, error: projectsError }, { data: keys, error: keysError }] = await Promise.all([
      clientIds.length ? admin.from("tic_oauth_clients").select("client_id,client_name").in("client_id", clientIds) : Promise.resolve({ data: [], error: null }),
      projectIds.length ? admin.from("developer_projects").select("id,name").in("id", projectIds) : Promise.resolve({ data: [], error: null }),
      projectIds.length ? admin.from("developer_api_keys").select("id,revoked_at,expires_at").in("id", (sessions ?? []).map(session => session.key_id)) : Promise.resolve({ data: [], error: null }),
    ]);
    if (clientsError || projectsError || keysError) throw clientsError ?? projectsError ?? keysError;
    const rows = (sessions ?? []).map(session => {
      const key = (keys ?? []).find(item => item.id === session.key_id);
      return { ...session, client_name: (clients ?? []).find(item => item.client_id === session.client_id)?.client_name ?? "MCP client", project_name: (projects ?? []).find(item => item.id === session.project_id)?.name ?? "Project", active: !session.revoked_at && !!session.refresh_token_expires_at && Date.parse(session.refresh_token_expires_at) > Date.now() && !!key && !key.revoked_at && (!key.expires_at || Date.parse(key.expires_at) > Date.now()) };
    });
    return Response.json({ connections: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "MCP connections are temporarily unavailable." }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to revoke MCP connections." }, { status: 401 });
  let body: { id?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Send a valid request." }, { status: 400 }); }
  if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return Response.json({ error: "Invalid connection ID." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("tic_oauth_sessions").update({ revoked_at: new Date().toISOString(), access_token_hash: null, refresh_token_hash: null }).eq("id", body.id).eq("user_id", user.id).is("revoked_at", null).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Active connection not found." }, { status: 404 });
    return Response.json({ revoked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Connection could not be revoked." }, { status: 503 }); }
}
