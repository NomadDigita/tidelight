import Link from "next/link";
import SystemHealth from "@/app/ui/system-health";

export default function SystemsPage() {
  return <div className="content-wrap inner-page systems-page">
    <header className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> TIDELIGHT / RESEARCH SYSTEMS</div><h1>Clarity includes<br/><span>knowing the limits.</span></h1><p>See which public data and research services are configured, what freshness means, and where the decision trail is preserved.</p></div><div className="heading-note"><span className="note-star">∿</span><b>Paper research only.</b><small>No exchange orders are sent by Tidelight.</small></div></header>
    <SystemHealth/>
    <section className="systems-explainer"><article><span className="eyebrow small-eyebrow">DATA FRESHNESS</span><h2>Every feed has a clock.</h2><p>Market snapshots are treated as stale after the provider freshness window. If Bitget is unavailable, market pages show an unavailable state instead of substituting sample prices.</p><Link href="/markets">Open the live market map ↗</Link></article><article><span className="eyebrow small-eyebrow">AUDITABILITY</span><h2>Runs keep their inputs.</h2><p>Research notes retain their evidence and quotes. Strategy runs keep completed candle snapshots, assumptions, and a SHA-256 fingerprint. Nightwatch decisions are recorded to the signed-in account’s private paper ledger.</p><Link href="/briefs">Review saved research ↗</Link></article><article><span className="eyebrow small-eyebrow">RECOVERY & OPERATIONS</span><h2>What is not claimed yet.</h2><p>This view does not certify a database restore, provider SLA, external security audit, or underlying-issuer session alignment. Those require measured operational rehearsals and independent review.</p><Link href="/demo">See the product evidence map ↗</Link></article></section>
  </div>;
}
