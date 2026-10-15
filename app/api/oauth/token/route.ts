import { createAdminClient } from "@/lib/supabase/admin";
import { createOAuthSecret, hashOAuthSecret, isOAuthRefreshToken, pkceChallengeMatches, TIC_MCP_RESOURCE, oauthNoStoreHeaders } from "@/lib/tic/oauth";
import { reserveOAuthRateLimit } from "@/lib/tic/oauth-rate-limit";

export const dynamic = "force-dynamic";

function tokenResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*" } });
}

function tokenError(error: string, status = 400) { return tokenResponse({ error }, status); }

async function parseRequest(request: Request): Promise<URLSearchParams | null> {
  try {
    if ((Number(request.headers.get("content-length")) || 0) > 8_192) return null;
    const raw = await request.text();
    if (raw.length > 8_192) return null;
    const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (type === "application/x-www-form-urlencoded") return new URLSearchParams(raw);
    if (type === "application/json") {
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      return new URLSearchParams(Object.entries(value as Record<string, unknown>).filter(([, item]) => typeof item === "string") as [string, string][]);
    }
    return null;
  } catch { return null; }
}

export async function POST(request: Request) {
  if (request.headers.has("authorization")) return tokenError("invalid_client");
  try {
    if (!await reserveOAuthRateLimit(request, "token", 120, 60)) return Response.json({ error: "slow_down" }, { status: 429, headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*", "Retry-After": "60" } });
  } catch { return tokenError("temporarily_unavailable", 503); }
  const params = await parseRequest(request);
  if (!params) return tokenError("invalid_request", 413);
  const clientId = params.get("client_id") ?? "";
  const resource = params.get("resource");
  if (!/^tlic_[A-Za-z0-9_-]{32}$/.test(clientId) || resource !== TIC_MCP_RESOURCE || params.has("client_secret")) return tokenError("invalid_request");
  const grantType = params.get("grant_type");
  const admin = createAdminClient();
  const now = new Date();
  const accessToken = createOAuthSecret("access");
  const refreshToken = createOAuthSecret("refresh");
  try {
    if (grantType === "authorization_code") {
      const code = params.get("code") ?? "";
      const redirectUri = params.get("redirect_uri") ?? "";
      const verifier = params.get("code_verifier") ?? "";
      if (!/^tic_code_[A-Za-z0-9_-]{43}$/.test(code) || !redirectUri) return tokenError("invalid_grant");
      const { data: session, error } = await admin.from("tic_oauth_sessions").select("id,code_challenge,scopes,key_id,redirect_uri,resource").eq("client_id", clientId).eq("authorization_code_hash", hashOAuthSecret(code)).eq("redirect_uri", redirectUri).eq("resource", resource).is("code_used_at", null).gt("code_expires_at", now.toISOString()).maybeSingle();
      if (error) throw error;
      if (!session || !pkceChallengeMatches(verifier, session.code_challenge)) return tokenError("invalid_grant");
      const { data: key, error: keyError } = await admin.from("developer_api_keys").select("revoked_at,expires_at,scopes").eq("id", session.key_id).maybeSingle();
      if (keyError) throw keyError;
      if (!key || key.revoked_at || (key.expires_at && Date.parse(key.expires_at) <= now.getTime()) || !session.scopes.every((scope: string) => key.scopes.includes(scope))) return tokenError("invalid_grant");
      const { data: consumed, error: consumeError } = await admin.from("tic_oauth_sessions").update({
        code_used_at: now.toISOString(), authorization_code_hash: null, code_challenge: null,
        access_token_hash: hashOAuthSecret(accessToken), access_token_expires_at: new Date(now.getTime() + 15 * 60_000).toISOString(),
        refresh_token_hash: hashOAuthSecret(refreshToken), refresh_token_expires_at: new Date(now.getTime() + 90 * 24 * 60 * 60_000).toISOString(),
      }).eq("id", session.id).is("code_used_at", null).eq("authorization_code_hash", hashOAuthSecret(code)).select("id").maybeSingle();
      if (consumeError) throw consumeError;
      if (!consumed) return tokenError("invalid_grant");
      return tokenResponse({ access_token: accessToken, token_type: "Bearer", expires_in: 900, refresh_token: refreshToken, scope: session.scopes.join(" "), resource: TIC_MCP_RESOURCE });
    }
    if (grantType === "refresh_token") {
      const oldRefresh = params.get("refresh_token") ?? "";
      if (!isOAuthRefreshToken(oldRefresh)) return tokenError("invalid_grant");
      const requestedScopes = params.has("scope") ? (params.get("scope") ?? "").trim().split(/\s+/).filter(Boolean) : null;
      const { data: rotation, error: rotateError } = await admin.rpc("rotate_tic_oauth_refresh_token", {
        p_client_id: clientId,
        p_old_refresh_hash: hashOAuthSecret(oldRefresh),
        p_new_access_hash: hashOAuthSecret(accessToken),
        p_new_refresh_hash: hashOAuthSecret(refreshToken),
        p_requested_scopes: requestedScopes,
        p_access_expires_at: new Date(now.getTime() + 15 * 60_000).toISOString(),
        p_refresh_expires_at: new Date(now.getTime() + 90 * 24 * 60 * 60_000).toISOString(),
      });
      if (rotateError) throw rotateError;
      if (!rotation || typeof rotation !== "object" || !("status" in rotation)) throw new Error("Refresh rotation returned an invalid result.");
      const result = rotation as { status: unknown; scopes?: unknown };
      if (result.status === "invalid_scope") return tokenError("invalid_scope");
      if (result.status !== "rotated" || !Array.isArray(result.scopes) || result.scopes.some((scope) => typeof scope !== "string")) return tokenError("invalid_grant");
      return tokenResponse({ access_token: accessToken, token_type: "Bearer", expires_in: 900, refresh_token: refreshToken, scope: result.scopes.join(" "), resource: TIC_MCP_RESOURCE });
    }
    return tokenError("unsupported_grant_type");
  } catch { return tokenError("temporarily_unavailable", 503); }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...oauthNoStoreHeaders(), "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}
