export type RetrievedPublicSource = {
  title: string;
  url: string;
  excerpt: string;
  publisher: string;
  publicationDate: string | null;
  sourceQuality: string;
  sourceType: "web" | "filing";
};

const issuerDomains: Record<string, string> = {
  AAPL: "apple.com",
  AMZN: "aboutamazon.com",
  MSFT: "microsoft.com",
  NVDA: "nvidia.com",
  TSLA: "tesla.com",
};

const publisherHosts = new Set([
  "apnews.com", "www.apnews.com",
  "bbc.com", "www.bbc.com",
  "bloomberg.com", "www.bloomberg.com",
  "cnbc.com", "www.cnbc.com",
  "finance.yahoo.com",
  "nytimes.com", "www.nytimes.com",
  "reuters.com", "www.reuters.com",
  "wsj.com", "www.wsj.com",
]);
const secHosts = new Set(["sec.gov", "www.sec.gov"]);
const maxPageBytes = 2 * 1024 * 1024;
const maxExcerptLength = 6_000;

function hostIsWithin(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

export function validatePublicSourceUrl(value: string, company: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const ticker = company.toUpperCase();
  const issuerDomain = issuerDomains[ticker];
  const allowed = publisherHosts.has(hostname) || secHosts.has(hostname) || Boolean(issuerDomain && hostIsWithin(hostname, issuerDomain));
  if (!allowed) return null;
  url.hostname = hostname;
  url.hash = "";
  return url;
}

function decodeEntities(value: string) {
  const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"', ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
    if (key[0] === "#") {
      const codePoint = key[1]?.toLowerCase() === "x" ? Number.parseInt(key.slice(2), 16) : Number.parseInt(key.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    }
    return named[key.toLowerCase()] ?? entity;
  });
}

function cleanText(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function metaValue(html: string, key: string) {
  const tag = html.match(/<meta\b[^>]*>/gi)?.find((item) => {
    const identifier = item.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
    return identifier?.toLowerCase() === key.toLowerCase();
  });
  const content = tag?.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
  return content ? cleanText(content) : "";
}

export function extractPublicPage(html: string) {
  const title = metaValue(html, "og:title") || metaValue(html, "twitter:title") || cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const publicationDate = metaValue(html, "article:published_time") || metaValue(html, "datePublished") || metaValue(html, "publication_date") || null;
  const main = html.match(/<(article|main)\b[^>]*>[\s\S]*?<\/\1>/i)?.[0] ?? html;
  const visible = main
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|nav|footer|header|aside|form|noscript|svg|iframe|button)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(?:br|\/p|\/h[1-6]|\/li|\/div|\/section|\/article)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const excerpt = decodeEntities(visible).replace(/[\t\f\v ]+/g, " ").replace(/ *\n+ */g, "\n").trim().slice(0, maxExcerptLength);
  return { title: title.slice(0, 200), publicationDate, excerpt };
}

async function readLimited(response: Response) {
  const sizeHeader = Number(response.headers.get("content-length"));
  if (Number.isFinite(sizeHeader) && sizeHeader > maxPageBytes) throw new Error("source-too-large");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxPageBytes) {
      await reader.cancel();
      throw new Error("source-too-large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function fetchPublicResearchSource(value: string, company: string, fetcher: typeof fetch = fetch): Promise<RetrievedPublicSource> {
  const validatedUrl = validatePublicSourceUrl(value, company);
  if (!validatedUrl) throw new Error("source-domain-not-allowed");
  let currentUrl: URL = validatedUrl;

  let response: Response | undefined;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    response = await fetcher(currentUrl, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "text/html, text/plain;q=0.9", "User-Agent": "Tidelight public-source reader" },
    });
    if (response.status < 300 || response.status >= 400) break;
    const redirectLocation: string | null = response.headers.get("location");
    const nextUrl: URL | null = redirectLocation ? validatePublicSourceUrl(new URL(redirectLocation, currentUrl).toString(), company) : null;
    if (!nextUrl || redirectCount === 3) throw new Error("source-redirect-not-allowed");
    currentUrl = nextUrl;
  }
  if (!response?.ok) throw new Error("source-fetch-failed");
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("text/html") && !contentType.startsWith("text/plain")) throw new Error("source-content-type-not-supported");
  const html = await readLimited(response);
  const parsed = contentType.startsWith("text/html") ? extractPublicPage(html) : { title: "", publicationDate: null, excerpt: cleanText(html) };
  if (parsed.excerpt.length < 80) throw new Error("source-text-too-short");

  const publisher = currentUrl.hostname;
  const isSec = secHosts.has(publisher);
  const isIssuer = Boolean(issuerDomains[company.toUpperCase()] && hostIsWithin(publisher, issuerDomains[company.toUpperCase()]));
  return {
    title: parsed.title || `${publisher} public source`,
    url: currentUrl.toString(),
    excerpt: parsed.excerpt,
    publisher,
    publicationDate: parsed.publicationDate,
    sourceQuality: isSec ? "SEC public source; captured page text was matched against every displayed quote." : isIssuer ? "Issuer-hosted source; captured page text was matched against every displayed quote." : "Public publisher page; author and publisher identity were not independently verified.",
    sourceType: isSec ? "filing" : "web",
  };
}
