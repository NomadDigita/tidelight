import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bitgetPrivateRequest, encryptSecret, type Mode } from "@/lib/bitget-private";

export const runtime = "nodejs";
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false }, { status: 401 });
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("bitget_connections").select("id, label, mode, live_enabled, last_validated_at").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ connected: Boolean(data?.last_validated_at), connection: data ? { label: data.label, mode: data.mode, live_enabled: data.live_enabled, last_validated_at: data.last_validated_at } : null });
  } catch {
    return NextResponse.json({ error: "Connection status is unavailable." }, { status: 500 });
  }
}
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in before connecting Bitget." }, { status: 401 });
  let body: { apiKey?: unknown; apiSecret?: unknown; passphrase?: unknown; mode?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Enter valid connection details." }, { status: 400 }); }
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const apiSecret = typeof body.apiSecret === "string" ? body.apiSecret.trim() : "";
  const passphrase = typeof body.passphrase === "string" ? body.passphrase.trim() : "";
  const mode: Mode = body.mode === "live" ? "live" : "demo";
  if (apiKey.length < 8 || apiKey.length > 180 || apiSecret.length < 16 || apiSecret.length > 180 || passphrase.length < 1 || passphrase.length > 180) {
    return NextResponse.json({ error: "Check that all three Bitget API fields are filled in correctly." }, { status: 400 });
  }
  if (!process.env.BITGET_CREDENTIALS_ENCRYPTION_KEY || process.env.BITGET_CREDENTIALS_ENCRYPTION_KEY.length < 32) {
    return NextResponse.json({ error: "Secure key storage is not configured for this deployment. No credentials were saved." }, { status: 503 });
  }
  try {
    await bitgetPrivateRequest({ apiKey, apiSecret, passphrase, mode }, "GET", "/api/v3/account/assets");
    const admin = createAdminClient();
    const record = {
      user_id: user.id, label: mode === "demo" ? "Bitget demo account" : "Bitget live account",
      mode, live_enabled: mode === "live", api_key_ciphertext: encryptSecret(apiKey),
      api_secret_ciphertext: encryptSecret(apiSecret), passphrase_ciphertext: encryptSecret(passphrase),
      encryption_version: "aes-256-gcm-v1", last_validated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    const { error } = await admin.from("bitget_connections").upsert(record, { onConflict: "user_id" });
    if (error) throw new Error("connection-save-failed");
    return NextResponse.json({ connected: true, mode, live_enabled: mode === "live", last_validated_at: record.last_validated_at });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "credential-encryption-not-configured") return NextResponse.json({ error: "Secure key storage is not configured. No credentials were saved." }, { status: 503 });
    if (message === "connection-save-failed") return NextResponse.json({ error: "Bitget verified the key, but Tidelight could not save it securely." }, { status: 500 });
    return NextResponse.json({ error: mode === "demo" ? "Bitget did not verify this demo key. Check that it is a demo-mode key with read permission." : "Bitget did not verify this key. Check its permissions and passphrase." }, { status: 422 });
  }
}
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in before disconnecting Bitget." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("bitget_connections").delete().eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ connected: false });
  } catch { return NextResponse.json({ error: "Could not disconnect Bitget." }, { status: 500 }); }
}
