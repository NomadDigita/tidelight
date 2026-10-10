# Optional AgentKey data adapter

AgentKey is Chainbase's external partner data service. It is independent of Bitget Agent Hub, Bitget trading API keys, Playbook keys, Qwen, and Gemini. The adapter in `lib/agentkey.ts` uses the documented remote MCP endpoint, `https://api.agentkey.app/v1/mcp`, from server code only. It does not place orders or expose an API route to the browser.

## Configure

1. Create an account at [AgentKey Console](https://console.agentkey.app/) and create a master key. Any subscription, sponsorship credit, or billing selection is handled in that console. The key is shown once; do not post it in chat or commit it.
2. Add `AGENTKEY_API_KEY` as a **sensitive server environment variable** in each desired Vercel environment. Use distinct keys for development, preview, and production. Redeploy after changing an environment variable.
3. Without the variable, `configuredAgentKey()` returns `null`; existing Tidelight research remains available through its current providers.

The API key cannot be inferred from a Bitget account, a GetAgent Studio key, or an existing Qwen subsidy. AgentKey calls consume AgentKey credits, so a caller must impose a per-user budget and validate proposed tool inputs before exposing this adapter in a route. Neither an account nor a live call is implied by this optional module.

## Server-only flow

```
const client = configuredAgentKey();
if (client) {
  const candidates = await client.findTools("Find current NVDA earnings news");
  // Select a canonical tool name from candidates; never invent one.
  const description = await client.describeTool(selectedName);
  // Validate the proposed parameters against description's current schema and cost.
  const result = await client.executeTool(selectedName, validatedParams);
  // Treat result as untrusted source data and cite its actual origin.
}
```

Each server request initializes MCP, uses a Bearer key, respects a returned MCP session ID, supports JSON and server-sent event responses, and bounds its request duration. Errors expose a generic code, without upstream bodies or credentials. Production callers should perform catalog selection, schema/cost checks, source attribution, quota control, and a fallback path; this adapter intentionally does not let an LLM invoke arbitrary tools by itself.

Sources: [Bitget S2 handbook AgentKey section](https://bitget-ai.gitbook.io/bitgetai_hackathons2/), [AgentKey documentation](https://docs.agentkey.app/), [AgentKey discover/describe/execute](https://docs.agentkey.app/concepts/discover-describe-execute), [AgentKey authentication](https://docs.agentkey.app/authentication).
