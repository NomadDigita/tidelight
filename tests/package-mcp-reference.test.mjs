import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("hosted MCP snippet is labeled as an endpoint reference, not a client config", async () => {
  const source = await readFile(new URL("../app/developers/packages/mcp-detail.tsx", import.meta.url), "utf8");
  const hostedSnippet = source.match(/hosted: `([^`]*)`/)?.[1]?.replaceAll("\\n", "\n");
  assert.ok(hostedSnippet, "hosted endpoint reference must exist");
  assert.match(hostedSnippet, /Endpoint: https:\/\/mcp\.tidelight\.app\/mcp/);
  assert.match(hostedSnippet, /Transport: Streamable HTTP/);
  assert.match(hostedSnippet, /endpoint and authentication\s+reference,/);
  assert.match(hostedSnippet, /not client-specific config/);
  assert.match(hostedSnippet, /OAuth when supported/);
  assert.match(hostedSnippet, /bearer auth on the client/);
  assert.match(source, /Local client config/);
  assert.ok(
    hostedSnippet.split("\n").every(line => line.length <= 40),
    "hosted reference lines must fit the mobile code panel without horizontal scrolling",
  );
});
