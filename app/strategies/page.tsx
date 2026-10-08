import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StrategyLab from "@/app/ui/strategy-lab";

export default async function StrategiesPage({ searchParams }: { searchParams: Promise<{ symbol?: string; researchRunId?: string }> }) {
  const { symbol: requestedSymbol, researchRunId: requestedResearchRunId } = await searchParams;
  const initialSymbol = requestedSymbol?.toUpperCase().match(/^[A-Z0-9]{2,32}$/)?.[0] ?? "RAAPLUSDT";
  const initialResearchRunId = requestedResearchRunId?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)?.[0] ?? null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = user
    ? await supabase.from("strategy_backtest_runs").select("id, symbol, interval, strategy_key, parameters, train_metrics, test_metrics, data_start, data_end, candle_count, created_at").order("created_at", { ascending: false }).limit(12)
    : { data: [] };

  return <div className="content-wrap inner-page strategy-page">
    <header className="strategy-hero">
      <div className="strategy-hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> ALPHA FACTORY · RESEARCH SANDBOX</div><h1>Test the idea.<br /><span>Respect the evidence.</span></h1><p>Test inspectable rules across Bitget Reality stock tokens and US stock perpetual markets. Compare trend, mean reversion, breakout, and after-hours ideas against completed candles with costs, rolling checks, and a chronological holdout. Eligible runs require at least 60 days of history and 30 days out of sample.</p><div className="strategy-proof"><span><i /> Public Bitget candles</span><span>Deterministic signals</span><span>Private saved runs</span></div></div>
      <div className="strategy-hero-art" aria-hidden="true"><div className="strategy-art-sun"/><div className="strategy-art-wave wave-one"/><div className="strategy-art-wave wave-two"/><div className="strategy-art-grid"/><div className="strategy-art-label">MINIMUM HOLDOUT<br/><b>30+ days</b></div></div>
    </header>
    <StrategyLab signedIn={Boolean(user)} initialRuns={data ?? []} initialSymbol={initialSymbol} initialResearchRunId={initialResearchRunId} />
    <section className="strategy-method"><div><span className="eyebrow small-eyebrow">METHOD · TRANSPARENT MARKET RULES</span><h2>Rules you can inspect and replay.</h2><p>Choose among six fixed rule families: trend, mean reversion, price channel, after-hours drift, trend pullback, and a volume-confirmed semiconductor breakout. Each replays one verified Bitget market at a time; the basket comparison selects a training leader but does not model continuous rotation. Signals use completed candles, simulate at the next eligible open, and include estimated fees and slippage. Generated hypotheses select only implemented rules.</p></div><div className="strategy-method-facts"><div><b>20 / 50</b><span>Trend reference</span></div><div><b>66 / 34</b><span>Training and holdout split</span></div><div><b>0.15%</b><span>Assumed cost per side</span></div></div></section>
    <div className="route-footnote"><span>i</span> Historical replay is not a forecast. Results omit dividends, issuer actions and order-book liquidity; stock perpetual results also omit funding, margin and liquidation. No orders are placed.</div>
    {!user ? <div className="sign-in-panel strategy-signin"><div className="empty-glyph">⌁</div><div><span className="eyebrow small-eyebrow">SAVE YOUR RESEARCH</span><h2>Sign in to keep a private run history.</h2><p>You can inspect the method without signing in; saving results is account scoped.</p><Link className="primary-link" href="/login">Sign in <span>↗</span></Link></div></div> : null}
  </div>;
}
