import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { developerKeyHashFromRequest } from "@/lib/tic/credentials";
import { hashOAuthSecret, isOAuthAccessToken } from "@/lib/tic/oauth";
import { isTicMcpCredentialActive } from "@/lib/tic/mcp-protocol";

export type TicMcpCredential = { secret: string; scopes: string[] };

export async function authenticateTicMcpRequest(request: Request): Promise<TicMcpCredential | null> {
  const secret = request.headers.get("authorization") ? request.headers.get("authorization")!.replace(/^Bearer\s+/i, "") : "";
  const keyHash = developerKeyHashFromRequest(request);
  const admin = createAdminClient();
  if (!keyHash && isOAuthAccessToken(secret)) {
    const { data: token, error: tokenError } = await admin.from("tic_oauth_sessions").select("key_id,scopes").eq("access_token_hash", hashOAuthSecret(secret)).eq("resource", "https://mcp.tidelight.app/mcp").is("revoked_at", null).gt("access_token_expires_at", new Date().toISOString()).maybeSingle();
    if (tokenError) throw tokenError;
    if (!token) return null;
    const { data: key, error: keyError } = await admin.from("developer_api_keys").select("scopes,revoked_at,expires_at").eq("id", token.key_id).maybeSingle();
    if (keyError) throw keyError;
    if (!key || !isTicMcpCredentialActive(key)) return null;
    const keyScopes = Array.isArray(key.scopes) ? key.scopes.filter((scope): scope is string => typeof scope === "string") : [];
    const oauthScopes = Array.isArray(token.scopes) ? token.scopes.filter((scope: unknown): scope is string => typeof scope === "string") : [];
    if (oauthScopes.some(scope => !keyScopes.includes(scope))) return null;
    return { secret, scopes: oauthScopes };
  }
  if (!keyHash || !secret) return null;
  const { data, error } = await admin.from("developer_api_keys")
    .select("scopes,revoked_at,expires_at").eq("key_hash", keyHash).maybeSingle();
  if (error) throw error;
  if (!data || !isTicMcpCredentialActive(data)) return null;
  const scopes = Array.isArray(data.scopes) ? data.scopes.filter((scope): scope is string => typeof scope === "string") : [];
  return { secret, scopes };
}
