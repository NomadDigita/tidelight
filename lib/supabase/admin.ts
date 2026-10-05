import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Service-role access is isolated to protected server jobs. Never import in a client component. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server secret is not configured.");
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
