import { timingSafeEqual, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBitgetAsset, getBitgetCandles } from "@/lib/bitget-market";
import { evaluateSmaCrossover } from "@/lib/nightwatch-signal";

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
  const runId = randomUUID();
  if (!authorized(request)) return NextResponse.json({ runId, error: "Unauthorized scheduled check." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ runId, state: "setup_required", error: "Scheduled paper checks are safely disabled until a Supabase server secret is configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const admin = createAdminClient();
  const countResult = await admin.from("nightwatch_preferences").select("user_id", { count: "exact", head: true }).eq("trigger_mode", "every_check").not("monitor_symbol", "is", null);
  if (countResult.error) return NextResponse.json({ runId, error: "Could not count opted-in paper schedules." }, { status: 503 });
  const count = countResult.count ?? 0;
  const batchCount = Math.max(1, Math.ceil(count / BATCH_SIZE));
  const offset = count > BATCH_SIZE ? (Math.floor(Date.now() / DAY_MS) % batchCount) * BATCH_SIZE : 0;
  const { data: enabled, error: preferenceError } = await admin.from("nightwatch_preferences").select("user_id, monitor_symbol, research_run_id, alert_on_signal, alert_on_fill").eq("trigger_mode", "every_check").not("monitor_symbol", "is", null).order("updated_at", { ascending: true }).range(offset, offset + BATCH_SIZE - 1);
  if (preferenceError) return NextResponse.json({ runId, error: "Could not load opted-in paper schedules." }, { status: 503 });
  if (!enabled?.length) return NextResponse.json({ runId, state: "idle", checked: 0, message: "No active scheduled paper checks are opted in." }, { headers: { "Cache-Control": "no-store" } });

  const users = await admin.from("nightwatch_accounts").select("user_id, paused").in("user_id", enabled.map((item) => item.user_id));
  if (users.error) return NextResponse.json({ runId, error: "Could not verify paper pause controls." }, { status: 503 });
  const unpaused = new Set((users.data ?? []).filter((item) => !item.paused).map((item) => item.user_id));
  const schedules = enabled.filter((item) => unpaused.has(item.user_id) && item.monitor_symbol);
  const marketData = new Map<string, { asset: NonNullable<Awaited<ReturnType<typeof getBitgetAsset>>>; asOfMs: number; close: number; fast: number; slow: number; signal: "buy" | "sell" | "hold"; snapshot: Record<string, unknown> }>();
  const symbolErrors: string[] = [];

  for (const symbol of [...new Set(schedules.map((item) => item.monitor_symbol as string))]) {
    try {
      const asset = await getBitgetAsset(symbol);
      if (!asset?.isReality) { symbolErrors.push(symbol); continue; }
      const candles = await getBitgetCandles(symbol, "4H", 1000);
      const closed = candles.filter((candle) => candle.timestamp + FOUR_HOURS <= Date.now());
      if (closed.length < 51) { symbolErrors.push(symbol); continue; }
      const current = closed.at(-1)!;
      const previous = closed.at(-2)!;
      const closes = closed.map((candle) => candle.close);
      const values = evaluateSmaCrossover(closes);
      const asOfMs = current.timestamp + FOUR_HOURS;
      marketData.set(symbol, { asset, asOfMs, close: current.close, fast: values.fastSma, slow: values.slowSma, signal: values.signal, snapshot: { provider: "Bitget public Spot candles", interval: "4H", trigger: "scheduled_opt_in", closedCandleStart: new Date(current.timestamp).toISOString(), closedCandleEnd: new Date(asOfMs).toISOString(), previousCandleStart: new Date(previous.timestamp).toISOString(), previousFastSma: values.previousFastSma, previousSlowSma: values.previousSlowSma, assetName: asset.name, underlyingTicker: asset.underlyingTicker, feeRate: 0.001, slippageRate: 0.0005, rule: "SMA20/50 completed-candle crossover v1" } });
    } catch { symbolErrors.push(symbol); }
  }

  let recorded = 0;
  let failures = 0;
  for (const preference of schedules) {
    const sample = marketData.get(preference.monitor_symbol as string);
    if (!sample) { failures += 1; continue; }
    const { data, error } = await admin.rpc("nightwatch_tick_scheduled", { p_user_id: preference.user_id, p_symbol: preference.monitor_symbol, p_as_of_ms: sample.asOfMs, p_reference_price: sample.close, p_fast_sma: sample.fast, p_slow_sma: sample.slow, p_signal: sample.signal, p_snapshot: sample.snapshot, p_research_run_id: preference.research_run_id });
    if (error) { failures += 1; continue; }
    recorded += 1;
    const result = data as { run_id?: string; outcome?: string; reason?: string };
    if (!result.run_id) continue;
    const alerts = [];
    if (sample.signal !== "hold" && preference.alert_on_signal) alerts.push({ user_id: preference.user_id, run_id: result.run_id, kind: "signal", title: `${sample.signal.toUpperCase()} signal · ${sample.asset.symbol}`, body: result.reason ?? "Scheduled Nightwatch check recorded a signal." });
    if (result.outcome === "executed" && preference.alert_on_fill) alerts.push({ user_id: preference.user_id, run_id: result.run_id, kind: "fill", title: `Paper ${sample.signal} filled · ${sample.asset.symbol}`, body: result.reason ?? "A scheduled paper fill passed the guardrails." });
    if (alerts.length) await admin.from("nightwatch_alerts").upsert(alerts, { onConflict: "run_id,kind" });
  }

  const response = { runId, state: failures ? "partial" : "complete", checked: recorded, pausedOrDisabled: enabled.length - schedules.length, failures, scheduleCount: count, batchSize: BATCH_SIZE, batchOffset: offset, unavailableSymbols: [...new Set(symbolErrors)], paperOnly: true };
  return NextResponse.json(response, { status: failures ? 207 : 200, headers: { "Cache-Control": "no-store" } });
}
