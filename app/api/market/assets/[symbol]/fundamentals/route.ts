import { getIssuerWebsite, getBitgetAsset } from "@/lib/bitget-market";
import { getSecCompanyResearch, type CompanyResearch } from "@/lib/sec-fundamentals";
import { createAdminClient } from "@/lib/supabase/admin";

const tickerPattern = /^[A-Z][A-Z0-9.]{0,9}$/;
type CacheRow = { cik: string; payload: CompanyResearch; fetched_at: string; expires_at: string };

async function readCached(ticker: string): Promise<CacheRow | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("sec_company_facts_cache").select("cik,payload,fetched_at,expires_at").eq("ticker", ticker).maybeSingle();
    return data as CacheRow | null;
  } catch { return null; }
}

async function writeCached(ticker: string, research: CompanyResearch) {
  try {
    const admin = createAdminClient();
    const now = new Date();
    await admin.from("sec_company_facts_cache").upsert({ ticker, cik: research.cik, payload: research, source_url: research.sourceUrl, fetched_at: now.toISOString(), expires_at: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString() });
  } catch (error) { console.warn("sec-company-cache-write-failed", error instanceof Error ? error.message : "unknown"); }
}

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!/^[A-Z0-9]{2,32}$/.test(symbol)) return Response.json({ error: "Invalid market symbol." }, { status: 400 });
  try {
    const asset = await getBitgetAsset(symbol);
    if (!asset) return Response.json({ error: "This Bitget market pair is not available." }, { status: 404 });
    const ticker = asset.kind === "rtoken" ? asset.underlyingTicker : null;
    if (!ticker || !tickerPattern.test(ticker)) return Response.json({ status: "unsupported", reason: "SEC fundamentals are available only for verified US equity underlyings." }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
    const cached = await readCached(ticker);
    if (cached && Date.parse(cached.expires_at) > Date.now()) return Response.json({ status: "available", research: cached.payload, freshness: "cached", cachedAt: cached.fetched_at }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
    try {
      const research = await getSecCompanyResearch(ticker, getIssuerWebsite(ticker));
      await writeCached(ticker, research);
      return Response.json({ status: "available", research, freshness: "current" }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
    } catch (error) {
      if (cached) return Response.json({ status: "available", research: cached.payload, freshness: "stale", cachedAt: cached.fetched_at, warning: "SEC filing data could not be refreshed." }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
      console.warn("sec-company-research-fetch-failed", error instanceof Error ? error.message : "unknown");
      return Response.json({ status: "unavailable", error: "SEC filing data is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    return Response.json({ error: "Bitget asset details are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
