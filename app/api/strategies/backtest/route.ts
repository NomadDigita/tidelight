import { createHash } from "node:crypto";
import { getBitgetAsset, getBitgetCandles, getBitgetStockPerp, type AlphaMarketCategory, type CandleInterval } from "@/lib/bitget-market";
import { ALPHA_STRATEGIES, prepareBacktestCandles, runBacktest, runCostSensitivity, runWalkForward, type StrategyKey, type WalkForwardResult } from "@/lib/backtest";
import { createClient } from "@/lib/supabase/server";

const intervals = new Set<CandleInterval>(["1H", "4H", "1D"]);
const symbolPattern = /^[A-Z0-9]{2,32}$/;

export async function POST(request: Request) {
  let body: { symbol?: unknown; interval?: unknown; marketCategory?: unknown; researchRunId?: unknown; strategyKey?: unknown; hypothesis?: unknown };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: "Send a valid JSON request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Send a valid JSON request." }, { status: 400 });
  const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  const interval = typeof body.interval === "string" ? body.interval.toUpperCase() as CandleInterval : null;
  const marketCategory: AlphaMarketCategory = body.marketCategory === "USDT-FUTURES" ? "USDT-FUTURES" : "SPOT";
  if (body.marketCategory != null && body.marketCategory !== "SPOT" && body.marketCategory !== "USDT-FUTURES") return Response.json({ error: "Choose Reality spot or a US stock perpetual market." }, { status: 400 });
  const researchRunId = typeof body.researchRunId === "string" ? body.researchRunId : null;
  const strategyKey = typeof body.strategyKey === "string" && Object.hasOwn(ALPHA_STRATEGIES, body.strategyKey) ? body.strategyKey as StrategyKey : "sma_trend_v1";
  let hypothesis: { strategyKey: StrategyKey; thesis: string; entryConditions: string[]; exitConditions: string[]; risks: string[]; validationFocus: string } | null = null;
  if (body.hypothesis != null) {
    if (typeof body.hypothesis !== "object" || Array.isArray(body.hypothesis)) return Response.json({ error: "The Alpha hypothesis is invalid." }, { status: 400 });
    const value = body.hypothesis as Record<string, unknown>;
    const cleanText = (item: unknown, max: number) => typeof item === "string" ? item.trim().slice(0, max) : "";
    const cleanList = (item: unknown) => Array.isArray(item) ? item.filter((entry): entry is string => typeof entry === "string").slice(0, 4).map((entry) => entry.trim().slice(0, 180)).filter(Boolean) : [];
    const key = typeof value.strategyKey === "string" ? value.strategyKey as StrategyKey : null;
    const thesis = cleanText(value.thesis, 420);
    const validationFocus = cleanText(value.validationFocus, 300);
    const entryConditions = cleanList(value.entryConditions);
    const exitConditions = cleanList(value.exitConditions);
    if (!key || key !== strategyKey || !Object.hasOwn(ALPHA_STRATEGIES, key) || thesis.length < 20 || !validationFocus || !entryConditions.length || !exitConditions.length) return Response.json({ error: "The Alpha hypothesis does not match the selected implemented rule." }, { status: 400 });
    hypothesis = { strategyKey: key, thesis, validationFocus, entryConditions, exitConditions, risks: cleanList(value.risks) };
  }
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
    const asset = marketCategory === "SPOT" ? await getBitgetAsset(symbol) : await getBitgetStockPerp(symbol);
    if (!asset) return Response.json({ error: marketCategory === "SPOT" ? "That Reality rToken is not an active Bitget spot market." : "This US stock perpetual is not in the supported, currently active Bitget contract set." }, { status: 404 });
    if (marketCategory === "SPOT" && !asset.isReality) return Response.json({ error: "Choose a verified Reality rToken, for example RNVDAUSDT." }, { status: 422 });
    const fetchedCandles = await getBitgetCandles(symbol, interval, 1000, marketCategory);
    const evaluatedAt = Date.now();
    const candles = prepareBacktestCandles(fetchedCandles, interval, evaluatedAt);
    const result = runBacktest(symbol, interval, candles, evaluatedAt, strategyKey);
    let walkForward: WalkForwardResult | null = null;
    let walkForwardStatus = "";
    try { walkForward = runWalkForward(symbol, interval, candles, evaluatedAt, strategyKey); }
    catch (error) { walkForwardStatus = error instanceof Error ? error.message : "More completed history is required for rolling windows."; }
    const costSensitivity = runCostSensitivity(symbol, interval, candles, evaluatedAt, strategyKey);
    const candleHash = createHash("sha256").update(JSON.stringify(candles)).digest("hex");
    const replayParameters = { ...result.parameters, marketCategory, ...(hypothesis ? { hypothesis } : {}) };
    const { data, error } = await supabase.from("strategy_backtest_runs").insert({
      user_id: user.id,
      symbol,
      interval,
      strategy_key: result.strategyKey,
      parameters: { ...replayParameters, candleHash, assetName: asset.name, assetKind: marketCategory === "SPOT" ? asset.kind : "stock-perpetual", walkForward, walkForwardStatus, costSensitivity, researchRunId },
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
    return Response.json({ run: { ...result, parameters: replayParameters, id: data.id, runId: data.id, createdAt: data.created_at, assetName: asset.name, assetKind: marketCategory === "SPOT" ? asset.kind : "stock-perpetual", candleHash, candles, walkForward, walkForwardStatus, costSensitivity, researchRunId, providerTimestamp: asset.providerTimestamp, sessionHours: asset.tradingSessions, weekendTradable: asset.weekendTradable } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backtest unavailable.";
    const status = /At least|too short/.test(message) ? 422 : 503;
    console.error("Strategy backtest failed", { symbol, interval, marketCategory, message: message.slice(0, 180) });
    return Response.json({ error: status === 422 ? message : "Bitget could not return enough usable candles for this market. Retry shortly; no result was stored." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
