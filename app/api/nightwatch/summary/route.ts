import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to generate a Nightwatch summary." }, { status: 401 });
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const { data: runs, error } = await supabase.from("nightwatch_runs").select("id, signal, outcome, symbol").gte("created_at", start.toISOString());
  if (error) return NextResponse.json({ error: "Could not read today's paper decisions." }, { status: 500 });
  const total = runs?.length ?? 0;
  const executed = runs?.filter((run) => run.outcome === "executed").length ?? 0;
  const blocked = runs?.filter((run) => run.outcome === "rejected").length ?? 0;
  const symbols = [...new Set((runs ?? []).map((run) => run.symbol))].slice(0, 4).join(", ") || "no markets";
  const body = `${total} decision${total === 1 ? "" : "s"} across ${symbols}; ${executed} paper fill${executed === 1 ? "" : "s"}, ${blocked} blocked by guardrails. No live orders were sent.`;
  const { data: existing } = await supabase.from("nightwatch_alerts").select("id").eq("kind", "summary").gte("created_at", start.toISOString()).maybeSingle();
  const mutation = existing?.id
    ? supabase.from("nightwatch_alerts").update({ title: "Nightwatch daily summary", body, read_at: null }).eq("id", existing.id)
    : supabase.from("nightwatch_alerts").insert({ user_id: user.id, kind: "summary", title: "Nightwatch daily summary", body });
  const { data: alert, error: insertError } = await mutation.select("id, kind, title, body, read_at, created_at").single();
  if (insertError) return NextResponse.json({ error: "Could not save today's summary." }, { status: 500 });
  return NextResponse.json({ alert });
}
