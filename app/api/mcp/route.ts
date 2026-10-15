import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateTicMcpRequest } from "@/lib/tic/mcp-auth";
import { createTidelightMcpServer, type TicMcpInvoker, type TicMcpOperation } from "@/lib/tic/mcp-protocol";
import { createMcpInternalRequest } from "@/lib/tic/mcp-internal-request";
import { getTicMcpAllowedOrigins, ticMcpCorsHeaders } from "@/lib/tic/mcp-cors";
import { GET as listInstruments } from "@/app/api/v1/market/instruments/route";
import { POST as startResearch } from "@/app/api/v1/research/jobs/route";
import { DELETE as cancelResearch, GET as getResearch } from "@/app/api/v1/research/jobs/[jobId]/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "tidelight.app", "www.tidelight.app", "mcp.tidelight.app",
  "tidelight-tessera8.vercel.app", "tidelight-two.vercel.app", "tidelight-research.vercel.app",
]);
const ALLOWED_ORIGINS = getTicMcpAllowedOrigins(process.env.TIC_MCP_ALLOWED_ORIGINS, process.env.NODE_ENV);

function safeHost(host: string) {
  return ALLOWED_HOSTS.has(host) || /^tidelight-[a-z0-9-]+-tessera8\.vercel\.app$/.test(host);
}

function apiRequest(secret: string, path: string, method: string, body?: unknown, idempotencyKey?: string) {
  const headers = new Headers({ Authorization: `Bearer ${secret}`, Accept: "application/json" });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  return createMcpInternalRequest(`https://tidelight.app${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

function makeInvoker(secret: string): TicMcpInvoker {
  return async (operation: TicMcpOperation): Promise<Response> => {
    switch (operation.operation) {
      case "market.list":
        return listInstruments(apiRequest(secret, `/api/v1/market/instruments?kind=rtoken&limit=${operation.limit}`, "GET"));
      case "research.start":
        return startResearch(apiRequest(secret, "/api/v1/research/jobs", "POST", { ticker: operation.ticker }, operation.idempotencyKey));
      case "research.get":
        return (await getResearch(apiRequest(secret, `/api/v1/research/jobs/${encodeURIComponent(operation.jobId)}`, "GET"), { params: Promise.resolve({ jobId: operation.jobId }) })) ?? Response.json({ error: { code: "service_unavailable", message: "The research job could not be loaded." } }, { status: 503 });
      case "research.cancel":
        return (await cancelResearch(apiRequest(secret, `/api/v1/research/jobs/${encodeURIComponent(operation.jobId)}`, "DELETE"), { params: Promise.resolve({ jobId: operation.jobId }) })) ?? Response.json({ error: { code: "service_unavailable", message: "The research job could not be cancelled." } }, { status: 503 });
      default:
        return Response.json({ error: { code: "unsupported_operation", message: "This Tidelight operation is unavailable." } }, { status: 400 });
    }
  };
}

async function handle(request: Request) {
  let host: string;
  try { host = new URL(request.url).host.toLowerCase(); }
  catch { return Response.json({ error: "Invalid host." }, { status: 400 }); }
  if (!safeHost(host)) return Response.json({ error: "Host is not supported." }, { status: 421, headers: { "Cache-Control": "no-store" } });
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return Response.json({ error: "Origin is not allowed." }, { status: 403, headers: { "Cache-Control": "no-store" } });

  let credential;
  try { credential = await authenticateTicMcpRequest(request); }
  catch { return Response.json({ error: "MCP authentication is temporarily unavailable." }, { status: 503, headers: { ...Object.fromEntries(ticMcpCorsHeaders(origin, ALLOWED_ORIGINS)), "Cache-Control": "no-store" } }); }
  if (!credential) {
    const headers = ticMcpCorsHeaders(origin, ALLOWED_ORIGINS);
    headers.set("Cache-Control", "no-store");
    headers.set("WWW-Authenticate", 'Bearer realm="Tidelight Intelligence Cloud", resource_metadata="https://mcp.tidelight.app/.well-known/oauth-protected-resource/mcp"');
    return Response.json({ error: "Provide an active, scoped Tidelight API key." }, {
      status: 401, headers,
    });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    maxRequestBodySize: 16 * 1024,
    allowedHosts: [host],
    allowedOrigins: ALLOWED_ORIGINS,
    enableDnsRebindingProtection: true,
  });
  try {
    const server = createTidelightMcpServer(new Set(credential.scopes), makeInvoker(credential.secret));
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of ticMcpCorsHeaders(origin, ALLOWED_ORIGINS)) headers.set(name, value);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return Response.json({ error: "The MCP request could not be completed." }, { status: 500, headers: { ...Object.fromEntries(ticMcpCorsHeaders(origin, ALLOWED_ORIGINS)), "Cache-Control": "no-store" } });
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return Response.json({ error: "Origin is not allowed." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  return new Response(null, { status: 204, headers: { ...Object.fromEntries(ticMcpCorsHeaders(origin, ALLOWED_ORIGINS)), "Cache-Control": "no-store" } });
}
