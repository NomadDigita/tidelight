import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

async function currentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error ? null : user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to read account privacy settings." }, { status: 401, headers: noStore });
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("account_privacy_preferences").select("analytics_choice,updated_at").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ choice: data?.analytics_choice ?? null, updatedAt: data?.updated_at ?? null }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Account privacy settings are unavailable." }, { status: 503, headers: noStore });
  }
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save account privacy settings." }, { status: 401, headers: noStore });
  let body: { choice?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a valid analytics choice." }, { status: 400, headers: noStore }); }
  if (body.choice !== "accepted" && body.choice !== "rejected") return NextResponse.json({ error: "Choose allow or reject analytics." }, { status: 400, headers: noStore });
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("account_privacy_preferences").upsert({ user_id: user.id, analytics_choice: body.choice, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select("analytics_choice,updated_at").single();
    if (error || !data) throw error ?? new Error("Privacy choice was not saved.");
    return NextResponse.json({ choice: data.analytics_choice, updatedAt: data.updated_at }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Could not save the account privacy choice." }, { status: 503, headers: noStore });
  }
}
