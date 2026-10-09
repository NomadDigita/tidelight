import { timingSafeEqual, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBitgetAsset, getBitgetCandles } from "@/lib/bitget-market";
import { evaluateSmaCrossover } from "@/lib/nightwatch-signal";
import { decideNightwatch } from "@/lib/nightwatch-agent";
import { nightwatchAnalysisBudget, readBeforeNightwatchDeadline, rotateNightwatchSchedules } from "@/lib/nightwatch-budget";
import { ALPHA_STRATEGIES, BACKTEST_STRATEGY, prepareBacktestCandles, type StrategyKey } from "@/lib/backtest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const FOUR_HOURS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const runId = randomUUID();
  if (!authorized(request)) return NextResponse.json({ runId, error: "Unauthorized scheduled check." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ runId, state: "setup_required", error: "Scheduled paper checks are safely disabled until a Supabase server secret is configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const admin = createAdminClient();
  const analysisDeadline = nightwatchAnalysisBudget(startedAt).deadlineAt;
  const readSignal = AbortSignal.timeout(Math.max(1, analysisDeadline - Date.now()));
  const countResult = await admin.from("nightwatch_preferences").select("user_id", { count: "exact", head: true }).eq("trigger_mode", "every_check").not("monitor_symbol", "is", null).abortSignal(readSignal);
  if (countResult.error) return NextResponse.json({ runId, error: "Could not count opted-in paper schedules." }, { status: 503 });
  const count = countResult.count ?? 0;
  const batchCount = Math.max(1, Math.ceil(count / BATCH_SIZE));
  const offset = count > BATCH_SIZE ? (Math.floor(Date.now() / DAY_MS) % batchCount) * BATCH_SIZE : 0;
  const { data: enabled, error: preferenceError } = await admin.from("nightwatch_preferences").select("user_id, monitor_symbol, research_run_id, alert_on_signal, alert_on_fill, playbook_key").eq("trigger_mode", "every_check").not("monitor_symbol", "is", null).order("updated_at", { ascending: true }).order("user_id", { ascending: true }).range(offset, offset + BATCH_SIZE - 1).abortSignal(readSignal);
  if (preferenceError) return NextResponse.json({ runId, error: "Could not load opted-in paper schedules." }, { status: 503 });
  if (!enabled?.length) return NextResponse.json({ runId, state: "idle", checked: 0, message: "No active scheduled paper checks are opted in." }, { headers: { "Cache-Control": "no-store" } });

  const users = await admin.from("nightwatch_accounts").select("user_id, paused").in("user_id", enabled.map((item) => item.user_id)).abortSignal(readSignal);
  if (users.error) return NextResponse.json({ runId, error: "Could not verify paper pause controls." }, { status: 503 });
  const unpaused = new Set((users.data ?? []).filter((item) => !item.paused).map((item) => item.user_id));
  const schedules = rotateNightwatchSchedules(enabled.filter((item) => unpaused.has(item.user_id) && item.monitor_symbol), startedAt, batchCount);
  const marketData = new Map<string, { asset: NonNullable<Awaited<ReturnType<typeof getBitgetAsset>>>; asOfMs: number; close: number; fast: number; slow: number; signal: "buy" | "sell" | "hold"; snapshot: Record<string, unknown>; candles: Awaited<ReturnType<typeof getBitgetCandles>> }>();
  const symbolErrors: string[] = [];

  for (const symbol of [...new Set(schedules.map((item) => item.monitor_symbol as string))]) {
    if (Date.now() >= analysisDeadline) break;
    try {
      const asset = await readBeforeNightwatchDeadline(getBitgetAsset(symbol), analysisDeadline);
      if (!asset?.isReality) { symbolErrors.push(symbol); continue; }
      const candles = await readBeforeNightwatchDeadline(getBitgetCandles(symbol, "4H", 1000), analysisDeadline);
      const closed = prepareBacktestCandles(candles, "4H", Date.now());
      if (closed.length < 51) { symbolErrors.push(symbol); continue; }
      const current = closed.at(-1)!;
      const previous = closed.at(-2)!;
      const closes = closed.map((candle) => candle.close);
      const values = evaluateSmaCrossover(closes);
      const asOfMs = current.timestamp + FOUR_HOURS;
      marketData.set(symbol, { asset, asOfMs, close: current.close, fast: values.fastSma, slow: values.slowSma, signal: values.signal, snapshot: { provider: "Bitget public Spot candles", interval: "4H", trigger: "scheduled_opt_in", closedCandleStart: new Date(current.timestamp).toISOString(), closedCandleEnd: new Date(asOfMs).toISOString(), previousCandleStart: new Date(previous.timestamp).toISOString(), previousFastSma: values.previousFastSma, previousSlowSma: values.previousSlowSma, assetName: asset.name, underlyingTicker: asset.underlyingTicker, feeRate: 0.001, slippageRate: 0.0005, rule: "AI-led evidence and risk decision v1" }, candles: closed.slice(-90) });
    } catch {
      if (Date.now() >= analysisDeadline) break;
      symbolErrors.push(symbol);
    }
  }

  let recorded = 0;
  let failures = 0;
  let deferred = 0;
  for (const [index, preference] of schedules.entries()) {
    if (nightwatchAnalysisBudget(startedAt).budgetMs < 1000) {
      deferred += schedules.length - index;
      break;
    }
    const sample = marketData.get(preference.monitor_symbol as string);
    if (!sample) { failures += 1; continue; }
    const { data: account, error: accountError } = await admin.from("nightwatch_accounts").select("id,cash_balance").eq("user_id", preference.user_id).abortSignal(readSignal).maybeSingle();
    if (accountError || !account) {
      if (Date.now() >= analysisDeadline) { deferred += schedules.length - index; break; }
      failures += 1; continue;
    }
    const today = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();
    const [positionResult, ordersResult] = await Promise.all([
      admin.from("nightwatch_positions").select("quantity,average_cost").eq("account_id", account.id).eq("symbol", sample.asset.symbol).abortSignal(readSignal).maybeSingle(),
      admin.from("nightwatch_orders").select("realized_pnl").eq("account_id", account.id).gte("created_at", today).limit(10).abortSignal(readSignal)
    ]);
    const researchResult = preference.research_run_id
      ? await admin.from("research_runs").select("question,summary,status").eq("user_id", preference.user_id).eq("id", preference.research_run_id).abortSignal(readSignal).maybeSingle()
      : { data: null, error: null };
    if (positionResult.error || ordersResult.error || researchResult.error) {
      if (Date.now() >= analysisDeadline) { deferred += schedules.length - index; break; }
      failures += 1; continue;
    }
    const analysisBudget = nightwatchAnalysisBudget(startedAt);
    if (analysisBudget.budgetMs < 1000) { deferred += schedules.length - index; break; }
    const orders = ordersResult.data ?? [];
    let decision;
    try {
      decision = await decideNightwatch({
        symbol: sample.asset.symbol, issuer: sample.asset.name, candles: sample.candles,
        playbookKey: typeof preference.playbook_key === "string" && Object.hasOwn(ALPHA_STRATEGIES, preference.playbook_key) ? preference.playbook_key as StrategyKey : BACKTEST_STRATEGY,
        account: { cashUsd: Number(account.cash_balance), positionQuantity: Number(positionResult.data?.quantity ?? 0), averageCostUsd: positionResult.data?.average_cost == null ? null : Number(positionResult.data.average_cost), dailyRealizedPnlUsd: orders.reduce((sum, order) => sum + Number(order.realized_pnl ?? 0), 0), fillsToday: orders.length },
        research: researchResult.data?.status === "complete" ? { question: researchResult.data.question, summary: researchResult.data.summary } : null
      }, analysisBudget);
    } catch { failures += 1; continue; }
    const signal = decision.signal;
    const rationale = signal === decision.action ? decision.rationale : decision.rationale + " Confidence was below the 0.66 execution threshold, so the agent held.";
    const playbookKey = typeof preference.playbook_key === "string" && Object.hasOwn(ALPHA_STRATEGIES, preference.playbook_key) ? preference.playbook_key as StrategyKey : BACKTEST_STRATEGY;
    const snapshot = { ...sample.snapshot, playbook: { key: playbookKey, label: ALPHA_STRATEGIES[playbookKey].label }, agent: { version: "nightwatch-agent-v1", action: decision.action, signal, confidence: decision.confidence, rationale, evidence: decision.evidence, risks: decision.risks, invalidation: decision.invalidation, horizon: decision.horizon }, ...(preference.research_run_id ? { researchRunId: preference.research_run_id } : {}) };
    // Await ledger writes to completion: aborting the HTTP request cannot undo
    // a committed paper fill and could prevent its alert from being recorded.
    const { data, error } = await admin.rpc("nightwatch_tick_scheduled", { p_user_id: preference.user_id, p_symbol: preference.monitor_symbol, p_as_of_ms: sample.asOfMs, p_reference_price: sample.close, p_fast_sma: sample.fast, p_slow_sma: sample.slow, p_signal: signal, p_snapshot: snapshot, p_research_run_id: preference.research_run_id });
    if (error) { failures += 1; continue; }
    recorded += 1;
    const result = data as { run_id?: string; outcome?: string; reason?: string };
    if (!result.run_id) continue;
    const alerts = [];
    if (signal !== "hold" && preference.alert_on_signal) alerts.push({ user_id: preference.user_id, run_id: result.run_id, kind: "signal", title: `${signal.toUpperCase()} signal · ${sample.asset.symbol}`, body: rationale });
    if (result.outcome === "executed" && preference.alert_on_fill) alerts.push({ user_id: preference.user_id, run_id: result.run_id, kind: "fill", title: `Paper ${signal} filled · ${sample.asset.symbol}`, body: rationale });
    if (alerts.length) {
      const alertResult = await admin.from("nightwatch_alerts").upsert(alerts, { onConflict: "run_id,kind" });
      if (alertResult.error) failures += 1;
    }
  }

  const response = { runId, state: failures || deferred ? "partial" : "complete", checked: recorded, deferred, deferredReason: deferred ? "Scheduled checks reached the request time budget; remaining schedules were not evaluated." : null, pausedOrDisabled: enabled.length - schedules.length, failures, scheduleCount: count, batchSize: BATCH_SIZE, batchOffset: offset, unavailableSymbols: [...new Set(symbolErrors)], paperOnly: true };
  return NextResponse.json(response, { status: failures || deferred ? 207 : 200, headers: { "Cache-Control": "no-store" } });
}
