// The protocol/tool implementation is public and maintained in the canonical
// MCP component. Host authentication, tenant checks, quotas, and invocation
// adapters remain private to this application.
export {
  TIC_MCP_SERVER,
  createTidelightMcpServer,
  isTicMcpCredentialActive,
} from "../../public/components/mcp/server/src/index";
export type {
  TicMcpOperation,
  TicMcpInvoker,
} from "../../public/components/mcp/server/src/index";
