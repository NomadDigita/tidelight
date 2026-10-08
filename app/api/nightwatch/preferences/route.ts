import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeNightwatchPreferences } from "@/lib/nightwatch-preferences";
import { getBitgetAsset } from "@/lib/bitget-market";

const defaults = normalizeNightwatchPreferences({});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage Nightwatch preferences." }, { status: 401 });
  const { data, error } = await supabase.from("nightwatch_preferences").select("trigger_mode, monitor_symbol, research_run_id, alert_on_signal, alert_on_fill, daily_summary, playbook_key").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load Nightwatch preferences." }, { status: 503 });
  const schedulerAvailable = Boolean(process.env.CRON_SECRET && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
  return NextResponse.json({ ...(data ?? defaults), scheduler_available: schedulerAvailable });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage Nightwatch preferences." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Send valid JSON." }, { status: 400 }); }
  if (body.trigger_mode === "every_check") {
    const symbol = typeof body.monitor_symbol === "string" ? body.monitor_symbol.toUpperCase() : "";
    if (!/^[A-Z0-9]{2,24}USDT$/.test(symbol)) return NextResponse.json({ error: "Choose one Bitget Reality market for scheduled paper checks." }, { status: 400 });
    const schedulerAvailable = Boolean(process.env.CRON_SECRET && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
    if (!schedulerAvailable) return NextResponse.json({ error: "Scheduled checks are not enabled on this deployment yet. Configure the protected server-side scheduler first." }, { status: 503 });
    const asset = await getBitgetAsset(symbol).catch(() => null);
    if (!asset?.isReality) return NextResponse.json({ error: "Scheduled Nightwatch checks only support a verified Bitget Reality market." }, { status: 422 });
  }
  const researchRunId = typeof body.research_run_id === "string" ? body.research_run_id : null;
  if (researchRunId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(researchRunId)) return NextResponse.json({ error: "The linked research note ID is invalid." }, { status: 400 });
    const { data: linkedRun, error: linkedRunError } = await supabase.from("research_runs").select("id").eq("id", researchRunId).maybeSingle();
    if (linkedRunError || !linkedRun) return NextResponse.json({ error: "The linked research note is unavailable in this account." }, { status: 403 });
  }
  const values = { user_id: user.id, ...normalizeNightwatchPreferences(body), updated_at: new Date().toISOString() };
  const { error } = await supabase.from("nightwatch_preferences").upsert(values, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Could not save Nightwatch preferences." }, { status: 503 });
  return NextResponse.json(values);
}
