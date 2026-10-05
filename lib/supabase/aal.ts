import type { SupabaseClient } from "@supabase/supabase-js";

export async function requiresMfa(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return false;
  return data.currentLevel === "aal1" && data.nextLevel === "aal2";
}
