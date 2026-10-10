import "server-only";

const DOCS_ORIGIN = "https://docs.tidelight.app";

function cleanMarkdown(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function queryTidelightDocs(question: string): Promise<string> {
  const ask = question.trim().slice(0, 700);
  if (!ask) return "";
  const url = `${DOCS_ORIGIN}/index.md?ask=${encodeURIComponent(ask)}&goal=${encodeURIComponent("Help the user understand or use Tidelight safely")}`;
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/markdown, text/plain;q=0.9", "User-Agent": "Tidelight Tide/1.0" },
      signal: AbortSignal.timeout(6500),
      next: { revalidate: 3600 },
    });
    if (!response.ok) return "";
    const text = cleanMarkdown(await response.text());
    return text.slice(0, 6500);
  } catch {
    return "";
  }
}

export const TIDELIGHT_DOCS_HOME = DOCS_ORIGIN;
