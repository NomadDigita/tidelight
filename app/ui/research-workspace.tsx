"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEvidenceBrief } from "@/app/actions";

type ResearchBrief = {
  summary: string;
  upside: string;
  downside: string;
  catalysts: string[];
  claims: { claim: string; quote: string; stance: string; confidence: number }[];
  source: { title: string; url: string };
  evidence_basis: string;
};

const suggestions = [
  "How could a surprise rate cut affect tokenized tech stocks?",
  "What changed for NVDA after the latest export-control announcement?",
  "Compare Tesla and Nvidia exposure to this week’s macro events.",
];

export default function ResearchWorkspace({ qwenAvailable, initialQuestion = "" }: { qwenAvailable: boolean; initialQuestion?: string }) {
  const [question, setQuestion] = useState(initialQuestion);
  const [briefQuestion, setBriefQuestion] = useState("");
  const [error, setError] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
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
    setError("");
    setBrief(null);
    setSourceTitle("");
    setSourceUrl("");
    setExcerpt("");
    startTransition(() => setBriefQuestion(cleaned));
  }

  async function analyzeSource() {
    if (!briefQuestion) return;
    setIsAnalyzing(true);
    setError("");
    const result = await createEvidenceBrief({ question: briefQuestion, sourceTitle, sourceUrl, excerpt });
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
      <section className="hero-card" id="research" aria-labelledby="research-title">
        <div className="hero-glow" /><div className="hero-grid" />
        <div className="hero-content">
          <div className="hero-kicker"><span className="sparkle">✳</span> YOUR AFTER-HOURS RESEARCH DESK <span className="demo-pill">CONCEPT DEMO</span></div>
          <h2 id="research-title">Follow the story<br /><em>before the bell.</em></h2>
          <p className="hero-description">Ask about an event, a company, or a shift in the market. Get a clear read with sources, scenarios, and what to watch next.</p>
          <form className="research-form" onSubmit={(event) => { event.preventDefault(); openBrief(); }}>
            <label className="sr-only" htmlFor="research-question">Ask a research question</label>
            <span className="prompt-mark">↳</span><input id="research-question" type="text" maxLength={500} value={question} onChange={(event) => { setQuestion(event.target.value); setError(""); }} placeholder="What could this weekend’s chip restrictions mean for NVDA?" autoComplete="off" />
            <button type="submit" id="analyze-button" disabled={isPending}><span>{isPending ? "Preparing" : "Analyze"}</span><b>↗</b></button>
          </form>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <div className="prompt-examples"><span>TRY:</span>{suggestions.map((suggestion, index) => <span className="suggestion-wrap" key={suggestion}><button type="button" onClick={() => { setQuestion(suggestion); openBrief(suggestion); }}>{["Rate cut impact", "NVDA export rules", "Compare event exposure"][index]}</button>{index < suggestions.length - 1 ? <i /> : null}</span>)}</div>
        </div>
        <div className="hero-ornament" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><span className="orbit-mark">∿</span></div><span className="orbit-label label-one">EVENT FLOW</span><span className="orbit-label label-two">AFTER HOURS</span><span className="orbit-label label-three">RISK CONTEXT</span></div>
        <div className="hero-foot"><span><span className="pulse-dot" /> DESIGNED FOR 24/7 TOKENIZED MARKETS</span><span>RESEARCH WITH CONTEXT <b>↗</b></span></div>
      </section>

      {briefQuestion ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setBriefQuestion(""); }}>
        <section className="brief-dialog" role="dialog" aria-modal="true" aria-labelledby="brief-title">
          <button ref={closeButtonRef} className="dialog-close" aria-label="Close research brief" onClick={() => setBriefQuestion("")}>×</button>
          <div className="dialog-kicker"><span className="pulse-dot" /> TIDELIGHT RESEARCH NOTE <span className="demo-pill">SOURCE-BOUNDED</span></div>
          <h2 id="brief-title">{briefQuestion}</h2>
          <div className="brief-meta"><span>AFTER-HOURS EVENT RESEARCH</span><span>·</span><span>{brief ? "QWEN SYNTHESIS" : "USER-PROVIDED SOURCE"}</span></div>
          <div className="brief-rule" />
          <p className="brief-intro">Add one source passage to ground the analysis. Tidelight will store the excerpt, quote-check each cited claim against it, and link back to the original. No live market prices are used.</p>
          <div className="source-fields">
            <label>Source title<input value={sourceTitle} maxLength={200} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Official filing, release, or article title" /></label>
            <label>Source link<input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" type="url" inputMode="url" /></label>
            <label>Passage to analyze<textarea value={excerpt} maxLength={6000} onChange={(event) => setExcerpt(event.target.value)} placeholder="Paste an excerpt from the source (80–6,000 characters). Tidelight analyzes only the text you provide." rows={5} /><span className="source-count">{excerpt.length.toLocaleString()} / 6,000</span></label>
          </div>
          {brief ? <div className="generated-brief">
            <div className="brief-section"><div className="brief-section-title"><span>01</span> WHAT THE SOURCE SAYS</div><p>{brief.summary}</p></div>
            <div className="scenario-grid"><div><small>UPSIDE CASE</small><b>{brief.upside}</b></div><div><small>WHAT COULD BREAK THE THESIS</small><b>{brief.downside}</b></div></div>
            {brief.catalysts.length ? <div className="brief-section"><div className="brief-section-title"><span>02</span> WHAT TO WATCH NEXT</div><ul>{brief.catalysts.map((item, index) => <li key={index}>{item}</li>)}</ul></div> : null}
            <div className="brief-section"><div className="brief-section-title"><span>03</span> CLAIMS WITH SOURCE QUOTES</div>{brief.claims.map((item, index) => <blockquote className="evidence-claim" key={index}><b>{item.claim}</b><q>{item.quote}</q><small>{item.stance.toUpperCase()} · {Math.round(item.confidence * 100)}% model confidence</small></blockquote>)}</div>
            <a className="source-citation" href={brief.source.url} target="_blank" rel="noreferrer">↗ {brief.source.title}</a>
          </div> : null}
          {!qwenAvailable ? <p className="provider-warning" role="status">Qwen is not configured on this deployment yet. The button stays disabled, and no research is presented as AI-generated.</p> : null}
          <div className="brief-bottom"><span>◉ {brief ? "Saved to your private research" : qwenAvailable ? "Evidence-based · Qwen synthesis" : "Generation unavailable · setup needed"}</span><button className="save-brief-button" onClick={analyzeSource} disabled={isAnalyzing || !qwenAvailable}>{isAnalyzing ? "Checking evidence…" : brief ? "Regenerate brief" : qwenAvailable ? "Build cited brief" : "Qwen setup needed"}</button><button onClick={() => setBriefQuestion("")}>Back to workspace <span>↗</span></button></div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </section>
      </div> : null}
    </>
  );
}
