import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BitgetRequestError, bitgetPrivateRequest, getBitgetCredentials } from "@/lib/bitget-private";
import { enqueueFuturesAccessEmail } from "@/lib/email/futures-access";
import { drainEmailQueue } from "@/lib/email/delivery";

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
    await bitgetPrivateRequest(credentials, "GET", "/api/v3/account/assets?category=USDT-FUTURES");
    const admin = createAdminClient();
    const { data: current } = await admin.from("futures_live_access_requests").select("status").eq("user_id", user.id).maybeSingle();
    if (current?.status === "approved") return NextResponse.json({ error: "Live access is already approved." }, { status: 409 });
    if (current?.status === "pending") return NextResponse.json({ error: "Your live access request is already under review." }, { status: 409 });
    const requestedAt = new Date().toISOString();
    const { error } = await admin.from("futures_live_access_requests").upsert({ user_id: user.id, status: "pending", terms_version: TERMS_VERSION, accepted_terms: Object.fromEntries(REQUIRED.map(key => [key, true])), requested_at: requestedAt, reviewed_at: null, review_note: null }, { onConflict: "user_id" });
    if (error) throw error;
    await enqueueFuturesAccessEmail({ admin, userId: user.id, eventKey: "futures-live-request-user:" + user.id + ":" + Date.parse(requestedAt), kind: "futures_access_submitted", title: "Request received", body: "Your live US stock perpetual access request is in the operator review queue. Review usually takes a few minutes to a few hours. You can continue using your $10,000 paper account in the meantime." });
    try {
      const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const reviewers = (usersPage?.users ?? []).filter(candidate => {
        const roles = candidate.app_metadata?.roles;
        return candidate.app_metadata?.role === "admin" || candidate.app_metadata?.role === "operator" || (Array.isArray(roles) && (roles.includes("admin") || roles.includes("operator")));
      });
      await Promise.all(reviewers.map(candidate => enqueueFuturesAccessEmail({ admin, userId: candidate.id, eventKey: "futures-live-request-reviewer:" + user.id + ":" + candidate.id + ":" + Date.parse(requestedAt), kind: "futures_access_request", title: "New live access request", body: "A user submitted a live US stock perpetual access request. Open the authenticated Tidelight operator review queue to inspect the accepted terms and make an auditable decision. Request reference: " + user.id + "." })));
      if (process.env.RESEND_API_KEY) await drainEmailQueue(admin);
    } catch { /* The committed request remains pending; the protected retry worker will deliver queued mail. */ }
    return NextResponse.json({ status: "pending", requestedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof BitgetRequestError) return NextResponse.json({ error: "Bitget could not verify USDT futures account access. Check that the saved live API key has futures account read permission and an allowed IP." }, { status: 422 });
    return NextResponse.json({ error: "Could not submit the live access request. Try again shortly." }, { status: 503 });
  }
}
