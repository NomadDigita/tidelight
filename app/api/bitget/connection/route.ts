import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ connected: false, liveReady: false }, { status: 401 });
  const { data, error } = await supabase.from("bitget_connections").select("id, label, mode, live_enabled, last_validated_at, encryption_version").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not read the Bitget connection state." }, { status: 500 });
  return NextResponse.json({ connected: Boolean(data), liveReady: false, connection: data ? { ...data, live_enabled: false, mode: "paper" } : null });
}
