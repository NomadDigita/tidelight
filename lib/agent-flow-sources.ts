import type { FlowSource } from "./agent-flow-policy";

export type FlowEvidence = FlowSource & { snippet: string };
const issuerNames: Record<string, string> = { NVDA: "NVIDIA", TSLA: "Tesla", AAPL: "Apple", AMD: "Advanced Micro Devices", MSFT: "Microsoft", META: "Meta", AMZN: "Amazon", GOOGL: "Alphabet", INTC: "Intel", ASML: "ASML", QCOM: "Qualcomm", MU: "Micron" };

function decode(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function field(xml: string, tag: string) {
  return decode(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(xml)?.[1] ?? "");
}

async function rss(url: URL): Promise<FlowEvidence[]> {
  const response = await fetch(url, { headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "Tidelight Research/1.0" }, signal: AbortSignal.timeout(9000), cache: "no-store" });
  if (!response.ok) throw new Error(`http-${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 12).flatMap(match => {
    const item = match[1], title = field(item, "title"), link = field(item, "link");
    if (!title || !link.startsWith("https://")) return [];
    const published = Date.parse(field(item, "pubDate"));
    return [{ title, url: link, publisher: field(item, "source") || new URL(link).hostname.replace(/^www\./, ""),
      publishedAt: Number.isFinite(published) ? new Date(published).toISOString() : null,
      snippet: field(item, "description").slice(0, 400), via: "Public feeds" }];
  });
}

export async function gatherIssuerEvidence(ticker: string, issuer: string): Promise<FlowEvidence[]> {
  const name = issuerNames[ticker] ?? issuer;
  const google = new URL("https://news.google.com/rss/search");
  google.search = new URLSearchParams({ q: `"${name}" OR "${ticker}" (stock OR earnings OR filing)`, hl: "en-US", gl: "US", ceid: "US:en" }).toString();
  const bing = new URL("https://www.bing.com/news/search");
  bing.search = new URLSearchParams({ q: `${name} ${ticker} stock`, format: "rss" }).toString();
  const results = await Promise.allSettled([rss(google), rss(bing)]);
  results.forEach((result, index) => {
    if (result.status === "rejected") console.warn("agent-flow-source-feed", ticker, index === 0 ? "google" : "bing", result.reason instanceof Error ? result.reason.message : "unavailable");
  });
  const unique = new Map<string, FlowEvidence>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      // Search is discovery, not evidence of the article content. Pass only the
      // supplied headline/snippet to the model and retain the original link.
      const headline = `${item.title} ${item.snippet}`;
      const relevant = new RegExp(`(^|[^a-z0-9])${ticker}([^a-z0-9]|$)`, "i").test(headline) ||
        (name.length >= 4 && headline.toLowerCase().includes(name.toLowerCase()));
      if (!relevant) continue;
      const key = item.title.toLowerCase().replace(/\s+-\s+[^-]+$/, "").replace(/[^a-z0-9]/g, "");
      if (!unique.has(key)) unique.set(key, item);
    }
  }
  if (!unique.size && results.some(result => result.status === "fulfilled")) console.warn("agent-flow-source-empty", ticker, results.map(result => result.status === "fulfilled" ? result.value.length : "failed"));
  return [...unique.values()].sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""))
    // Older links can still help a reader understand a quiet ticker. The
    // trading gate independently requires cited coverage from the last 7 days.
    .filter(item => item.publishedAt && Date.now() - Date.parse(item.publishedAt) <= 30 * 86_400_000)
    .slice(0, 12);
}
