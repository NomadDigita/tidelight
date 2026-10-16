import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ThemeQuickSwitch } from "@/app/ui/theme-provider";
import "./tidelight-developers.css";
import "./platform-polish.css";

export const metadata: Metadata = {
  title: { absolute: "Tidelight Intelligence Cloud — Market intelligence infrastructure" },
  description: "Build with Tidelight's source-aware market and research services through a scoped API, remote MCP, and developer console.",
  alternates: { canonical: "https://tidelight.app/developers" },
};

const routeCards = [
  { number: "01", label: "REST API", host: "api.tidelight.app", path: "/v1", note: "Versioned, scoped requests" },
  { number: "02", label: "REMOTE MCP", host: "mcp.tidelight.app", path: "/mcp", note: "Streamable HTTP · OAuth" },
  { number: "03", label: "DOCUMENTATION", host: "dev.tidelight.app", path: "/", note: "Guides and API reference" },
];

export default function DevelopersPage() {
  return <main className="tic tic-landing tic-premium-landing">
    <nav className="tic-top tic-premium-top" aria-label="Developer navigation">
      <Link href="/developers" className="tic-brand"><Image src="/tidelight-mark.svg" alt="" width={30} height={30} priority /> <span className="tic-brand-name">Tidelight</span><span className="tic-brand-divider" aria-hidden="true"/><span>Intelligence Cloud</span></Link>
      <div><Link href="https://dev.tidelight.app">Docs</Link><Link href="/developers/packages">Packages</Link><ThemeQuickSwitch/><Link href="/developers/console" className="tic-button tic-nav-cta">Open console <span aria-hidden="true">↗</span></Link></div>
    </nav>

    <section className="tic-premium-hero">
      <div className="tic-hero-copy">
        <p className="tic-eyebrow"><span className="tic-status-dot"/> TIDELIGHT DEVELOPER PLATFORM</p>
        <h1>Intelligence,<br/><em>ready to build on.</em></h1>
        <p className="tic-hero-description">Bring Tidelight’s source-aware market and research capabilities into your products, services, and AI workflows.</p>
        <div className="tic-actions"><Link className="tic-button tic-primary" href="/developers/console">Start building <span aria-hidden="true">→</span></Link><Link className="tic-button tic-secondary" href="https://dev.tidelight.app">Explore the docs <span aria-hidden="true">↗</span></Link></div>
        <div className="tic-hero-assurances"><span><i>01</i> Evidence stays attached</span><span><i>02</i> Access stays scoped</span><span><i>03</i> Your account stays in control</span></div>
      </div>
      <figure className="tic-hero-art tic-motion-hero">
        <picture className="tic-motion-picture">
          <source media="(max-width: 520px)" srcSet="/tic-motion-mobile.svg" />
          <Image src="/tic-motion-visual.svg" alt="Conceptual workflow illustration: a research signal gains source context before reaching scoped API and MCP access. This is not a live request." width={1000} height={540} priority sizes="(max-width: 760px) 100vw, 48vw" />
        </picture>
        <figcaption>CONCEPTUAL WORKFLOW · NOT LIVE REQUEST ACTIVITY</figcaption>
      </figure>
    </section>

    <section className="tic-platform-strip" aria-label="Platform services">
      <p>THREE CLEAR ENTRY POINTS</p>
      <div>{routeCards.map(card => <Link href={card.label === "DOCUMENTATION" ? "https://dev.tidelight.app" : card.label === "REMOTE MCP" ? "https://mcp.tidelight.app/mcp" : "https://api.tidelight.app/v1"} key={card.number} className="tic-route-card"><span className="tic-route-number">{card.number}</span><div><strong>{card.label}</strong><code>{card.host}{card.path}</code><small>{card.note}</small></div><span className="tic-route-arrow" aria-hidden="true">↗</span></Link>)}</div>
    </section>

    <section className="tic-premium-showcase">
      <div className="tic-showcase-copy"><p className="tic-eyebrow">A RESPONSE WITH CONTEXT</p><h2>Every instrument has a source. Keep it that way.</h2><p>Tokenized equity spot instruments are clearly distinguished from underlying US stocks and perpetual contracts. Responses carry provider timing and source labels, so downstream systems can preserve what the data represents.</p><Link href="https://dev.tidelight.app#reference">Read the market endpoint reference <span aria-hidden="true">→</span></Link></div>
      <div className="tic-code-window"><div className="tic-window-bar"><div className="tic-window-dots"><i/><i/><i/></div><span>MARKET INSTRUMENTS / RESPONSE SHAPE</span><span>JSON</span></div><pre aria-label="Example response schema"><code><span className="tic-code-fade">{"// Shape of a supported market response"}</span>{"\n"}<span className="tic-code-key">GET</span> <span className="tic-code-value">/v1/market/instruments</span>{"\n"}<span className="tic-code-fade">Authorization: Bearer YOUR_KEY</span>{"\n\n"}{"{"}{"\n"}  <span className="tic-code-key">{"\"data\""}</span>: [ ... ],{"\n"}  <span className="tic-code-key">{"\"next_cursor\""}</span>: <span className="tic-code-fade">{"null | \"…\""}</span>,{"\n"}  <span className="tic-code-key">{"\"generated_at\""}</span>: <span className="tic-code-fade">{"\"ISO timestamp\""}</span>,{"\n"}  <span className="tic-code-key">{"\"request_id\""}</span>: <span className="tic-code-fade">{"\"request identifier\""}</span>{"\n"}{"}"}</code></pre><div className="tic-code-caption"><span className="tic-code-caption-mark">↳</span><span>Actual responses include provider-sourced instrument fields and timing. This illustration shows the contract shape, not live market data.</span></div></div>
    </section>

    <section className="tic-core-render"><div className="tic-core-copy"><p className="tic-eyebrow">ONE SHARED INTELLIGENCE CORE</p><h2>Different interfaces.<br/><em>One source-aware foundation.</em></h2><p>The API and remote MCP server expose supported Tidelight capabilities through the same service boundaries. The developer console keeps keys, activity, and access under your account.</p><div className="tic-core-pills"><span>SHARED SERVICES</span><i/><span>SCOPED ACCESS</span><i/><span>VISIBLE ACTIVITY</span></div></div><Image src="/tic-intelligence-glass.webp" alt="Abstract translucent glass illustration of one central intelligence service connected to three developer interfaces" width={1536} height={1024} sizes="(max-width: 760px) 100vw, 50vw" className="tic-core-image" /></section>

    <section className="tic-capabilities">
      <div className="tic-section-heading"><p className="tic-eyebrow">A CONNECTED WORKFLOW</p><h2>One platform. Clear boundaries.</h2><p>Move from authorized requests to inspectable work, with the same access rules across interfaces.</p></div>
      <div className="tic-capability-grid">
        <article className="tic-capability-card tic-capability-featured"><span className="tic-card-index">01 / ACCESS</span><div className="tic-card-visual tic-access-visual"><i/><i/><i/><span>RESEARCH:READ</span></div><h3>Credentials with intent</h3><p>Project keys are scope-limited, shown once, stored as hashes, and can be rotated or revoked from your console.</p><Link href="/developers/console">Manage credentials <span aria-hidden="true">→</span></Link></article>
        <article className="tic-capability-card"><span className="tic-card-index">02 / RESEARCH</span><div className="tic-card-visual tic-research-visual"><span>REQUEST</span><i/><span>JOB</span><i/><span>SNAPSHOT</span></div><h3>Long work, tracked</h3><p>Company research uses durable jobs with status, bounded retries, and explicit cancellation.</p><Link href="https://dev.tidelight.app#research">See research jobs <span aria-hidden="true">→</span></Link></article>
        <article className="tic-capability-card"><span className="tic-card-index">03 / VISIBILITY</span><div className="tic-card-visual tic-usage-visual" role="img" aria-label="Illustrative chart treatment only; no live account activity is shown"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><h3>Activity you can inspect</h3><p>Review actual authorized requests, timing, response status, credential history, and webhook delivery.</p><Link href="/developers/console">Open developer console <span aria-hidden="true">→</span></Link></article>
      </div>
    </section>

    <section className="tic-cta-band"><div><p className="tic-eyebrow">BUILD WITH TIDELIGHT</p><h2>Start with the service that fits your workflow.</h2><p>Set up a project, grant only what you need, then explore the live API or connect an MCP client.</p></div><div><Link href="/developers/console" className="tic-button tic-primary">Open developer console <span aria-hidden="true">→</span></Link><Link href="https://dev.tidelight.app#quickstart" className="tic-cta-text">Read the quickstart ↗</Link></div></section>
    <footer className="tic-footer tic-premium-footer"><Link href="/developers" className="tic-brand"><Image src="/tidelight-mark.svg" alt="" width={24} height={24}/><span className="tic-brand-name">Tidelight</span><span>Intelligence Cloud</span></Link><span>Source-aware intelligence infrastructure</span><div><Link href="/developers/packages">Packages</Link><Link href="https://dev.tidelight.app">Documentation</Link><Link href="/developers/console">Console</Link><Link href="/">Tidelight home</Link></div></footer>
  </main>;
}
