import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBitgetAsset, getBitgetCandles } from "@/lib/bitget-market";
import { evaluateSmaCrossover } from "@/lib/nightwatch-signal";
import { decideNightwatch } from "@/lib/nightwatch-agent";
import { normalizeNightwatchPreferences } from "@/lib/nightwatch-preferences";
import { ALPHA_STRATEGIES } from "@/lib/backtest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const FOUR_HOURS = 4 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const deadlineAt = Date.now() + 48000;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to run Nightwatch." }, { status: 401 });

  let symbol = "";
  let researchRunId: string | null = null;
  let linkedResearch: { question: string; summary: unknown; status: string } | null = null;
  try {
    const body = await request.json() as { symbol?: unknown; researchRunId?: unknown };
    symbol = typeof body.symbol === "string" ? body.symbol.toUpperCase() : "";
    researchRunId = typeof body.researchRunId === "string" ? body.researchRunId : null;
    if (researchRunId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(researchRunId)) return NextResponse.json({ error: "The linked research run ID is invalid." }, { status: 400 });
    if (researchRunId) {
      const { data: linkedRun, error: linkedRunError } = await supabase.from("research_runs").select("id,question,summary,status").eq("id", researchRunId).maybeSingle();
      if (linkedRunError || !linkedRun) return NextResponse.json({ error: "The linked research note is unavailable in this account." }, { status: 403 });
      linkedResearch = linkedRun;
    }
  } catch {
    return NextResponse.json({ error: "Choose a valid Bitget Reality market." }, { status: 400 });
  }
  if (!/^[A-Z0-9]{2,24}USDT$/.test(symbol)) return NextResponse.json({ error: "Choose a valid Bitget Reality market." }, { status: 400 });

  try {
    const asset = await getBitgetAsset(symbol);
    if (!asset?.isReality) return NextResponse.json({ error: "Nightwatch only monitors Bitget Reality tokenized equities." }, { status: 422 });

    const candles = await getBitgetCandles(symbol, "4H", 1000);
    const now = Date.now();
    const closed = candles.filter((candle) => candle.timestamp + FOUR_HOURS <= now);
    if (closed.length < 51) return NextResponse.json({ error: "Bitget has not returned enough completed 4-hour candles for the agent to evaluate." }, { status: 422 });

    const current = closed.at(-1)!;
    const previous = closed.at(-2)!;
    const closes = closed.map((candle) => candle.close);
    const { fastSma: fast, slowSma: slow, previousFastSma: previousFast, previousSlowSma: previousSlow } = evaluateSmaCrossover(closes);
    const asOfMs = current.timestamp + FOUR_HOURS;
    const asOf = new Date(asOfMs).toISOString();
    const { data: alreadyRun, error: alreadyError } = await supabase.from("nightwatch_runs").select("id,signal,outcome,reason").eq("symbol", symbol).eq("as_of", asOf).maybeSingle();
    if (alreadyError) return NextResponse.json({ error: "Could not check whether this candle was already reviewed." }, { status: 503 });
    if (alreadyRun) return NextResponse.json({ result: { run_id: alreadyRun.id, outcome: alreadyRun.outcome, reason: alreadyRun.reason, idempotent: true }, signal: alreadyRun.signal, asOf, price: current.close, history: closed.slice(-90).map((candle) => ({ t: candle.timestamp, c: candle.close })) });
    const [accountResult, positionResult, ordersResult] = await Promise.all([
      supabase.from("nightwatch_accounts").select("cash_balance").maybeSingle(),
      supabase.from("nightwatch_positions").select("quantity,average_cost").eq("symbol", symbol).maybeSingle(),
      supabase.from("nightwatch_orders").select("realized_pnl,created_at").gte("created_at", new Date(new Date().setUTCHours(0,0,0,0)).toISOString()).limit(10)
    ]);
    if (accountResult.error || positionResult.error || ordersResult.error) return NextResponse.json({ error: "Could not load your private paper account context." }, { status: 503 });
    const dailyOrders = ordersResult.data ?? [];
    const account = { cashUsd: Number(accountResult.data?.cash_balance ?? 10000), positionQuantity: Number(positionResult.data?.quantity ?? 0), averageCostUsd: positionResult.data?.average_cost == null ? null : Number(positionResult.data.average_cost), dailyRealizedPnlUsd: dailyOrders.reduce((sum, order) => sum + Number(order.realized_pnl ?? 0), 0), fillsToday: dailyOrders.length };
    const { data: savedPreferences } = await supabase.from("nightwatch_preferences").select("playbook_key").maybeSingle();
    const selectedPreferences = normalizeNightwatchPreferences(savedPreferences ?? {});
    const aiDecision = await decideNightwatch({ symbol, issuer: asset.name, candles: closed.slice(-90), account, playbookKey: selectedPreferences.playbook_key, research: linkedResearch?.status === "complete" ? { question: linkedResearch.question, summary: linkedResearch.summary } : null }, { budgetMs: 38000, deadlineAt });
    const signal = aiDecision.signal;
    const decision = signal === aiDecision.action ? aiDecision : { ...aiDecision, rationale: aiDecision.rationale + " Confidence was below the 0.66 execution threshold, so the agent held." };
    const { data, error } = await supabase.rpc("nightwatch_tick", {
      p_symbol: symbol,
      p_as_of_ms: asOfMs,
      p_reference_price: current.close,
      p_fast_sma: fast,
      p_slow_sma: slow,
      p_signal: signal,
      p_snapshot: {
        agent: { version: "nightwatch-agent-v1", action: decision.action, signal, confidence: decision.confidence, rationale: decision.rationale, evidence: decision.evidence, risks: decision.risks, invalidation: decision.invalidation, horizon: decision.horizon },
        ...(researchRunId ? { researchRunId } : {}),
        provider: "Bitget public Spot candles",
        interval: "4H",
        closedCandleStart: new Date(current.timestamp).toISOString(),
        closedCandleEnd: new Date(asOfMs).toISOString(),
        previousCandleStart: new Date(previous.timestamp).toISOString(),
        previousFastSma: previousFast,
        previousSlowSma: previousSlow,
        assetName: asset.name,
        underlyingTicker: asset.underlyingTicker,
        feeRate: 0.001,
        slippageRate: 0.0005,
        indicators: { sma20: fast, sma50: slow, previousSma20: previousFast, previousSma50: previousSlow },
        playbook: { key: selectedPreferences.playbook_key, label: ALPHA_STRATEGIES[selectedPreferences.playbook_key].label },
        rule: "AI-led evidence and risk decision v1",
      },
    });
    if (error) {
      console.error("Nightwatch paper tick failed", { code: error.code, message: error.message });
      return NextResponse.json({ error: error.message.includes("stale") ? error.message : "Could not save the paper decision. Try again shortly." }, { status: 500 });
    }
    const result = data as { run_id?: string; outcome?: string; reason?: string } | null;
    const { data: preferences } = await supabase.from("nightwatch_preferences").select("alert_on_signal, alert_on_fill").maybeSingle();
    const alerts: Array<{ kind: "signal" | "fill"; title: string; body: string }> = [];
    if (signal !== "hold" && preferences?.alert_on_signal !== false) alerts.push({ kind: "signal", title: `${signal.toUpperCase()} signal · ${symbol}`, body: decision.rationale });
    if (result?.outcome === "executed" && preferences?.alert_on_fill !== false) alerts.push({ kind: "fill", title: `Paper ${signal} filled · ${symbol}`, body: decision.rationale });
    if (result?.run_id && alerts.length) {
      await supabase.from("nightwatch_alerts").upsert(alerts.map((alert) => ({ user_id: user.id, run_id: result.run_id, ...alert })), { onConflict: "run_id,kind" });
    }
    return NextResponse.json({ result: data, decision, asset: { symbol: asset.symbol, name: asset.name, ticker: asset.underlyingTicker, logoUrl: asset.logoUrl }, signal, fastSma: fast, slowSma: slow, asOf: new Date(asOfMs).toISOString(), price: current.close, history: closed.slice(-90).map((candle) => ({ t: candle.timestamp, c: candle.close })) });
  } catch (error) {
    console.error("Nightwatch market check failed", error instanceof Error ? error.message : "Unknown market error");
    return NextResponse.json({ error: "Nightwatch could not complete the AI decision or market-data check. No paper order was placed." }, { status: 502 });
  }
}
