# Tidelight MCP protocol core

This TypeScript package contains the public, host-agnostic MCP server and its tool schemas. The production deployment at `https://mcp.tidelight.app/mcp` uses this same source from the Tidelight mother repository.

This package is a protocol component, not a standalone public service. The host application supplies the `market:read` and `research:run` scopes and an invoker. Authentication, OAuth, tenant isolation, quotas, provider access, and request logging stay in the host application and must be enforced there.

## Development

```sh
npm ci
npm test
```

`createTidelightMcpServer(scopes, invoke)` registers only the tools permitted by the supplied scope set. The invoker receives validated operations and returns a standard `Response`; host errors are returned as structured MCP tool errors. Do not pass credentials or private provider data in tool output.

The component supports market instrument search and lookup with `market:read`, and durable research job start/status/cancel with `research:run`. Tokenized equity spot instruments are explicitly distinguished from direct stock shares and stock perpetuals. Research outputs are evidence context, not investment recommendations.

The live endpoint uses Streamable HTTP and Tidelight OAuth or a scoped API key. See the [connection guide](../README.md). Tidelight certifies external clients individually; this package's protocol tests are not a compatibility certification for any client.
