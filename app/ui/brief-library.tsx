"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Run = { id: string; question: string; status: string; summary: unknown; model_name: string | null; event_type?: string | null; created_at: string };

function summaryText(value: unknown) {
  if (!value || typeof value !== "object") return "Your research question is saved. Add a source passage from the research desk to build a cited brief.";
  const assets = (value as Record<string, unknown>).assets;
  if (Array.isArray(assets)) return assets.map((asset) => {
    if (!asset || typeof asset !== "object") return "";
    const item = asset as Record<string, unknown>;
    return `${typeof item.ticker === "string" ? item.ticker + ": " : ""}${typeof item.summary === "string" ? item.summary : "Research recorded."}`;
  }).filter(Boolean).join(" ").slice(0, 320) || "The agent handoffs and market checks were recorded.";
  const summary = (value as Record<string, unknown>).summary;
  return typeof summary === "string" ? summary : "Your research question is saved. Add a source passage from the research desk to build a cited brief.";
}

export default function BriefLibrary({ runs }: { runs: Run[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(() => runs.filter((run) => {
    const matchesQuery = `${run.question} ${summaryText(run.summary)}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (status === "all" || run.status === status);
  }), [runs, query, status]);

  return <section className="library-panel">
    <div className="library-toolbar"><label className="library-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your research" aria-label="Search saved briefs" /></label><div className="filter-tabs" aria-label="Filter briefs">{[["all", "All"], ["complete", "Complete"], ["analyzing", "In progress"], ["failed", "Needs review"]].map(([key, label]) => <button key={key} className={status === key ? "selected" : ""} onClick={() => setStatus(key)}>{label}</button>)}</div><span className="library-count">{filtered.length.toString().padStart(2, "0")} NOTES</span></div>
    {filtered.length ? <div className="brief-card-grid">{filtered.map((run) => {
      const content = run.summary && typeof run.summary === "object" ? run.summary as Record<string, unknown> : null;
      const source = content?.source && typeof content.source === "object" ? content.source as Record<string, unknown> : null;
      return <article className="brief-card" key={run.id}>
        <div className="brief-card-top"><span className="brief-card-index">NOTE / {run.id.slice(0, 5).toUpperCase()}</span><span className={`status-pill status-${run.status}`}>{run.status.replaceAll("_", " ")}</span></div>
        <h2>{run.question}</h2><p>{summaryText(run.summary)}</p>
        <div className="brief-card-tags"><span>{run.event_type === "agent_flow" ? "AGENT FLOW" : run.model_name ?? "RESEARCH NOTE"}</span>{content?.claims && Array.isArray(content.claims) ? <span>{content.claims.length} EVIDENCE CLAIM{content.claims.length === 1 ? "" : "S"}</span> : null}</div>
        <div className="brief-card-footer"><time dateTime={run.created_at}>{new Date(run.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>{run.event_type === "agent_flow" ? <Link href={`/flow?question=${encodeURIComponent(run.question)}`}>RECHECK CURRENT DATA ↗</Link> : typeof source?.url === "string" ? <a href={source.url} target="_blank" rel="noreferrer">OPEN SOURCE ↗</a> : <Link href="/research">ADD A SOURCE ↗</Link>}</div>
      </article>;
    })}</div> : <div className="empty-library"><span className="empty-glyph">⌕</span><h2>{runs.length ? "No notes match that view." : "Your library is waiting."}</h2><p>{runs.length ? "Try a different search or status filter." : "Create a source-grounded note and it will appear here."}</p><Link href="/research">Go to research desk <span>↗</span></Link></div>}
  </section>;
}
