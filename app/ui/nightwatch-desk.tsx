"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import MfaChallenge from "@/app/ui/mfa-challenge";

type Asset = { symbol: string; name: string; ticker: string | null; lastPrice: number; change24h: number | null; logoUrl: string | null };
type Run = { id: string; symbol: string; signal: string; outcome: string; reason: string; as_of: string; reference_price: number; fast_sma: number; slow_sma: number; created_at: string };
type Order = { id: string; symbol: string; side: string; quantity: number; simulated_fill_price: number; notional: number; fee: number; realized_pnl: number | null; created_at: string };
type Position = { id: string; symbol: string; quantity: number; average_cost: number; opened_at: string; currentPrice: number | null; name: string; ticker: string | null; logoUrl: string | null };
type Mark = { t: number; c: number };
type NightwatchPreferences = { trigger_mode: "manual" | "every_check"; monitor_symbol: string | null; research_run_id: string | null; alert_on_signal: boolean; alert_on_fill: boolean; daily_summary: boolean };
type Alert = { id: string; kind: "signal" | "fill" | "summary"; title: string; body: string; read_at: string | null; created_at: string };

const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const price = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 7 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
const isUtcToday = (value: string) => new Date(value).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);

function MarketCurve({ marks }: { marks: Mark[] }) {
  if (marks.length < 2) return <div className="nw-curve-empty">Run a check to load the live Bitget candle trace.</div>;
  const values = marks.map((point) => point.c);
  const low = Math.min(...values); const high = Math.max(...values); const range = high - low || Math.max(high * 0.01, 0.000001);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 900},${145 - ((value - low) / range) * 112}`).join(" ");
  const positive = values.at(-1)! >= values[0];
  return <svg className="nw-market-curve" viewBox="0 0 900 190" role="img" aria-label="Completed Bitget four hour candle closes for selected market">
    {[32, 88, 144].map((y) => <line key={y} x1="0" x2="900" y1={y} y2={y} className="nw-gridline" />)}
    <defs><linearGradient id="nightwatch-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={positive ? "#79e6b2" : "#f19b89"} stopOpacity=".24"/><stop offset="1" stopColor={positive ? "#79e6b2" : "#f19b89"} stopOpacity="0"/></linearGradient></defs>
    <polygon points={`0,165 ${points} 900,165`} fill="url(#nightwatch-fill)" />
    <polyline points={points} fill="none" stroke={positive ? "#8ce9ba" : "#efaa92"} strokeWidth="2.7" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    <circle cx="900" cy={145 - ((values.at(-1)! - low) / range) * 112} r="4.5" fill={positive ? "#aaf1cb" : "#f5b6a2"} />
    <text x="0" y="185">{new Date(marks[0].t).toLocaleDateString()}</text><text x="900" y="185" textAnchor="end">{new Date(marks.at(-1)!.t).toLocaleDateString()}</text>
  </svg>;
}

function IssuerMark({ ticker, logoUrl }: { ticker: string | null; logoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  return <span className="nw-issuer-mark">{logoUrl && !failed ? <Image src={logoUrl} alt="" width={30} height={30} unoptimized onError={() => setFailed(true)} /> : <b>{(ticker ?? "R").slice(0, 1)}</b>}</span>;
}

export default function NightwatchDesk({ signedIn, assets, initialRuns, initialOrders, positions, cashBalance, paused, initialHistory, defaultSymbol, initialAlerts, researchRunId = null }: {
  signedIn: boolean; assets: Asset[]; initialRuns: Run[]; initialOrders: Order[]; positions: Position[];
  cashBalance: number; paused: boolean; initialHistory: Mark[]; defaultSymbol: string; initialAlerts: Alert[];
  researchRunId?: string | null;
}) {
  const router = useRouter();
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [history, setHistory] = useState(initialHistory);
  const [localRun, setLocalRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const [changing, setChanging] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(paused);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"decisions" | "orders">("decisions");
  const [preferences, setPreferences] = useState<NightwatchPreferences>({ trigger_mode: "manual", monitor_symbol: null, research_run_id: null, alert_on_signal: true, alert_on_fill: true, daily_summary: true });
  const [schedulerAvailable, setSchedulerAvailable] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const selected = assets.find((asset) => asset.symbol === symbol);
  const allRuns = localRun ? [localRun, ...initialRuns.filter((run) => run.id !== localRun.id)] : initialRuns;
  const marketChange = selected?.change24h;
  const positionsValue = useMemo(() => positions.reduce((sum, item) => sum + item.quantity * (item.currentPrice ?? item.average_cost), 0), [positions]);
  const equity = cashBalance + positionsValue;
  const realizedToday = initialOrders.filter((order) => isUtcToday(order.created_at)).reduce((sum, order) => sum + (order.realized_pnl ?? 0), 0);

  useEffect(() => { if (signedIn) void fetch("/api/nightwatch/preferences").then((response) => response.ok ? response.json() : null).then((data: (NightwatchPreferences & { scheduler_available?: boolean }) | null) => { if (data) { setPreferences(data); setSchedulerAvailable(Boolean(data.scheduler_available)); } }).catch(() => undefined); }, [signedIn]);

  async function savePreferences(next: Partial<NightwatchPreferences>) {
    if (!signedIn) { router.push("/login"); return; }
    const updated = { ...preferences, ...next }; setPreferences(updated); setSavingPreferences(true);
    try { const response = await fetch("/api/nightwatch/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) }); if (!response.ok) { const payload = await response.json() as { error?: string }; setPreferences(preferences); setError(payload.error ?? "Could not save Nightwatch preferences."); } }
    catch { setPreferences(preferences); setError("Could not save Nightwatch preferences."); }
    finally { setSavingPreferences(false); }
  }

  async function markAlertRead(id?: string) {
    if (!signedIn) { router.push("/login"); return; }
    const response = await fetch("/api/nightwatch/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) });
    if (response.ok) setAlerts((items) => items.map((item) => id && item.id !== id ? item : { ...item, read_at: new Date().toISOString() }));
  }

  async function generateSummary() {
    if (!signedIn) { router.push("/login"); return; }
    setSummaryBusy(true);
    try {
      const response = await fetch("/api/nightwatch/summary", { method: "POST" });
      const payload = await response.json() as { alert?: Alert; error?: string };
      if (response.ok && payload.alert) setAlerts((items) => [payload.alert!, ...items.filter((item) => item.kind !== "summary")]);
      else setError(payload.error ?? "Could not generate the daily summary.");
    } finally { setSummaryBusy(false); }
  }

  async function runCheck() {
    if (!signedIn) { router.push("/login"); return; }
    setRunning(true); setError(""); setNotice(""); setLocalRun(null);
    try {
      const response = await fetch("/api/nightwatch/tick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, researchRunId }) });
      const payload = await response.json() as { error?: string; signal?: string; fastSma?: number; slowSma?: number; asOf?: string; price?: number; history?: Mark[]; result?: { run_id: string; outcome: string; reason: string } };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? "Market check could not complete.");
      setHistory(payload.history ?? []);
      setLocalRun({ id: payload.result.run_id, symbol, signal: payload.signal ?? "hold", outcome: payload.result.outcome, reason: payload.result.reason, as_of: payload.asOf ?? new Date().toISOString(), reference_price: payload.price ?? selected?.lastPrice ?? 0, fast_sma: payload.fastSma ?? 0, slow_sma: payload.slowSma ?? 0, created_at: new Date().toISOString() });
      setNotice(payload.result.outcome === "executed" ? "Decision accepted and recorded in your paper ledger." : "Market snapshot checked and decision recorded.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nightwatch is temporarily unavailable."); }
    finally { setRunning(false); }
  }

  async function togglePause() {
    if (!signedIn) { router.push("/login"); return; }
    setChanging(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/nightwatch/control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: !isPaused }) });
      const payload = await response.json() as { paused?: boolean; error?: string; code?: string };
      if (payload.code === "mfa_required") { setMfaRequired(true); setChanging(false); return; }
      if (!response.ok || typeof payload.paused !== "boolean") throw new Error(payload.error ?? "Could not update the agent state.");
      setIsPaused(payload.paused); setNotice(payload.paused ? "Paper agent paused. Checks will be recorded without fills." : "Paper agent resumed."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update agent state."); }
    finally { setChanging(false); }
  }

  async function closePosition(position: Position) {
    if (!signedIn) { router.push("/login"); return; }
    setClosing(position.symbol); setError(""); setNotice("");
    try {
      const response = await fetch("/api/nightwatch/close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: position.symbol, reason: "Manual paper exit from Nightwatch" }) });
      const payload = await response.json() as { error?: string; code?: string };
      if (payload.code === "mfa_required") { setMfaRequired(true); setClosing(null); return; }
      if (!response.ok) throw new Error(payload.error ?? "Could not close the paper position.");
      setNotice("Paper position closed and realized P&L recorded."); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not close the paper position."); }
    finally { setClosing(null); }
  }

  return <div className="content-wrap inner-page nightwatch-page">
    {mfaRequired ? <MfaChallenge onVerified={() => { setMfaRequired(false); setNotice("Authenticator verified. Retry the control you were changing."); }} /> : null}
    <section className="nw-hero">
      <div className="nw-hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> TRACK 03 · AGENT HUB · PAPER EXECUTION</div>
        <h1>Watch the tide.<br/><span>Keep your hands steady.</span></h1>
        <p>A transparent research agent for Bitget Reality markets. It reads completed candles, explains each decision, and simulates bounded orders against a private ledger.</p>
        <div className="nw-hero-pills"><span><i className="nw-pulse"/> {isPaused ? "AGENT PAUSED" : "PAPER SYSTEM READY"}</span><span>NO LIVE ORDERS</span><span>PUBLIC BITGET DATA</span></div>
      </div>
      <div className="nw-orbit" aria-hidden="true"><div className="nw-orbit-ring ring-a"/><div className="nw-orbit-ring ring-b"/><div className="nw-orbit-core">N<span>W</span></div><div className="nw-orbit-chip chip-one">SMA 20 <b>↑</b></div><div className="nw-orbit-chip chip-two">RISK <b>ON</b></div><div className="nw-orbit-chip chip-three">4H <b>LIVE</b></div></div>
      <div className="nw-hero-coast" aria-hidden="true"/>
    </section>

    <section className="nw-command-bar"><div className="nw-status-line"><span className={`nw-state-dot${isPaused ? " paused" : ""}`}/><div><b>{isPaused ? "Agent is paused" : "Paper agent is standing by"}</b><small>{signedIn ? "Private to your account · account-backed audit" : "Sign in to create your private paper account"}</small></div></div><div className="nw-command-actions"><button type="button" className="nw-secondary-button" onClick={() => void togglePause()} disabled={changing}>{changing ? "Updating…" : isPaused ? "Resume agent" : "Pause agent"}</button><Link href="/strategies" className="nw-inline-link">Strategy lab <span>↗</span></Link></div></section>
    <section className="nw-preferences"><div><span className="eyebrow small-eyebrow">CONTROL SURFACE</span><h2>Choose how Nightwatch speaks.</h2><p>Run checks manually or opt in to one scheduled daily Reality market check. Pausing the paper agent skips scheduled checks; every fill remains simulated and guardrail-bound.</p></div><div className="nw-preference-controls"><div className="nw-cadence-note"><span>CHECK CADENCE</span><b>{preferences.trigger_mode === "every_check" ? `Scheduled · ${preferences.monitor_symbol}` : "Manual · completed 4H candle"}</b></div><label className="nw-schedule-control"><input type="checkbox" checked={preferences.trigger_mode === "every_check"} onChange={(event) => void savePreferences({ trigger_mode: event.target.checked ? "every_check" : "manual", monitor_symbol: event.target.checked ? (preferences.monitor_symbol ?? symbol) : preferences.monitor_symbol, research_run_id: event.target.checked ? researchRunId : preferences.research_run_id })} disabled={!signedIn || savingPreferences || !schedulerAvailable}/> Schedule one daily check</label><label className="nw-monitor-select">SCHEDULED REALITY MARKET<select value={preferences.monitor_symbol ?? symbol} onChange={(event) => void savePreferences({ monitor_symbol: event.target.value, trigger_mode: preferences.trigger_mode })} disabled={!signedIn || savingPreferences || !schedulerAvailable}>{assets.map((asset) => <option key={asset.symbol} value={asset.symbol}>{asset.name} · {asset.symbol}</option>)}</select></label>{!schedulerAvailable ? <small className="nw-scheduler-setup">Scheduler setup required on this deployment. Manual checks and daily summaries remain available.</small> : <small className="nw-scheduler-setup">Scheduled for 09:00 UTC daily; Hobby may start it any time during that hour. One market per account. Uses completed candles, skips while paused, and never sends exchange orders.</small>}{preferences.research_run_id ? <small className="nw-scheduler-setup">Linked research note {preferences.research_run_id.slice(0, 8).toUpperCase()} follows this schedule.</small> : null}<label><input type="checkbox" checked={preferences.alert_on_signal} onChange={(event) => void savePreferences({ alert_on_signal: event.target.checked })} disabled={!signedIn || savingPreferences}/> Signal alerts</label><label><input type="checkbox" checked={preferences.alert_on_fill} onChange={(event) => void savePreferences({ alert_on_fill: event.target.checked })} disabled={!signedIn || savingPreferences}/> Paper-fill alerts</label><label><input type="checkbox" checked={preferences.daily_summary} onChange={(event) => void savePreferences({ daily_summary: event.target.checked })} disabled={!signedIn || savingPreferences}/> Daily summary</label><button type="button" className="nw-summary-button" onClick={() => void generateSummary()} disabled={!signedIn || summaryBusy}>{summaryBusy ? "Building summary…" : "Generate today's summary"}</button></div></section>

    {error ? <div className="strategy-error" role="alert">{error}</div> : null}{notice ? <div className="nw-notice" role="status"><span>✓</span>{notice}</div> : null}

    <section className="nw-kpi-grid" aria-label="Paper portfolio summary">
      <article className="nw-kpi nw-kpi-primary"><span>PAPER EQUITY</span><b>{usd(equity)}</b><small>Cash + current tokenized equity marks</small><i>◌</i></article>
      <article className="nw-kpi"><span>AVAILABLE CASH</span><b>{usd(cashBalance)}</b><small>Starting balance {usd(10000)}</small><i>$</i></article>
      <article className="nw-kpi"><span>OPEN EXPOSURE</span><b>{usd(positionsValue)}</b><small>{positions.length} active paper {positions.length === 1 ? "position" : "positions"}</small><i>⌁</i></article>
      <article className="nw-kpi"><span>REALIZED TODAY</span><b className={realizedToday < 0 ? "nw-negative" : ""}>{usd(realizedToday)}</b><small>Daily stop at −$200 · UTC day</small><i>↗</i></article>
    </section>

    <div className="nw-main-grid">
      <section className="nw-panel nw-market-panel">
        <div className="nw-panel-head"><div><span className="eyebrow small-eyebrow">MARKET WATCH · BITGET REALITY</span><h2>One clean signal at a time.</h2></div><span className="nw-source-badge"><i/> 4H CANDLES</span></div>
        <div className="nw-market-select-row"><label htmlFor="nw-symbol">MONITOR A TOKENIZED EQUITY</label><select id="nw-symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} disabled={!assets.length}>{assets.map((asset) => <option value={asset.symbol} key={asset.symbol}>{asset.name} · {asset.symbol}</option>)}</select>
          <div className="nw-current-price"><span>{selected?.ticker ?? "MARKET"}</span><b>{selected ? price(selected.lastPrice) : "—"}</b><small className={(marketChange ?? 0) >= 0 ? "positive" : "negative"}>{marketChange == null ? "change unavailable" : `${marketChange >= 0 ? "+" : ""}${(marketChange * 100).toFixed(2)}% today`}</small></div>
        </div>
        <div className="nw-chart-wrap"><div className="nw-chart-label"><span>COMPLETED CANDLE CLOSES</span><span>LAST 90 · 4H</span></div><MarketCurve marks={history}/></div>
        <div className="nw-rules-strip"><div><span>ENTRY</span><b>20 SMA crosses above 50</b></div><div><span>EXIT</span><b>20 SMA crosses below 50</b></div><div><span>MARKET GATE</span><b>Reality token only</b></div></div>
        <button className="nw-run-button" type="button" onClick={() => void runCheck()} disabled={running || !assets.length}>{running ? <><span className="strategy-spinner"/> Reading Bitget candles…</> : <>Run completed-candle check <span>↗</span></>}</button>
        <p className="nw-run-caption">Uses the last completed 4-hour bar. Re-running the same bar is idempotent.</p>
      </section>

      <section className="nw-panel nw-risk-panel">
        <div className="nw-panel-head"><div><span className="eyebrow small-eyebrow">GUARDRAILS · ALWAYS ON</span><h2>Risk comes first.</h2></div><div className="nw-shield">⌑</div></div>
        <div className="nw-risk-summary"><div className="nw-risk-emblem"><span>✓</span></div><div><b>Five hard checks</b><small>Evaluated atomically before every fill</small></div><span className="nw-risk-on">ACTIVE</span></div>
        <ul className="nw-risk-list"><li><span>01</span><b>Asset eligibility</b><small>Verified Bitget Reality instrument</small><i>✓</i></li><li><span>02</span><b>Feed freshness</b><small>Completed candle less than 6 hours old</small><i>✓</i></li><li><span>03</span><b>Position sizing</b><small>Maximum $500 per entry · long only</small><i>✓</i></li><li><span>04</span><b>Daily circuit breaker</b><small>$200 realized loss or 5 fills per day</small><i>✓</i></li><li><span>05</span><b>Pause + duplicate lock</b><small>Owner control · one decision per candle</small><i>✓</i></li></ul>
        <div className="nw-cost-note"><span>SIMULATED COSTS</span><b>0.10% fee <i>+</i> 0.05% slippage per side</b></div>
      </section>
    </div>

    <section className="nw-panel nw-positions-panel"><div className="nw-panel-head"><div><span className="eyebrow small-eyebrow">PRIVATE PAPER BOOK</span><h2>Open positions <span className="nw-count">{positions.length}</span></h2></div><span className="nw-account-tag">{signedIn ? "YOUR ACCOUNT · $10,000 START" : "PREVIEW MODE"}</span></div>
      {positions.length ? <div className="nw-position-table"><div className="nw-table-head"><span>MARKET</span><span>SIZE</span><span>AVERAGE COST</span><span>LAST MARK</span><span>OPEN P&L*</span><span>ACTION</span></div>{positions.map((item) => { const mark = item.currentPrice ?? item.average_cost; const pnl = (mark - item.average_cost) * item.quantity; return <div className="nw-position-row" key={item.id}><span className="nw-position-market"><IssuerMark ticker={item.ticker} logoUrl={item.logoUrl}/><span><b>{item.ticker ?? item.symbol.replace("USDT", "")}</b><small>{item.name} · {item.symbol}</small></span></span><b>{item.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</b><b>{price(item.average_cost)}</b><b>{price(mark)}</b><b className={pnl >= 0 ? "positive" : "negative"}>{pnl >= 0 ? "+" : ""}{usd(pnl)}</b><button type="button" className="nw-close-position" onClick={() => void closePosition(item)} disabled={closing === item.symbol}>{closing === item.symbol ? "Closing…" : "Close paper"}</button></div>; })}</div> : <div className="nw-empty-book"><span>⌁</span><div><b>Nothing at risk. That’s a position too.</b><small>Nightwatch will only open a simulated position after a fresh golden cross passes every guardrail.</small></div></div>}
      <p className="nw-footnote">* Open P&amp;L is an estimate before exit fees/slippage. Open positions are marked with the latest public Bitget quote.</p>
    </section>

    <section className="nw-panel nw-alerts-panel"><div className="nw-panel-head"><div><span className="eyebrow small-eyebrow">ALERT STREAM · PRIVATE</span><h2>What changed while you were away.</h2></div><div className="nw-alert-actions"><span className="nw-count">{alerts.filter((alert) => !alert.read_at).length} unread</span>{alerts.some((alert) => !alert.read_at) ? <button type="button" onClick={() => void markAlertRead()} disabled={!signedIn}>Mark all read</button> : null}</div></div>
      {alerts.length ? <div className="nw-alert-list">{alerts.slice(0, 8).map((alert) => <article className={`nw-alert ${alert.kind}${alert.read_at ? " read" : ""}`} key={alert.id}><span>{alert.kind === "fill" ? "↗" : alert.kind === "summary" ? "≋" : "!"}</span><div><b>{alert.title}</b><p>{alert.body}</p><small>{date(alert.created_at)}{alert.read_at ? " · read" : " · new"}</small></div>{!alert.read_at ? <button type="button" aria-label={`Mark ${alert.title} as read`} onClick={() => void markAlertRead(alert.id)} disabled={!signedIn}>✓</button> : null}</article>)}</div> : <div className="nw-empty-activity"><span>!</span><div><b>No alerts yet.</b><small>Signal and paper-fill alerts will appear here after a completed-candle check.</small></div></div>}
    </section>

    <section className="nw-panel nw-activity-panel"><div className="nw-panel-head"><div><span className="eyebrow small-eyebrow">THE AUDIT TRAIL · PRIVATE & APPEND-ONLY</span><h2>Every signal has a reason.</h2></div><div className="nw-tabs"><button type="button" className={view === "decisions" ? "active" : ""} onClick={() => setView("decisions")}>Decisions <span>{allRuns.length}</span></button><button type="button" className={view === "orders" ? "active" : ""} onClick={() => setView("orders")}>Paper fills <span>{initialOrders.length}</span></button></div></div>
      {view === "decisions" ? allRuns.length ? <div className="nw-event-list">{allRuns.slice(0, 12).map((run) => <article className="nw-event" key={run.id}><span className={`nw-event-icon ${run.outcome}`}>{run.outcome === "executed" ? "↗" : run.outcome === "rejected" ? "⊘" : "·"}</span><div className="nw-event-copy"><div><b>{run.signal.toUpperCase()} · {run.symbol}</b><span className={`nw-outcome ${run.outcome}`}>{run.outcome.replace("_", " ")}</span></div><p>{run.reason}</p><small>{date(run.as_of)} · reference {price(Number(run.reference_price))}</small></div><span className="nw-event-sma">20 / 50<br/><b>{Number(run.fast_sma).toPrecision(5)} / {Number(run.slow_sma).toPrecision(5)}</b></span></article>)}</div> : <div className="nw-empty-activity"><span>◎</span><div><b>The audit ledger is ready.</b><small>Run a completed-candle check to record the first decision and its market snapshot.</small></div></div>
      : initialOrders.length ? <div className="nw-event-list">{initialOrders.slice(0, 12).map((order) => <article className="nw-event" key={order.id}><span className={`nw-event-icon ${order.side}`}>{order.side === "buy" ? "↗" : "↙"}</span><div className="nw-event-copy"><div><b>PAPER {order.side.toUpperCase()} · {order.symbol}</b><span className="nw-outcome executed">filled</span></div><p>{Number(order.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })} units at {price(Number(order.simulated_fill_price))} · {usd(Number(order.notional))} notional · {usd(Number(order.fee))} fee</p><small>{date(order.created_at)} · no exchange order was sent</small></div>{order.realized_pnl != null ? <b className={`nw-order-pnl ${order.realized_pnl >= 0 ? "positive" : "negative"}`}>{usd(Number(order.realized_pnl))}</b> : <span className="nw-open-label">POSITION OPEN</span>}</article>)}</div> : <div className="nw-empty-activity"><span>◌</span><div><b>No paper fills yet.</b><small>HOLD or blocked decisions appear in the Decisions tab. Only passing crossover orders are listed here.</small></div></div>}
    </section>

    <section className="nw-method-footer"><div><span className="eyebrow small-eyebrow">METHOD CARD · NIGHTWATCH SMA 20/50 V1</span><p>Signals compare two consecutive completed Bitget 4-hour candles. Entry/exit is simulated at the close that confirms the crossover. Each fill applies estimated fee and adverse slippage. The $10,000 sandbox, $500 entry cap, $200 daily realized-loss circuit breaker and five-fill limit are enforced in the database transaction.</p></div><div className="nw-method-actions"><Link href="/strategies">Inspect historical backtest <span>↗</span></Link><Link href="/markets">Explore Reality listings <span>↗</span></Link></div></section>
    <div className="route-footnote nw-disclaimer"><span>i</span> This is a research simulation. It does not place exchange orders, hold assets, or predict future returns. Tokenized assets may have distinct market hours, liquidity and issuer terms.</div>
    {!signedIn ? <div className="sign-in-panel strategy-signin"><div className="empty-glyph">◉</div><div><span className="eyebrow small-eyebrow">MAKE THE PAPER BOOK YOURS</span><h2>Sign in to save a private audit and paper ledger.</h2><p>The market view is public. Account controls and run history are private to your sign-in.</p><Link className="primary-link" href="/login">Sign in <span>↗</span></Link></div></div> : null}
  </div>;
}
