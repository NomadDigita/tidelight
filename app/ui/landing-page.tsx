import Link from "next/link";

const capabilities = [
  ["Evidence", "Keep the original source beside the claim, date, and uncertainty."],
  ["Exposure", "Map a company story to issuers, sectors, and tokenized markets."],
  ["Scenarios", "Compare what supports the view with what could change it."],
];

export default function LandingPage() {
  return <main className="landing-page">
    <nav className="landing-nav" aria-label="Tidelight landing navigation">
      <Link className="landing-brand" href="/"><span className="landing-mark">∿</span><span>tide<span>light</span></span></Link>
      <div className="landing-nav-links"><a href="#method">The method</a><a href="https://docs.tidelight.app" target="_blank" rel="noopener noreferrer">Docs ↗</a><Link href="/login">Sign in</Link></div>
    </nav>
    <section className="landing-hero">
      <div className="landing-hero-copy"><span className="landing-kicker"><i /> AFTER-HOURS MARKET RESEARCH</span><h1>See the signal<br /><em>between sessions.</em></h1><p>Evidence-first research for tokenized markets. Ask a question in plain language, follow the story into the assets it touches, and keep your decision grounded in what can be checked.</p><div className="landing-actions"><Link className="landing-primary" href="/research">Open the research desk <span>↗</span></Link><Link className="landing-secondary" href="/guide">See how Tidelight works <span>→</span></Link></div><div className="landing-trust"><span><i /> Live public market data</span><span><i /> Source-led briefs</span><span><i /> Paper-first controls</span></div></div>
      <div className="landing-orbit" aria-label="Tidelight research loop"><div className="landing-orbit-ring ring-one" /><div className="landing-orbit-ring ring-two" /><div className="landing-orbit-core"><span>tide</span><b>light</b><small>READ THE RIPPLE</small></div><span className="orbit-label orbit-label-one">EVENT</span><span className="orbit-label orbit-label-two">EVIDENCE</span><span className="orbit-label orbit-label-three">DECISION</span></div>
    </section>
    <section className="landing-proof" id="method"><div className="landing-section-heading"><span className="landing-kicker">ONE CLEAR PATH</span><h2>From a market story<br /><em>to a considered view.</em></h2></div><div className="landing-capabilities">{capabilities.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="landing-method"><div><span className="landing-kicker">THE TIDELIGHT METHOD</span><h2>Event → Evidence → Exposure → Scenario → Decision.</h2><p>A calmer research desk for the hours when the usual headlines go quiet. Mini keeps the answer simple. Pro keeps every receipt in view.</p></div><Link href="/flow">Walk through Agent Flow <span>↗</span></Link></section>
    <section className="landing-bottom"><div><span className="landing-kicker">BUILT FOR MARKETS THAT NEVER SLEEP</span><h2>Start with the question<br /><em>you actually have.</em></h2></div><Link className="landing-primary" href="/login">Enter Tidelight <span>↗</span></Link></section>
    <footer className="landing-footer"><span>© 2026 Tidelight Research</span><span>Clarity when the bell is quiet.</span><div><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><a href="mailto:thedigitalabiola@gmail.com">Contact</a></div></footer>
  </main>;
}
