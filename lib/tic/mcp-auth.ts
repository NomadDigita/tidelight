import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { developerKeyHashFromRequest } from "@/lib/tic/credentials";
import { isTicMcpCredentialActive } from "@/lib/tic/mcp-protocol";

export type TicMcpCredential = { secret: string; scopes: string[] };

export async function authenticateTicMcpRequest(request: Request): Promise<TicMcpCredential | null> {
  const secret = request.headers.get("authorization") ? request.headers.get("authorization")!.replace(/^Bearer\s+/i, "") : "";
  const keyHash = developerKeyHashFromRequest(request);
  if (!keyHash || !secret) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.from("developer_api_keys")
    .select("scopes,revoked_at,expires_at").eq("key_hash", keyHash).maybeSingle();
  if (error) throw error;
  if (!data || !isTicMcpCredentialActive(data)) return null;
  const scopes = Array.isArray(data.scopes) ? data.scopes.filter((scope): scope is string => typeof scope === "string") : [];
  return { secret, scopes };
}
