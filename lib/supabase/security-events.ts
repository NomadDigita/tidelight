import type { SupabaseClient } from "@supabase/supabase-js";

export async function logSecurityEvent(supabase: SupabaseClient, userId: string, eventType: "mfa_required" | "mfa_verified" | "control_change" | "paper_exit", metadata: Record<string, unknown> = {}) {
  await supabase.from("security_events").insert({ user_id: userId, event_type: eventType, metadata });
}
