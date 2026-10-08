"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useExperience } from "@/app/ui/theme-provider";

type StageEvent = { id: string; agent: string; status: "running" | "complete" | "blocked"; title: string; detail: string; at: string; asset?: string };
type Destination = { mode: "paper_futures" | "live_spot"; label: string; href: string };
type AssetRead = {
  ticker: string; issuer: string; summary: string; stance: "bullish" | "bearish" | "mixed" | "unclear";
  confidence: number; tradeable: boolean; gateReasons: string[];
  sources: Array<{ title: string; url: string; publisher: string; publishedAt: string | null }>;
  market: { perpSymbol: string | null; spotSymbol: string | null; lastPrice: number | null };
  handoff: { destinations: Destination[]; reason: string } | null;
};
type FlowResult = { question: string; assets: AssetRead[]; tradeable: boolean; handoff?: unknown; trace: StageEvent[] };

const EXAMPLES = ["What do you think about NVDA and TSLA?", "Compare Apple and Microsoft after the latest news", "Is the rNVDA market worth reviewing?"];

function safeDeskLink(destination: Destination) {
  try {
    const url = new URL(destination.href, "https://tidelight.local");
    if (url.origin !== "https://tidelight.local") return null;
    if (destination.mode === "paper_futures" && url.pathname === "/futures") return url.pathname + url.search;
    if (destination.mode === "live_spot" && url.pathname === "/trading") return url.pathname + url.search;
  } catch { /* A malformed destination is never rendered. */ }
  return null;
}

export default function AgentFlowDesk({ initialQuestion }: { initialQuestion: string }) {
  const { mode, setMode } = useExperience();
  const [question, setQuestion] = useState(initialQuestion);
  const [stages, setStages] = useState<StageEvent[]>([]);
  const [result, setResult] = useState<FlowResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const handoffRef = useRef<HTMLDivElement>(null);
  const tradeableAssets = result?.assets.filter((asset) => asset.tradeable && asset.handoff?.destinations.length) ?? [];

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!result || !tradeableAssets.length) return;
    const timer = window.setTimeout(() => {
      handoffRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
      handoffRef.current?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [result, tradeableAssets.length]);

  async function runFlow(event?: FormEvent) {
    event?.preventDefault();
    const submitted = question.trim();
    if (submitted.length < 4) { setError("Ask a question about a US stock or its tokenized market."); return; }
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError(""); setResult(null); setStages([]);
    let completed = false;
    try {
      const response = await fetch("/api/research/agent-flow", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ question: submitted }), signal: request.signal,
      });
      if (!response.ok || !response.body) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.error || "The research flow could not start. Please try again.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      function receive(block: string) {
        const kind = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
        const payload = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!kind || !payload) return;
        const data = JSON.parse(payload);
        if (kind === "stage") {
          const stage = data as StageEvent;
          if (!stage.id || !stage.title) return;
          setStages((previous) => {
            const index = previous.findIndex((item) => item.id === stage.id);
            if (index < 0) return [...previous, stage];
            return previous.map((item, i) => i === index ? stage : item);
          });
        } else if (kind === "result") {
          completed = true;
          setResult(data as FlowResult);
        } else if (kind === "error") {
          throw new Error(data.error || "The research flow stopped before completion.");
        }
      }
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          receive(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
        }
      }
      buffer += decoder.decode().replace(/\r\n/g, "\n");
      if (buffer.trim()) receive(buffer);
      if (!completed) throw new Error("The connection ended before the research was complete. Please retry.");
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "The research flow could not finish.");
    } finally {
      if (controller.current === request) { controller.current = null; setBusy(false); }
    }
  }

  return <div className="content-wrap inner-page agent-flow-page">
    <section className="flow-hero" aria-labelledby="flow-title">
      <div className="flow-hero-copy"><span className="flow-kicker"><i /> TIDELIGHT / CONNECTED RESEARCH</span>
        <h1 id="flow-title">Ask once.<br /><span>Follow every step.</span></h1>
        <p>Bring a question about US stocks or their tokenized markets. Tidelight checks recent evidence, maps the available instruments, tests a scenario, and only offers a trading review when its gates agree.</p>
        <form className="flow-form" onSubmit={runFlow}><label htmlFor="flow-question">Your market question</label><div className="flow-form-row"><textarea id="flow-question" value={question} maxLength={280} rows={2} onChange={(event) => setQuestion(event.target.value)} placeholder="What do you think about NVDA and TSLA?" disabled={busy} /><button type="submit" disabled={busy}>{busy ? "Following the evidence…" : "Begin research ↗"}</button></div></form>
        <div className="flow-prompts"><span>TRY A QUESTION</span>{EXAMPLES.map((example) => <button type="button" key={example} onClick={() => setQuestion(example)} disabled={busy}>{example}</button>)}</div>
      </div>
      <div className="flow-orbit" aria-hidden="true"><div className="flow-orbit-ring"><span>EVENT</span><span>EVIDENCE</span><span>EXPOSURE</span><span>DECISION</span></div><div className="flow-orbit-core">∿<small>TIDELIGHT</small></div></div>
    </section>

    {(busy || stages.length > 0) ? <section className="flow-glass" aria-label="Agent activity"><div className="flow-section-head"><div><span className="flow-kicker">THE VISIBLE WORKFLOW</span><h2>What the agents are checking.</h2><p>Operational checkpoints appear as the work runs. Private model reasoning and unverified claims are not displayed.</p></div><span className={`flow-state ${busy ? "flow-state-live" : ""}`}>{busy ? "● IN PROGRESS" : error ? "PAUSED" : "COMPLETE"}</span></div>
      <div className="flow-trace" aria-live="polite" aria-relevant="additions text">{stages.map((stage, index) => <article className={`flow-stage flow-stage-${stage.status}`} key={stage.id}><div className="flow-stage-rail"><span>{String(index + 1).padStart(2, "0")}</span><i /></div><div className="flow-stage-body"><div><span>{stage.agent}{stage.asset ? ` · ${stage.asset}` : ""}</span><small>{stage.at ? new Date(stage.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</small></div><h3>{stage.title}</h3><p>{stage.detail}</p></div><span className="flow-stage-status">{stage.status === "running" ? "Checking" : stage.status === "blocked" ? "Paused" : "Checked"}</span></article>)}{busy && stages.length === 0 ? <div className="flow-wait"><i /> Connecting the research agents…</div> : null}</div>
    </section> : null}

    {error ? <div className="flow-error" role="alert"><b>Research paused</b><span>{error}</span>{error.toLowerCase().includes("sign in") ? <Link href="/login">Sign in ↗</Link> : <button type="button" onClick={() => void runFlow()} disabled={busy}>Try again ↗</button>}</div> : null}

    {result ? <section className="flow-results" aria-label="Research findings"><div className="flow-section-head"><div><span className="flow-kicker">RESEARCH / {result.assets.length} {result.assets.length === 1 ? "COMPANY" : "COMPANIES"}</span><h2>One question. Separate decisions.</h2><p>Each company has its own evidence and market gate. A favorable read does not place an order.</p></div></div>
      <div className="flow-asset-grid">{result.assets.map((asset) => <article key={asset.ticker} className="flow-asset-card"><header><div><span className="flow-kicker">{asset.ticker} / {asset.issuer}</span><h3>{asset.issuer}</h3></div><span className={`flow-verdict ${asset.tradeable ? "flow-verdict-ready" : ""}`}>{asset.tradeable ? "REVIEW AVAILABLE" : "NO TRADE HANDOFF"}</span></header><p>{asset.summary}</p><div className="flow-asset-meta"><span>Read <b>{asset.stance}</b></span><span>Confidence <b>{Math.round(asset.confidence * 100)}%</b></span>{asset.market.lastPrice !== null ? <span>Reference <b>${asset.market.lastPrice.toLocaleString()}</b></span> : null}</div>{asset.gateReasons?.length ? <div className="flow-gates"><b>Decision gates</b><ul>{asset.gateReasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></div> : null}<details className="flow-sources"><summary>Inspect {asset.sources.length} {asset.sources.length === 1 ? "source" : "sources"}</summary>{asset.sources.length ? <ul>{asset.sources.map((source, index) => <li key={`${source.url}-${index}`}><span>{source.publisher}{source.publishedAt ? ` · ${new Date(source.publishedAt).toLocaleDateString()}` : ""}</span><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></li>)}</ul> : <p>No source links were returned; the trading gate remains closed.</p>}</details></article>)}</div>
      {tradeableAssets.length ? <div className="flow-handoff" ref={handoffRef} tabIndex={-1} role="region" aria-label="Choose a trading review desk"><div className="flow-handoff-intro"><span className="flow-kicker">NEXT / YOUR DECISION</span><h2>Review the market before acting.</h2><p>The research gates found a scenario worth inspecting. Choose paper futures, or review a Bitget tokenized stock spot order in demo or live account mode. You can review both desks. Every order still requires your own approval and risk checks.</p></div><div className="flow-handoff-list">{tradeableAssets.map((asset) => <div className="flow-handoff-asset" key={asset.ticker}><div><b>{asset.ticker}</b><span>{asset.handoff?.reason}</span></div><div className="flow-handoff-actions">{asset.handoff?.destinations.flatMap((destination) => { const href = safeDeskLink(destination); if (!href) return []; if (destination.mode === "paper_futures") return [<Link key="paper" href={href} onClick={() => setMode("pro")}>Review paper futures <span>↗</span></Link>]; const demo = `${href}${href.includes("?") ? "&" : "?"}intent=demo`; const live = `${href}${href.includes("?") ? "&" : "?"}intent=live`; return [<Link key="demo" href={demo} onClick={() => setMode("pro")}>Review Bitget demo spot <span>↗</span></Link>, <Link key="live" href={live} onClick={() => setMode("pro")}>Review Bitget live spot <span>↗</span></Link>]; })}</div></div>)}</div><small>Research can be uncertain. A review link never places a trade or switches your account into live mode.{mode === "mini" ? " Trade reviews open the Pro workspace controls." : ""}</small></div> : <div className="flow-no-handoff"><span className="flow-kicker">RISK GATE / HOLD</span><b>No trading handoff for this read.</b><p>Review the sources and decision gates above. You can return when fresher or stronger evidence is available.</p><Link href="/markets">Explore the market map ↗</Link></div>}
    </section> : null}
  </div>;
}
