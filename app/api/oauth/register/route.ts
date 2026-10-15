import { createAdminClient } from "@/lib/supabase/admin";
import { createOAuthClientId, parseOAuthScopes, validateOAuthRedirectUris, oauthNoStoreHeaders } from "@/lib/tic/oauth";
import { reserveOAuthRateLimit } from "@/lib/tic/oauth-rate-limit";

export const dynamic = "force-dynamic";

function registrationHeaders() {
  return { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*" };
}

export async function POST(request: Request) {
  try {
    if (!await reserveOAuthRateLimit(request, "register", 20, 3600)) return Response.json({ error: "slow_down" }, { status: 429, headers: { ...oauthNoStoreHeaders(), "Retry-After": "3600" } });
  } catch { return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: oauthNoStoreHeaders() }); }
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 8_192) return Response.json({ error: "invalid_client_metadata", error_description: "Registration body is too large." }, { status: 413, headers: registrationHeaders() });
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    body = value as Record<string, unknown>;
  } catch { return Response.json({ error: "invalid_client_metadata" }, { status: 400, headers: registrationHeaders() }); }
  const clientName = typeof body.client_name === "string" ? body.client_name.trim() : "";
  const redirectUris = validateOAuthRedirectUris(body.redirect_uris);
  const grantTypes = body.grant_types ?? ["authorization_code", "refresh_token"];
  const responseTypes = body.response_types ?? ["code"];
  const authMethod = body.token_endpoint_auth_method ?? "none";
  const requestedScopes = typeof body.scope === "string" ? parseOAuthScopes(body.scope) : ["market:read"];
  if (!clientName || clientName.length > 120 || !redirectUris || !Array.isArray(grantTypes) || grantTypes.length !== 2 || !grantTypes.includes("authorization_code") || !grantTypes.includes("refresh_token") || !Array.isArray(responseTypes) || responseTypes.length !== 1 || responseTypes[0] !== "code" || authMethod !== "none" || !requestedScopes) {
    return Response.json({ error: "invalid_client_metadata", error_description: "Tidelight supports public clients using authorization code with PKCE and HTTPS or loopback redirect URIs." }, { status: 400, headers: registrationHeaders() });
  }
  const clientId = createOAuthClientId();
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("tic_oauth_clients").insert({ client_id: clientId, client_name: clientName, redirect_uris: redirectUris, scopes: requestedScopes });
    if (error) throw error;
    return Response.json({ client_id: clientId, client_name: clientName, redirect_uris: redirectUris, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", scope: requestedScopes.join(" "), client_id_issued_at: Math.floor(Date.now() / 1000) }, { status: 201, headers: registrationHeaders() });
  } catch { return Response.json({ error: "server_error" }, { status: 503, headers: registrationHeaders() }); }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...registrationHeaders(), "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
