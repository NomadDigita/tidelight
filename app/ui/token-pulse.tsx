"use client";

import { useState } from "react";
import "./token-pulse.css";

type Exposure = { symbol: string; name: string; instrument: string; issuer: string; underlying: string; sector: string; catalysts: string[]; risks: string[] };
type Result = {
  token: string; collectedAt: string; coverage: { news: number; community: number };
  sources: Array<{ title: string; url: string; publisher: string; publishedAt: string | null; channel: string; snippet: string }>;
  analysis: { overview: string; mood: string; mood_explanation: string; notable_developments: Array<{ headline: string; what_it_means: string; source_urls: string[] }>; risks: string[]; watch_next: string[]; confidence: number; limitations: string; unavailable?: boolean };
};
export default function TokenPulse() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [exposure, setExposure] = useState<Exposure[] | null>(null);
  const [exposureBusy, setExposureBusy] = useState(false);
  const [reviewSymbol, setReviewSymbol] = useState<string | null>(null);
  async function research(event: React.FormEvent) {
    event.preventDefault();
    if (!token.trim()) { setError("Enter a token name or symbol."); return; }
    setBusy(true); setError(""); setResult(null); setExposure(null); setReviewSymbol(null);
    try {
      const response = await fetch("/api/research/token-pulse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await response.json();
      if (!response.ok && !(Array.isArray(data.sources) && data.sources.length > 0 && data.analysis)) throw new Error(data.error || "Could not build this token pulse.");
      setResult(data);
      if (!response.ok) setError(data.error || "AI synthesis is unavailable; review the gathered sources below.");
      if (response.ok && ["positive", "negative"].includes(data.analysis?.mood) && data.analysis.confidence >= 0.85 && data.coverage.news >= 5) {
        const cited = new Set<string>((data.analysis.notable_developments ?? []).flatMap((item: { source_urls: string[] }) => item.source_urls).map((url: string) => { try { return new URL(url).hostname; } catch { return ""; } }).filter(Boolean));
        if (cited.size >= 2) {
          fetch("/api/research/exposure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: data.token }) }).then((res) => res.ok ? res.json() : null).then((mapped) => { if (mapped?.matches?.[0]?.symbol) setReviewSymbol(mapped.matches[0].symbol); }).catch(() => {});
        }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not build this token pulse."); }
    finally { setBusy(false); }
  }
  async function resolveExposure() {
    if (!token.trim()) return;
    setExposureBusy(true); setError("");
    try { const response = await fetch("/api/research/exposure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Exposure map unavailable."); setExposure(data.matches ?? []); } catch (cause) { setError(cause instanceof Error ? cause.message : "Exposure map unavailable."); } finally { setExposureBusy(false); }
  }
  return <section className="token-pulse" aria-labelledby="token-pulse-title">
    <div className="tp-heading"><div><span className="tp-kicker"><i /> TIDELIGHT / TOKEN PULSE</span><h2 id="token-pulse-title">A quick read on any token.</h2><p>Type a name or ticker. Tidelight gathers recent headlines and public community posts, then tells you what’s worth checking next.</p></div><span className="tp-live-badge">NEWS + COMMUNITY</span></div>
    <form className="tp-form" onSubmit={research}><label className="sr-only" htmlFor="tp-token">Token name or symbol</label><span className="tp-search-mark">⌕</span><input id="tp-token" maxLength={80} value={token} onChange={(event) => setToken(event.target.value)} placeholder="Try rNVDA, NVIDIA, rTSLA…" autoComplete="off"/><button type="submit" disabled={busy}>{busy ? <><i className="tp-spinner"/> Gathering sources</> : "Build token pulse"}</button></form>
    <p className="tp-helper">A snapshot of public information. Community posts can be wrong or coordinated; this is a research aid, not a trade signal.</p>
    {error ? <p className="tp-error" role="alert">{error}</p> : null}
    {result ? <div className="tp-result" aria-live="polite">
      <div className="tp-result-top"><div><span className="tp-kicker">LATEST PUBLIC READ · {new Date(result.collectedAt).toLocaleString()}</span><h3>{result.token}</h3></div><span className={"tp-mood tp-" + (result.analysis.unavailable ? "unclear" : result.analysis.mood)}>{result.analysis.unavailable ? "analysis unavailable" : result.analysis.mood}</span></div>
      <p className="tp-overview">{result.analysis.overview}</p>{result.analysis.unavailable ? null : <p className="tp-mood-note">{result.analysis.mood_explanation}</p>}
      <div className="tp-coverage"><span><b>{result.coverage.news}</b> news sources</span><span><b>{result.coverage.community}</b> community posts</span>{result.analysis.unavailable ? <span>AI confidence wasn’t generated</span> : <span><b>{Math.round(result.analysis.confidence * 100)}%</b> confidence</span>}</div>
      {!result.analysis.unavailable ? <div className="tp-columns"><section><h4>What changed</h4>{result.analysis.notable_developments.length ? result.analysis.notable_developments.map((item, index) => <article className="tp-development" key={index}><b>{item.headline}</b><p>{item.what_it_means}</p>{item.source_urls.map((url) => { const source = result.sources.find((candidate) => candidate.url === url); return source ? <a key={url} href={url} target="_blank" rel="noreferrer">{source.publisher} ↗</a> : null; })}</article>) : <p className="tp-muted">No clear development stood out in this sample.</p>}</section><section><h4>Risks to keep in view</h4><ul>{result.analysis.risks.map((item, index) => <li key={index}>{item}</li>)}</ul><h4 className="tp-watch-heading">What to check next</h4><ol>{result.analysis.watch_next.map((item, index) => <li key={index}>{item}</li>)}</ol></section></div> : null}
      <details className="tp-sources" open={result.analysis.unavailable}><summary>Review all {result.sources.length} collected items</summary><ul>{result.sources.map((source) => <li key={source.url}><span>{source.channel} · {source.publisher}{source.publishedAt ? " · " + new Date(source.publishedAt).toLocaleDateString() : ""}</span><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a></li>)}</ul></details>
      <div className="tp-exposure-handoff"><div><span className="tp-kicker">NEXT LAYER · EXPOSURE MAP</span><b>Connect this token to its market context.</b><small>Issuer, underlying, sector, catalysts and risk context.</small></div><button type="button" onClick={() => void resolveExposure()} disabled={exposureBusy}>{exposureBusy ? "Mapping…" : "Map exposure ↗"}</button></div>{exposure ? <div className="tp-exposure-grid">{exposure.length ? exposure.map((item) => <article key={item.symbol}><b>{item.name} · {item.symbol}</b><span>{item.instrument} · {item.issuer}</span><small>{item.sector} · underlying: {item.underlying}</small><p><strong>Catalyst:</strong> {item.catalysts[0]}</p><p><strong>Risk:</strong> {item.risks[0]}</p></article>) : <p className="tp-muted">No supported exposure match yet. Try a ticker or full asset name.</p>}</div> : null}
      <p className="tp-limit">{result.analysis.limitations}</p>
    </div> : null}
    {reviewSymbol ? <aside className="tp-review-toast" role="status"><button type="button" className="tp-review-close" aria-label="Dismiss market review" onClick={() => setReviewSymbol(null)}>×</button><span className="tp-kicker">RESEARCH → MARKET REVIEW</span><b>Sources point to a clear story. Check the market before acting.</b><p>This is a news read, not an order signal. Confirm the instrument, price, risk, and account mode yourself.</p><a href={`/trading?symbol=${encodeURIComponent(reviewSymbol)}`}>Inspect {reviewSymbol} at the trading desk ↗</a></aside> : null}
  </section>;
}
