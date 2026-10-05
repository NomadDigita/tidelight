import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBitgetAsset } from "@/lib/bitget-market";
import { requiresMfa } from "@/lib/supabase/aal";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to close a paper position." }, { status: 401 });
  if (await requiresMfa(supabase)) return NextResponse.json({ code: "mfa_required", error: "Verify your authenticator before closing a paper position." }, { status: 403 });
  let body: { symbol?: unknown; reason?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 }); }
  const symbol = typeof body.symbol === "string" ? body.symbol.toUpperCase() : "";
  if (!/^[A-Z0-9]{2,24}USDT$/.test(symbol)) return NextResponse.json({ error: "Choose a valid Bitget Reality market." }, { status: 400 });
  const asset = await getBitgetAsset(symbol).catch(() => null);
  if (!asset?.isReality || !asset.lastPrice || asset.lastPrice <= 0) return NextResponse.json({ error: "A current Bitget Reality price is required for this paper exit." }, { status: 422 });
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 240) : "Manual paper exit";
  const { data, error } = await supabase.rpc("nightwatch_close_position", { p_symbol: symbol, p_reference_price: asset.lastPrice, p_reason: reason });
  if (error) return NextResponse.json({ error: error.message.includes("No open") ? error.message : "Could not close the paper position." }, { status: 409 });
  return NextResponse.json({ result: data, price: asset.lastPrice });
}
