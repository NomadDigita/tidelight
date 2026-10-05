import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const defaults = { trigger_mode: "manual", alert_on_signal: true, alert_on_fill: true, daily_summary: true } as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage Nightwatch preferences." }, { status: 401 });
  const { data, error } = await supabase.from("nightwatch_preferences").select("trigger_mode, alert_on_signal, alert_on_fill, daily_summary").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load Nightwatch preferences." }, { status: 503 });
  return NextResponse.json(data ?? defaults);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to manage Nightwatch preferences." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return NextResponse.json({ error: "Send valid JSON." }, { status: 400 }); }
  const trigger_mode = body.trigger_mode === "every_check" ? "every_check" : "manual";
  const values = { user_id: user.id, trigger_mode, alert_on_signal: body.alert_on_signal !== false, alert_on_fill: body.alert_on_fill !== false, daily_summary: body.daily_summary !== false, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("nightwatch_preferences").upsert(values, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Could not save Nightwatch preferences." }, { status: 503 });
  return NextResponse.json(values);
}
