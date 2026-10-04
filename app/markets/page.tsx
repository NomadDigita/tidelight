import Link from "next/link";

const coverage = [
  { symbol: "NVDA", name: "NVIDIA Corporation", sector: "Semiconductors", note: "Compute, export policy, and capex" },
  { symbol: "TSLA", name: "Tesla, Inc.", sector: "Mobility", note: "Deliveries, margins, and autonomy" },
  { symbol: "MSFT", name: "Microsoft Corporation", sector: "Cloud & AI", note: "Cloud growth and AI investment" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", sector: "Commerce", note: "Retail, cloud, and consumer demand" },
  { symbol: "AAPL", name: "Apple Inc.", sector: "Consumer technology", note: "Devices, services, and supply chain" },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Platforms", note: "Search, cloud, and AI products" },
  { symbol: "META", name: "Meta Platforms, Inc.", sector: "Social & AI", note: "Advertising and AI infrastructure" },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc.", sector: "Semiconductors", note: "Accelerators, CPUs, and data-center demand" },
];

export default function MarketsPage() {
  return <div className="content-wrap inner-page markets-page">
    <section className="markets-hero">
      <div className="markets-hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> THE ALWAYS-ON MARKET MAP</div><h1>Markets move.<br /><span>Context travels.</span></h1><p>Tidelight is built for the information gap between the closing bell and the next open — where tokenized equities keep moving and the story keeps unfolding.</p><div className="markets-hero-actions"><Link className="primary-link" href="/research">Research an event <span>↗</span></Link><Link className="subtle-link" href="/watchlist">Build your company radar</Link></div></div>
      <div className="market-orbit" aria-hidden="true"><div className="market-orbit-ring ring-a" /><div className="market-orbit-ring ring-b" /><div className="market-orbit-center"><span>∿</span><small>24 / 7<br />CONTEXT</small></div><i className="orbit-node node-a" /><i className="orbit-node node-b" /><i className="orbit-node node-c" /><span className="orbit-caption orbit-caption-a">AFTER HOURS</span><span className="orbit-caption orbit-caption-b">EVENT FLOW</span></div>
      <div className="markets-hero-foot"><span><i /> MARKET DATA CONNECTION</span><b>NOT CONNECTED</b><small>We label what we know and what is still missing.</small></div>
    </section>

    <section className="coverage-section"><div className="section-heading"><div><div className="eyebrow small-eyebrow">RESEARCH UNIVERSE</div><h2>Companies worth following</h2></div><span className="coverage-count">08 STARTING NAMES</span></div>
      <div className="coverage-table"><div className="coverage-table-head"><span>COMPANY</span><span>SECTOR</span><span>RESEARCH LENS</span><span>DATA STATUS</span></div>{coverage.map((item, index) => <article id={item.symbol.toLowerCase()} className="coverage-row" key={item.symbol}><span className="coverage-company"><i>{String(index + 1).padStart(2, "0")}</i><b>{item.symbol}</b><small>{item.name}</small></span><span className="coverage-sector">{item.sector}</span><span className="coverage-lens">{item.note}</span><span className="coverage-status"><i /> Connect pending</span></article>)}</div>
      <div className="coverage-note"><span>i</span><p>These are company research lenses, not live market quotes. We have not connected a verified tokenized-equity quote feed, so Tidelight will not display invented prices, charts, or performance.</p></div>
    </section>
    <section className="markets-bottom-grid"><article className="market-note-card"><span className="eyebrow small-eyebrow">WHY THE QUIET HOURS MATTER</span><h2>Price can move.<br /><em>So can the story.</em></h2><p>Policy, earnings, and macro events don’t wait for the opening bell. Tidelight helps you collect the source material and read the signal with care.</p></article><article className="market-data-card"><div className="data-card-mark">⌁</div><span className="eyebrow small-eyebrow">DATA PROMISE</span><h3>No decorative numbers.</h3><p>Market context stays useful only when its origin and freshness are clear. Every future quote will need an identifiable provider and timestamp.</p><Link href="/settings">See connection status <span>↗</span></Link></article></section>
  </div>;
}
