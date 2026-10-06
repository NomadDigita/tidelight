import type { Metadata } from "next";
import Link from "next/link";
import styles from "./guide.module.css";

export const metadata: Metadata = {
  title: "Start here | Tidelight",
  description: "A plain-language guide to researching tokenized US equities, testing strategies, and observing paper decisions with Tidelight.",
};

const quickSteps = [
  { number: "01", title: "Choose an event", body: "Start with a company, a new announcement, or a question about what changed while US markets were closed." },
  { number: "02", title: "Bring the evidence", body: "Add a source such as an issuer release or filing. Tidelight works from the material it captures; it does not prove that a publisher is trustworthy." },
  { number: "03", title: "Check the claims", body: "Open the supporting passage, compare sources, and separate what the source says from what the analysis infers." },
  { number: "04", title: "Decide what to inspect next", body: "Follow a supported company exposure into market context or a strategy replay. Each handoff is optional and user-triggered." },
];

const useCases = [
  {
    number: "01",
    label: "RESEARCH DESK",
    title: "An announcement lands after the closing bell",
    description: "You hold or follow a tokenized stock and want to understand an earnings update, company release, or policy change before deciding whether it matters.",
    steps: ["Ask one focused question about the event.", "Add the company release or filing and another useful source.", "Review cited passages, uncertainty, counterpoints, and what could change the view."],
    href: "/research",
    action: "Start a research note",
    tone: "mint",
  },
  {
    number: "02",
    label: "STRATEGY LAB",
    title: "You want to challenge a simple market rule",
    description: "Replay the fixed SMA baseline on completed Bitget candles, then compare the holdout against buy-and-hold and higher assumed costs.",
    steps: ["Choose a supported market and candle interval.", "Inspect the training and holdout periods, trades, and rolling windows when available.", "Export the exact candle snapshot, assumptions, and results for review."],
    href: "/strategies",
    action: "Explore strategy testing",
    tone: "blue",
  },
  {
    number: "03",
    label: "NIGHTWATCH · PAPER ONLY",
    title: "You want to observe a guarded paper decision",
    description: "Use Nightwatch to review a completed-candle check with deterministic limits. Scheduled checks are opt-in, and simulated fills are not real orders.",
    steps: ["Choose a supported Reality market and review its feed freshness.", "Set conservative paper limits and leave the monitor paused until you are ready.", "Inspect each recorded decision and pause the monitor whenever needed."],
    href: "/nightwatch",
    action: "See Nightwatch controls",
    tone: "amber",
  },
];

const glossary = [
  { term: "Reality instrument", meaning: "A tokenized market instrument associated with an underlying company. Its price and trading conditions can differ from the underlying share." },
  { term: "Source-backed claim", meaning: "A statement in a research note paired with a passage captured from a source. A matched quote does not certify the publisher." },
  { term: "Inference", meaning: "An interpretation drawn from evidence. It should be reviewed as analysis, not treated as a fact or instruction." },
  { term: "Holdout", meaning: "The later portion of historical data used to evaluate a rule after its earlier training period." },
  { term: "Paper decision", meaning: "A simulated decision recorded for review. Tidelight does not send live orders." },
];

export default function GuidePage() {
  return <div className={`content-wrap inner-page ${styles.page}`}>
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <div className="eyebrow"><span className="eyebrow-line"/> TIDELIGHT / START HERE</div>
        <h1>Follow the evidence.<br/><span>Keep the decision yours.</span></h1>
        <p>Use Tidelight to understand an event affecting a tokenized US equity, inspect the sources, then choose whether to explore market or paper-trading context.</p>
        <div className={styles.heroActions}><Link className="primary-link" href="/research">Start with an event <span>↗</span></Link><Link className={styles.quietLink} href="/demo">See the product walkthrough <span>→</span></Link></div>
      </div>
      <aside className={styles.promise} aria-label="Tidelight product boundaries">
        <span className={styles.promiseIcon}>◌</span>
        <span className="eyebrow small-eyebrow">A QUICK ORIENTATION</span>
        <b>Research first.<br/>Optional tools next.</b>
        <p>Tidelight gives you material to inspect. You choose what to believe and what to do.</p>
        <span className={styles.promiseTag}>NO LIVE ORDERS</span>
      </aside>
    </header>

    <section className={styles.quickstart} aria-labelledby="quickstart-title">
      <div className={styles.sectionHead}><div><span className="eyebrow small-eyebrow">YOUR FIRST RESEARCH NOTE</span><h2 id="quickstart-title">Four steps, then decide.</h2></div><p>Keep the question narrow. One well-sourced event is more useful than a broad market prompt.</p></div>
      <ol className={styles.steps}>{quickSteps.map((step) => <li key={step.number}><span className={styles.stepNumber}>{step.number}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol>
    </section>

    <section className={styles.useCases} aria-labelledby="usecases-title">
      <div className={styles.sectionHead}><div><span className="eyebrow small-eyebrow">PICK THE JOB YOU HAVE</span><h2 id="usecases-title">Three ways to use Tidelight.</h2></div><p>Start with research. Strategy testing and Nightwatch are optional paths for users who need them.</p></div>
      <div className={styles.caseGrid}>{useCases.map((item) => <article className={`${styles.caseCard} ${styles[item.tone]}`} key={item.number}>
        <div className={styles.caseTop}><span>{item.number}</span><small>{item.label}</small></div>
        <h3>{item.title}</h3><p className={styles.caseDescription}>{item.description}</p>
        <ul>{item.steps.map((step) => <li key={step}>{step}</li>)}</ul>
        <Link href={item.href}>{item.action} <span>↗</span></Link>
      </article>)}</div>
    </section>

    <section className={styles.truth} aria-labelledby="truth-title">
      <div><span className="eyebrow small-eyebrow">WHAT TIDELIGHT CAN AND CANNOT TELL YOU</span><h2 id="truth-title">Useful context.<br/><span>No false certainty.</span></h2></div>
      <div className={styles.truthList}>
        <p><b>Sources:</b> Tidelight checks captured passages against displayed claims; it does not independently certify publisher identity or completeness.</p>
        <p><b>Market data:</b> Quotes can be delayed or unavailable. Check each provider timestamp and freshness label before using it.</p>
        <p><b>Strategy results:</b> Historical simulations depend on data and assumptions. They do not establish future performance; token-specific sessions and execution may differ.</p>
        <p><b>Nightwatch:</b> It records paper decisions and simulated fills. It never sends live exchange orders.</p>
      </div>
    </section>

    <details className={styles.glossary}>
      <summary><span><span className="eyebrow small-eyebrow">PLAIN-LANGUAGE GLOSSARY</span><b>Five terms you may see</b></span><span className={styles.expand}>＋</span></summary>
      <dl>{glossary.map((item) => <div key={item.term}><dt>{item.term}</dt><dd>{item.meaning}</dd></div>)}</dl>
    </details>

    <footer className={styles.footerCta}><div><span className="eyebrow small-eyebrow">READY WHEN YOU ARE</span><h2>Bring one question. We’ll keep the sources close.</h2></div><Link className="primary-link" href="/research">Open Research Desk <span>↗</span></Link></footer>
  </div>;
}
