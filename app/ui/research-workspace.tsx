"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEvidenceBrief } from "@/app/actions";
import { useExperience } from "@/app/ui/theme-provider";

type ResearchBrief = {
  summary: string;
  upside: string;
  downside: string;
  catalysts: string[];
  claims: { claim: string; quote: string; stance: string; confidence: number; sourceUrl?: string }[];
  sources: { title: string; url: string; publisher?: string; retrieved_at?: string; publication_date?: string | null; source_quality?: string }[];
  exposure?: { ticker: string; issuer: string; sector: string; realityPair: string; scenarios: { upside: string; downside: string; invalidation: string } }[];
  citation_coverage?: number;
  counterpoint_count?: number;
  evidence_basis: string;
};

const suggestions = [
  "How could a surprise rate cut affect tokenized tech stocks?",
  "What changed for NVDA after the latest export-control announcement?",
  "Compare Tesla and Nvidia exposure to this week’s macro events.",
];

export default function ResearchWorkspace({ qwenAvailable, initialQuestion = "" }: { qwenAvailable: boolean; initialQuestion?: string }) {
  const { mode } = useExperience();
  const [question, setQuestion] = useState(initialQuestion);
  const [company, setCompany] = useState(() => initialQuestion.match(/\b(NVDA|TSLA|MSFT|AMZN|AAPL)\b/)?.[1] ?? "NVDA");
  const [briefQuestion, setBriefQuestion] = useState("");
  const [error, setError] = useState("");
  const [sources, setSources] = useState([{ title: "", url: "", excerpt: "" }]);
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!briefQuestion) return;
    closeButtonRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setBriefQuestion("");
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [briefQuestion]);

  function openBrief(nextQuestion = question) {
    const cleaned = nextQuestion.trim();
    if (!cleaned) {
      setError("Add a question or choose a research prompt to begin.");
      return;
    }
    const scopedQuestion = mode === "mini" ? `${cleaned} for ${company} (${company === "NVDA" ? "NVIDIA" : company === "TSLA" ? "Tesla" : company === "MSFT" ? "Microsoft" : company === "AMZN" ? "Amazon" : "Apple"})` : cleaned;
    setError("");
    setBrief(null);
    setSources([{ title: "", url: "", excerpt: "" }]);
    startTransition(() => setBriefQuestion(scopedQuestion));
  }

  async function analyzeSource() {
    if (!briefQuestion) return;
    setIsAnalyzing(true);
    setError("");
    const result = await createEvidenceBrief({ question: briefQuestion, sources, fetchSource: mode === "mini", company });
    setIsAnalyzing(false);
    if (result.error) {
      if (result.error.includes("Sign in")) router.push("/login");
      else setError(result.error);
    } else if (result.brief) {
      setBrief(result.brief);
    } else setError("Could not create this research brief. Please try again.");
  }

  return (
    <>
      <section className={`hero-card${mode === "mini" ? " mini-research-hero" : ""}`} id="research" aria-labelledby="research-title">
        <div className="hero-glow" /><div className="hero-grid" />
        <div className="hero-content">
          <div className="hero-kicker"><span className="sparkle">✳</span> {mode === "mini" ? "A SIMPLE, SOURCE-BASED ANSWER" : "YOUR AFTER-HOURS RESEARCH DESK"} <span className="demo-pill">{mode === "mini" ? "MINI" : "CONCEPT DEMO"}</span></div>
          <h2 id="research-title">{mode === "mini" ? <>Understand the story<br /><em>around one company.</em></> : <>Follow the story<br /><em>before the bell.</em></>}</h2>
          <p className="hero-description">{mode === "mini" ? "Choose a company, ask a question, and add a public source link. We’ll read it and show what supports the answer." : "Ask about an event, a company, or a shift in the market. Get a clear read with sources, scenarios, and what to watch next."}</p>
          {mode === "mini" ? <label className="mini-company-select">COMPANY<select aria-label="Choose a company" value={company} onChange={(event) => setCompany(event.target.value)}><option value="NVDA">NVIDIA · NVDA</option><option value="TSLA">Tesla · TSLA</option><option value="MSFT">Microsoft · MSFT</option><option value="AMZN">Amazon · AMZN</option><option value="AAPL">Apple · AAPL</option></select></label> : null}
          <form className="research-form" onSubmit={(event) => { event.preventDefault(); openBrief(); }}>
            <label className="sr-only" htmlFor="research-question">Ask a research question</label>
            <span className="prompt-mark">↳</span><input id="research-question" type="text" maxLength={500} value={question} onChange={(event) => { setQuestion(event.target.value); setError(""); }} placeholder={mode === "mini" ? "What does this news mean for the company?" : "What could this weekend’s chip restrictions mean for NVDA?"} autoComplete="off" />
            <button type="submit" id="analyze-button" disabled={isPending}><span>{isPending ? "Preparing" : "Analyze"}</span><b>↗</b></button>
          </form>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="prompt-examples"><span>{mode === "mini" ? "EXAMPLE:" : "TRY:"}</span>{(mode === "mini" ? ["How could this announcement affect the company?"] : suggestions).map((suggestion, index) => <span className="suggestion-wrap" key={suggestion}><button type="button" onClick={() => { setQuestion(suggestion); openBrief(suggestion); }}>{mode === "mini" ? "Explain a company announcement" : ["Rate cut impact", "NVDA export rules", "Compare event exposure"][index]}</button>{mode !== "mini" && index < suggestions.length - 1 ? <i /> : null}</span>)}</div>
        </div>
        <div className="hero-ornament" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><span className="orbit-mark">∿</span></div><span className="orbit-label label-one">EVENT FLOW</span><span className="orbit-label label-two">AFTER HOURS</span><span className="orbit-label label-three">RISK CONTEXT</span></div>
        <div className="hero-foot"><span><span className="pulse-dot" /> DESIGNED FOR 24/7 TOKENIZED MARKETS</span><span>RESEARCH WITH CONTEXT <b>↗</b></span></div>
      </section>

      {briefQuestion ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBriefQuestion(""); }}>
        <section className={`brief-dialog${mode === "mini" ? " mini-research-dialog" : ""}`} role="dialog" aria-modal="true" aria-labelledby="brief-title">
          <button ref={closeButtonRef} className="dialog-close" aria-label="Close research brief" onClick={() => setBriefQuestion("")}>×</button>
          <div className="dialog-kicker"><span className="pulse-dot" /> TIDELIGHT RESEARCH NOTE <span className="demo-pill">SOURCE-BOUNDED</span></div>
          <h2 id="brief-title">{briefQuestion}</h2>
          <div className="brief-meta"><span>AFTER-HOURS EVENT RESEARCH</span><span>·</span><span>{brief ? "QWEN SYNTHESIS" : mode === "mini" ? "PUBLIC SOURCE LINK" : "USER-PROVIDED SOURCE"}</span></div>
          <div className="brief-rule" />
          <p className="brief-intro">{mode === "mini" ? "Add a link to a public company release, SEC filing, or supported publisher. We’ll read the page and check every displayed quote against its text." : "Add source passages to ground the analysis. Tidelight stores them, checks each displayed claim against a matching quote, and links back to the originals. Market prices are shown separately from this source-only brief."}</p>
          <div className="source-fields">{sources.map((source, index) => <div className="source-entry" key={index}><div className="source-entry-head"><b>{mode === "mini" ? "Your public source" : `Source ${String(index + 1).padStart(2, "0")}`}</b>{mode !== "mini" && sources.length > 1 ? <button type="button" onClick={() => setSources((current) => current.filter((_, item) => item !== index))}>Remove</button> : null}</div>{mode === "mini" ? <><label>Link to the original<input value={source.url} onChange={(event) => setSources([{ ...source, url: event.target.value }])} placeholder="https://…" type="url" inputMode="url" required /></label><small className="source-helper">Supported: the selected company’s website, SEC.gov, and selected public publishers. We don’t follow links to other sites.</small></> : <><label>Source title<input value={source.title} maxLength={200} onChange={(event) => setSources((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} placeholder="Official filing, release, or article title" /></label><label>Source link<input value={source.url} onChange={(event) => setSources((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} placeholder="https://…" type="url" inputMode="url" /></label><label>Passage to analyze<textarea value={source.excerpt} maxLength={6000} onChange={(event) => setSources((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, excerpt: event.target.value } : item))} placeholder="Paste an excerpt from the source (80–6,000 characters)." rows={5} /><span className="source-count">{source.excerpt.length.toLocaleString()} / 6,000</span></label></>}</div>)}{mode !== "mini" ? <button type="button" className="add-source-button" onClick={() => setSources((current) => current.length < 5 ? [...current, { title: "", url: "", excerpt: "" }] : current)} disabled={sources.length >= 5}>＋ Add another source <span>{sources.length} / 5</span></button> : null}</div>
          {brief ? <div className="generated-brief">
            {mode !== "mini" ? <div className="decision-spine" aria-label="Tidelight decision workflow"><span>EVENT</span><i>→</i><span>EVIDENCE</span><i>→</i><span>EXPOSURE</span><i>→</i><span>SCENARIO</span><i>→</i><span>DECISION</span></div> : null}
            <div className="brief-section"><div className="brief-section-title"><span>01</span> {mode === "mini" ? "THE SIMPLE ANSWER" : "WHAT THE SOURCE SAYS"}</div><p>{brief.summary}</p></div>
            <div className="scenario-grid"><div><small>{mode === "mini" ? "WHAT COULD GO WELL" : "UPSIDE CASE"}</small><b>{brief.upside}</b></div><div><small>{mode === "mini" ? "WHAT COULD CHANGE THIS ANSWER" : "WHAT COULD BREAK THE THESIS"}</small><b>{brief.downside}</b></div></div>
            {mode !== "mini" && brief.catalysts.length ? <div className="brief-section"><div className="brief-section-title"><span>02</span> WHAT TO WATCH NEXT</div><ul>{brief.catalysts.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}
            {mode !== "mini" && brief.exposure?.length ? <div className="brief-section"><div className="brief-section-title"><span>03</span> MARKET EXPOSURE</div><div className="exposure-grid">{brief.exposure.map((item) => <div className="exposure-chip" key={item.ticker}><b>{item.ticker}</b><span>{item.issuer}</span><small>{item.sector} · {item.realityPair}</small><p><strong>Upside:</strong> {item.scenarios.upside}</p><p><strong>Downside:</strong> {item.scenarios.downside}</p><p><strong>Invalidation:</strong> {item.scenarios.invalidation}</p></div>)}</div></div> : null}
            <div className="brief-section"><div className="brief-section-title"><span>04</span> {mode === "mini" ? "WHAT SUPPORTS THE ANSWER" : "CLAIMS WITH SOURCE QUOTES"} {mode !== "mini" ? <em>{brief.citation_coverage ?? 100}% CITED</em> : null}</div>{brief.claims.map((item, index) => <blockquote className={`evidence-claim ${item.stance}`} key={index}><b>{item.claim}</b><q>{item.quote}</q><small>{mode === "mini" ? `${item.stance === "contradicts" ? "COUNTERPOINT" : item.stance === "context" ? "CONTEXT" : "SUPPORTING DETAIL"} · ${item.sourceUrl ?? "source matched"}` : `${item.stance.toUpperCase()} · ${Math.round(item.confidence * 100)}% model confidence · ${item.sourceUrl ?? "source matched"}`}</small></blockquote>)}</div>
            {mode !== "mini" ? <div className="evidence-quality-strip"><div><b>{brief.sources.length}</b><small>distinct source{brief.sources.length === 1 ? "" : "s"}</small></div><div><b>{brief.citation_coverage ?? 0}%</b><small>shown claims quote-checked</small></div><div><b>{brief.counterpoint_count ?? 0}</b><small>opposing claim{brief.counterpoint_count === 1 ? "" : "s"} found in supplied text</small></div></div> : null}
            {(brief.counterpoint_count ?? 0) === 0 ? <p className="counterpoint-note">No direct opposing claim was found in the passages you supplied. That does not mean no opposing evidence exists elsewhere.</p> : null}
            <div className="source-citation-list">{brief.sources.map((source) => <article className="source-provenance" key={source.url}><a className="source-citation" href={source.url} target="_blank" rel="noreferrer">↗ {source.title}</a><div><span>{source.publisher ?? new URL(source.url).hostname}</span>{source.retrieved_at ? <time dateTime={source.retrieved_at}>Captured {new Date(source.retrieved_at).toISOString().replace("T", " ").slice(0, 16)} UTC</time> : null}<small>{source.publication_date ? `Published ${source.publication_date}` : "Publication date not provided"} · {source.source_quality ?? "publisher not independently verified"}</small></div></article>)}</div>
          </div> : null}
          {!qwenAvailable ? <p className="provider-warning" role="status">Qwen is not configured on this deployment yet. The button stays disabled, and no research is presented as AI-generated.</p> : null}
          <div className="brief-bottom"><span>◉ {brief ? "Saved to your private research" : qwenAvailable ? "Evidence-based · Qwen synthesis" : "Generation unavailable · setup needed"}</span><button className="save-brief-button" onClick={analyzeSource} disabled={isAnalyzing || !qwenAvailable}>{isAnalyzing ? mode === "mini" ? "Reading source…" : "Checking evidence…" : brief ? "Regenerate brief" : qwenAvailable ? mode === "mini" ? "Read source & explain" : "Build cited brief" : "Qwen setup needed"}</button><button onClick={() => setBriefQuestion("")}>Back to workspace <span>↗</span></button></div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </section>
      </div> : null}
    </>
  );
}
