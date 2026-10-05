import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to manage Nightwatch alerts." }, { status: 401 });
  let body: { id?: unknown; all?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Send a valid alert update." }, { status: 400 }); }
  const now = new Date().toISOString();
  const query = supabase.from("nightwatch_alerts").update({ read_at: now }).eq("user_id", user.id).is("read_at", null);
  if (typeof body.id === "string" && body.id.length > 0) query.eq("id", body.id);
  else if (body.all !== true) return NextResponse.json({ error: "Choose an alert or mark all as read." }, { status: 400 });
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Could not update the alert stream." }, { status: 500 });
  return NextResponse.json({ readAt: now });
}
