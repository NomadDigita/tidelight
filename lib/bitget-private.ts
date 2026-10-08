import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type Mode = "demo" | "live";
type Secrets = { apiKey: string; apiSecret: string; passphrase: string; mode: Mode };
export class BitgetRequestError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super("bitget-request-rejected"); }
}
const VERSION = "aes-256-gcm-v1";
function key() {
  const configured = process.env.BITGET_CREDENTIALS_ENCRYPTION_KEY;
  if (!configured || configured.length < 32) throw new Error("credential-encryption-not-configured");
  return createHash("sha256").update(configured, "utf8").digest();
}
export function encryptSecret(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}
function decryptSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== VERSION || !iv || !tag || !encrypted) throw new Error("credential-ciphertext-invalid");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}
export function bitgetHeaders(credentials: Secrets, method: "GET" | "POST", path: string, body = "") {
  const timestamp = Date.now().toString();
  const signature = createHmac("sha256", credentials.apiSecret).update(timestamp + method + path + body).digest("base64");
  return {
    "ACCESS-KEY": credentials.apiKey, "ACCESS-SIGN": signature, "ACCESS-TIMESTAMP": timestamp,
    "ACCESS-PASSPHRASE": credentials.passphrase, "Content-Type": "application/json", locale: "en-US",
    ...(credentials.mode === "demo" ? { paptrading: "1" } : {}),
  };
}
export async function getBitgetCredentials(userId: string): Promise<Secrets | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("bitget_connections").select("api_key_ciphertext, api_secret_ciphertext, passphrase_ciphertext, mode, live_enabled").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("connection-read-failed");
  if (!data?.api_key_ciphertext || !data.api_secret_ciphertext || !data.passphrase_ciphertext) return null;
  if (data.mode === "live" && !data.live_enabled) return null;
  return { apiKey: decryptSecret(data.api_key_ciphertext), apiSecret: decryptSecret(data.api_secret_ciphertext), passphrase: decryptSecret(data.passphrase_ciphertext), mode: data.mode === "live" ? "live" : "demo" };
}
export async function bitgetPrivateRequest(credentials: Secrets, method: "GET" | "POST", path: string, payload?: Record<string, unknown>) {
  const body = payload ? JSON.stringify(payload) : "";
  const url = "https://api.bitget.com" + path;
  const response = await fetch(url, { method, headers: bitgetHeaders(credentials, method, path, body), ...(payload ? { body } : {}), signal: AbortSignal.timeout(12000), cache: "no-store" });
  const result = await response.json() as { code?: string; msg?: string; data?: unknown };
  if (!response.ok || result.code !== "00000") throw new BitgetRequestError(/^\d{1,12}$/.test(String(result.code)) ? String(result.code) : "unknown", response.status);
  return result;
}
export type { Mode };
