import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export const DEFAULT_TIDELIGHT_MCP_URL = "https://mcp.tidelight.app/mcp";
const API_KEY_PATTERN = /^tl_(?:test|live)_[A-Za-z0-9_-]{43}$/;

export type TidelightMcpProxyOptions = {
  apiKey: string;
  endpoint?: string;
  fetch?: typeof fetch;
};

export function validateTidelightMcpProxyOptions(options: TidelightMcpProxyOptions) {
  if (!API_KEY_PATTERN.test(options.apiKey)) throw new TypeError("A valid Tidelight API key is required.");
  let endpoint: URL;
  try { endpoint = new URL(options.endpoint ?? DEFAULT_TIDELIGHT_MCP_URL); }
  catch { throw new TypeError("The Tidelight MCP endpoint must be a valid URL."); }
  const localDevelopmentHost = ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);
  if ((endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && localDevelopmentHost)) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new TypeError("The Tidelight MCP endpoint must use HTTPS and cannot contain credentials, query, or fragment.");
  }
  return { apiKey: options.apiKey, endpoint, fetch: options.fetch ?? globalThis.fetch };
}

/**
 * Create a local stdio-compatible MCP server which forwards discovery and tool
 * calls to Tidelight's hosted MCP service. Authorization and scopes stay on the
 * hosted service; this adapter does not duplicate Tidelight business logic.
 */
export async function createTidelightMcpProxy(options: TidelightMcpProxyOptions) {
  const config = validateTidelightMcpProxyOptions(options);
  const remoteClient = new Client({ name: "tidelight-mcp-stdio-proxy", version: "0.1.0" });
  const remoteTransport = new StreamableHTTPClientTransport(config.endpoint, {
    requestInit: { headers: { Authorization: `Bearer ${config.apiKey}` } },
    fetch: config.fetch,
  });

  try {
    await remoteClient.connect(remoteTransport);
  } catch {
    await remoteClient.close().catch(() => undefined);
    throw new Error("Could not connect to Tidelight MCP. Check the endpoint, network, and API key scope.");
  }

  const server = new Server(
    { name: "tidelight-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => remoteClient.listTools());
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    return remoteClient.callTool({ name: params.name, arguments: params.arguments ?? {} });
  });

  return {
    server,
    close: async () => {
      await Promise.allSettled([server.close(), remoteClient.close()]);
    },
  };
}
