import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StrategyLab from "@/app/ui/strategy-lab";

export default async function StrategiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = user
    ? await supabase.from("strategy_backtest_runs").select("id, symbol, interval, strategy_key, parameters, train_metrics, test_metrics, data_start, data_end, candle_count, created_at").order("created_at", { ascending: false }).limit(12)
    : { data: [] };

  return <div className="content-wrap inner-page strategy-page">
    <header className="strategy-hero">
      <div className="strategy-hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> ALPHA FACTORY · RESEARCH SANDBOX</div><h1>Test the idea.<br /><span>Respect the evidence.</span></h1><p>Replay a transparent trend rule against up to 1,000 Bitget spot candles. Every eligible run has at least 60 days of data, 30 days of evaluated training after warm-up, and a final 30-day holdout; inputs, parameters and costs are preserved.</p><div className="strategy-proof"><span><i /> Public Bitget candles</span><span>Deterministic signals</span><span>Private saved runs</span></div></div>
      <div className="strategy-hero-art" aria-hidden="true"><div className="strategy-art-sun"/><div className="strategy-art-wave wave-one"/><div className="strategy-art-wave wave-two"/><div className="strategy-art-grid"/><div className="strategy-art-label">OUT-OF-SAMPLE<br/><b>34%</b></div></div>
    </header>
    <StrategyLab signedIn={Boolean(user)} initialRuns={data ?? []} />
    <section className="strategy-method"><div><span className="eyebrow small-eyebrow">THE RULE · SMA TREND V1</span><h2>One simple rule. Fully inspectable.</h2><p>Go long when the 20 candle simple moving average is above the 50 candle average. Enter on the next candle open; leave on the next open after the trend turns down. Each side assumes 0.10% fee and 0.05% slippage. Runs need at least 60 days overall, 30 evaluated training days after warm-up, and a 30-day untouched holdout.</p></div><div className="strategy-method-facts"><div><b>20 / 50</b><span>Fast and slow SMA</span></div><div><b>66 / 34</b><span>Training and holdout split</span></div><div><b>0.15%</b><span>Assumed cost per side</span></div></div></section>
    <div className="route-footnote"><span>i</span> Historical replay is not a forecast. Results omit dividends, issuer actions, financing and order-book liquidity; tokenized equities may have distinct sessions. No orders are placed.</div>
    {!user ? <div className="sign-in-panel strategy-signin"><div className="empty-glyph">⌁</div><div><span className="eyebrow small-eyebrow">SAVE YOUR RESEARCH</span><h2>Sign in to keep a private run history.</h2><p>You can inspect the method without signing in; saving results is account scoped.</p><Link className="primary-link" href="/login">Sign in <span>↗</span></Link></div></div> : null}
  </div>;
}
