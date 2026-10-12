import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueSecurityEmail } from "@/lib/email/nightwatch";
import { drainEmailQueue } from "@/lib/email/delivery";

export const dynamic = "force-dynamic";
const EVENTS = {
  passkey_registered: { title: "A passkey was added", body: "A new passkey was added to your Tidelight account. If you did not add it, remove unfamiliar passkeys and review your account security." },
  passkey_removed: { title: "A passkey was removed", body: "A passkey was removed from your Tidelight account. If you did not make this change, review your account security and sign-in methods." },
  email_changed: { title: "Your account email was changed", body: "A request was made to change the email address on your Tidelight account. Check your inboxes for Supabase's confirmation message. If you did not request this, contact security@tidelight.app." },
} as const;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  let event: keyof typeof EVENTS;
  try {
    const body = await request.json() as { event?: unknown };
    if (typeof body.event !== "string" || !Object.hasOwn(EVENTS, body.event)) return NextResponse.json({ error: "That account event cannot be notified." }, { status: 400 });
    event = body.event as keyof typeof EVENTS;
  } catch { return NextResponse.json({ error: "Send a valid account event." }, { status: 400 }); }
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin.from("security_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("event_type", event).gte("created_at", since);
    if (countError) throw new Error("rate_limit_check_failed");
    if ((count ?? 0) >= 3) return NextResponse.json({ ok: true, queued: false }, { headers: { "Cache-Control": "no-store" } });
    const { error: eventError } = await admin.from("security_events").insert({ user_id: user.id, event_type: event, metadata: { source: "authenticated_account_action" } });
    if (eventError) throw new Error("event_log_failed");
    const notice = EVENTS[event];
    await enqueueSecurityEmail({ admin, userId: user.id, eventKey: `security:${user.id}:${event}:${new Date().toISOString().slice(0, 10)}`, ...notice });
    after(async () => { try { await drainEmailQueue(admin); } catch { console.error("Account security email delivery deferred"); } });
    return NextResponse.json({ ok: true, queued: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Authenticated changes must not reveal internal mail or provider state to the caller.
    return NextResponse.json({ ok: true, queued: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
