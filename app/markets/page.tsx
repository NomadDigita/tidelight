import Link from "next/link";
import MarketUniverse from "@/app/ui/market-universe";

export default function MarketsPage() {
  return <div className="content-wrap inner-page markets-page">
    <section className="markets-hero">
      <div className="markets-hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> THE ALWAYS-ON MARKET MAP</div><h1>Markets move.<br /><span>Context travels.</span></h1><p>Explore the actual Bitget spot universe, including tokenized US equities. Every quote carries its source, freshness, classification, and stock-session context.</p><div className="markets-hero-actions"><Link className="primary-link" href="/research">Research an event <span>↗</span></Link><Link className="subtle-link" href="/watchlist">Build your company radar</Link></div></div>
      <div className="market-orbit" aria-hidden="true"><div className="market-orbit-ring ring-a" /><div className="market-orbit-ring ring-b" /><div className="market-orbit-center"><span>∿</span><small>24 / 7<br />CONTEXT</small></div><i className="orbit-node node-a" /><i className="orbit-node node-b" /><i className="orbit-node node-c" /><span className="orbit-caption orbit-caption-a">AFTER HOURS</span><span className="orbit-caption orbit-caption-b">EVENT FLOW</span></div>
      <div className="markets-hero-foot"><span><i /> BITGET PUBLIC SPOT API</span><b>READ ONLY</b><small>Live pricing requires no account key.</small></div>
    </section>

    <MarketUniverse />

      <section className="markets-bottom-grid"><article className="market-note-card"><span className="eyebrow small-eyebrow">WHY THE QUIET HOURS MATTER</span><h2>Price can move.<br /><em>So can the story.</em></h2><p>Policy, earnings, and macro events don’t wait for the opening bell. Tidelight combines verified Bitget market context with evidence-led research so traders can inspect the case before making a decision.</p></article><article className="market-data-card"><div className="data-card-mark">⌁</div><span className="eyebrow small-eyebrow">DATA PROMISE</span><h3>Show where every number came from.</h3><p>Quotes and candle history use Bitget public market data. Reality flags, underlying tickers, and trading eligibility use Bitget reference data. Issuer labels and logos are presentation metadata; unsupported logos fall back to an underlying ticker mark. No sample prices are substituted when the feed is unavailable.</p><Link href="/settings">See workspace settings <span>↗</span></Link></article></section>
  </div>;
}
