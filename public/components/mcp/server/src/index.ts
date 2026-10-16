import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const TIC_MCP_SERVER = { name: "tidelight-intelligence-cloud", version: "1.0.0" } as const;
export type TicMcpOperation =
  | { operation: "market.list"; limit: number; underlyingTicker?: string }
  | { operation: "research.start"; ticker: string; idempotencyKey: string }
  | { operation: "research.get"; jobId: string }
  | { operation: "research.cancel"; jobId: string };
export type TicMcpInvoker = (operation: TicMcpOperation) => Promise<Response>;

export function isTicMcpCredentialActive(credential: { scopes: unknown; revoked_at: string | null; expires_at: string | null }, now = Date.now()) {
  const scopes = Array.isArray(credential.scopes) ? credential.scopes.filter((scope): scope is string => typeof scope === "string") : [];
  return !credential.revoked_at && (!credential.expires_at || Date.parse(credential.expires_at) > now)
    && scopes.some(scope => scope === "market:read" || scope === "research:run");
}

async function asToolResult(response: Response, select?: (data: Record<string, unknown>) => Record<string, unknown>) {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await response.json();
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { data: parsed };
  } catch {
    body = { error: { code: "invalid_upstream_response", message: "Tidelight returned an unreadable response." } };
  }
  const result = select && response.ok ? select(body) : body;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    structuredContent: result,
    ...(!response.ok || ("error" in body && body.error !== null && body.error !== undefined) ? { isError: true } : {}),
  };
}

const tickerSchema = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.]{0,9}$/).describe("Supported US stock ticker, for example NVDA.");
const jobIdSchema = z.string().uuid().describe("Research job ID returned when the job was started.");

/**
 * Create the public Tidelight MCP tool server around a host-provided invoker.
 * Authentication, tenant isolation, quotas and provider access belong to the host.
 */
export function createTidelightMcpServer(scopes: ReadonlySet<string>, invoke: TicMcpInvoker) {
  const server = new McpServer(TIC_MCP_SERVER, { capabilities: { tools: {} } });

  if (scopes.has("market:read")) {
    server.registerTool("tidelight_search_tokenized_equities", {
      title: "Search tokenized equities",
      description: "Search Tidelight's supported Reality tokenized equity spot instruments. These are tokenized products, not direct stock shares or stock perpetual contracts. Results identify the Bitget Reality spot source and provider timestamps.",
      inputSchema: {
        underlying_ticker: tickerSchema.optional().describe("Optional underlying stock ticker to filter, such as NVDA."),
        limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of instruments to return (1 to 100)."),
      },
    }, async ({ underlying_ticker, limit }) => asToolResult(
      await invoke({ operation: "market.list", limit, ...(underlying_ticker ? { underlyingTicker: underlying_ticker } : {}) }),
    ));

    server.registerTool("tidelight_get_tokenized_equity", {
      title: "Get tokenized equity instruments",
      description: "Get currently supported Reality spot instruments mapped to one underlying US stock. An empty list means Tidelight has no matching supported tokenized spot instrument at this time.",
      inputSchema: { ticker: tickerSchema },
    }, async ({ ticker }) => asToolResult(
      await invoke({ operation: "market.list", limit: 100, underlyingTicker: ticker }),
    ));
  }

  if (scopes.has("research:run")) {
    server.registerTool("tidelight_start_company_research", {
      title: "Start company research",
      description: "Queue a durable company snapshot job for a supported US stock. Returns a job ID for polling. Results contain source-labeled market context and headline discovery references; they are not a recommendation or valuation.",
      inputSchema: {
        ticker: tickerSchema,
        idempotency_key: z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/).optional().describe("Optional stable key to safely retry this request (8 to 128 letters, numbers, dots, underscores, colons, or hyphens)."),
      },
    }, async ({ ticker, idempotency_key }) => asToolResult(await invoke({
      operation: "research.start", ticker, idempotencyKey: idempotency_key ?? crypto.randomUUID(),
    })));

    server.registerTool("tidelight_get_research_job", {
      title: "Get research job",
      description: "Read status and the completed structured snapshot for a job in this credential's project. Private model chain-of-thought is never returned.",
      inputSchema: { job_id: jobIdSchema },
    }, async ({ job_id }) => asToolResult(await invoke({ operation: "research.get", jobId: job_id })));

    server.registerTool("tidelight_cancel_research_job", {
      title: "Cancel research job",
      description: "Request cancellation of a queued or running research job owned by this credential's project.",
      inputSchema: { job_id: jobIdSchema },
    }, async ({ job_id }) => asToolResult(await invoke({ operation: "research.cancel", jobId: job_id })));
  }

  return server;
}
