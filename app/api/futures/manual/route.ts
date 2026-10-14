import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBitgetStockPerp, STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";
import { enqueueFuturesTradeEmail } from "@/lib/email/futures-trade";
import { drainEmailQueue } from "@/lib/email/delivery";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to place a futures paper order." }, { status: 401 });
  let body: { symbol?: unknown; action?: unknown; margin?: unknown; leverage?: unknown; referencePrice?: unknown; priceProtection?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a valid workstation order." }, { status: 400 }); }
  const symbol = typeof body.symbol === "string" ? body.symbol.toUpperCase() : "";
  const action = body.action;
  const margin = Number(body.margin);
  const leverage = Number(body.leverage ?? 10);
  if (!Number.isInteger(leverage) || leverage < 1 || leverage > 100) return NextResponse.json({ error: "Leverage must be between 1× and 100×." }, { status: 400 });
  if (!STOCK_PERP_UNIVERSE.some((item) => item === symbol) || !["open_long","open_short","close"].includes(String(action))) return NextResponse.json({ error: "Choose a supported perpetual and order action." }, { status: 400 });
  if ((action === "open_long" || action === "open_short") && (!Number.isFinite(margin) || margin < 10 || margin > 250)) return NextResponse.json({ error: "Paper margin must be between 10 and 250 USDT." }, { status: 400 });
  try {
    const market = await getBitgetStockPerp(symbol);
    if (!market || !market.lastPrice || !market.providerTimestamp || Date.now() - market.providerTimestamp > 60_000) return NextResponse.json({ error: "Bitget's contract mark is stale. Try again when a fresh quote is available." }, { status: 503 });
    if (action !== "close" && body.priceProtection === true && (!Number.isFinite(Number(body.referencePrice)) || Number(body.referencePrice) <= 0 || Math.abs(market.lastPrice - Number(body.referencePrice)) / Number(body.referencePrice) > 0.02)) return NextResponse.json({ error: "Price protection paused this order because the quote moved more than 2%. Review the updated market price." }, { status: 409 });
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("futures_paper_manual_order", {
      p_user_id: user.id, p_symbol: symbol, p_as_of_ms: market.providerTimestamp,
      p_reference_price: market.lastPrice, p_action: action, p_margin: action === "close" ? 0 : margin, p_leverage: leverage,
    });
    if (error) {
      console.error("Futures paper order RPC failed", error.code);
      return NextResponse.json({ error: error.message?.includes("stale") ? "Bitget's contract mark is stale. Try again." : "Paper order could not be accepted." }, { status: 503 });
    }
    const result = data as { id?: string; action: string; outcome: string; reason: string; fillPrice?: number; quantity?: number; realizedPnl?: number };
    if (result.outcome === "filled" && result.id) {
      try {
        const { data: fill, error: fillError } = await admin.from("futures_paper_fills")
          .select("id,symbol,action,direction,quantity,fill_price,notional,fee,realized_pnl")
          .eq("decision_id", result.id)
          .maybeSingle();
        if (fillError) throw fillError;
        if (fill) {
          const closed = fill.action === "close";
          const side = fill.direction === "long" ? "Long" : "Short";
          const title = fill.symbol + " · " + side + (closed ? " position closed" : " position opened");
          const money = (value: number) => Number(value).toFixed(2);
          const bodyText = [
            "Your simulated US stock perpetual paper trade was filled. No live Bitget order was sent.",
            "Contract: " + fill.symbol,
            "Action: " + side + (closed ? " position closed" : " position opened"),
            "Filled quantity: " + Number(fill.quantity).toFixed(8) + " " + fill.symbol.replace("USDT", ""),
            "Fill price: " + Number(fill.fill_price).toFixed(4) + " USDT",
            "Notional: " + money(Number(fill.notional)) + " USDT",
            "Trading fee: " + money(Number(fill.fee)) + " USDT",
            closed ? "Realized P&L after fee: " + (Number(fill.realized_pnl) >= 0 ? "+" : "") + money(Number(fill.realized_pnl)) + " USDT" : "Realized P&L: Not realized; the position is open.",
            "Fill reference: " + fill.id,
          ].join("\n");
          await enqueueFuturesTradeEmail({
            admin,
            userId: user.id,
            eventKey: "futures-paper-trade:" + fill.id,
            title,
            body: bodyText,
          });
          if (process.env.RESEND_API_KEY) await drainEmailQueue(admin);
        }
      } catch (emailError) {
        const code = emailError instanceof Error && "code" in emailError ? String(emailError.code).slice(0, 64) : "delivery_queue_failed";
        console.error("Futures paper fill email queued for retry or recovery", code);
      }
    }
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Bitget market data or paper execution is temporarily unavailable." }, { status: 503 });
  }
}
