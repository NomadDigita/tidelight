import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBitgetCandles, getBitgetStockPerp, STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";
import { decideFuturesPaper } from "@/lib/futures-paper-agent";
import { ALPHA_STRATEGIES, type StrategyKey } from "@/lib/backtest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const FOUR_HOURS = 4 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to control your paper account." }, { status: 401 });
  let body: { paused?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a valid paper control." }, { status: 400 }); }
  if (typeof body?.paused !== "boolean") return NextResponse.json({ error: "Choose a valid pause state." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("futures_paper_accounts").upsert({ user_id: user.id, paused: body.paused, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) { console.error("Futures paper pause failed", error.code); return NextResponse.json({ error: "Could not update the paper account." }, { status: 503 }); }
    return NextResponse.json({ paused: body.paused }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Paper account control is unavailable." }, { status: 503 }); }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to use the private futures paper account." }, { status: 401 });
  let body: { symbol?: unknown; mode?: unknown; researchRunId?: unknown; playbookKey?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a valid paper check." }, { status: 400 }); }
  const symbol = typeof body?.symbol === "string" ? body.symbol.toUpperCase() : "";
  const mode = body?.mode === "close" ? "close" : "check";
  if (body?.mode != null && body.mode !== "check" && body.mode !== "close") return NextResponse.json({ error: "Choose check or close." }, { status: 400 });
  if (!STOCK_PERP_UNIVERSE.some(item => item === symbol)) return NextResponse.json({ error: "Choose a supported US stock perpetual." }, { status: 400 });
  const researchRunId = typeof body.researchRunId === "string" && UUID.test(body.researchRunId) ? body.researchRunId : null;
  if (body.researchRunId != null && !researchRunId) return NextResponse.json({ error: "The research note ID is invalid." }, { status: 400 });
  const playbookKey = typeof body.playbookKey === "string" && Object.hasOwn(ALPHA_STRATEGIES, body.playbookKey) ? body.playbookKey as StrategyKey : null;
  if (body.playbookKey != null && !playbookKey) return NextResponse.json({ error: "Choose an implemented Alpha Factory rule." }, { status: 400 });

  try {
    const asset = await getBitgetStockPerp(symbol);
    if (!asset) return NextResponse.json({ error: "This stock perpetual is not an active, verified Bitget market." }, { status: 422 });
    const now = Date.now();
    const candles = await getBitgetCandles(symbol, "4H", 1000, "USDT-FUTURES");
    const closed = candles.filter(candle => candle.timestamp + FOUR_HOURS <= now);
    if (closed.length < 60) return NextResponse.json({ error: "Not enough completed Bitget candles for a paper decision." }, { status: 422 });
    const latest = closed.at(-1)!;
    const candleEnd = latest.timestamp + FOUR_HOURS;
    if (now - candleEnd > 6 * 60 * 60 * 1000) return NextResponse.json({ error: "The stock perpetual candle is stale; no paper decision was sent." }, { status: 422 });

    const [accountResult, positionResult, priorResult, researchResult] = await Promise.all([
      supabase.from("futures_paper_accounts").select("cash_balance,paused").maybeSingle(),
      supabase.from("futures_paper_positions").select("symbol,direction,margin,quantity,entry_fill").maybeSingle(),
      mode === "check" ? supabase.from("futures_paper_decisions").select("id,action,outcome,reason").eq("symbol",symbol).eq("as_of",new Date(candleEnd).toISOString()).maybeSingle() : Promise.resolve({ data: null, error: null }),
      researchRunId ? supabase.from("research_runs").select("question,summary,status").eq("id",researchRunId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (accountResult.error || positionResult.error || priorResult.error || researchResult.error) return NextResponse.json({ error: "The private paper account could not be loaded." }, { status: 503 });
    if (researchRunId && !researchResult.data) return NextResponse.json({ error: "That research note is unavailable in this account." }, { status: 403 });
    if (priorResult.data) return NextResponse.json({ result: { id: priorResult.data.id, action: priorResult.data.action, outcome: priorResult.data.outcome, reason: priorResult.data.reason, idempotent: true } });
    const position = positionResult.data;
    if (mode === "close" && (!position || position.symbol !== symbol)) return NextResponse.json({ error: "No matching futures paper position is open." }, { status: 422 });
    const actualPlaybook = playbookKey ?? "sma_trend_v1";
    const decision = mode === "check" ? await decideFuturesPaper({
      symbol, issuer: asset.name, candles: closed.slice(-90), position: position?.direction === "long" || position?.direction === "short" ? position.direction : null,
      cashUsd: Number(accountResult.data?.cash_balance ?? 10000), playbookKey: actualPlaybook,
      research: researchResult.data?.status === "complete" ? { question: researchResult.data.question, summary: researchResult.data.summary } : null,
    }) : { proposedAction: "close", action: "close", confidence: 1, rationale: "Account owner requested a paper exit.", evidence: [`${symbol} verified Bitget market`], risks: ["Paper mark can differ from a live exchange fill"], invalidation: "Position closed" };
    // Manual exits use a current verified ticker mark and a distinct UTC timestamp.
    // They can close a position after a check on the same completed candle.
    if (mode === "close" && (!asset.providerTimestamp || now - asset.providerTimestamp > 60_000 || asset.providerTimestamp > now + 60_000)) return NextResponse.json({ error: "The live Bitget mark is stale; manual paper exit was not recorded." }, { status: 422 });
    const mark = mode === "close" ? asset.lastPrice : latest.close;
    const asOfMs = mode === "close" ? now : candleEnd;
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("futures_paper_apply", {
      p_user_id: user.id, p_symbol: symbol, p_as_of_ms: asOfMs, p_reference_price: mark, p_action: decision.action,
      p_snapshot: { agent: decision, playbook: { key: actualPlaybook, label: ALPHA_STRATEGIES[actualPlaybook].label },
        source: mode === "close" ? "Bitget verified USDT-FUTURES ticker" : "Bitget completed USDT-FUTURES 4H candle",
        researchRunId, candleEnd: new Date(candleEnd).toISOString(), marketCategory: "USDT-FUTURES", paperOnly: true, maxLeverage: 1 },
    });
    if (error) { console.error("Futures paper persistence failed", error.code); return NextResponse.json({ error: "Could not save the futures paper decision." }, { status: 503 }); }
    return NextResponse.json({ result: data, decision, market: { symbol, name: asset.name, price: mark, asOf: new Date(asOfMs).toISOString() } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Futures paper check failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "The futures paper check could not finish. No exchange order was placed." }, { status: 502 });
  }
}
