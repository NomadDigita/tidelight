import { createAdminClient } from "@/lib/supabase/admin";
import { hashOAuthSecret, isOAuthAccessToken, isOAuthRefreshToken, oauthNoStoreHeaders } from "@/lib/tic/oauth";
import { reserveOAuthRateLimit } from "@/lib/tic/oauth-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (request.headers.has("authorization")) return Response.json({ error: "invalid_client" }, { status: 400, headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*" } });
  try {
    if (!await reserveOAuthRateLimit(request, "revoke", 30, 3600)) return Response.json({ error: "slow_down" }, { status: 429, headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*" } });
  } catch { return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: oauthNoStoreHeaders() }); }
  let form: URLSearchParams;
  try {
    const raw = await request.text();
    if (raw.length > 8_192 || request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") throw new Error("invalid");
    form = new URLSearchParams(raw);
  } catch { return Response.json({ error: "invalid_request" }, { status: 400, headers: oauthNoStoreHeaders() }); }
  const clientId = form.get("client_id") ?? "";
  const token = form.get("token") ?? "";
  if (!/^tlic_[A-Za-z0-9_-]{32}$/.test(clientId) || (!isOAuthAccessToken(token) && !isOAuthRefreshToken(token))) return new Response(null, { status: 200, headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*" } });
  try {
    const admin = createAdminClient();
    const field = isOAuthAccessToken(token) ? "access_token_hash" : "refresh_token_hash";
    const { data: session, error } = await admin.from("tic_oauth_sessions").select("id").eq("client_id", clientId).eq(field, hashOAuthSecret(token)).maybeSingle();
    if (error) throw error;
    if (session) {
      const { error: revokeError } = await admin.from("tic_oauth_sessions").update({ revoked_at: new Date().toISOString(), access_token_hash: null, refresh_token_hash: null }).eq("id", session.id).is("revoked_at", null);
      if (revokeError) throw revokeError;
    }
    return new Response(null, { status: 200, headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*" } });
  } catch { return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*" } }); }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
