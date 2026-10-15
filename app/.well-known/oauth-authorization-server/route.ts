import { TIC_OAUTH_ISSUER, TIC_MCP_RESOURCE, TIC_OAUTH_SCOPES, oauthNoStoreHeaders } from "@/lib/tic/oauth";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    issuer: TIC_OAUTH_ISSUER,
    authorization_endpoint: `${TIC_OAUTH_ISSUER}/api/oauth/authorize`,
    token_endpoint: `${TIC_OAUTH_ISSUER}/api/oauth/token`,
    registration_endpoint: `${TIC_OAUTH_ISSUER}/api/oauth/register`,
    revocation_endpoint: `${TIC_OAUTH_ISSUER}/api/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: TIC_OAUTH_SCOPES,
    service_documentation: "https://dev.tidelight.app",
    resource: TIC_MCP_RESOURCE,
  }, { headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" } });
}
