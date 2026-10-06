import { createHash } from "node:crypto";
import { getBitgetAsset, getBitgetCandles, type CandleInterval } from "@/lib/bitget-market";
import { prepareBacktestCandles, runBacktest, runCostSensitivity, runWalkForward, type WalkForwardResult } from "@/lib/backtest";
import { createClient } from "@/lib/supabase/server";

const intervals = new Set<CandleInterval>(["1H", "4H", "1D"]);
const symbolPattern = /^[A-Z0-9]{2,32}$/;

export async function POST(request: Request) {
  let body: { symbol?: unknown; interval?: unknown; researchRunId?: unknown };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: "Send a valid JSON request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Send a valid JSON request." }, { status: 400 });
  const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  const interval = typeof body.interval === "string" ? body.interval.toUpperCase() as CandleInterval : null;
  const researchRunId = typeof body.researchRunId === "string" ? body.researchRunId : null;
  if (researchRunId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(researchRunId)) return Response.json({ error: "The linked research run ID is invalid." }, { status: 400 });
  if (!symbolPattern.test(symbol) || !interval || !intervals.has(interval)) return Response.json({ error: "Choose a valid Bitget market and candle interval." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Sign in to save and compare backtest runs." }, { status: 401 });
  if (researchRunId) {
    const { data: linkedRun, error: linkedRunError } = await supabase.from("research_runs").select("id").eq("id", researchRunId).maybeSingle();
    if (linkedRunError || !linkedRun) return Response.json({ error: "The linked research note is unavailable in this account." }, { status: 403 });
  }

  try {
    const asset = await getBitgetAsset(symbol);
    if (!asset) return Response.json({ error: "That symbol is not an active Bitget spot market." }, { status: 404 });
    const fetchedCandles = await getBitgetCandles(symbol, interval, 1000);
    const evaluatedAt = Date.now();
    const candles = prepareBacktestCandles(fetchedCandles, interval, evaluatedAt);
    const result = runBacktest(symbol, interval, candles, evaluatedAt);
    let walkForward: WalkForwardResult | null = null;
    let walkForwardStatus = "";
    try { walkForward = runWalkForward(symbol, interval, candles, evaluatedAt); }
    catch (error) { walkForwardStatus = error instanceof Error ? error.message : "More completed history is required for rolling windows."; }
    const costSensitivity = runCostSensitivity(symbol, interval, candles, evaluatedAt);
    const candleHash = createHash("sha256").update(JSON.stringify(candles)).digest("hex");
    const { data, error } = await supabase.from("strategy_backtest_runs").insert({
      user_id: user.id,
      symbol,
      interval,
      strategy_key: result.strategyKey,
      parameters: { ...result.parameters, candleHash, assetName: asset.name, assetKind: asset.kind, walkForward, walkForwardStatus, costSensitivity, researchRunId },
      train_metrics: result.train,
      test_metrics: result.test,
      data_start: new Date(result.dataStart).toISOString(),
      data_end: new Date(result.dataEnd).toISOString(),
      candle_count: result.candleCount,
      candles,
    }).select("id, created_at").single();
    if (error) {
      console.error("Backtest persistence failed", error.code);
      return Response.json({ error: "The run completed, but could not be saved. Please try again." }, { status: 503 });
    }
    return Response.json({ run: { ...result, id: data.id, runId: data.id, createdAt: data.created_at, assetName: asset.name, assetKind: asset.kind, candleHash, candles, walkForward, walkForwardStatus, costSensitivity, researchRunId, providerTimestamp: asset.providerTimestamp, sessionHours: asset.tradingSessions, weekendTradable: asset.weekendTradable } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backtest unavailable.";
    const status = /At least|too short/.test(message) ? 422 : 503;
    return Response.json({ error: status === 422 ? message : "Bitget candle history is temporarily unavailable. No result was stored." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
