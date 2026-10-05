"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BacktestMetrics, BacktestResult } from "@/lib/backtest";
import type { CandleInterval } from "@/lib/bitget-market";

type SavedRun = {
  id: string;
  symbol: string;
  interval: string;
  strategy_key: string;
  parameters: Record<string, unknown>;
  train_metrics: BacktestMetrics;
  test_metrics: BacktestMetrics;
  data_start: string;
  data_end: string;
  candle_count: number;
  created_at: string;
};
type DisplayRun = BacktestResult & { id: string; createdAt: string; assetName: string; candleHash: string };
const validationSet = [
  { label: "Apple · Reality", symbol: "RAAPLUSDT", interval: "4H" as CandleInterval },
  { label: "NVIDIA · Reality", symbol: "RNVDAUSDT", interval: "4H" as CandleInterval },
  { label: "Bitcoin · crypto", symbol: "BTCUSDT", interval: "4H" as CandleInterval },
  { label: "Ethereum · crypto", symbol: "ETHUSDT", interval: "4H" as CandleInterval },
  { label: "Solana · crypto", symbol: "SOLUSDT", interval: "4H" as CandleInterval },
];

function pct(value: number | null | undefined) { return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`; }
function number(value: number | null | undefined) { return value == null ? "—" : value.toFixed(2); }
function date(value: number | string) { return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }

function EquityCurve({ points }: { points: Array<{ timestamp: number; equity: number }> }) {
  if (points.length < 2) return null;
  const stride = Math.max(1, Math.ceil(points.length / 90));
  const sampled = points.filter((_, index) => index === 0 || index === points.length - 1 || index % stride === 0);
  const low = Math.min(...sampled.map((point) => point.equity));
  const high = Math.max(...sampled.map((point) => point.equity));
  const range = high - low || 1;
  const path = sampled.map((point, index) => `${index ? "L" : "M"}${(index / (sampled.length - 1)) * 1000},${16 + ((high - point.equity) / range) * 150}`).join(" ");
  return <div className="strategy-equity"><div className="strategy-equity-head"><span className="eyebrow small-eyebrow">HOLDOUT EQUITY · AFTER COSTS</span><b>$10,000 <i>→</i> ${sampled[sampled.length - 1].equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b></div><svg viewBox="0 0 1000 190" role="img" aria-label="Out-of-sample simulated equity curve"><line x1="0" x2="1000" y1="170" y2="170" className="equity-baseline"/><path d={`${path} L1000,170 L0,170 Z`} className="equity-fill"/><path d={path} className="equity-path"/><text x="2" y="187">{date(sampled[0].timestamp)}</text><text x="998" y="187" textAnchor="end">{date(sampled.at(-1)!.timestamp)}</text></svg></div>;
}

function MetricCard({ label, value, note, positive }: { label: string; value: string; note: string; positive?: boolean }) {
  return <div className="strategy-metric"><span>{label}</span><b className={positive === undefined ? "" : positive ? "metric-positive" : "metric-negative"}>{value}</b><small>{note}</small></div>;
}

export default function StrategyLab({ signedIn, initialRuns }: { signedIn: boolean; initialRuns: SavedRun[] }) {
  const router = useRouter();
  const [symbol, setSymbol] = useState("RAAPLUSDT");
  const [interval, setInterval] = useState<CandleInterval>("4H");
  const [run, setRun] = useState<DisplayRun | null>(null);
  const [matrix, setMatrix] = useState<DisplayRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [matrixBusy, setMatrixBusy] = useState(false);
  const [error, setError] = useState("");

  async function execute() {
    if (!signedIn) { router.push("/login"); return; }
    setBusy(true); setError(""); setRun(null);
    try {
      const response = await fetch("/api/strategies/backtest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, interval }) });
      const payload = await response.json() as { run?: DisplayRun; error?: string };
      if (!response.ok || !payload.run) throw new Error(payload.error ?? "Could not run backtest.");
      setRun(payload.run);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Backtest unavailable."); }
    finally { setBusy(false); }
  }

  async function executeMatrix() {
    if (!signedIn) { router.push("/login"); return; }
    setMatrixBusy(true); setError(""); setMatrix([]);
    try {
      const results: DisplayRun[] = [];
      for (const item of validationSet) {
        const response = await fetch("/api/strategies/backtest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: item.symbol, interval: item.interval }) });
        const payload = await response.json() as { run?: DisplayRun; error?: string };
        if (payload.run) results.push(payload.run);
        else if (!response.ok) throw new Error(`${item.label}: ${payload.error ?? "validation failed"}`);
        setMatrix([...results]);
      }
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Validation matrix unavailable."); }
    finally { setMatrixBusy(false); }
  }

  const display = run;
  const test = display?.test;
  const latestSaved = initialRuns[0];
  const matrixReturn = matrix.length ? matrix.reduce((sum, item) => sum + item.test.totalReturnPct, 0) / matrix.length : null;
  const matrixWinRate = matrix.length ? matrix.reduce((sum, item) => sum + (item.test.winRatePct ?? 0), 0) / matrix.length : null;
  const matrixDrawdown = matrix.length ? matrix.reduce((sum, item) => sum + item.test.maxDrawdownPct, 0) / matrix.length : null;

  return <>
    <section className="strategy-spine" aria-label="Tidelight decision spine"><span>EVENT</span><i>→</i><span>EVIDENCE</span><i>→</i><span>EXPOSURE</span><i>→</i><span>SCENARIO</span><i>→</i><b>DECISION</b></section>
    <section className="strategy-workbench" aria-labelledby="strategy-workbench-title">
      <div className="strategy-workbench-head"><div><span className="eyebrow small-eyebrow">REPLAY A PUBLIC MARKET</span><h2 id="strategy-workbench-title">Build a baseline</h2></div><span className="strategy-readonly">PAPER RESEARCH ONLY</span></div>
      <div className="strategy-controls"><label>Bitget spot symbol<input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32))} placeholder="RAAPLUSDT" maxLength={32} /></label><label>Candle interval<select value={interval} onChange={(event) => setInterval(event.target.value as CandleInterval)}><option value="1H">1 hour</option><option value="4H">4 hours</option><option value="1D">1 day</option></select></label><button type="button" className="strategy-run-button" onClick={() => void execute()} disabled={busy || !symbol}>{busy ? <><span className="strategy-spinner"/> Replaying candles…</> : <>Run holdout test <span>↗</span></>}</button></div>
      <div className="validation-set"><span>REPRESENTATIVE VALIDATION SET</span>{validationSet.map((item) => <button type="button" key={item.symbol} onClick={() => { setSymbol(item.symbol); setInterval(item.interval); }}>{item.label}</button>)}<button type="button" className="validation-matrix-button" onClick={() => void executeMatrix()} disabled={matrixBusy}>{matrixBusy ? "Running matrix…" : "Run full matrix ↗"}</button></div>
      {error ? <div className="strategy-error" role="alert">{error}</div> : null}
      {busy ? <div className="strategy-progress"><span/><span/><span/> Fetching Bitget candles and evaluating the fixed 20 / 50 SMA rule…</div> : null}
      {display ? <div className="strategy-result" aria-live="polite">
        <div className="strategy-result-heading"><div><span className="eyebrow small-eyebrow">OUT-OF-SAMPLE · LAST 30%</span><h3>{display.assetName} <small>{display.symbol} · {display.interval}</small></h3></div><span className="strategy-result-status">SAVED</span></div>
        <div className="strategy-metric-grid"><MetricCard label="Holdout return" value={pct(test?.totalReturnPct)} note="After estimated costs" positive={(test?.totalReturnPct ?? 0) >= 0}/><MetricCard label="Buy & hold" value={pct(test?.buyAndHoldReturnPct)} note="Same holdout window" positive={(test?.buyAndHoldReturnPct ?? 0) >= 0}/><MetricCard label="Max drawdown" value={pct(test?.maxDrawdownPct ? -test.maxDrawdownPct : 0)} note="Marked at each candle close" positive={false}/><MetricCard label="Trades · win rate" value={`${test?.trades ?? 0} · ${test?.winRatePct == null ? "—" : `${test.winRatePct.toFixed(0)}%`}`} note="Closed positions in holdout"/></div>
        {test ? <EquityCurve points={test.equityCurve} /> : null}
        <div className="strategy-result-foot"><span>{display.candleCount} candles · {date(display.dataStart)} — {date(display.dataEnd)}</span><span title={display.candleHash}>SHA-256 {display.candleHash.slice(0, 12)}…</span></div>
        <details className="strategy-train-details"><summary>View training window, risk metrics and raw trades</summary><div className="strategy-train-grid"><span>Training return <b>{pct(display.train.totalReturnPct)}</b></span><span>Training baseline <b>{pct(display.train.buyAndHoldReturnPct)}</b></span><span>Holdout Sharpe / Sortino <b>{number(display.test.sharpeRatio)} / {number(display.test.sortinoRatio)}</b></span><span>Starting equity <b>$10,000 simulated</b></span></div><div className="strategy-trades"><span className="eyebrow small-eyebrow">HOLDOUT EXECUTIONS · COSTS APPLIED ON BOTH SIDES</span>{display.test.tradeLog.length ? display.test.tradeLog.map((trade, index) => <div className="strategy-trade-row" key={`${trade.entryTime}-${index}`}><span>{date(trade.entryTime)}</span><span>${trade.entryPrice.toFixed(4)}</span><span>→ {date(trade.exitTime)}</span><span>${trade.exitPrice.toFixed(4)}</span><b className={trade.returnPct >= 0 ? "metric-positive" : "metric-negative"}>{pct(trade.returnPct)}</b></div>) : <p>No long entries triggered in this holdout window.</p>}</div></details>
      </div> : null}
    </section>
    {matrix.length ? <section className="strategy-history validation-matrix"><div className="section-heading"><div><div className="eyebrow small-eyebrow">CROSS-MARKET VALIDATION · AFTER COSTS</div><h2>One rule, five markets.</h2></div><span className="strategy-history-note">{matrix.length} / {validationSet.length} complete</span></div><div className="validation-summary"><div><span>AVERAGE HOLDOUT</span><b className={matrixReturn != null && matrixReturn >= 0 ? "metric-positive" : "metric-negative"}>{matrixReturn == null ? "—" : pct(matrixReturn)}</b></div><div><span>AVERAGE DRAWDOWN</span><b className="metric-negative">{matrixDrawdown == null ? "—" : `-${matrixDrawdown.toFixed(2)}%`}</b></div><div><span>AVERAGE WIN RATE</span><b>{matrixWinRate == null ? "—" : `${matrixWinRate.toFixed(0)}%`}</b></div></div><div className="strategy-history-table"><div className="strategy-history-row strategy-history-labels"><span>Market</span><span>Holdout</span><span>Max drawdown</span><span>Trades / win</span></div>{matrix.map((item) => <div className="strategy-history-row" key={item.id}><span><b>{item.assetName}</b><small>{item.symbol} · {item.interval}</small></span><b className={item.test.totalReturnPct >= 0 ? "metric-positive" : "metric-negative"}>{pct(item.test.totalReturnPct)}</b><span className="metric-negative">-{item.test.maxDrawdownPct.toFixed(2)}%</span><small>{item.test.trades} / {item.test.winRatePct == null ? "—" : `${item.test.winRatePct.toFixed(0)}%`}</small></div>)}</div><p className="strategy-history-note matrix-note">Aggregates are descriptive across the selected validation set; they are not a ranking or a promise of future performance.</p></section> : null}
    {latestSaved ? <section className="strategy-history"><div className="section-heading"><div><div className="eyebrow small-eyebrow">PRIVATE RUN LOG</div><h2>Recent replays</h2></div><span className="strategy-history-note">{initialRuns.length} latest saved</span></div><div className="strategy-history-table"><div className="strategy-history-row strategy-history-labels"><span>Market</span><span>Holdout</span><span>Return vs hold</span><span>Ran</span></div>{initialRuns.map((item) => <div className="strategy-history-row" key={item.id}><span><b>{item.symbol}</b><small>{item.interval} · SMA 20 / 50</small></span><b className={item.test_metrics.totalReturnPct >= 0 ? "metric-positive" : "metric-negative"}>{pct(item.test_metrics.totalReturnPct)}</b><span>{pct(item.test_metrics.buyAndHoldReturnPct)}</span><small>{date(item.created_at)}</small></div>)}</div><p className="strategy-history-link"><Link href="/markets">Choose from the live Bitget market map <span>↗</span></Link></p></section> : null}
  </>;
}
