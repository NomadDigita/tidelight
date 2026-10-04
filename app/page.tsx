import Link from "next/link";
import ResearchWorkspace from "./ui/research-workspace";
import IssuerLogo from "./ui/issuer-logo";
import { getBitgetMarketUniverse } from "@/lib/bitget-market";
import { createClient } from "@/lib/supabase/server";

const companies = [
  { symbol: "NVDA", name: "NVIDIA", field: "Semiconductors", color: "green" },
  { symbol: "TSLA", name: "Tesla", field: "Mobility", color: "red" },
  { symbol: "MSFT", name: "Microsoft", field: "Cloud & AI", color: "blue" },
  { symbol: "AMZN", name: "Amazon", field: "Commerce", color: "amber" },
];

function price(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 0.01 ? 6 : 2, minimumFractionDigits: 2 }).format(value);
}

export default async function Home() {
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" }).format(new Date());
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const market = await getBitgetMarketUniverse().catch(() => null);
  const { data: savedRuns } = user
    ? await supabase.from("research_runs").select("id, question, status, created_at").order("created_at", { ascending: false }).limit(4)
    : { data: [] };

  return <div className="content-wrap dashboard-page">
    <section className="welcome-row dashboard-welcome">
      <div><div className="eyebrow"><span className="eyebrow-line" /> {today.toUpperCase()} <span className="eyebrow-divider">/</span> YOUR MARKET BRIEF</div><h1>{user ? "Welcome back" : "See what moves"}<span className="mint-dot">.</span></h1><p className="welcome-copy">The bell may be quiet. The market isn’t.</p></div>
      <Link className="date-button" href="/research">Start a research note <span>↗</span></Link>
    </section>

    <ResearchWorkspace qwenAvailable={Boolean(process.env.BITGET_QWEN_API_KEY)} />

    <section className="dashboard-section" aria-labelledby="coverage-title">
      <div className="section-heading"><div><div className="eyebrow small-eyebrow">YOUR RADAR, AT A GLANCE</div><h2 id="coverage-title">Companies in view</h2></div><Link className="text-button" href="/watchlist">Open watchlist <span>↗</span></Link></div>
      <div className="company-grid">{companies.map((company, index) => {
        const asset = market?.assets.find((item) => item.isReality && item.underlyingTicker === company.symbol);
        const logoUrl = asset?.logoUrl ?? `https://www.google.com/s2/favicons?domain=${({ NVDA: "nvidia.com", TSLA: "tesla.com", MSFT: "microsoft.com", AMZN: "amazon.com" } as Record<string, string>)[company.symbol]}&sz=128`;
        return <Link className="company-card" href={asset ? `/markets/${encodeURIComponent(asset.symbol)}` : "/markets"} key={company.symbol}>
          <div className="company-card-top"><IssuerLogo ticker={company.symbol} logoUrl={logoUrl} /><span className="company-symbol">{asset?.symbol ?? company.symbol}</span><span className="company-index">0{index + 1}</span></div>
          <b>{company.name}</b><small>{asset ? `${company.field} · Bitget Reality` : company.field}</small>
          {asset ? <div className="company-card-price"><span>${price(asset.lastPrice)}</span><b className={asset.change24h !== null && asset.change24h < 0 ? "negative" : "positive"}>{asset.change24h === null ? "—" : `${asset.change24h >= 0 ? "+" : ""}${(asset.change24h * 100).toFixed(2)}%`}</b></div> : null}
          <div className="company-card-foot"><span className="pulse-dot" /> {asset ? "Live Bitget rToken" : market ? "Issuer reference" : "Market feed unavailable"} <span>↗</span></div>
        </Link>;
      })}</div>
      <p className="data-disclaimer"><span>i</span> {market ? "Prices and token classification come from Bitget’s public spot feed; issuer names and logos identify the underlying company. Market data is informational, not an investment signal." : "Bitget’s public market feed is temporarily unavailable. No sample prices are shown; open the market map to retry."}</p>
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
