"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ALPHA_STRATEGIES, BACKTEST_STRATEGY, type StrategyKey, type BacktestMetrics, type BacktestResult, type WalkForwardResult } from "@/lib/backtest";
import { STOCK_PERP_UNIVERSE, type AlphaMarketCategory, type CandleInterval, type MarketCandle } from "@/lib/bitget-market";

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
type AlphaDraft = { strategyKey: StrategyKey; thesis: string; entryConditions: string[]; exitConditions: string[]; risks: string[]; validationFocus: string };
type DisplayRun = BacktestResult & { parameters: BacktestResult["parameters"] & { hypothesis?: AlphaDraft; marketCategory?: AlphaMarketCategory }; id: string; runId: string; createdAt: string; assetName: string; assetKind: string; candleHash: string; candles: MarketCandle[]; walkForward: WalkForwardResult | null; walkForwardStatus: string; costSensitivity: Array<{ label: string; feeBpsPerSide: number; slippageBpsPerSide: number; returnPct: number }>; researchRunId: string | null; providerTimestamp: number | null; sessionHours: string[]; weekendTradable: boolean | null };
const validationSet = [
  { label: "NVIDIA · rToken", symbol: "RNVDAUSDT", interval: "4H" as CandleInterval },
  { label: "AMD · rToken", symbol: "RAMDUSDT", interval: "4H" as CandleInterval },
  { label: "Tesla · rToken", symbol: "RTSLAUSDT", interval: "4H" as CandleInterval },
  { label: "Apple · rToken", symbol: "RAAPLUSDT", interval: "4H" as CandleInterval },
  { label: "Microsoft · rToken", symbol: "RMSFTUSDT", interval: "4H" as CandleInterval },
];
const stockPerpSet = ["NVDAUSDT", "AMDUSDT", "MSFTUSDT", "AAPLUSDT", "TSLAUSDT"].map(symbol => ({ label: `${symbol.slice(0, -4)} · perpetual`, symbol, interval: "4H" as CandleInterval }));
const semiconductorSet = ["NVDAUSDT", "AMDUSDT", "INTCUSDT", "ASMLUSDT", "QCOMUSDT", "MUUSDT"].map(symbol => ({ label: `${symbol.slice(0, -4)} · semiconductor`, symbol, interval: "4H" as CandleInterval }));
function marketSymbol(value: string, category: AlphaMarketCategory) {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return category === "SPOT" ? /^R[A-Z0-9]+USDT$/.test(clean) ? clean : `R${clean.replace(/^R/, "").replace(/USDT$/, "")}USDT` : clean.endsWith("USDT") ? clean : `${clean}USDT`;
}

function pct(value: number | null | undefined) { return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`; }
function number(value: number | null | undefined) { return value == null ? "—" : value.toFixed(2); }
function date(value: number | string) { return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }

function downloadRun(run: DisplayRun) {
  const bundle = {
    schema: "tidelight.strategy-run.v1",
    exportedAt: new Date().toISOString(),
    run: {
      id: run.runId, symbol: run.symbol, assetName: run.assetName, assetKind: run.assetKind,
      interval: run.interval, strategyKey: run.strategyKey, marketCategory: run.parameters.marketCategory ?? "SPOT", parameters: run.parameters,
      researchRunId: run.researchRunId, providerTimestamp: run.providerTimestamp,
      sessionHours: run.sessionHours, weekendTradable: run.weekendTradable,
      dataStart: new Date(run.dataStart).toISOString(), dataEnd: new Date(run.dataEnd).toISOString(),
      candleCount: run.candleCount,
      candleHash: { algorithm: "SHA-256", canonicalization: "JSON.stringify(completed candles in ascending timestamp order)", value: run.candleHash },
      train: run.train, holdout: run.test, walkForward: run.walkForward,
      walkForwardStatus: run.walkForwardStatus, costSensitivity: run.costSensitivity,
      assumptions: ["Signals use the prior completed candle and execute at the next candle open.", "Fee and slippage assumptions are applied on entry and exit.", "This is an unlevered price replay, not futures account P&L. Funding, leverage, margin, liquidation, order-book depth, and corporate actions are not modeled."],
    },
    candles: run.candles,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tidelight-${run.symbol}-${run.interval}-${run.runId.slice(0, 8)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

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

export default function StrategyLab({ signedIn, initialRuns, initialSymbol = "RAAPLUSDT", initialResearchRunId = null }: { signedIn: boolean; initialRuns: SavedRun[]; initialSymbol?: string; initialResearchRunId?: string | null }) {
  const router = useRouter();
  const [symbol, setSymbol] = useState(initialSymbol);
  const [marketCategory, setMarketCategory] = useState<AlphaMarketCategory>("SPOT");
  const [futuresBasket, setFuturesBasket] = useState<"leaders" | "semiconductors">("leaders");
  const [interval, setInterval] = useState<CandleInterval>("4H");
  const [strategyKey, setStrategyKey] = useState<StrategyKey>(BACKTEST_STRATEGY);
  const [objective, setObjective] = useState("");
  const [hypothesis, setHypothesis] = useState<AlphaDraft | null>(null);
  const [hypothesisBusy, setHypothesisBusy] = useState(false);
  const [run, setRun] = useState<DisplayRun | null>(null);
  const [matrix, setMatrix] = useState<DisplayRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [matrixBusy, setMatrixBusy] = useState(false);
  const [error, setError] = useState("");

  async function draftStrategy() {
    if (!signedIn) { router.push("/login"); return; }
    const token = marketSymbol(symbol, "SPOT");
    setHypothesisBusy(true); setError(""); setHypothesis(null);
    try {
      const response = await fetch("/api/strategies/hypothesize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objective, symbol: token, interval }) });
      const payload = await response.json() as { hypothesis?: AlphaDraft; error?: string };
      if (!response.ok || !payload.hypothesis) throw new Error(payload.error ?? "Could not draft an Alpha hypothesis.");
      setSymbol(token); setStrategyKey(payload.hypothesis.strategyKey); setHypothesis(payload.hypothesis);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Alpha hypothesis unavailable."); }
    finally { setHypothesisBusy(false); }
  }

  async function execute(strategyOverride: StrategyKey = strategyKey, hypothesisOverride: AlphaDraft | null = hypothesis?.strategyKey === strategyOverride ? hypothesis : null) {
    if (!signedIn) { router.push("/login"); return; }
    setBusy(true); setError(""); setRun(null);
    try {
      const response = await fetch("/api/strategies/backtest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: marketSymbol(symbol, marketCategory), marketCategory, interval, researchRunId: initialResearchRunId, strategyKey: strategyOverride, ...(hypothesisOverride && marketCategory === "SPOT" ? { hypothesis: hypothesisOverride } : {}) }) });
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
      for (const item of marketCategory === "SPOT" ? validationSet : futuresBasket === "leaders" ? stockPerpSet : semiconductorSet) {
        const response = await fetch("/api/strategies/backtest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: item.symbol, interval: item.interval, strategyKey, marketCategory }) });
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
  const activeSet = marketCategory === "SPOT" ? validationSet : futuresBasket === "leaders" ? stockPerpSet : semiconductorSet;
  // Freeze selection using training observations only. The holdout below is read
  // after selection; do not choose the largest holdout return in hindsight.
  const selectedLeader = matrix.length === activeSet.length ? [...matrix]
    .filter(item => item.train.trades >= 2 && item.train.maxDrawdownPct <= 20 && item.train.sharpeRatio != null && item.train.sharpeRatio > 0)
    .sort((a, b) => (b.train.sharpeRatio ?? 0) - (a.train.sharpeRatio ?? 0))[0] ?? null : null;

  return <>
    <section className="strategy-spine" aria-label="Tidelight decision spine"><span>EVENT</span><i>→</i><span>EVIDENCE</span><i>→</i><span>EXPOSURE</span><i>→</i><span>SCENARIO</span><i>→</i><b>DECISION</b></section>
    <section className="strategy-workbench" aria-labelledby="strategy-workbench-title">
      <div className="strategy-workbench-head"><div><span className="eyebrow small-eyebrow">ALPHA FACTORY · REPRODUCIBLE REPLAY</span><h2 id="strategy-workbench-title">Test the rule, then test its limits.</h2></div><span className="strategy-readonly">PAPER RESEARCH ONLY</span></div>
      <div className="alpha-market-switch" role="group" aria-label="Market to validate"><button type="button" aria-pressed={marketCategory === "SPOT"} disabled={busy || matrixBusy || hypothesisBusy} onClick={() => { setMarketCategory("SPOT"); setSymbol("RNVDAUSDT"); setRun(null); setMatrix([]); setError(""); }}>Reality rTokens · spot</button><button type="button" aria-pressed={marketCategory === "USDT-FUTURES"} disabled={busy || matrixBusy || hypothesisBusy} onClick={() => { setMarketCategory("USDT-FUTURES"); setSymbol("NVDAUSDT"); setHypothesis(null); setRun(null); setMatrix([]); setError(""); }}>US stocks · perpetuals</button></div>
      <p className="alpha-market-context">{marketCategory === "SPOT" ? "Bitget Reality stock tokens. This market can feed the Nightwatch spot paper account." : "Verified Bitget USDT futures contracts for US stocks. This is an unlevered price replay: funding, leverage, margin and liquidation are excluded. No futures order is placed."}</p>
      {marketCategory === "USDT-FUTURES" ? <div className="alpha-market-switch alpha-basket-switch" role="group" aria-label="Stock market basket"><button type="button" aria-pressed={futuresBasket === "leaders"} disabled={busy || matrixBusy} onClick={() => { setFuturesBasket("leaders"); setMatrix([]); }}>US stock leaders</button><button type="button" aria-pressed={futuresBasket === "semiconductors"} disabled={busy || matrixBusy} onClick={() => { setFuturesBasket("semiconductors"); setMatrix([]); }}>Semiconductor basket</button></div> : null}
      {marketCategory === "SPOT" ? <section className="alpha-hypothesis-card" aria-label="Draft an Alpha Factory hypothesis"><div className="alpha-hypothesis-intro"><span className="eyebrow small-eyebrow">ALPHA FACTORY · HYPOTHESIS STUDIO</span><h3>Start with a market idea.</h3><p>Describe the behavior you want to test. Tidelight maps it to an inspectable rule, then replays it against a Reality rToken with costs and a separate holdout window.</p></div><div className="alpha-hypothesis-form"><label htmlFor="alpha-objective">WHAT WOULD YOU LIKE TO TEST?</label><textarea id="alpha-objective" value={objective} onChange={(event) => setObjective(event.target.value.slice(0, 800))} placeholder="For example: test whether oversold moves in NVIDIA’s rToken tend to rebound over the next few candles." rows={3} maxLength={800}/><div><small>{objective.length}/800 · Suggestions are hypotheses, not performance claims.</small><button type="button" className="strategy-run-button" onClick={() => void draftStrategy()} disabled={hypothesisBusy || objective.trim().length < 12 || !symbol}>{hypothesisBusy ? <><span className="strategy-spinner"/> Drafting…</> : <>Draft a testable idea <span>↗</span></>}</button></div></div>{hypothesis ? <div className="alpha-hypothesis-result" aria-live="polite"><div className="alpha-hypothesis-result-head"><span>TESTABLE HYPOTHESIS</span><b>{ALPHA_STRATEGIES[hypothesis.strategyKey].label}</b></div><p>{hypothesis.thesis}</p><div className="alpha-hypothesis-conditions"><div><span>ENTRY TO TEST</span>{hypothesis.entryConditions.map((item,index) => <small key={index}>• {item}</small>)}</div><div><span>EXIT TO TEST</span>{hypothesis.exitConditions.map((item,index) => <small key={index}>• {item}</small>)}</div></div>{hypothesis.risks.length ? <div className="alpha-hypothesis-risk"><b>What could break it</b><span>{hypothesis.risks.join(" · ")}</span></div> : null}<div className="alpha-hypothesis-validate"><p><b>Validation focus</b> · {hypothesis.validationFocus}</p><button type="button" className="strategy-run-button" onClick={() => void execute(hypothesis.strategyKey, hypothesis)} disabled={busy}>Validate this idea <span>↗</span></button></div></div> : null}</section> : null}
      <div className="strategy-controls"><label>ALPHA RULE<select value={strategyKey} onChange={(event) => setStrategyKey(event.target.value as StrategyKey)}>{Object.entries(ALPHA_STRATEGIES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select><small>{ALPHA_STRATEGIES[strategyKey].description}</small></label><label>{marketCategory === "SPOT" ? "Reality rToken symbol" : "US stock perpetual"}{marketCategory === "SPOT" ? <input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32))} placeholder="RNVDAUSDT" maxLength={32} /> : <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>{STOCK_PERP_UNIVERSE.map(item => <option key={item} value={item}>{item}</option>)}</select>}</label><label>Candle interval<select value={interval} onChange={(event) => setInterval(event.target.value as CandleInterval)}><option value="1H">1 hour</option><option value="4H">4 hours</option><option value="1D">1 day</option></select></label><button type="button" className="strategy-run-button" onClick={() => void execute()} disabled={busy || !symbol}>{busy ? <><span className="strategy-spinner"/> Replaying candles…</> : <>Run holdout test <span>↗</span></>}</button></div>
      <div className="validation-set"><span>REPRESENTATIVE VALIDATION SET</span>{activeSet.map((item) => <button type="button" key={item.symbol} onClick={() => { setSymbol(item.symbol); setInterval(item.interval); }}>{item.label}</button>)}<button type="button" className="validation-matrix-button" onClick={() => void executeMatrix()} disabled={matrixBusy}>{matrixBusy ? "Running matrix…" : "Run full matrix ↗"}</button></div>
      {error ? <div className="strategy-error" role="alert">{error}</div> : null}
      {busy ? <div className="strategy-progress"><span/><span/><span/> Fetching Bitget candles and evaluating {ALPHA_STRATEGIES[strategyKey].label}…</div> : null}
      {display ? <div className="strategy-result" aria-live="polite">
        <div className="strategy-result-heading"><div><span className="eyebrow small-eyebrow">{display.parameters.marketCategory === "USDT-FUTURES" ? "US STOCK PERPETUAL" : "REALITY SPOT"} · {display.parameters.strategyLabel} · OUT-OF-SAMPLE</span><h3>{display.assetName} <small>{display.symbol} · {display.interval}</small></h3></div><div className="strategy-result-actions"><button type="button" className="strategy-export-button" onClick={() => downloadRun(display)}>Export reproducible run ↓</button><span className="strategy-result-status">SAVED</span></div></div>
        {display.parameters.hypothesis ? <div className="alpha-saved-hypothesis"><span>HYPOTHESIS SAVED WITH THIS RUN</span><p>{display.parameters.hypothesis.thesis}</p></div> : null}<div className="strategy-metric-grid"><MetricCard label="Holdout return" value={pct(test?.totalReturnPct)} note="After estimated costs" positive={(test?.totalReturnPct ?? 0) >= 0}/><MetricCard label="Buy & hold" value={pct(test?.buyAndHoldReturnPct)} note="Same holdout window" positive={(test?.buyAndHoldReturnPct ?? 0) >= 0}/><MetricCard label="Max drawdown" value={pct(test?.maxDrawdownPct ? -test.maxDrawdownPct : 0)} note="Marked at each candle close" positive={false}/><MetricCard label="Trades · win rate" value={`${test?.trades ?? 0} · ${test?.winRatePct == null ? "—" : `${test.winRatePct.toFixed(0)}%`}`} note="Closed positions in holdout"/></div>
        {test ? <EquityCurve points={test.equityCurve} /> : null}
      <div className="strategy-result-foot"><span>{display.candleCount} candles · {date(display.dataStart)} — {date(display.dataEnd)}</span><span title={display.candleHash}>SHA-256 {display.candleHash.slice(0, 12)}…</span></div>
        {display.parameters.marketCategory === "USDT-FUTURES" ? <p className="alpha-market-context">Price-only, unlevered simulation. Funding, margin, liquidation and contract execution are not modeled. Nightwatch currently runs Reality spot paper positions.</p> : <p className="strategy-history-link"><Link href={`/nightwatch?symbol=${encodeURIComponent(display.symbol)}&playbook=${encodeURIComponent(display.strategyKey)}`}>Use this playbook in Nightwatch paper agent <span>↗</span></Link></p>}
        {display.walkForward ? <section className="strategy-walkforward" aria-label="Walk-forward validation"><div className="walkforward-heading"><div><span className="eyebrow small-eyebrow">ROLLING OUT-OF-SAMPLE</span><h4>Does it hold across time?</h4></div><b className={display.walkForward.positiveFolds === display.walkForward.totalFolds ? "metric-positive" : "metric-negative"}>{display.walkForward.positiveFolds} / {display.walkForward.totalFolds} positive windows</b></div><div className="walkforward-grid">{display.walkForward.folds.map((fold) => <article key={fold.index}><span>WINDOW 0{fold.index}</span><b className={fold.metrics.totalReturnPct >= 0 ? "metric-positive" : "metric-negative"}>{pct(fold.metrics.totalReturnPct)}</b><small>{date(fold.testStart)} – {date(fold.testEnd)}</small><small>{fold.metrics.trades} trades · {pct(fold.metrics.buyAndHoldReturnPct)} buy & hold</small></article>)}</div><p>Three disjoint trailing windows after estimated costs. The selected rule is fixed; prior candles provide indicator context and are not used to tune parameters. Mean window return: <b>{pct(display.walkForward.meanReturnPct)}</b>.</p></section> : <div className="strategy-walkforward strategy-walkforward-limited"><span className="eyebrow small-eyebrow">ROLLING WINDOWS NOT AVAILABLE</span><p>{display.walkForwardStatus || "More completed candle history is needed for three useful evaluation windows."} The main holdout and cost stress remain available.</p></div>}
        {display.costSensitivity?.length ? <section className="strategy-cost-sensitivity"><div><span className="eyebrow small-eyebrow">EXECUTION COST STRESS</span><h4>How sensitive is the result to friction?</h4></div><div className="cost-sensitivity-grid">{display.costSensitivity.map((scenario) => <article key={scenario.label}><span>{scenario.label}</span><b className={scenario.returnPct >= 0 ? "metric-positive" : "metric-negative"}>{pct(scenario.returnPct)}</b><small>{(scenario.feeBpsPerSide / 100).toFixed(2)}% fee + {(scenario.slippageBpsPerSide / 100).toFixed(2)}% slippage per side</small></article>)}</div></section> : null}
        <details className="strategy-train-details"><summary>View training window, risk metrics and raw trades</summary><div className="strategy-train-grid"><span>Training return <b>{pct(display.train.totalReturnPct)}</b></span><span>Training baseline <b>{pct(display.train.buyAndHoldReturnPct)}</b></span><span>Holdout Sharpe / Sortino <b>{number(display.test.sharpeRatio)} / {number(display.test.sortinoRatio)}</b></span><span>Starting equity <b>$10,000 simulated</b></span><span>Saved run ID <b>{display.runId.slice(0, 8)}…</b></span><span>Provider mark <b>{display.providerTimestamp ? date(display.providerTimestamp) : "Unavailable"}</b></span></div><div className="strategy-trades"><span className="eyebrow small-eyebrow">HOLDOUT EXECUTIONS · COSTS APPLIED ON BOTH SIDES</span>{display.test.tradeLog.length ? display.test.tradeLog.map((trade, index) => <div className="strategy-trade-row" key={`${trade.entryTime}-${index}`}><span>{date(trade.entryTime)}</span><span>${trade.entryPrice.toFixed(4)}</span><span>→ {date(trade.exitTime)}</span><span>${trade.exitPrice.toFixed(4)}</span><b className={trade.returnPct >= 0 ? "metric-positive" : "metric-negative"}>{pct(trade.returnPct)}</b></div>) : <p>No long entries triggered in this holdout window.</p>}</div></details>
      </div> : null}
    </section>
    {matrix.length ? <section className="strategy-history validation-matrix"><div className="section-heading"><div><div className="eyebrow small-eyebrow">{marketCategory === "SPOT" ? "RTOKEN" : "STOCK PERPETUAL"} VALIDATION · AFTER COSTS</div><h2>One rule, {activeSet.length} US equity markets.</h2></div><span className="strategy-history-note">{matrix.length} / {activeSet.length} complete</span></div>{marketCategory === "USDT-FUTURES" && matrix.length === activeSet.length ? <div className="alpha-leader-card"><span className="eyebrow small-eyebrow">TRAINING-ONLY SELECTION · UNTOUCHED HOLDOUT</span>{selectedLeader ? <><h3>{selectedLeader.assetName} <small>{selectedLeader.symbol}</small></h3><p>Selected by highest positive training Sharpe after costs, at least two closed training trades, and training drawdown ≤20%. Its separate holdout returned <b className={selectedLeader.test.totalReturnPct >= 0 ? "metric-positive" : "metric-negative"}>{pct(selectedLeader.test.totalReturnPct)}</b> against <b>{pct(selectedLeader.test.buyAndHoldReturnPct)}</b> buy and hold. Selection is a single historical test, not continuous rotation.</p></> : <p>No market met the predeclared training gates. The experiment stays in cash; no holdout winner is chosen in hindsight.</p>}</div> : null}<div className="validation-summary"><div><span>AVERAGE HOLDOUT</span><b className={matrixReturn != null && matrixReturn >= 0 ? "metric-positive" : "metric-negative"}>{matrixReturn == null ? "—" : pct(matrixReturn)}</b></div><div><span>AVERAGE DRAWDOWN</span><b className="metric-negative">{matrixDrawdown == null ? "—" : `-${matrixDrawdown.toFixed(2)}%`}</b></div><div><span>AVERAGE WIN RATE</span><b>{matrixWinRate == null ? "—" : `${matrixWinRate.toFixed(0)}%`}</b></div></div><div className="strategy-history-table"><div className="strategy-history-row strategy-history-labels"><span>Market</span><span>Holdout</span><span>Max drawdown</span><span>Trades / win</span></div>{matrix.map((item) => <div className="strategy-history-row" key={item.id}><span><b>{item.assetName}</b><small>{item.symbol} · {item.interval}</small></span><b className={item.test.totalReturnPct >= 0 ? "metric-positive" : "metric-negative"}>{pct(item.test.totalReturnPct)}</b><span className="metric-negative">-{item.test.maxDrawdownPct.toFixed(2)}%</span><small>{item.test.trades} / {item.test.winRatePct == null ? "—" : `${item.test.winRatePct.toFixed(0)}%`}</small></div>)}</div><p className="strategy-history-note matrix-note">These are independent one-market replays, not a rotation portfolio. Futures funding and leveraged P&amp;L are excluded; performance is not a trading promise.</p></section> : null}
    {latestSaved ? <section className="strategy-history"><div className="section-heading"><div><div className="eyebrow small-eyebrow">PRIVATE RUN LOG</div><h2>Recent replays</h2></div><span className="strategy-history-note">{initialRuns.length} latest saved</span></div><div className="strategy-history-table"><div className="strategy-history-row strategy-history-labels"><span>Market</span><span>Holdout</span><span>Return vs hold</span><span>Ran</span></div>{initialRuns.map((item) => <div className="strategy-history-row" key={item.id}><span><b>{item.symbol}</b><small>{item.interval} · {ALPHA_STRATEGIES[item.strategy_key as StrategyKey]?.label ?? item.strategy_key}</small></span><b className={item.test_metrics.totalReturnPct >= 0 ? "metric-positive" : "metric-negative"}>{pct(item.test_metrics.totalReturnPct)}</b><span>{pct(item.test_metrics.buyAndHoldReturnPct)}</span><small>{date(item.created_at)}</small></div>)}</div><p className="strategy-history-link"><Link href="/markets">Choose from the live Bitget market map <span>↗</span></Link></p></section> : null}
  </>;
}
