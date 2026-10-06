import Link from "next/link";
import ResearchWorkspace from "./ui/research-workspace";
import MarketRadar from "./ui/market-radar";
import { getBitgetMarketUniverse } from "@/lib/bitget-market";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export default async function Home() {
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" }).format(new Date());
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const market = await getBitgetMarketUniverse().catch(() => null);
  const radarTickers = new Set(["NVDA", "TSLA", "MSFT", "AMZN"]);
  const initialRadarAssets = market?.assets.filter((asset) => asset.isReality && radarTickers.has(asset.underlyingTicker ?? "")) ?? [];
  const { data: savedRuns } = user
    ? await supabase.from("research_runs").select("id, question, status, created_at").order("created_at", { ascending: false }).limit(4)
    : { data: [] };

  return <div className="content-wrap dashboard-page">
    <section className="welcome-row dashboard-welcome">
      <div><div className="eyebrow"><span className="eyebrow-line" /> {today.toUpperCase()} <span className="eyebrow-divider">/</span> YOUR MARKET BRIEF</div><h1>{user ? "Welcome back" : "See what moves"}<span className="mint-dot">.</span></h1><p className="welcome-copy">The bell may be quiet. The market isn’t.</p></div>
      <div className="dashboard-welcome-actions"><Link className="date-button" href="/research">Start a research note <span>↗</span></Link><Link className="welcome-guide-link" href="/guide">New here? Follow the quick guide <span>→</span></Link></div>
    </section>

    <ResearchWorkspace qwenAvailable={Boolean(process.env.BITGET_QWEN_API_KEY)} />

    <section className="proof-strip" aria-labelledby="proof-title">
      <div className="proof-heading"><div className="eyebrow small-eyebrow">WHY TIDELIGHT EXISTS</div><h2 id="proof-title">A market moves first.<br /><span>Understanding catches up.</span></h2></div>
      <div className="proof-cards">
        <article><span className="proof-index">01</span><b>See the token behind the ticker</b><p>Reality instruments keep their issuer, session, and source attached to every quote.</p></article>
        <article><span className="proof-index">02</span><b>Ask with the evidence in view</b><p>Turn an event into a sourced brief that can be saved, revisited, and challenged.</p></article>
        <article><span className="proof-index">03</span><b>Practice before you commit</b><p>Test a market idea in the paper lab while the reasoning is still easy to inspect.</p></article>
      </div>
    </section>

    <section className="dashboard-section" aria-labelledby="coverage-title">
      <div className="section-heading"><div><div className="eyebrow small-eyebrow">YOUR RADAR, AT A GLANCE</div><h2 id="coverage-title">Companies in view</h2></div><Link className="text-button" href="/watchlist">Open watchlist <span>↗</span></Link></div>
      <MarketRadar initialAssets={initialRadarAssets} initialGeneratedAt={market?.generatedAt ?? null} initialNow={market?.generatedAt ?? 0} />
      <p className="data-disclaimer"><span>i</span> Prices and token classification come from Bitget’s public spot feed; issuer names and logos identify the underlying company. Quotes refresh while this page is open. Market data is informational, not an investment signal.</p>
    </section>

    <section className="overview-grid">
      <article className="panel stories-panel">
        <div className="panel-heading"><div><div className="eyebrow small-eyebrow">YOUR RESEARCH TRAIL</div><h3>{savedRuns?.length ? "Recently opened" : "Make your first research note"}</h3></div><Link className="text-button" href="/briefs">View saved briefs <span>↗</span></Link></div>
        {savedRuns?.length ? <div className="story-list">{savedRuns.map((run) => <Link className="story-row saved-run" href="/briefs" key={run.id}><span className="story-symbol blue">⌕</span><span className="story-main"><b>{run.question}</b><small>{new Date(run.created_at).toLocaleString()} <i>·</i> Research note</small></span><span className="story-tag tag-context">{run.status.toUpperCase()}</span><span className="row-arrow">↗</span></Link>)}</div> : <div className="empty-inline"><span className="empty-glyph">✳</span><p>Start with a question. Add one source. Keep the important parts together.</p><Link href="/research">Open the research desk <span>↗</span></Link></div>}
      </article>
      <article className="panel afterhours-panel">
        <div className="panel-heading"><div><div className="eyebrow small-eyebrow">THE TIDELIGHT METHOD</div><h3>Read between sessions</h3></div><span className="method-icon">∿</span></div>
        <p>When tokenized equities move beyond the opening bell, context matters as much as the chart.</p>
        <div className="method-steps"><div><span>01</span><b>Ask</b><small>Frame the event you’re watching.</small></div><div><span>02</span><b>Ground</b><small>Add a source we can check.</small></div><div><span>03</span><b>Keep</b><small>Save a brief to revisit later.</small></div></div>
        <Link className="panel-link" href="/markets">Explore the market map <span>↗</span></Link>
      </article>
    </section>
  </div>;
}
