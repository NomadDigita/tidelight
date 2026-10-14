import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBitgetStockPerp, STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";
import { enqueueFuturesTradeEmail } from "@/lib/email/futures-trade";
import { drainEmailQueue } from "@/lib/email/delivery";
import { isPaperLimitImmediatelyMarketable, isPaperOrderTriggered, paperLimitReferencePrice } from "@/lib/futures-paper-order-policy";

export const dynamic = "force-dynamic";
type PaperOrder = { id: string; user_id: string; account_id: string; symbol: string; action: "open_long" | "open_short"; order_type: "limit" | "conditional"; margin: number; leverage: number; limit_price: number | null; trigger_price: number | null; post_only: boolean; reduce_only: boolean; status: "pending" | "processing" | "filled" | "canceled" | "blocked"; reason: string | null; fill_price: number | null; quantity: number | null; fill_id: string | null; processing_at: string | null; created_at: string; filled_at: string | null };

async function currentUser() {
  const supabase = await createClient();
  return (await supabase.auth.getUser()).data.user;
}

async function evaluate(order: PaperOrder, userId: string, admin: ReturnType<typeof createAdminClient>, currentPrice: number, providerTimestamp: number) {
  const price = order.order_type === "limit" ? Number(order.limit_price) : Number(order.trigger_price);
  const eligible = isPaperOrderTriggered(order.order_type, order.action, currentPrice, price);
  if (!eligible) return order;
  const { data: claim, error: claimError } = await admin.from("futures_paper_orders").update({ status: "processing", processing_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", order.id).eq("user_id", userId).eq("status", "pending").select("id").maybeSingle();
  if (claimError || !claim) return order;
  const referencePrice = order.order_type === "limit" ? paperLimitReferencePrice(order.action, currentPrice, price) : currentPrice;
  try {
    const { data, error } = await admin.rpc("futures_paper_manual_order", {
      p_user_id: userId, p_symbol: order.symbol, p_as_of_ms: providerTimestamp,
      p_reference_price: referencePrice, p_action: order.action, p_margin: Number(order.margin), p_leverage: Number(order.leverage),
    });
    if (error) throw error;
    const result = data as { id?: string; outcome?: string; reason?: string; fillPrice?: number; quantity?: number };
    const filled = result.outcome === "filled";
    const { data: fill } = filled && result.id ? await admin.from("futures_paper_fills").select("id,symbol,action,direction,quantity,fill_price,notional,fee,realized_pnl").eq("decision_id", result.id).maybeSingle() : { data: null };
    const next = { status: filled ? "filled" : "blocked", reason: result.reason ?? (filled ? "Paper order filled." : "Paper order blocked by account controls."), fill_price: result.fillPrice ?? null, quantity: result.quantity ?? null, fill_id: fill?.id ?? null, processing_at: null, filled_at: filled ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
    const { data: updated } = await admin.from("futures_paper_orders").update(next).eq("id", order.id).eq("status", "processing").select("*").maybeSingle();
    if (updated && fill?.id) {
      try {
        const closed = fill.action === "close";
        const side = fill.direction === "long" ? "Long" : "Short";
        const money = (amount: number) => Number(amount).toFixed(2);
        await enqueueFuturesTradeEmail({ admin, userId, eventKey: "futures-paper-trade:" + fill.id, title: fill.symbol + " · " + side + " position opened", body: ["Your simulated US stock perpetual paper trade was filled. No live Bitget order was sent.", "Contract: " + fill.symbol, "Action: " + side + (closed ? " position closed" : " position opened"), "Filled quantity: " + Number(fill.quantity).toFixed(8) + " " + fill.symbol.replace("USDT", ""), "Fill price: " + Number(fill.fill_price).toFixed(4) + " USDT", "Notional: " + money(Number(fill.notional)) + " USDT", "Trading fee: " + money(Number(fill.fee)) + " USDT", closed ? "Realized P&L after fee: " + (Number(fill.realized_pnl) >= 0 ? "+" : "") + money(Number(fill.realized_pnl)) + " USDT" : "Realized P&L: Not realized; the position is open.", "Fill reference: " + fill.id].join("\n") });
        if (process.env.RESEND_API_KEY) await drainEmailQueue(admin);
      } catch { console.error("Paper order fill email could not be queued."); }
    }
    return (updated as PaperOrder | null) ?? { ...order, ...next } as PaperOrder;
  } catch {
    await admin.from("futures_paper_orders").update({ status: "pending", processing_at: null, reason: "The market check could not complete; this order will be retried.", updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", "processing");
    return order;
  }
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view paper orders." }, { status: 401 });
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.toUpperCase();
  if (symbol && !STOCK_PERP_UNIVERSE.some(item => item === symbol)) return NextResponse.json({ error: "Choose a supported perpetual." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("futures_paper_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Paper orders are temporarily unavailable." }, { status: 503 });
  let orders = (data ?? []) as PaperOrder[];
  const staleClaims = orders.filter(order => order.status === "processing" && order.processing_at && Date.now() - new Date(order.processing_at).getTime() > 60_000);
  for (const order of staleClaims) await admin.from("futures_paper_orders").update({ status: "pending", processing_at: null, reason: "Market check resumed after an interrupted request.", updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", "processing");
  if (staleClaims.length) orders = orders.map(order => staleClaims.some(claim => claim.id === order.id) ? { ...order, status: "pending" } : order);
  if (url.searchParams.get("evaluate") === "1" && symbol) {
    const hasOpenOrder = orders.some(order => order.symbol === symbol && order.status === "pending");
    const quote = hasOpenOrder ? await getBitgetStockPerp(symbol) : null;
    if (quote?.lastPrice && quote.providerTimestamp && Date.now() - quote.providerTimestamp <= 60_000) {
      orders = await Promise.all(orders.map(order => order.symbol === symbol && order.status === "pending" ? evaluate(order, user.id, admin, quote.lastPrice, quote.providerTimestamp!) : order));
      const fresh = await admin.from("futures_paper_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
      if (!fresh.error && fresh.data) orders = fresh.data as PaperOrder[];
    }
  }
  return NextResponse.json({ orders }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to place a paper order." }, { status: 401 });
  let body: { symbol?: unknown; action?: unknown; orderType?: unknown; margin?: unknown; leverage?: unknown; limitPrice?: unknown; triggerPrice?: unknown; postOnly?: unknown; reduceOnly?: unknown; referencePrice?: unknown; priceProtection?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a valid paper order." }, { status: 400 }); }
  const symbol = typeof body.symbol === "string" ? body.symbol.toUpperCase() : "";
  const action = body.action;
  const orderType = body.orderType;
  const margin = Number(body.margin);
  const leverage = Number(body.leverage);
  const orderPrice = Number(orderType === "limit" ? body.limitPrice : body.triggerPrice);
  if (!STOCK_PERP_UNIVERSE.some(item => item === symbol) || !["open_long", "open_short"].includes(String(action))) return NextResponse.json({ error: "Choose a supported perpetual and order direction." }, { status: 400 });
  if (!(["limit", "conditional"] as const).includes(orderType as "limit" | "conditional")) return NextResponse.json({ error: "Only paper limit and conditional orders are supported here." }, { status: 400 });
  const validType = orderType as "limit" | "conditional";
  const validAction = action as "open_long" | "open_short";
  if (!Number.isFinite(margin) || margin < 10 || margin > 250 || !Number.isInteger(leverage) || leverage < 1 || leverage > 100) return NextResponse.json({ error: "Paper margin must be $10–$250 and leverage 1×–100×." }, { status: 400 });
  if (!Number.isFinite(orderPrice) || orderPrice <= 0 || body.reduceOnly === true) return NextResponse.json({ error: body.reduceOnly === true ? "Reduce-only entries require a matching open position." : "Enter a valid limit or trigger price." }, { status: 400 });
  try {
    const quote = await getBitgetStockPerp(symbol);
    if (!quote?.lastPrice || !quote.providerTimestamp || Date.now() - quote.providerTimestamp > 60_000) return NextResponse.json({ error: "Bitget's quote is stale. Try again when fresh market data is available." }, { status: 503 });
    if (body.priceProtection === true && (!Number.isFinite(Number(body.referencePrice)) || Number(body.referencePrice) <= 0 || Math.abs(quote.lastPrice - Number(body.referencePrice)) / Number(body.referencePrice) > 0.02)) return NextResponse.json({ error: "Price protection paused this order because the quote moved more than 2%. Review the updated market price." }, { status: 409 });
    if (orderPrice < quote.lastPrice * 0.25 || orderPrice > quote.lastPrice * 4) return NextResponse.json({ error: "The order price is outside the permitted review range for this quote." }, { status: 422 });
    if (validType === "limit" && body.postOnly === true && isPaperLimitImmediatelyMarketable(validAction, quote.lastPrice, orderPrice)) return NextResponse.json({ error: "This limit price would execute immediately. Change the price to preserve post-only intent." }, { status: 422 });
    const admin = createAdminClient();
    const { error: accountError } = await admin.from("futures_paper_accounts").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
    if (accountError) throw accountError;
    const { data: account, error: accountReadError } = await admin.from("futures_paper_accounts").select("id").eq("user_id", user.id).single();
    if (accountReadError || !account) throw accountReadError ?? new Error("Paper account unavailable.");
    const { count: openCount, error: openCountError } = await admin.from("futures_paper_orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending");
    if (openCountError) throw openCountError;
    if ((openCount ?? 0) >= 20) return NextResponse.json({ error: "Cancel an existing order before adding more. The paper account allows up to 20 open orders." }, { status: 429 });
    const { data, error } = await admin.from("futures_paper_orders").insert({ user_id: user.id, account_id: account.id, symbol, action: validAction, order_type: validType, margin, leverage, limit_price: validType === "limit" ? orderPrice : null, trigger_price: validType === "conditional" ? orderPrice : null, post_only: body.postOnly === true, reduce_only: false }).select("*").single();
    if (error || !data) throw error ?? new Error("Paper order was not saved.");
    let order = data as PaperOrder;
    if (isPaperOrderTriggered(validType, validAction, quote.lastPrice, orderPrice)) order = await evaluate(order, user.id, admin, quote.lastPrice, quote.providerTimestamp);
    return NextResponse.json({ order }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Futures paper order creation failed", error instanceof Error && "code" in error ? String(error.code) : "unavailable");
    return NextResponse.json({ error: "Could not save this paper order." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to cancel paper orders." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Choose an open paper order." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("futures_paper_orders").update({ status: "canceled", reason: "Canceled by the account holder.", updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).eq("status", "pending").select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not cancel this paper order." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "This order is no longer open." }, { status: 409 });
  return NextResponse.json({ canceled: true }, { headers: { "Cache-Control": "private, no-store" } });
}
