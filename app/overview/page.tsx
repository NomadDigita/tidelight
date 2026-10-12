import OverviewIntelligence from "@/app/ui/overview-intelligence";
import MarketRadar from "@/app/ui/market-radar";
import { getBitgetMarketUniverse } from "@/lib/bitget-market";
import { createClient } from "@/lib/supabase/server";
import MarketSessionIndicator from "@/app/ui/market-session-indicator";

export const maxDuration = 60;

export default async function Overview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [market, watchlistResponse, savedResponse] = await Promise.all([
    getBitgetMarketUniverse().catch(() => null),
    user ? supabase.from("watchlist_items").select("symbol, company_name").order("created_at", { ascending: true }).limit(12) : Promise.resolve({ data: [] }),
    user ? supabase.from("research_runs").select("id, question, status, created_at, summary").eq("event_type", "agent_flow").eq("status", "complete").order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
  ]);
  const radarTickers = new Set(["NVDA", "TSLA", "MSFT", "AMZN"]);
  const initialRadarAssets = market?.assets.filter((asset) => asset.isReality && radarTickers.has(asset.underlyingTicker ?? "")) ?? [];
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" }).format(new Date());

  return <>
    <OverviewIntelligence signedIn={Boolean(user)} watchlist={watchlistResponse.data ?? []} savedRuns={savedResponse.data ?? []} marketGeneratedAt={market?.generatedAt ?? null} marketStatus={market ? "available" : "unavailable"} />
    <section className="content-wrap iu-market-section" aria-labelledby="iu-market-title"><div className="iu-market-heading"><div><span className="iu-eyebrow"><i/> {today.toUpperCase()} / PUBLIC MARKET SNAPSHOT</span><h2 id="iu-market-title">Companies in view</h2><p>Source: Bitget public spot feed · Informational context, not a signal.</p></div><MarketSessionIndicator session={market?.session ?? null} status={market?.marketSessionStatus ?? "unavailable"}/></div><MarketRadar initialAssets={initialRadarAssets} initialGeneratedAt={market?.generatedAt ?? null} initialNow={market?.generatedAt ?? 0}/><p className="data-disclaimer"><span>i</span> Prices and token classification come from Bitget’s public spot feed; issuer names and logos identify the underlying company. Quotes refresh while this page is open. Market data is informational, not an investment signal.</p></section>
  </>;
}
