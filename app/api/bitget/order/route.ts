import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBitgetCredentials, bitgetPrivateRequest } from "@/lib/bitget-private";
import { getBitgetAsset } from "@/lib/bitget-market";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in before placing an order." }, { status: 401 });
  let body: { symbol?: unknown; side?: unknown; orderType?: unknown; quantity?: unknown; price?: unknown; confirmation?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Review the order details and try again." }, { status: 400 }); }
  const symbol = typeof body.symbol === "string" ? body.symbol.trim().toUpperCase() : "";
  const side = body.side === "buy" || body.side === "sell" ? body.side : "";
  const orderType = body.orderType === "limit" || body.orderType === "market" ? body.orderType : "";
  const quantity = Number(body.quantity); const limitPrice = Number(body.price);
  if (!side || !orderType || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000000) return NextResponse.json({ error: "Enter a valid side, order type, and quantity." }, { status: 400 });
  try {
    const credentials = await getBitgetCredentials(user.id);
    if (!credentials) return NextResponse.json({ error: "Connect and verify a Bitget account first." }, { status: 409 });
    const expectedConfirmation = credentials.mode === "live" ? "PLACE LIVE ORDER" : "PLACE DEMO ORDER";
    if (body.confirmation !== expectedConfirmation) return NextResponse.json({ error: "The order confirmation did not match the selected account mode." }, { status: 400 });
    if (credentials.mode === "live") {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.currentLevel !== "aal2") return NextResponse.json({ error: "Complete an authenticator check before placing a live order.", mfaRequired: true }, { status: 403 });
    }
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: attempts, error: auditReadError } = await supabase.from("security_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("event_type", "bitget_order_attempt").gte("created_at", hourAgo);
    if (auditReadError) return NextResponse.json({ error: "Could not check the order safety limit. No order was sent." }, { status: 503 });
    if ((attempts ?? 0) >= 5) return NextResponse.json({ error: "This account has reached the five order attempts per hour safety limit." }, { status: 429 });
    const asset = await getBitgetAsset(symbol);
    if (!asset?.isReality || asset.kind !== "rtoken" || asset.quoteCoin !== "USDT") return NextResponse.json({ error: "Tidelight only routes spot orders for verified Bitget Reality stock tokens." }, { status: 422 });
    if (!Number.isFinite(asset.lastPrice) || asset.lastPrice <= 0) return NextResponse.json({ error: "A current Bitget price is unavailable. No order was sent." }, { status: 422 });
    if (orderType === "limit" && (!Number.isFinite(limitPrice) || limitPrice <= 0 || Math.abs(limitPrice / asset.lastPrice - 1) > 0.05)) return NextResponse.json({ error: "A limit price must be within 5% of the latest Bitget reference price." }, { status: 400 });
    const estimatedNotional = side === "buy" && orderType === "market" ? quantity : quantity * (orderType === "limit" ? limitPrice : asset.lastPrice);
    if (estimatedNotional > 250) return NextResponse.json({ error: "This first release caps each order at 250 USDT. Reduce the order size." }, { status: 400 });
    const payload: Record<string, unknown> = {
      category: "SPOT", symbol, qty: String(quantity), side, orderType,
      clientOid: crypto.randomUUID(),
      ...(orderType === "limit" ? { price: String(limitPrice), timeInForce: "GTC" } : {}),
    };
    const { error: auditWriteError } = await supabase.from("security_events").insert({
      user_id: user.id, event_type: "bitget_order_attempt",
      metadata: { mode: credentials.mode, symbol, side, orderType, estimatedNotional, createdAt: new Date().toISOString() },
    });
    if (auditWriteError) return NextResponse.json({ error: "Could not write the order audit record. No order was sent." }, { status: 503 });
    const result = await bitgetPrivateRequest(credentials, "POST", "/api/v3/trade/place-order", payload);
    return NextResponse.json({ accepted: true, mode: credentials.mode, symbol, side, orderType, estimatedNotional, order: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "credential-encryption-not-configured") return NextResponse.json({ error: "Secure key storage is unavailable. No order was sent." }, { status: 503 });
    if (message === "connection-read-failed") return NextResponse.json({ error: "Could not load the verified account." }, { status: 503 });
    return NextResponse.json({ error: "Bitget did not accept the request. Check the account mode, available balance, instrument status, and API permissions. The exchange may have received a timed-out request; inspect Bitget order history before retrying." }, { status: 502 });
  }
}
