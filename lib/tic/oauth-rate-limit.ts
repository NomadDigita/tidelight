import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type TicOAuthRateEndpoint = "register" | "authorize" | "token" | "revoke";

export async function reserveOAuthRateLimit(request: Request, endpoint: TicOAuthRateEndpoint, limit: number, windowSeconds: number) {
  const source = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
  const client = source.split(",")[0].trim().slice(0, 128) || "unknown";
  const secret = process.env.TIC_OAUTH_RATE_LIMIT_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("OAuth rate limit key is not configured.");
  const subjectHash = createHmac("sha256", secret).update(client).digest("hex");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reserve_tic_oauth_rate_limit", { p_subject_hash: subjectHash, p_endpoint: endpoint, p_max_requests: limit, p_window_seconds: windowSeconds });
  if (error) throw error;
  return data === true;
}
