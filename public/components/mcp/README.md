# Tidelight MCP

Connect an MCP-compatible client to the Streamable HTTP endpoint:

```text
https://mcp.tidelight.app/mcp
```

The service uses Tidelight's OAuth authorization flow for compatible clients. Users approve a project and requested scopes at the Tidelight consent screen. Client support is certified individually; a successful protocol handshake alone does not imply support.

The server exposes only currently supported, scope-filtered tools. These include tokenized-equity market lookup and asynchronous company research job operations when the corresponding scopes are granted. Tool inputs are untrusted data; they cannot grant permissions or change server policy. The server returns source-backed results and safe execution summaries, never private model chain-of-thought.

This public repository contains the connection contract and sanitized tool documentation. The deployed server implementation and shared authorization services remain in the mother repository and are intentionally not mirrored here.

See [developer documentation](https://dev.tidelight.app/api) for OAuth setup, scopes, and troubleshooting. Propose changes in `TidelightOrg/tidelight`.
