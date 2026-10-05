import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeNightwatchPreferences } from "@/lib/nightwatch-preferences";

const defaults = normalizeNightwatchPreferences({});

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
  const values = { user_id: user.id, ...normalizeNightwatchPreferences(body), updated_at: new Date().toISOString() };
  const { error } = await supabase.from("nightwatch_preferences").upsert(values, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Could not save Nightwatch preferences." }, { status: 503 });
  return NextResponse.json(values);
}
