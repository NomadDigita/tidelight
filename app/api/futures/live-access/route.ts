import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BitgetRequestError, bitgetPrivateRequest, getBitgetCredentials } from "@/lib/bitget-private";

export const dynamic = "force-dynamic";
const TERMS_VERSION = "2026-10-13";
const REQUIRED = ["market_risk","liquidation","api_permissions","key_security","manual_orders"] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const admin = createAdminClient();
    const [{ data: access, error }, credentials] = await Promise.all([
      admin.from("futures_live_access_requests").select("status,terms_version,requested_at,reviewed_at,review_note").eq("user_id", user.id).maybeSingle(),
      getBitgetCredentials(user.id),
    ]);
    if (error) throw error;
    return NextResponse.json({ status: access?.status ?? "not_requested", requestedAt: access?.requested_at ?? null, reviewedAt: access?.reviewed_at ?? null, reviewNote: access?.review_note ?? null, liveKeyConfigured: credentials?.mode === "live" }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Live access status is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to request live futures access." }, { status: 401 });
  let body: { termsVersion?: unknown; accepted?: Record<string, unknown> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Review the live trading terms and try again." }, { status: 400 }); }
  if (body.termsVersion !== TERMS_VERSION || !body.accepted || REQUIRED.some(key => body.accepted?.[key] !== true)) return NextResponse.json({ error: "All five live trading acknowledgements are required." }, { status: 400 });
  try {
    const credentials = await getBitgetCredentials(user.id);
    if (!credentials || credentials.mode !== "live") return NextResponse.json({ error: "Configure and verify a live Bitget API connection in Tidelight Settings first." }, { status: 409 });
    await bitgetPrivateRequest(credentials, "GET", "/api/v3/account/account?category=USDT-FUTURES");
    const admin = createAdminClient();
    const { data: current } = await admin.from("futures_live_access_requests").select("status").eq("user_id", user.id).maybeSingle();
    if (current?.status === "approved") return NextResponse.json({ error: "Live access is already approved." }, { status: 409 });
    if (current?.status === "pending") return NextResponse.json({ error: "Your live access request is already under review." }, { status: 409 });
    const { error } = await admin.from("futures_live_access_requests").upsert({ user_id: user.id, status: "pending", terms_version: TERMS_VERSION, accepted_terms: Object.fromEntries(REQUIRED.map(key => [key, true])), requested_at: new Date().toISOString(), reviewed_at: null, review_note: null }, { onConflict: "user_id" });
    if (error) throw error;
    return NextResponse.json({ status: "pending", requestedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof BitgetRequestError) return NextResponse.json({ error: "Bitget could not verify USDT futures account access. Check that the saved live API key has futures account read permission and an allowed IP." }, { status: 422 });
    return NextResponse.json({ error: "Could not submit the live access request. Try again shortly." }, { status: 503 });
  }
}
