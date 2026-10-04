"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveResearchQuestion } from "@/app/actions";

const suggestions = [
  "How could a surprise rate cut affect tokenized tech stocks?",
  "What changed for NVDA after the latest export-control announcement?",
  "Compare Tesla and Nvidia exposure to this week’s macro events.",
];

export default function ResearchWorkspace() {
  const [question, setQuestion] = useState("");
  const [briefQuestion, setBriefQuestion] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
    setSaved(false);
    startTransition(() => setBriefQuestion(cleaned));
  }

  async function saveQuestion() {
    if (!briefQuestion) return;
    setIsSaving(true);
    const result = await saveResearchQuestion(briefQuestion);
    setIsSaving(false);
    if (result.error) {
      if (result.error.includes("Sign in")) router.push("/login");
      else setError(result.error);
    } else {
      setSaved(true);
    }
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
          <div className="dialog-kicker"><span className="pulse-dot" /> TIDELIGHT RESEARCH NOTE <span className="demo-pill">ILLUSTRATIVE</span></div>
          <h2 id="brief-title">{briefQuestion}</h2>
          <div className="brief-meta"><span>AFTER-HOURS EVENT RESEARCH</span><span>·</span><span>GENERATED PREVIEW</span></div>
          <div className="brief-rule" />
          <p className="brief-intro">This concept preview shows the shape of a Tidelight research brief. It does not fetch live news or market data yet.</p>
          <div className="brief-section"><div className="brief-section-title"><span>01</span> WHAT CHANGED</div><p>Start with the confirmed event and its timing. Tidelight will separate what a source reports from what the market may infer, with a citation attached to each key claim.</p></div>
          <div className="brief-section"><div className="brief-section-title"><span>02</span> WHY IT MAY MATTER</div><p>Map the possible path from event to company: affected products, customers, suppliers, policy exposure, and the next scheduled information that could change the picture.</p></div>
          <div className="scenario-grid"><div><small>UPSIDE CASE</small><b>Expectations already price in the risk</b><span>Watch for resilient guidance or easing constraints.</span></div><div><small>WHAT COULD BREAK THE THESIS</small><b>Policy scope expands unexpectedly</b><span>Reassess if primary sources confirm a broader impact.</span></div></div>
          <div className="brief-bottom"><span>◉ Draft preview · no live sources yet</span><button className="save-brief-button" onClick={saveQuestion} disabled={isSaving || saved}>{saved ? "Question saved ✓" : isSaving ? "Saving…" : "Save question"}</button><button onClick={() => setBriefQuestion("")}>Back to workspace <span>↗</span></button></div>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </section>
      </div> : null}
    </>
  );
}
