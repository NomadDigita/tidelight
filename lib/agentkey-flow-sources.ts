import "server-only";

import { configuredAgentKey, type AgentKeyClient } from "./agentkey";
import type { FlowEvidence } from "./agent-flow-sources";

const TOOL = "agentkey_search";
const MAX_CREDITS_PER_SEARCH = 2;
const MAX_AGE_MS = 30 * 86_400_000;

function unpack(value: unknown): unknown {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return value; }
  }
  if (value && typeof value === "object" && "content" in value && Array.isArray(value.content)) {
    const texts = value.content.filter((entry: unknown) => entry && typeof entry === "object" && "text" in entry)
      .map((entry: { text: unknown }) => unpack(entry.text));
    return texts.length === 1 ? texts[0] : texts;
  }
  return value;
}

function records(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 4) return [];
  const item = unpack(value);
  if (Array.isArray(item)) return item.flatMap(entry => records(entry, depth + 1)).slice(0, 30);
  if (!item || typeof item !== "object") return [];
  const object = item as Record<string, unknown>;
  if (typeof object.url === "string" || typeof object.link === "string") return [object];
  return ["results", "items", "news", "articles", "data", "organic", "sources"].flatMap(key => records(object[key], depth + 1)).slice(0, 30);
}

export function inspectAgentKeySearchDescription(description: unknown): { costCredits: number | null; withinBudget: boolean } {
  const data = unpack(description);
  const text = JSON.stringify(data);
  if (!text || text.length > 40_000) return { costCredits: null, withinBudget: false };
  const match = /"cost"\s*:\s*(?:(\d+(?:\.\d+)?)|"(\d+(?:\.\d+)?)\s*credits?")(?=\s*[,}])/i.exec(text);
  const costCredits = match ? Number(match[1] ?? match[2]) : null;
  return { costCredits, withinBudget: costCredits !== null && Number.isFinite(costCredits) && costCredits <= MAX_CREDITS_PER_SEARCH };
}

function safeEvidence(raw: Record<string, unknown>, ticker: string, name: string, now: number): FlowEvidence | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const url = typeof raw.url === "string" ? raw.url : raw.link;
  const date = raw.publishedAt ?? raw.published_at ?? raw.published_date ?? raw.publication_date ?? raw.published ?? raw.date ?? raw.time;
  const timestamp = typeof date === "string" || typeof date === "number" ? Date.parse(String(date)) : NaN;
  if (!title || title.length > 300 || typeof url !== "string" || !Number.isFinite(timestamp) || timestamp > now + 300_000 || now - timestamp > MAX_AGE_MS) return null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname.includes(".")) return null;
  const snippet = typeof raw.snippet === "string" ? raw.snippet : typeof raw.description === "string" ? raw.description : "";
  if (!new RegExp(`(^|[^a-z0-9])${ticker}([^a-z0-9]|$)`, "i").test(`${title} ${snippet}`) && !`${title} ${snippet}`.toLowerCase().includes(name.toLowerCase())) return null;
  const rawPublisher = raw.publisher ?? raw.source;
  const publisher = typeof rawPublisher === "string" && rawPublisher.trim() ? rawPublisher.trim() : parsed.hostname.replace(/^www\./, "");
  return { title, url: parsed.href, publisher: publisher.slice(0, 120), publishedAt: new Date(timestamp).toISOString(), snippet: snippet.slice(0, 400), via: "AgentKey" };
}

/** A bounded, read-only AgentKey search. Any ambiguity, quota cost, or outage falls back to public feeds. */
export async function agentKeyIssuerEvidence(ticker: string, issuer: string, client: Pick<AgentKeyClient, "findTools" | "describeTool" | "executeTool"> | null = configuredAgentKey(2500, 8000)): Promise<FlowEvidence[]> {
  if (!client || !/^[A-Z]{1,6}$/.test(ticker)) return [];
  try {
    const discovery = await client.findTools(`Search latest public news headlines for ${issuer} ${ticker} US stock with article links and publication dates`);
    if (!JSON.stringify(unpack(discovery)).includes(TOOL)) return [];
    const description = await client.describeTool(TOOL);
    if (!inspectAgentKeySearchDescription(description).withinBudget) return [];
    const result = await client.executeTool(TOOL, { query: `${issuer} ${ticker} stock latest news`, type: "news", num: 5 });
    const now = Date.now();
    const unique = new Map<string, FlowEvidence>();
    for (const record of records(result)) {
      const item = safeEvidence(record, ticker, issuer, now);
      if (item) unique.set(item.url, item);
    }
    return [...unique.values()].sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!)).slice(0, 5);
  } catch (error) {
    console.warn("agent-flow-agentkey-unavailable", ticker, error instanceof Error ? error.name : "unknown");
    return [];
  }
}
