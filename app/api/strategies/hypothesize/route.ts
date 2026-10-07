import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALPHA_STRATEGIES, type StrategyKey } from "@/lib/backtest";
import { getBitgetAsset } from "@/lib/bitget-market";
import { draftAlphaHypothesis } from "@/lib/alpha-factory-agent";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const validIntervals = new Set(["1H", "4H", "1D"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to draft and save an Alpha hypothesis." }, { status: 401 });

  let body: { objective?: unknown; symbol?: unknown; interval?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 }); }

  const objective = typeof body.objective === "string" ? body.objective.trim() : "";
  const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  const interval = typeof body.interval === "string" ? body.interval : "4H";
  if (objective.length < 12 || objective.length > 800) return NextResponse.json({ error: "Describe a testable market idea in 12 to 800 characters." }, { status: 400 });
  if (!/^R[A-Z0-9]{1,20}USDT$/.test(symbol) || !validIntervals.has(interval)) return NextResponse.json({ error: "Choose a Bitget Reality rToken and a supported candle interval." }, { status: 400 });

  try {
    const asset = await getBitgetAsset(symbol);
    if (!asset?.isReality) return NextResponse.json({ error: "Alpha Factory only tests tokenized US equity Reality rTokens." }, { status: 422 });
    const hypothesis = await draftAlphaHypothesis({ objective, symbol, issuer: asset.name, interval });
    return NextResponse.json({ hypothesis, strategy: ALPHA_STRATEGIES[hypothesis.strategyKey as StrategyKey], market: { symbol: asset.symbol, issuer: asset.name, interval } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message.includes("not configured") ? 503 : 502;
    return NextResponse.json({ error: message || "Alpha Factory could not draft a hypothesis. Retry shortly." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
