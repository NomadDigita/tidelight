import "server-only";

import { AgentKeyError, configuredAgentKey } from "@/lib/agentkey";

const MAX_CONTEXT = 4_500;

type ToolResult = { content?: Array<{ type?: unknown; text?: unknown }> };

function textFrom(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const content = (result as ToolResult).content;
  if (!Array.isArray(content)) return "";
  return content.map(item => item && item.type === "text" && typeof item.text === "string" ? item.text : "").join("\n").replace(/\s+/g, " ").trim().slice(0, MAX_CONTEXT);
}

function toolNames(result: unknown): string[] {
  const text = textFrom(result);
  // AgentKey's catalogue is deliberately treated as untrusted provider data. We
  // accept a short, conservative tool-name form only, then inspect its schema.
  return [...new Set((text.match(/[A-Za-z][A-Za-z0-9_-]{1,60}\/[A-Za-z][A-Za-z0-9_.-]{1,80}/g) ?? []))].slice(0, 4);
}

export type AgentKeyResearch = { state: "used" | "unavailable" | "unsupported"; context: string; tool?: string };

/**
 * Execute one discovered public research tool at most. Its output is only
 * supplemental context: it is never stored as a cited source and never opens
 * a trading gate. The existing issuer-source pipeline remains authoritative.
 */
export async function gatherAgentKeyResearch(query: string): Promise<AgentKeyResearch> {
  const client = configuredAgentKey();
  if (!client) return { state: "unavailable", context: "" };
  try {
    const discovery = await client.findTools(`Find public, read-only news or company research relevant to: ${query.slice(0, 420)}`);
    for (const name of toolNames(discovery)) {
      const description = textFrom(await client.describeTool(name));
      const schema = description.toLowerCase();
      // Discovery output belongs to a third party. Never execute a tool that
      // hints at a mutation, credential action, payment, or order operation.
      if (/(?:\bwrite\b|\bcreate\b|\bupdate\b|\bdelete\b|\btrade\b|\border\b|\btransfer\b|\bwallet\b|\bkey\b|\bpayment\b)/.test(schema)) continue;
      if (!/(?:\bnews\b|\bresearch\b|\bsearch\b|\bmarket\b|\bpublic\b|\bread.?only\b)/.test(schema)) continue;
      const parameter = schema.includes("query") ? "query" : schema.includes(" q") ? "q" : "";
      if (!parameter) continue;
      const result = await client.executeTool(name, { [parameter]: query.slice(0, 420) });
      const context = textFrom(result);
      if (context) return { state: "used", tool: name, context };
    }
    return { state: "unsupported", context: "" };
  } catch (cause) {
    // Provider details and tool output must not escape into client-visible errors.
    if (cause instanceof AgentKeyError) return { state: "unavailable", context: "" };
    return { state: "unavailable", context: "" };
  }
}
