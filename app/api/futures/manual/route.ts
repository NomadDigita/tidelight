import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBitgetStockPerp, STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to place a futures paper order." }, { status: 401 });
  let body: { symbol?: unknown; action?: unknown; margin?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a valid workstation order." }, { status: 400 }); }
  const symbol = typeof body.symbol === "string" ? body.symbol.toUpperCase() : "";
  const action = body.action;
  const margin = Number(body.margin);
  if (!STOCK_PERP_UNIVERSE.some((item) => item === symbol) || !["open_long","open_short","close"].includes(String(action))) return NextResponse.json({ error: "Choose a supported perpetual and order action." }, { status: 400 });
  if ((action === "open_long" || action === "open_short") && (!Number.isFinite(margin) || margin < 10 || margin > 250)) return NextResponse.json({ error: "Paper margin must be between 10 and 250 USDT." }, { status: 400 });
  try {
    const market = await getBitgetStockPerp(symbol);
    if (!market || !market.lastPrice || !market.providerTimestamp || Date.now() - market.providerTimestamp > 60_000) return NextResponse.json({ error: "Bitget's contract mark is stale. Try again when a fresh quote is available." }, { status: 503 });
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("futures_paper_manual_order", {
      p_user_id: user.id, p_symbol: symbol, p_as_of_ms: market.providerTimestamp,
      p_reference_price: market.lastPrice, p_action: action, p_margin: action === "close" ? 0 : margin,
    });
    if (error) {
      console.error("Futures paper order RPC failed", error.code);
      return NextResponse.json({ error: error.message?.includes("stale") ? "Bitget's contract mark is stale. Try again." : "Paper order could not be accepted." }, { status: 503 });
    }
    const result = data as { action: string; outcome: string; reason: string; fillPrice?: number; quantity?: number; realizedPnl?: number };
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Bitget market data or paper execution is temporarily unavailable." }, { status: 503 });
  }
}
