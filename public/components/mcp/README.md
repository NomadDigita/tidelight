# Tidelight Intelligence Cloud MCP

Connect an MCP client to the Streamable HTTP endpoint:

```text
https://mcp.tidelight.app/mcp
```

The service accepts Tidelight OAuth access tokens and scoped developer API keys. OAuth grants are approved on the Tidelight consent screen, bound to a project key, and limited to scopes that key already has. Discovery metadata is available at:

- `https://mcp.tidelight.app/.well-known/oauth-protected-resource/mcp`
- `https://mcp.tidelight.app/.well-known/oauth-authorization-server`

## Available tools

| Tool | Required scope | Purpose |
| --- | --- | --- |
| `tidelight_search_tokenized_equities` | `market:read` | Search supported Reality tokenized-equity spot instruments, with server-side underlying ticker filtering |
| `tidelight_get_tokenized_equity` | `market:read` | Filter supported instruments by underlying ticker |
| `tidelight_start_company_research` | `research:run` | Start a durable research snapshot job |
| `tidelight_get_research_job` | `research:run` | Read a job status and completed snapshot |
| `tidelight_cancel_research_job` | `research:run` | Cancel queued/running work |

An empty instrument list means there is no matching supported tokenized spot instrument. These instruments are not direct US shares or stock perpetual contracts. Research results contain source-labeled context, are not recommendations, and never expose private model chain-of-thought.

## Public implementation boundary

`server/` contains the host-agnostic MCP protocol core, the `@tidelight/mcp` local stdio bridge, and scope/schema/proxy tests. Production uses the same protocol core. The local bridge forwards discovery and tool calls to the hosted service; it does not replace or run the production endpoint. The application host enforces authentication, OAuth, tenant isolation, quotas, logging, provider access and operational controls. Private service adapters remain in the mother repository and are not mirrored here.

Check the package with `cd server && npm ci && npm test && npm pack --dry-run --json`. The manifest stays private until first-release approval. Those protocol tests do not certify compatibility with an external client. Tidelight has not yet certified a named third-party MCP client's complete OAuth, refresh, invocation, and revocation flow. See the [developer guide](https://dev.tidelight.app/api) for current connection and troubleshooting instructions.

This repository is synchronized from `TidelightOrg/tidelight`; propose source changes there.

The mother repository owns package tests and the manual GitHub source-release workflow. That workflow creates source releases in this mirror; it does not publish `@tidelight/mcp` to npm.
