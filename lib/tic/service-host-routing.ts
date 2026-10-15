export type ServiceHostRoute = { kind: "rewrite"; pathname: string } | { kind: "not-found" } | null;

export function resolveServiceHostRoute(hostname: string, pathname: string): ServiceHostRoute {
  const host = hostname.toLowerCase();
  if (host === "api.tidelight.app") {
    if (pathname === "/") return { kind: "rewrite", pathname: "/api/v1" };
    if (pathname === "/v1" || pathname.startsWith("/v1/")) return { kind: "rewrite", pathname: `/api${pathname}` };
    return { kind: "not-found" };
  }
  if (host === "mcp.tidelight.app") {
    if (pathname === "/" || pathname === "/mcp" || pathname === "/api/mcp") return { kind: "rewrite", pathname: "/api/mcp" };
    if (pathname === "/.well-known/oauth-protected-resource/mcp") return { kind: "rewrite", pathname: "/api/oauth/mcp-resource" };
    return { kind: "not-found" };
  }
  if (host === "status.tidelight.app") {
    if (pathname === "/") return { kind: "rewrite", pathname: "/status" };
    if (pathname === "/health") return { kind: "rewrite", pathname: "/api/health" };
    if (pathname === "/status" || pathname === "/api/health") return { kind: "rewrite", pathname };
    return { kind: "not-found" };
  }
  if (host === "dev.tidelight.app") {
    if (pathname === "/" || pathname === "/api") return { kind: "rewrite", pathname: "/developers/docs" };
    if (pathname === "/developers/docs") return { kind: "rewrite", pathname };
    return { kind: "not-found" };
  }
  return null;
}
