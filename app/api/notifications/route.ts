import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view notifications." }, { status: 401 });
  const [alerts, security, receipts] = await Promise.all([
    supabase.from("nightwatch_alerts").select("id,kind,title,body,read_at,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("security_events").select("id,event_type,metadata,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("notification_read_receipts").select("security_event_id,read_at"),
  ]);
  if (alerts.error || security.error || receipts.error) return NextResponse.json({ error: "Notifications could not be loaded." }, { status: 503 });
  const receiptByEvent = new Map((receipts.data ?? []).map((receipt) => [receipt.security_event_id, receipt.read_at]));
  const events = (security.data ?? []).map((event) => {
    const details = event.metadata && typeof event.metadata === "object" ? event.metadata as Record<string, unknown> : {};
    const labels: Record<string, [string, string]> = {
      mfa_required: ["Extra verification requested", "A sensitive account action requested an authenticator check."],
      mfa_verified: ["Authenticator check passed", "Your identity was confirmed for a sensitive action."],
      passkey_signin: ["Passkey sign-in completed", "A passkey was used to access your Tidelight account."],
      passkey_registered: ["Passkey added", "A passkey was registered to your account."],
      passkey_removed: ["Passkey removed", "A passkey was removed from your account."],
      control_change: [details.paused === true ? "Nightwatch paused" : "Nightwatch resumed", "Your paper agent control was changed."],
      paper_exit: ["Paper position closed", `A simulated position${typeof details.symbol === "string" ? ` in ${details.symbol}` : ""} was closed.`],
      bitget_connection_removed: ["Bitget connection removed", "A connected exchange credential was removed."],
    };
    const [title, body] = labels[event.event_type] ?? ["Account security event", "A security-related action was recorded on your account."];
    return { id: `security-${event.id}`, kind: "security", title, body, read_at: receiptByEvent.get(event.id) ?? null, created_at: event.created_at };
  });
  const notices = [...(alerts.data ?? []), ...events].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return NextResponse.json({ notifications: notices }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update notifications." }, { status: 401 });
  let body: { id?: unknown; all?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Send valid JSON." }, { status: 400 }); }
  const readAt = new Date().toISOString();
  let result;
  if (body.all === true) {
    result = await supabase.from("nightwatch_alerts").update({ read_at: readAt }).is("read_at", null);
    const { data: events, error: eventsError } = await supabase.from("security_events").select("id");
    if (eventsError) return NextResponse.json({ error: "Could not update notification status." }, { status: 503 });
    if (events?.length) {
      const { error } = await supabase.from("notification_read_receipts").upsert(events.map((event) => ({ user_id: user.id, security_event_id: event.id, read_at: readAt })), { onConflict: "user_id,security_event_id" });
      if (error) return NextResponse.json({ error: "Could not update notification status." }, { status: 503 });
    }
  }
  else if (typeof body.id === "string" && body.id.startsWith("security-") && /^[0-9a-f-]{36}$/i.test(body.id.slice(9))) {
    const { error } = await supabase.from("notification_read_receipts").upsert({ user_id: user.id, security_event_id: body.id.slice(9), read_at: readAt }, { onConflict: "user_id,security_event_id" });
    if (error) return NextResponse.json({ error: "Could not update notification status." }, { status: 503 });
    return NextResponse.json({ ok: true });
  }
  else if (typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id)) result = await supabase.from("nightwatch_alerts").update({ read_at: readAt }).eq("id", body.id);
  else return NextResponse.json({ error: "Choose a valid notification." }, { status: 400 });
  if (result?.error) return NextResponse.json({ error: "Could not update notification status." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
