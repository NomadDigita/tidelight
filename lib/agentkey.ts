import "server-only";

// AgentKey is an optional Chainbase data source, not a Bitget order gateway.
// Keep its master key on the server: a browser caller must never choose a tool
// name or send arbitrary parameters directly to this client.
const ENDPOINT = "https://api.agentkey.app/v1/mcp";
const PROTOCOL_VERSION = "2025-06-18";
const MAX_RESPONSE_BYTES = 1_000_000;

type JsonRpcResponse = { jsonrpc?: string; id?: number; result?: unknown; error?: { code?: number; message?: string } };
type FetchLike = typeof fetch;

export class AgentKeyError extends Error {
  readonly code: "unavailable" | "unauthorized" | "upstream" | "protocol" | "timeout";
  constructor(code: "unavailable" | "unauthorized" | "upstream" | "protocol" | "timeout") {
    super(`agentkey-${code}`);
    this.code = code;
  }
}

function parseResponse(raw: string, contentType: string, id: number): JsonRpcResponse {
  if (contentType.includes("text/event-stream")) {
    for (const event of raw.split(/\r?\n\r?\n/)) {
      const data = event.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
      if (!data || data === "[DONE]") continue;
      try {
        const message = JSON.parse(data) as JsonRpcResponse;
        if (message.id === id) return message;
      } catch { /* Ignore non-JSON keepalives. */ }
    }
    throw new AgentKeyError("protocol");
  }
  try {
    const message = JSON.parse(raw) as JsonRpcResponse;
    if (message.id !== id) throw new AgentKeyError("protocol");
    return message;
  } catch (error) {
    if (error instanceof AgentKeyError) throw error;
    throw new AgentKeyError("protocol");
  }
}

export class AgentKeyClient {
  private nextId = 1;
  private sessionId: string | undefined;
  private initialized = false;
  private readonly key: string;
  private readonly transport: FetchLike;
  private readonly timeoutMs: number;
  private readonly deadlineAt: number | null;

  constructor(key: string, transport: FetchLike = fetch, timeoutMs = 12000, totalBudgetMs?: number) {
    if (!key.trim()) throw new AgentKeyError("unavailable");
    this.key = key;
    this.transport = transport;
    this.timeoutMs = timeoutMs;
    this.deadlineAt = totalBudgetMs ? Date.now() + totalBudgetMs : null;
  }

  private async request(method: string, params?: Record<string, unknown>, notification = false): Promise<unknown> {
    const remaining = this.deadlineAt === null ? this.timeoutMs : Math.min(this.timeoutMs, this.deadlineAt - Date.now());
    if (remaining <= 0) throw new AgentKeyError("timeout");
    const id = this.nextId++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remaining);
    try {
      const response = await this.transport(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.key}`,
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": PROTOCOL_VERSION,
          ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", ...(!notification ? { id } : {}), method, ...(params ? { params } : {}) }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403) throw new AgentKeyError("unauthorized");
      if (!response.ok) throw new AgentKeyError("upstream");
      if (method === "initialize") this.sessionId = response.headers.get("Mcp-Session-Id") || undefined;
      if (notification) return undefined;
      const raw = await response.text();
      if (raw.length > MAX_RESPONSE_BYTES) throw new AgentKeyError("protocol");
      const payload = parseResponse(raw, response.headers.get("content-type") || "", id);
      if (payload.error) throw new AgentKeyError("upstream");
      if (!Object.hasOwn(payload, "result")) throw new AgentKeyError("protocol");
      return payload.result;
    } catch (error) {
      if (error instanceof AgentKeyError) throw error;
      if (controller.signal.aborted) throw new AgentKeyError("timeout");
      throw new AgentKeyError("upstream");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "tidelight-server", version: "1.0.0" },
    });
    await this.request("notifications/initialized", undefined, true);
    this.initialized = true;
  }

  private async callTool(name: "find_tools" | "describe_tool" | "execute_tool", args: Record<string, unknown>): Promise<unknown> {
    await this.initialize();
    const result = await this.request("tools/call", { name, arguments: args }) as { isError?: boolean } | null;
    if (!result || result.isError) throw new AgentKeyError("upstream");
    return result;
  }

  /** Discover live catalog names using the user's full natural-language intent. */
  findTools(query: string): Promise<unknown> {
    if (!query.trim() || query.length > 500) throw new AgentKeyError("protocol");
    return this.callTool("find_tools", { q: query });
  }

  /** Fetch the current schema and cost before executing a discovered tool. */
  describeTool(name: string): Promise<unknown> {
    if (!name.trim() || name.length > 200) throw new AgentKeyError("protocol");
    return this.callTool("describe_tool", { name });
  }

  /** Call only a tool whose name and params were checked against describeTool. */
  executeTool(name: string, params: Record<string, unknown>): Promise<unknown> {
    if (!name.trim() || name.length > 200) throw new AgentKeyError("protocol");
    return this.callTool("execute_tool", { name, params });
  }
}

export function configuredAgentKey(timeoutMs?: number, totalBudgetMs?: number): AgentKeyClient | null {
  const key = process.env.AGENTKEY_API_KEY?.trim();
  return key ? new AgentKeyClient(key, fetch, timeoutMs, totalBudgetMs) : null;
}
