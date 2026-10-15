import { TIC_MCP_RESOURCE, TIC_OAUTH_ISSUER, TIC_OAUTH_SCOPES, oauthNoStoreHeaders } from "@/lib/tic/oauth";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    resource: TIC_MCP_RESOURCE,
    authorization_servers: [TIC_OAUTH_ISSUER],
    scopes_supported: TIC_OAUTH_SCOPES,
    bearer_methods_supported: ["header"],
    resource_documentation: "https://dev.tidelight.app",
  }, { headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" } });
}
