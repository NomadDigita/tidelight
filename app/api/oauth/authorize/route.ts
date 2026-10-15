import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseOAuthScopes, TIC_MCP_RESOURCE, validateOAuthRedirectUris, oauthNoStoreHeaders } from "@/lib/tic/oauth";
import { reserveOAuthRateLimit } from "@/lib/tic/oauth-rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!await reserveOAuthRateLimit(request, "authorize", 30, 3600)) return Response.json({ error: "slow_down" }, { status: 429, headers: { ...oauthNoStoreHeaders(), "Retry-After": "3600" } });
  } catch { return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: oauthNoStoreHeaders() }); }
  const params = new URL(request.url).searchParams;
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const resource = params.get("resource");
  const challenge = params.get("code_challenge") ?? "";
  const state = params.get("state");
  if (!/^tlic_[A-Za-z0-9_-]{32}$/.test(clientId) || params.get("response_type") !== "code" || params.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge) || !redirectUri || (state !== null && (!state || state.length > 512)) || resource !== TIC_MCP_RESOURCE) {
    return Response.json({ error: "invalid_request", error_description: "Authorization code with S256 PKCE and the Tidelight MCP resource is required." }, { status: 400, headers: oauthNoStoreHeaders() });
  }
  try {
    const admin = createAdminClient();
    const { error: cleanupError } = await admin.from("tic_oauth_flows").delete().lt("expires_at", new Date().toISOString());
    if (cleanupError) throw cleanupError;
    const { data: client, error: clientError } = await admin.from("tic_oauth_clients").select("client_id,redirect_uris,scopes").eq("client_id", clientId).maybeSingle();
    if (clientError) throw clientError;
    if (!client || !validateOAuthRedirectUris(client.redirect_uris) || !(client.redirect_uris as string[]).includes(redirectUri)) return Response.json({ error: "invalid_client" }, { status: 400, headers: oauthNoStoreHeaders() });
    const scopes = parseOAuthScopes(params.get("scope"), client.scopes);
    if (!scopes) return Response.json({ error: "invalid_scope" }, { status: 400, headers: oauthNoStoreHeaders() });
    const { data: flow, error } = await admin.from("tic_oauth_flows").insert({ client_id: clientId, redirect_uri: redirectUri, scopes, resource, code_challenge: challenge, state }).select("id").single();
    if (error) throw error;
    return NextResponse.redirect(new URL(`/developers/oauth/consent?flow=${encodeURIComponent(flow.id)}`, "https://tidelight.app"), { status: 303, headers: oauthNoStoreHeaders() });
  } catch {
    return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: oauthNoStoreHeaders() });
  }
}
