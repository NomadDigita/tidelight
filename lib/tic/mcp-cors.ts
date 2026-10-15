const TIDELIGHT_ORIGINS = ["https://tidelight.app", "https://www.tidelight.app", "https://mcp.tidelight.app"];

export function getTicMcpAllowedOrigins(configured: string | undefined, environment = "production") {
  const extra = (configured ?? "").split(",").map(value => value.trim()).filter(Boolean).flatMap(value => {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.origin !== value || url.username || url.password) return [];
      return [url.origin];
    } catch { return []; }
  });
  return [...new Set([...TIDELIGHT_ORIGINS, ...extra, ...(environment === "development" ? ["http://localhost:3000", "http://127.0.0.1:3000"] : [])])];
}

export function ticMcpCorsHeaders(origin: string | null, allowedOrigins: readonly string[]) {
  const headers = new Headers();
  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-Id");
    headers.set("Access-Control-Expose-Headers", "MCP-Session-Id, WWW-Authenticate");
    headers.set("Access-Control-Max-Age", "600");
    headers.set("Vary", "Origin");
  }
  return headers;
}
