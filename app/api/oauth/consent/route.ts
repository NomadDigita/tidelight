import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProjectRole } from "@/lib/tic/organizations";
import { createOAuthSecret, hashOAuthSecret, oauthNoStoreHeaders } from "@/lib/tic/oauth";
import { sameOrigin } from "@/lib/tic/credentials";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "invalid_origin" }, { status: 403, headers: oauthNoStoreHeaders() });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "login_required" }, { status: 401, headers: oauthNoStoreHeaders() });
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "invalid_request" }, { status: 400, headers: oauthNoStoreHeaders() }); }
  const flowId = String(form.get("flow_id") ?? "");
  const keyId = String(form.get("key_id") ?? "");
  const decision = String(form.get("decision") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(flowId) || (decision !== "approve" && decision !== "deny")) return Response.json({ error: "invalid_request" }, { status: 400, headers: oauthNoStoreHeaders() });
  try {
    const admin = createAdminClient();
    const { data: flow, error: flowError } = await admin.from("tic_oauth_flows").select("*").eq("id", flowId).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (flowError) throw flowError;
    if (!flow) return new Response("Authorization request expired. Return to your MCP client and try again.", { status: 410, headers: { ...oauthNoStoreHeaders(), "Content-Type": "text/plain; charset=utf-8" } });
    const callback = new URL(flow.redirect_uri);
    if (decision === "deny") {
      callback.searchParams.set("error", "access_denied");
      if (flow.state) callback.searchParams.set("state", flow.state);
      await admin.from("tic_oauth_flows").delete().eq("id", flow.id);
      return NextResponse.redirect(callback, { status: 303, headers: oauthNoStoreHeaders() });
    }
    if (!/^[0-9a-f-]{36}$/i.test(keyId)) return Response.json({ error: "invalid_key" }, { status: 400, headers: oauthNoStoreHeaders() });
    const { data: key, error: keyError } = await admin.from("developer_api_keys").select("id,project_id,scopes,revoked_at,expires_at").eq("id", keyId).maybeSingle();
    if (keyError) throw keyError;
    const role = key ? await getProjectRole(admin, key.project_id, user.id) : null;
    if (!key || !role || role === "reader" || key.revoked_at || (key.expires_at && Date.parse(key.expires_at) <= Date.now()) || !flow.scopes.every((scope: string) => key.scopes.includes(scope))) {
      return Response.json({ error: "invalid_key", error_description: "Choose an active project key with the requested scopes." }, { status: 403, headers: oauthNoStoreHeaders() });
    }
    const code = createOAuthSecret("code");
    const { error: insertError } = await admin.from("tic_oauth_sessions").insert({
      client_id: flow.client_id,
      user_id: user.id,
      project_id: key.project_id,
      key_id: key.id,
      redirect_uri: flow.redirect_uri,
      resource: flow.resource,
      scopes: flow.scopes,
      authorization_code_hash: hashOAuthSecret(code),
      code_challenge: flow.code_challenge,
      code_expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    if (insertError) throw insertError;
    await admin.from("tic_oauth_flows").delete().eq("id", flow.id);
    callback.searchParams.set("code", code);
    if (flow.state) callback.searchParams.set("state", flow.state);
    return NextResponse.redirect(callback, { status: 303, headers: oauthNoStoreHeaders() });
  } catch {
    return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: oauthNoStoreHeaders() });
  }
}
