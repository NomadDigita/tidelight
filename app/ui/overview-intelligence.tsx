"use client";

import TidelightAnimatedMark from "@/app/ui/tidelight-animated-mark";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { composeIntelligenceBlocks, parseIntelligenceResult, type IntelligenceBlock, type IntelligenceResult } from "@/lib/intelligence-ui";
import { RegistryBlock } from "@/app/ui/intelligence-results";
import { useExperience } from "@/app/ui/theme-provider";
import { useIntelligence } from "@/app/ui/intelligence-provider";

type SavedRun = { id: string; question: string; status: string; created_at: string; summary: unknown };
type WatchItem = { symbol: string; company_name: string };


export default function OverviewIntelligence({ signedIn, watchlist, savedRuns, marketGeneratedAt, marketStatus }: { signedIn: boolean; watchlist: WatchItem[]; savedRuns: SavedRun[]; marketGeneratedAt: number | null; marketStatus: string }) {
  const { mode } = useExperience();
  const intelligence = useIntelligence();
  const [question, setQuestion] = useState("");
  const [feedback, setFeedback] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [hideSavedRun, setHideSavedRun] = useState(false);
  const validSaved = useMemo(() => savedRuns.map((run) => ({ run, result: parseIntelligenceResult(run.summary) })).filter((item) => item.result !== null), [savedRuns]);
  const selectedResult = intelligence.result ?? validSaved.find((item) => item.run.id === activeRunId)?.result ?? (!hideSavedRun ? validSaved[0]?.result : null) ?? null;
  const watchLabel = watchlist.slice(0, 3).map((item) => item.company_name || item.symbol).join(", ");
  const supportedTickers = new Set(["NVDA", "AMD", "MSFT", "AAPL", "META", "AMZN", "GOOGL", "TSLA", "INTC", "ASML", "QCOM", "MU"]);
  const supportedWatchlist = watchlist.filter((item) => supportedTickers.has(item.symbol.replace(/^R/, "").replace(/USDT$/, "")));
  const defaultQuestion = supportedWatchlist.length ? `Compare the latest evidence for ${supportedWatchlist.slice(0, 3).map((item) => item.symbol.replace(/^R/, "").replace(/USDT$/, "")).join(" and ")} and outline the main risks` : "Compare the latest evidence for NVDA and TSLA and outline the main risks";
  const freshness = marketGeneratedAt ? `AS OF ${new Date(marketGeneratedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}` : "Not connected";

  async function submit(event: FormEvent) {
    event.preventDefault(); setFeedback("");
    if (!signedIn) { setFeedback("Sign in to start a private, saved research workflow."); return; }
    const query = question.trim() || defaultQuestion;
    if (query.length < 5) { setFeedback("Add a little more detail to your question."); return; }
    const contextRunId = activeRunId ?? selectedResult?.researchRunId ?? null;
    const scopedQuery = contextRunId && selectedResult ? `${selectedResult.assets.map((asset) => asset.ticker).join(" and ")} context: ${query}`.slice(0, 500) : query;
    setActiveRunId(null);
    const result = await intelligence.start(scopedQuery, contextRunId);
    if (result) { setActiveRunId(result.researchRunId); setQuestion(""); setFeedback("Fresh evidence and market context are ready."); }
  }

  function openRun(run: SavedRun, result: IntelligenceResult | null) {
    if (!result) { setFeedback("This saved item is not a compatible Agent Flow session yet. Open it in Saved briefs to review."); return; }
    setActiveRunId(run.id); setHideSavedRun(false); setFeedback(""); intelligence.restore(result);
  }

  const blocks = selectedResult ? composeIntelligenceBlocks(selectedResult) : [];
  const blockRegistry: Record<IntelligenceBlock["type"], IntelligenceBlock> | null = selectedResult ? Object.fromEntries(blocks.map((block) => [block.type, block])) as Record<IntelligenceBlock["type"], IntelligenceBlock> : null;

  return <div className={`content-wrap dashboard-page intelligent-overview${mode === "mini" ? " is-mini" : " is-pro"}`}>
    <section className="iu-intro"><div className="iu-intro-copy"><span className="iu-eyebrow"><i/> TIDELIGHT INTELLIGENCE / YOUR DESK</span><h1>{signedIn ? "Your market, in context" : "A clearer view of the market"}<span>.</span></h1><p>{signedIn && watchLabel ? `Following ${watchLabel}${watchlist.length > 3 ? ` and ${watchlist.length - 3} more` : ""}.` : "Research, verified market context, and risk gates in one place."} Start with the useful signal already in view; ask a follow-up whenever you’re ready.</p></div><div className="iu-intro-meta"><span className="iu-mode-chip">{mode === "mini" ? "MINI · PLAIN LANGUAGE" : "PRO · FULL EVIDENCE"}</span><span className={`iu-connection ${marketStatus === "available" ? "is-online" : ""}`}><i/>{marketStatus === "available" ? `BITGET MARKET · ${freshness}` : "MARKET SNAPSHOT UNAVAILABLE"}</span></div></section>

    <section className="iu-workspace" aria-label="Intelligence workspace"><div className="iu-main-column">
      <section className="iu-prompt-panel" aria-labelledby="iu-prompt-heading"><div className="iu-prompt-top"><span className="iu-kicker">ASK THE AGENT TEAM</span><span>Private · Source-first · No automatic orders</span></div><h2 id="iu-prompt-heading">What would you like to understand?</h2><p>Use a supported US stock or tokenized equity symbol. Tidelight checks attributable coverage and verified Bitget market data.</p><form onSubmit={submit}><label className="sr-only" htmlFor="iu-question">Ask a market research question</label><textarea id="iu-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} rows={2} placeholder={watchlist.length ? `What changed for ${watchlist[0].symbol.replace(/^R/, "").replace(/USDT$/, "")} since my last review?` : "Compare NVDA and TSLA after the latest news…"} disabled={intelligence.busy}/><div className="iu-prompt-controls"><small>{question.length}/500 · Try an issuer name or ticker</small><button type="submit" disabled={intelligence.busy}>{intelligence.busy ? "Following evidence…" : "Research this question"}<span>→</span></button></div></form>{feedback ? <p className="iu-feedback" role="status">{feedback}</p> : null}{intelligence.error ? <p className="iu-error" role="alert">{intelligence.error}</p> : null}<div className="iu-suggestions"><span>START WITH</span><button type="button" onClick={() => setQuestion(defaultQuestion)}>Your watchlist context</button><button type="button" onClick={() => setQuestion("Compare NVDA and TSLA using recent evidence and show the risks")}>NVDA / TSLA comparison</button><Link href="/research">Add a primary source <span>→</span></Link></div></section>

      {selectedResult ? <div className="iu-composed-workspace" aria-label="Validated generated research workspace"><div className="iu-result-header"><div><span className="iu-kicker">GENERATED WORKSPACE / {selectedResult.researchRunId.slice(0, 8).toUpperCase()}</span><h2>{selectedResult.question}</h2><p>Collected {selectedResult.assets.reduce((count, asset) => count + asset.sources.length, 0)} source links and checked {selectedResult.assets.length} supported market {selectedResult.assets.length === 1 ? "instrument" : "instruments"}.</p></div><button type="button" onClick={() => { setActiveRunId(null); setHideSavedRun(true); intelligence.clear(); }}>Clear view</button></div>{blocks.map((block) => <RegistryBlock key={block.id} block={blockRegistry![block.type]} result={selectedResult} mode={mode}/>)}</div> : <section className="iu-welcome-panel"><div className="iu-welcome-symbol"><TidelightAnimatedMark /></div><div><span className="iu-kicker">A BRIEF, ALREADY IN MOTION</span><h2>{signedIn ? watchlist.length ? "Your watchlist is the starting point." : "Build your first intelligence session." : "See today’s market context."}</h2><p>{signedIn && watchlist.length ? `Your saved list includes ${watchlist.slice(0, 4).map((item) => item.company_name || item.symbol).join(", ")}. Ask for a fresh evidence-and-market review, or open a recent session to continue its context.` : "When available, the market snapshot below uses public Bitget data. Sign in to start private research, save sessions, and continue them later."}</p><button type="button" onClick={() => { setQuestion(defaultQuestion); document.getElementById("iu-question")?.focus(); }}>Start with this context <span>→</span></button></div><div className="iu-brief-stats"><div><span>WATCHLIST</span><b>{signedIn ? watchlist.length : "—"}</b></div><div><span>RECENT SESSIONS</span><b>{savedRuns.length}</b></div><div><span>MARKET CHECK</span><b>{marketStatus === "available" ? "Live feed" : "Unavailable"}</b></div></div></section>}
    </div>

    <aside className="iu-context-rail" aria-label="Personalized research context"><section className="iu-rail-panel"><div className="iu-rail-head"><span className="iu-kicker">YOUR SIGNAL GRAPH</span><Link href="/watchlist" aria-label="Open watchlist">→</Link></div><h2>What Tidelight knows</h2><p>Personal context used to make the next read more relevant.</p><div className="iu-context-list"><div><i className="iu-context-icon">◉</i><span><b>{watchlist.length ? `${watchlist.length} saved watchlist ${watchlist.length === 1 ? "asset" : "assets"}` : "No watchlist yet"}</b><small>{watchlist.length ? watchlist.slice(0, 4).map((item) => item.symbol).join(" · ") : "Add issuers to shape your desk"}</small></span></div><div><i className="iu-context-icon">⌕</i><span><b>{savedRuns.length ? "Recent research available" : "No prior sessions"}</b><small>{savedRuns.length ? "Owner-scoped and saved to your research trail" : "Your first completed run will appear here"}</small></span></div><div><i className="iu-context-icon">◷</i><span><b>{marketStatus === "available" ? "Public market feed checked" : "Market feed unavailable"}</b><small>{marketStatus === "available" ? `Market snapshot ${freshness}` : "Quotes are not shown as current"}</small></span></div></div><small className="iu-privacy-note">Portfolio exposure is not read here. Add it through the authorized portfolio tools when available.</small></section>

      <section className="iu-rail-panel iu-saved-panel"><div className="iu-rail-head"><span className="iu-kicker">RESEARCH TRAIL</span><Link href="/briefs">ALL →</Link></div><h2>Pick up where you left off.</h2>{savedRuns.length ? <div className="iu-saved-list">{savedRuns.slice(0, 5).map((run) => { const result = parseIntelligenceResult(run.summary); return <button type="button" className={`iu-saved-run${activeRunId === run.id ? " is-selected" : ""}`} key={run.id} onClick={() => openRun(run, result)}><span className="iu-saved-run-top"><b>{run.status === "complete" ? "AGENT RESEARCH" : run.status.toUpperCase()}</b><time dateTime={run.created_at}>{new Date(run.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</time></span><span>{run.question}</span><small>{result ? `${result.assets.length} issuer${result.assets.length === 1 ? "" : "s"} · ${result.trace.length} operational checks` : "Open saved research record"}</small></button>; })}</div> : <p className="iu-empty-rail">Your completed sessions will be saved here, ready to reopen.</p>}</section>

      <section className="iu-rail-promo"><span className="iu-kicker">MOVE FROM CONTEXT TO METHOD</span><b>One record across the research loop.</b><p>Replay a rule in Strategy Lab, or let Nightwatch observe a market you choose.</p><div><Link href="/strategies">Strategy Lab <span>→</span></Link><Link href="/nightwatch">Nightwatch <span>→</span></Link></div></section></aside></section>
  </div>;
}
