import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron secret is not configured." }, { status: 503 });
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const supabase = createAdminClient();
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) return NextResponse.json({ error: "Could not enumerate summary recipients." }, { status: 500 });
  let generated = 0;
  for (const user of users.users) {
    const { data: preferences } = await supabase.from("nightwatch_preferences").select("daily_summary").eq("user_id", user.id).maybeSingle();
    if (preferences?.daily_summary === false) continue;
    const { data: runs } = await supabase.from("nightwatch_runs").select("outcome, symbol").eq("user_id", user.id).gte("created_at", start.toISOString());
    const total = runs?.length ?? 0;
    const executed = runs?.filter((run) => run.outcome === "executed").length ?? 0;
    const blocked = runs?.filter((run) => run.outcome === "rejected").length ?? 0;
    const symbols = [...new Set((runs ?? []).map((run) => run.symbol))].slice(0, 4).join(", ") || "no markets";
    const body = `${total} decision${total === 1 ? "" : "s"} across ${symbols}; ${executed} paper fill${executed === 1 ? "" : "s"}, ${blocked} blocked by guardrails. No live orders were sent.`;
    const { data: existing } = await supabase.from("nightwatch_alerts").select("id").eq("user_id", user.id).eq("kind", "summary").gte("created_at", start.toISOString()).maybeSingle();
    const mutation = existing?.id ? supabase.from("nightwatch_alerts").update({ title: "Nightwatch daily summary", body, read_at: null }).eq("id", existing.id) : supabase.from("nightwatch_alerts").insert({ user_id: user.id, kind: "summary", title: "Nightwatch daily summary", body });
    const { error } = await mutation;
    if (!error) generated += 1;
  }
  return NextResponse.json({ generated, date: start.toISOString().slice(0, 10) });
}
