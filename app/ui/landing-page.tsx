import Link from "next/link";
import Image from "next/image";
import LandingDocsEmbed from "@/app/ui/landing-docs-embed";
import { NavigationTrail } from "@/app/ui/navigation-icon";
import { ThemeQuickSwitch } from "@/app/ui/theme-provider";
import { LanguageToggle } from "@/app/ui/language-provider";

const capabilities = [
  ["Research", "Turn a plain-language question into a source-led market brief."],
  ["Exposure", "Map the story to issuers, sectors, and tokenized instruments."],
  ["Action", "Move from a considered view to paper or live-ready decisions."],
];

export default function LandingPage() {
  return <main className="landing-page">
    <nav className="landing-nav" aria-label="Tidelight landing navigation">
      <Link className="landing-brand" href="/"><Image className="landing-mark" src="/tidelight-mark.svg" alt="" width={30} height={30} priority /><span>tide<span>light</span></span></Link>
      <div className="landing-nav-actions">
        <div className="landing-nav-links"><a href="#method">The method</a><a href="#handbook">Docs <NavigationTrail className="landing-arrow" /></a></div>
        <ThemeQuickSwitch />
        <LanguageToggle className="landing-language-toggle" />
        <Link className="landing-nav-workspace" href="/overview">Open workspace</Link>
      </div>
    </nav>
    <section className="landing-hero">
      <div className="landing-hero-copy"><span className="landing-kicker"><i /> THE INTELLIGENCE LAYER FOR MARKETS THAT NEVER SLEEP</span><h1>The market moves.<br /><em>Tidelight makes sense of it.</em></h1><p>Ask what you actually want to know. Tidelight connects live market context, evidence, exposure, and scenarios into one calm decision surface—for curious beginners and serious operators alike.</p><div className="landing-actions"><Link className="landing-primary" href="/research">Ask Tidelight a question <NavigationTrail className="landing-arrow" /></Link><Link className="landing-secondary" href="/guide">See the ecosystem <NavigationTrail className="landing-arrow" /></Link></div><div className="landing-trust"><span><i /> Live public market context</span><span><i /> Agent-assisted research</span><span><i /> Paper-first controls</span></div></div>
      <div className="landing-hero-stage" aria-label="Tidelight live signal interface">
        <div className="landing-stage-glow" />
        <p className="landing-dyor"><span>THE TIDELIGHT STANDARD</span><strong>DYOR</strong><small>Do your own research.</small></p>
        <span className="landing-pointer" aria-hidden="true"><svg viewBox="0 0 64 80" focusable="false"><path d="M27 8c-4 0-7 3-7 7v30l-4-4a6 6 0 0 0-8.5 8.5l13 14a15 15 0 0 0 11 5h4c10 0 18-8 18-18V27a6 6 0 0 0-12 0v-6a6 6 0 0 0-12 0v-6a6 6 0 0 0-2.5-4.9Z" /></svg></span>
        <span className="landing-product-word" aria-hidden="true">TIDELIGHT</span>
        <div className="landing-orbit"><div className="landing-orbit-ring ring-one" /><div className="landing-orbit-ring ring-two" /><div className="landing-orbit-core"><span>tide</span><b>light</b><small>LIVE SIGNAL</small><i className="landing-core-pulse" /></div><span className="orbit-label orbit-label-one">EVENT / LIVE</span><span className="orbit-label orbit-label-two">EVIDENCE</span><span className="orbit-label orbit-label-three">DECISION</span></div>
        <div className="landing-hand-art">
          <Image className="landing-tide-hand" src="/tide-hand.webp" alt="A hand holding Tide, the Tidelight intelligence companion" width={430} height={645} priority />
          <span className="landing-egg-mark" aria-hidden="true"><svg viewBox="0 0 64 64" focusable="false"><circle className="egg-mark-star" cx="48.5" cy="17.5" r="3.5" /><path className="egg-mark-wave egg-mark-wave-a" d="M11 34.5c7.3 0 7.3-10 14.6-10s7.3 10 14.7 10c7.3 0 7.3-10 14.7-10" /><path className="egg-mark-wave egg-mark-wave-b" d="M11 44.5c7.3 0 7.3-6 14.6-6s7.3 6 14.7 6c7.3 0 7.3-6 14.7-6" /></svg></span>
        </div>
        <div className="landing-stage-readout"><span><i /> SIGNAL DESK</span><b>Following the ripple</b><small>Event → Evidence → Exposure → Scenario</small></div>
      </div>
    </section>
    <section className="landing-proof" id="method"><div className="landing-section-heading"><span className="landing-kicker">ONE CONNECTED ECOSYSTEM</span><h2>Everything you need<br /><em>before you make a move.</em></h2><p className="landing-section-lede">Research, markets, agent flow, paper trading, and decision history—designed as one connected loop instead of five disconnected tools.</p></div><div className="landing-capabilities">{capabilities.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <LandingDocsEmbed />
    <section className="landing-method"><div><span className="landing-kicker">THE TIDELIGHT METHOD</span><h2>One question in.<br /><em>One clearer next step out.</em></h2><p>Tide helps you ask naturally. The research agents gather context. The flow shows their work. The market layer keeps the exposure honest. You stay in control of the decision.</p></div><Link href="/flow">Walk through Agent Flow <NavigationTrail className="landing-arrow" /></Link></section>
    <section className="landing-bottom"><div><span className="landing-kicker">BUILT FOR MARKETS THAT NEVER SLEEP</span><h2>Start with the question<br /><em>you actually have.</em></h2></div><Link className="landing-primary" href="/overview">Enter your workspace <NavigationTrail className="landing-arrow" /></Link></section>
    <footer className="landing-footer"><span>© 2026 Tidelight Research</span><span>Clarity when the bell is quiet.</span><div><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><a href="mailto:thedigitalabiola@gmail.com">Contact</a></div></footer>
  </main>;
}

