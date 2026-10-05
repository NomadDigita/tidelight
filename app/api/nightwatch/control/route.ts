import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requiresMfa } from "@/lib/supabase/aal";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to manage Nightwatch." }, { status: 401 });
  if (await requiresMfa(supabase)) return NextResponse.json({ code: "mfa_required", error: "Verify your authenticator before changing the agent state." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { paused?: unknown };
  if (typeof body.paused !== "boolean") return NextResponse.json({ error: "Choose pause or resume." }, { status: 400 });
  const { data, error } = await supabase.rpc("nightwatch_set_paused", { p_paused: body.paused });
  if (error) {
    console.error("Nightwatch control update failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Could not update the paper agent state." }, { status: 500 });
  }
  return NextResponse.json({ paused: data });
}
