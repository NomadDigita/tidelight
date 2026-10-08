"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ALPHA_STRATEGIES, BACKTEST_STRATEGY, type StrategyKey } from "@/lib/backtest";
import { STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";

type PaperPosition = { symbol: string; direction: "long" | "short"; quantity: number; entry_fill: number; margin: number; entry_fee: number; opened_at: string };
type Decision = { id: string; symbol: string; as_of: string; action: string; outcome: string; reason: string; reference_price: number; realized_pnl: number; created_at: string; snapshot?: { agent?: { rationale?: string; confidence?: number; evidence?: string[]; risks?: string[]; invalidation?: string } } };
type Fill = { id: string; symbol: string; action: string; direction: string; quantity: number; fill_price: number; notional: number; fee: number; realized_pnl: number; created_at: string };
const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const when = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

export default function FuturesPaperDesk({ signedIn, cash, paused, position, mark, markAsOf, decisions, fills }: {
  signedIn: boolean; cash: number; paused: boolean; position: PaperPosition | null; mark: number | null; markAsOf: number | null; decisions: Decision[]; fills: Fill[];
}) {
  const router = useRouter();
  const [symbol, setSymbol] = useState<string>(position?.symbol ?? "NVDAUSDT");
  const [playbookKey, setPlaybookKey] = useState<StrategyKey>(BACKTEST_STRATEGY);
  const [busy, setBusy] = useState(false);
  const [isPaused, setIsPaused] = useState(paused);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<{ action?: string; outcome: string; reason: string; idempotent?: boolean } | null>(null);
  const exposure = position ? position.margin + (mark ? Number(position.quantity) * (mark - Number(position.entry_fill)) * (position.direction === "long" ? 1 : -1) : 0) : 0;
  const equity = cash + exposure;

  async function check(mode: "check" | "close") {
    if (!signedIn) { router.push("/login"); return; }
    setBusy(true); setError(""); setLatest(null);
    try {
      const response = await fetch("/api/futures/paper", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: mode === "close" ? position?.symbol : symbol, playbookKey, mode }) });
      const payload = await response.json() as { result?: { action?: string; outcome: string; reason: string; idempotent?: boolean }; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? "Paper check could not finish.");
      setLatest(payload.result); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Paper check unavailable."); }
    finally { setBusy(false); }
  }

  async function togglePause() {
    if (!signedIn) { router.push("/login"); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/futures/paper", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: !isPaused }) });
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error ?? "Paper control unavailable."); }
      setIsPaused(!isPaused); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Paper control unavailable."); }
    finally { setBusy(false); }
  }

  return <div className="content-wrap inner-page futures-page">
    <header className="futures-hero"><div className="eyebrow"><span className="eyebrow-line"/> TIDELIGHT / FUTURES PAPER DESK</div><h1>Read the market.<br/><span>Rehearse the risk.</span></h1><p>Research US stock perpetuals with a private paper account. An AI proposal follows a completed Bitget candle and your Alpha Factory rule; account limits make the final decision. Every hold, block and simulated fill is recorded.</p><div className="futures-badges"><span>US EQUITIES</span><span>1× PAPER MARGIN</span><span>NO EXCHANGE ORDERS</span></div></header>
    <section className="futures-ledger" aria-label="Separate perpetual paper account"><div className="futures-section-heading"><div className="eyebrow small-eyebrow">SEPARATE $10,000 SANDBOX</div><h2>Capital has a boundary.</h2><button type="button" className="futures-pause" onClick={() => void togglePause()} disabled={busy}>{isPaused ? "Resume new entries" : "Pause new entries"}</button></div><div className="futures-metrics"><article><span>PAPER EQUITY</span><b>{usd(equity)}</b><small>{mark && position ? "Bitget mark estimate" : "Cash plus reserved margin"}</small></article><article><span>AVAILABLE CASH</span><b>{usd(cash)}</b><small>After paper margin and fees</small></article><article><span>RESERVED MARGIN</span><b>{usd(position?.margin ?? 0)}</b><small>One position · $250 maximum</small></article><article><span>OPEN POSITION</span><b>{position ? `${position.direction.toUpperCase()} · ${position.symbol}` : "FLAT"}</b><small>{position ? `Opened ${when(position.opened_at)}` : "Nothing at risk"}</small></article></div>{position ? <div className="futures-position"><div><span>POSITION AT RISK</span><strong>{position.symbol} · {position.direction.toUpperCase()}</strong><p>{Number(position.quantity).toFixed(5)} units at {usd(Number(position.entry_fill))}. {mark ? `Last Bitget mark ${usd(mark)}${markAsOf ? ` · ${when(new Date(markAsOf).toISOString())}` : ""}.` : "Current mark unavailable; equity uses entry value."}</p></div><button type="button" onClick={() => void check("close")} disabled={busy || !mark}>Close paper position</button></div> : null}</section>
    <section className="futures-workbench"><div className="futures-section-heading"><div className="eyebrow small-eyebrow">COMPLETED 4H CANDLE · AI DECISION</div><h2>One considered check.</h2><p>Choose a verified stock perpetual and an inspectable rule. A new entry needs a fresh playbook state change and at least 70% validated AI confidence. You can always review a hold.</p></div><div className="futures-controls"><label>US STOCK PERPETUAL<select value={symbol} onChange={event => setSymbol(event.target.value)} disabled={busy}>{STOCK_PERP_UNIVERSE.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label>ALPHA FACTORY RULE<select value={playbookKey} onChange={event => setPlaybookKey(event.target.value as StrategyKey)} disabled={busy}>{Object.entries(ALPHA_STRATEGIES).map(([key, rule]) => <option key={key} value={key}>{rule.label}</option>)}</select></label><button type="button" onClick={() => void check("check")} disabled={busy}>{busy ? "Checking market…" : "Run paper decision ↗"}</button></div><p className="futures-method">A paper open reserves up to $250 at 1× exposure. Estimated fee: 0.10% per side; adverse slippage: 0.05% per side. Entry pauses after $200 realized daily loss or five fills. A mark crossing 80% adverse margin prompts a paper close on the next check; gaps can exceed that threshold. No funding or exchange liquidation is modeled.</p>{isPaused ? <p className="futures-notice">New paper entries are paused. Existing positions can still be closed.</p> : null}{error ? <p className="futures-error" role="alert">{error}</p> : null}{latest ? <div className="futures-notice" role="status"><b>{latest.outcome.toUpperCase()} · {latest.action?.replaceAll("_", " ") ?? "paper decision"}</b><span>{latest.reason}{latest.idempotent ? " This completed candle was already reviewed." : ""}</span></div> : null}</section>
    <section className="futures-audit"><div className="futures-section-heading"><div className="eyebrow small-eyebrow">PRIVATE DECISION TIMELINE</div><h2>Every action leaves a record.</h2></div>{decisions.length ? <div className="futures-decision-list">{decisions.map(item => <article key={item.id}><div><b>{item.outcome.toUpperCase()} · {item.action.replaceAll("_", " ")}</b><span>{item.symbol} · {when(item.as_of)}</span></div><p>{item.snapshot?.agent?.rationale ?? item.reason}</p><small>{item.reason} · Mark {usd(Number(item.reference_price))}{item.snapshot?.agent?.confidence != null ? ` · AI confidence ${Math.round(item.snapshot.agent.confidence * 100)}%` : ""}</small></article>)}</div> : <p className="futures-empty">No decision has been recorded in this paper account. The first completed-candle check begins its timeline.</p>}<div className="futures-fill-foot"><b>{fills.length} recent paper fills</b><span>Fills are simulations; this desk never sends an exchange order.</span></div></section>
    <p className="futures-footer"><Link href="/strategies">Inspect Alpha Factory validation ↗</Link><Link href="/nightwatch">See Reality spot Nightwatch ↗</Link></p>
  </div>;
}
