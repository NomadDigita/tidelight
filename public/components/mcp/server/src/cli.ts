#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createTidelightMcpProxy } from "./proxy.js";

const apiKey = process.env.TIDELIGHT_API_KEY;
if (!apiKey) {
  console.error("TIDELIGHT_API_KEY is required. Create a scoped project key in the Tidelight Developer Center.");
  process.exitCode = 1;
} else {
  try {
    const proxy = await createTidelightMcpProxy({
      apiKey,
      ...(process.env.TIDELIGHT_MCP_URL ? { endpoint: process.env.TIDELIGHT_MCP_URL } : {}),
    });
    await proxy.server.connect(new StdioServerTransport());
    const close = () => { void proxy.close().finally(() => { process.exitCode = 0; }); };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Tidelight MCP connection failed.");
    process.exitCode = 1;
  }
}
