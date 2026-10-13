"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ALPHA_STRATEGIES, BACKTEST_STRATEGY, type StrategyKey } from "@/lib/backtest";
import { STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";
import PnlShareCard from "@/app/ui/pnl-share-card";
import ChartShareButton from "@/app/ui/chart-share-button";

type PaperPosition = { symbol: string; direction: "long" | "short"; quantity: number; entry_fill: number; margin: number; entry_fee: number; opened_at: string };
type Decision = { id: string; symbol: string; as_of: string; action: string; outcome: string; reason: string; reference_price: number; realized_pnl: number; created_at: string; snapshot?: { agent?: { rationale?: string; confidence?: number; evidence?: string[]; risks?: string[]; invalidation?: string } } };
type Fill = { id: string; symbol: string; action: string; direction: string; quantity: number; fill_price: number; notional: number; fee: number; realized_pnl: number; created_at: string };
type FuturesCandle = { timestamp: number; open: number; high: number; low: number; close: number; volume: number | null };
type FuturesMarketView = { lastPrice: number; providerTimestamp: number | null; candles: FuturesCandle[] };
const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const when = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

function FuturesMarketChart({ candles, symbol, fills, position }: { candles: FuturesCandle[]; symbol: string; fills: Fill[]; position: PaperPosition | null }) {
  if (candles.length < 2) return <div className="futures-chart-empty">Completed Bitget candles are not available yet.</div>;
  const visible = candles.slice(-54), low = Math.min(...visible.map((item) => item.low)), high = Math.max(...visible.map((item) => item.high));
  const span = high - low || Math.max(high * .002, .000001);
  const points = visible.map((item, index) => `${(index / (visible.length - 1)) * 100},${79 - ((item.close - low) / span) * 62}`).join(" ");
  const startAt = visible[0].timestamp, endAt = visible.at(-1)!.timestamp;
  const markerSource = fills.filter((fill) => fill.symbol === symbol && fill.created_at && fill.fill_price > 0).map((fill) => ({ side: fill.action === "open_long" || (fill.action === "close" && fill.direction === "short") ? "B" as const : "S" as const, timestamp: new Date(fill.created_at).getTime(), price: fill.fill_price, title: `${fill.action.replaceAll("_", " ")} · ${when(fill.created_at)} · ${usd(fill.fill_price)}` }));
  if (position?.symbol === symbol && !markerSource.some((marker) => marker.timestamp === new Date(position.opened_at).getTime())) markerSource.push({ side: position.direction === "long" ? "B" : "S", timestamp: new Date(position.opened_at).getTime(), price: position.entry_fill, title: `Open ${position.direction} · ${when(position.opened_at)} · ${usd(position.entry_fill)}` });
  const markers = markerSource.filter((marker) => marker.timestamp >= startAt && marker.timestamp <= endAt).map((marker) => {
    const index = visible.reduce((best, candle, i) => Math.abs(candle.timestamp - marker.timestamp) < Math.abs(visible[best].timestamp - marker.timestamp) ? i : best, 0);
    return { ...marker, x: (index / (visible.length - 1)) * 100, y: 79 - ((marker.price - low) / span) * 62 };
  });
  return <div className="futures-chart-frame">
    <svg className="futures-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${symbol} Bitget USDT perpetual completed four-hour closing prices with trade entries and exits`}>
      <defs><linearGradient id="futures-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--brand-teal)" stopOpacity=".22"/><stop offset="1" stopColor="var(--brand-teal)" stopOpacity="0"/></linearGradient></defs>
      {[18, 45, 72].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} className="futures-chart-grid"/>)}
      <text x="50" y="56" textAnchor="middle" className="futures-chart-watermark">TIDELIGHT — BITGET</text>
      <path d={`M ${points.replaceAll(" ", " L ")} L 100 100 L 0 100 Z`} fill="url(#futures-chart-fill)"/>
      <polyline points={points} className="futures-chart-line"/>
      <circle cx="100" cy={79 - ((visible.at(-1)!.close - low) / span) * 62} r="1.4" className="futures-chart-last"/>
      {markers.map((marker,index) => <g key={`${marker.timestamp}-${index}`} transform={`translate(${marker.x} ${Math.max(7,Math.min(92,marker.y + (index%2 ? 7 : -7)))})`} className={marker.side === "B" ? "futures-trade-marker buy" : "futures-trade-marker sell"}><title>{marker.title}</title><rect x="-4" y="-4" width="8" height="8" rx="2"/><text textAnchor="middle" dominantBaseline="central">{marker.side}</text></g>)}
    </svg>
  </div>;
}

export default function FuturesPaperDesk({ signedIn, initialSymbol, researchRunId, cash, paused, position, mark, markAsOf, decisions, fills }: {
  signedIn: boolean; initialSymbol?: string; researchRunId?: string; cash: number; paused: boolean; position: PaperPosition | null; mark: number | null; markAsOf: number | null; decisions: Decision[]; fills: Fill[];
}) {
  const router = useRouter();
  const [symbol, setSymbol] = useState<string>(initialSymbol ?? position?.symbol ?? "NVDAUSDT");
  const [playbookKey, setPlaybookKey] = useState<StrategyKey>(BACKTEST_STRATEGY);
  const [busy, setBusy] = useState(false);
  const [isPaused, setIsPaused] = useState(paused);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<{ action?: string; outcome: string; reason: string; idempotent?: boolean } | null>(null);
  const [visibleDecisions, setVisibleDecisions] = useState(5);
  const [visibleFills, setVisibleFills] = useState(5);
  const [marketView, setMarketView] = useState<FuturesMarketView | null>(null);
  const [marketViewSymbol, setMarketViewSymbol] = useState("");
  const [marketViewError, setMarketViewError] = useState("");
  const exposure = position ? position.margin + (mark ? Number(position.quantity) * (mark - Number(position.entry_fill)) * (position.direction === "long" ? 1 : -1) : 0) : 0;
  const equity = cash + exposure;
  const visibleMarketView = marketViewSymbol === symbol ? marketView : null;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(`/api/futures/candles?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as FuturesMarketView & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Market view unavailable.");
        if (active) { setMarketView(payload); setMarketViewSymbol(symbol); setMarketViewError(""); }
      } catch (cause) {
        if (active && !(cause instanceof DOMException && cause.name === "AbortError")) setMarketViewError(cause instanceof Error ? cause.message : "Market view unavailable.");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [symbol]);

  async function check(mode: "check" | "close") {
    if (!signedIn) { router.push("/login"); return; }
    setBusy(true); setError(""); setLatest(null);
    try {
      const response = await fetch("/api/futures/paper", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: mode === "close" ? position?.symbol : symbol, playbookKey, mode, researchRunId: mode === "check" ? researchRunId : undefined }) });
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
    <header className="futures-hero"><div className="futures-hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> TIDELIGHT / FUTURES PAPER DESK</div><h1>Read the market.<br/><span>Rehearse the risk.</span></h1><p>A private simulator for practicing US stock perpetual strategies. Each check reviews one completed 4-hour Bitget candle against an Alpha Factory rule. Tidelight records the reasoning and enforces paper account limits; it never sends an exchange order.</p><div className="futures-badges"><span>US EQUITIES</span><span>1× PAPER MARGIN</span><span>NO EXCHANGE ORDERS</span></div><div className="futures-hero-actions"><Link href="/trading">Open eligible Bitget spot trading <span>↗</span></Link><Link href="/markets">Explore Reality markets <span>↗</span></Link></div></div><div className="futures-hero-art" aria-hidden="true"><svg viewBox="0 0 280 280" role="presentation"><defs><linearGradient id="futures-orbit" x1="0" y1="1" x2="1" y2="0"><stop stopColor="var(--brand-teal)" stopOpacity=".2"/><stop offset="1" stopColor="var(--brand-aqua)" stopOpacity=".82"/></linearGradient><linearGradient id="futures-signal" x1="0" y1="1" x2="1" y2="0"><stop stopColor="var(--brand-teal)"/><stop offset="1" stopColor="var(--brand-aqua)"/></linearGradient></defs><circle cx="140" cy="140" r="106" fill="none" stroke="url(#futures-orbit)"/><circle cx="140" cy="140" r="81" fill="none" stroke="var(--line)" strokeDasharray="3 7"/><circle cx="140" cy="140" r="56" fill="color-mix(in srgb,var(--panel) 82%,transparent)" stroke="color-mix(in srgb,var(--brand-teal) 42%,var(--line))"/><path d="M39 173c27 1 34-30 57-29 18 1 19 22 38 16 16-5 23-42 42-42 17 0 17 20 34 13 9-4 17-13 28-19" fill="none" stroke="url(#futures-signal)" strokeWidth="3" strokeLinecap="round"/><g stroke="var(--brand-teal)" strokeWidth="3" strokeLinecap="round"><path d="M68 124v38m-8-25h16m28-33v48m-8-30h16m28-14v37m-8-20h16m28-41v35m-8-23h16m28-8v39m-8-24h16"/></g><circle cx="215" cy="112" r="5" fill="var(--brand-aqua)"/><circle cx="140" cy="140" r="3" fill="var(--brand-teal)"/><text x="140" y="136" textAnchor="middle" fill="var(--text)" fontSize="19" fontFamily="var(--display)" fontWeight="600">4H</text><text x="140" y="156" textAnchor="middle" fill="var(--muted)" fontSize="7" fontFamily="var(--mono)" letterSpacing="1.4">SIGNAL / RISK</text></svg><span className="futures-art-tag tag-candle">COMPLETED CANDLE</span><span className="futures-art-tag tag-rule">RULE CHECK</span><span className="futures-art-tag tag-limit">PAPER LIMIT</span></div></header>
    <section className="futures-use-cases" aria-label="How to use the futures paper desk"><div className="futures-use-heading"><span className="eyebrow small-eyebrow">A RESEARCH SIMULATOR, NOT A BROKER</span><h2>Three ways to use the desk.</h2></div><div className="futures-use-grid"><article><span>01 / REHEARSE</span><b>Practice a thesis without live funds.</b><p>Review how a rule treats a completed candle and inspect its reasons before considering any real order elsewhere.</p></article><article><span>02 / COMPARE</span><b>See where a rule holds or acts.</b><p>Switch among supported stock perpetuals and keep each decision attached to its market snapshot and selected playbook.</p></article><article><span>03 / LEARN</span><b>Study risk controls in context.</b><p>Track simulated equity, reserved margin, paper fills, daily loss limits, and the conditions that block new entries.</p></article></div></section>
    <section className="futures-ledger" aria-label="Separate perpetual paper account"><div className="futures-section-heading"><div className="eyebrow small-eyebrow">SEPARATE $10,000 SANDBOX</div><h2>Capital has a boundary.</h2><button type="button" className="futures-pause" onClick={() => void togglePause()} disabled={busy}>{isPaused ? "Resume new entries" : "Pause new entries"}</button></div><div className="futures-metrics"><article><span>PAPER EQUITY</span><b>{usd(equity)}</b><small>{mark && position ? "Bitget mark estimate" : "Cash plus reserved margin"}</small></article><article><span>AVAILABLE CASH</span><b>{usd(cash)}</b><small>After paper margin and fees</small></article><article><span>RESERVED MARGIN</span><b>{usd(position?.margin ?? 0)}</b><small>One position · $250 maximum</small></article><article><span>OPEN POSITION</span><b>{position ? `${position.direction.toUpperCase()} · ${position.symbol}` : "FLAT"}</b><small>{position ? `Opened ${when(position.opened_at)}` : "Nothing at risk"}</small></article></div>{position ? <div className="futures-position"><div><span>POSITION AT RISK</span><strong>{position.symbol} · {position.direction.toUpperCase()}</strong><p>{Number(position.quantity).toFixed(5)} units at {usd(Number(position.entry_fill))}. {mark ? `Last Bitget mark ${usd(mark)}${markAsOf ? ` · ${when(new Date(markAsOf).toISOString())}` : ""}.` : "Current mark unavailable; equity uses entry value."}</p></div><div className="futures-position-actions"><PnlShareCard details={{ ticker: position.symbol.replace("USDT", ""), symbol: position.symbol, direction: position.direction.toUpperCase() as "LONG" | "SHORT", status: "OPEN", pnl: mark == null ? null : Number(position.quantity) * (mark - Number(position.entry_fill)) * (position.direction === "long" ? 1 : -1) - Number(position.entry_fee), pnlPercent: mark == null ? null : ((Number(position.quantity) * (mark - Number(position.entry_fill)) * (position.direction === "long" ? 1 : -1) - Number(position.entry_fee)) / Number(position.margin)) * 100, quantity: Number(position.quantity), entryPrice: Number(position.entry_fill), referencePrice: mark, referenceLabel: "LAST MARK", timestamp: position.opened_at, desk: "FUTURES PAPER DESK" }}/><button type="button" onClick={() => void check("close")} disabled={busy || !mark}>Close paper position</button></div></div> : null}</section>
    <section className="futures-workbench"><div className="futures-section-heading"><div className="eyebrow small-eyebrow">COMPLETED 4H CANDLE · AI DECISION</div><h2>One considered check.</h2><p>Choose a verified stock perpetual and an inspectable rule. A new entry needs a fresh playbook state change and at least 70% validated AI confidence. You can always review a hold.</p></div>
      <section className="futures-market-view" aria-label={`${symbol} Bitget futures market view`}><div className="futures-market-view-head"><div><span className="eyebrow small-eyebrow">BITGET · USDT FUTURES</span><b>{symbol}</b></div><div className="futures-market-actions">{visibleMarketView ? <ChartShareButton symbol={symbol} interval="4H" market="BITGET USDT FUTURES" candles={visibleMarketView.candles} markers={fills.filter(fill => fill.symbol === symbol).map(fill => ({ side: fill.action === "open_long" || (fill.action === "close" && fill.direction === "short") ? "B" as const : "S" as const, timestamp: new Date(fill.created_at).getTime(), price: fill.fill_price }))} /> : null}<div><strong>{visibleMarketView ? usd(visibleMarketView.lastPrice) : "—"}</strong><small>{visibleMarketView?.providerTimestamp ? `Quote ${when(new Date(visibleMarketView.providerTimestamp).toISOString())}` : marketViewError || "Loading verified quote…"}</small></div></div></div>{visibleMarketView ? <FuturesMarketChart candles={visibleMarketView.candles} symbol={symbol} fills={fills} position={position}/> : <div className="futures-chart-empty" role="status">{marketViewError || "Loading completed Bitget candles…"}</div>}<div className="futures-market-view-foot"><span>Completed 4H closes · {visibleMarketView?.candles.length ?? 0} bars</span><span>TIDELIGHT — BITGET</span></div></section>
      <div className="futures-controls"><label>US STOCK PERPETUAL<select value={symbol} onChange={event => setSymbol(event.target.value)} disabled={busy}>{STOCK_PERP_UNIVERSE.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label>ALPHA FACTORY RULE<select value={playbookKey} onChange={event => setPlaybookKey(event.target.value as StrategyKey)} disabled={busy}>{Object.entries(ALPHA_STRATEGIES).map(([key, rule]) => <option key={key} value={key}>{rule.label}</option>)}</select></label><button type="button" onClick={() => void check("check")} disabled={busy}>{busy ? "Checking market…" : <>Run paper decision <span className="futures-arrow" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 10 10 2M3 2h7v7"/></svg></span></>}</button></div><p className="futures-method">A paper open reserves up to $250 at 1× exposure. Estimated fee: 0.10% per side; adverse slippage: 0.05% per side. Entry pauses after $200 realized daily loss or five fills. A mark crossing 80% adverse margin prompts a paper close on the next check; gaps can exceed that threshold. No funding or exchange liquidation is modeled.</p><div className="futures-live-boundary"><b>Trading boundary</b><span>Leveraged stock perpetuals remain paper-only in this desk. Live orders are supported separately for eligible Bitget Reality spot tokens in the <Link href="/trading">Trading desk</Link>; leverage, margin and liquidation are not available there.</span></div>{isPaused ? <p className="futures-notice">New paper entries are paused. Existing positions can still be closed.</p> : null}{error ? <p className="futures-error" role="alert">{error}</p> : null}{latest ? <div className="futures-notice" role="status"><b>{latest.outcome.toUpperCase()} · {latest.action?.replaceAll("_", " ") ?? "paper decision"}</b><span>{latest.reason}{latest.idempotent ? " This completed candle was already reviewed." : ""}</span></div> : null}</section>
    <section className="futures-audit"><div className="futures-section-heading"><div className="eyebrow small-eyebrow">PRIVATE DECISION TIMELINE</div><h2>Every action leaves a record.</h2></div>{decisions.length ? <div className="futures-decision-list">{decisions.slice(0,visibleDecisions).map(item => <article key={item.id}><div><b>{item.outcome.toUpperCase()} · {item.action.replaceAll("_", " ")}</b><span>{item.symbol} · {when(item.as_of)}</span></div><p>{item.snapshot?.agent?.rationale ?? item.reason}</p><small>{item.reason} · Mark {usd(Number(item.reference_price))}{item.snapshot?.agent?.confidence != null ? ` · AI confidence ${Math.round(item.snapshot.agent.confidence * 100)}%` : ""}</small></article>)}</div> : <p className="futures-empty">No decision has been recorded in this paper account. The first completed-candle check begins its timeline.</p>}{decisions.length>5?<button type="button" className="history-more-button" onClick={()=>setVisibleDecisions(count=>count>=decisions.length?5:Math.min(count+5,decisions.length))}>{visibleDecisions>=decisions.length?"Show the latest 5":"Show 5 more decisions"}<span>{Math.min(visibleDecisions,decisions.length)} of {decisions.length}</span></button>:null}<div className="futures-fill-foot"><b>{fills.length} recent paper fills</b><span>Fills are simulations; this desk never sends an exchange order.</span></div>{fills.length ? <div className="futures-fill-list" aria-label="Recent futures paper fills">{fills.slice(0, visibleFills).map(fill => <article key={fill.id}><div><b>{fill.action.replaceAll("_", " ").toUpperCase()} · {fill.symbol}</b><small>{fill.direction.toUpperCase()} · {Number(fill.quantity).toLocaleString(undefined, { maximumFractionDigits: 6 })} units · {usd(Number(fill.fill_price))} · {when(fill.created_at)}</small></div><strong className={fill.action === "close" ? Number(fill.realized_pnl) >= 0 ? "positive" : "negative" : ""}>{fill.action === "close" ? usd(Number(fill.realized_pnl)) : "OPENED"}</strong>{fill.action === "close" ? <PnlShareCard details={{ ticker: fill.symbol.replace("USDT", ""), symbol: fill.symbol, direction: fill.direction.toUpperCase() as "LONG" | "SHORT", status: "CLOSED", pnl: Number(fill.realized_pnl), quantity: Number(fill.quantity), referencePrice: Number(fill.fill_price), referenceLabel: "EXIT FILL", timestamp: fill.created_at, desk: "FUTURES PAPER DESK" }}/> : null}</article>)}</div> : null}{fills.length>5?<button type="button" className="history-more-button" onClick={()=>setVisibleFills(count=>count>=fills.length?5:Math.min(count+5,fills.length))}>{visibleFills>=fills.length?"Show the latest 5":"Show 5 more fills"}<span>{Math.min(visibleFills,fills.length)} of {fills.length}</span></button>:null}</section>
    <p className="futures-footer"><Link href="/strategies">Inspect Alpha Factory validation <span className="futures-arrow" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 10 10 2M3 2h7v7"/></svg></span></Link><Link href="/nightwatch">See Reality spot Nightwatch <span className="futures-arrow" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 10 10 2M3 2h7v7"/></svg></span></Link></p>
  </div>;
}
