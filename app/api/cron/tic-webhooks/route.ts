import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSignedWebhook } from "@/lib/tic/webhook-security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 45;

type Delivery = { delivery_id: string; endpoint_id: string; project_id: string; endpoint_url: string; encrypted_secret: string; event_id: string; event_type: string; payload: unknown; attempt_number: number; lease_token: string };

function authorize(request: Request) {
  const expected = process.env.TIC_RESEARCH_CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !provided) return false;
  const left = Buffer.from(expected), right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

function safeErrorCode(error: unknown) {
  if (!(error instanceof Error)) return "delivery_failed";
  if (error.message === "unsafe_webhook_destination" || error.message === "invalid_webhook_url") return "unsafe_destination";
  if (error.message === "webhook_encryption_unconfigured" || error.message === "webhook_secret_corrupt") return "signing_unavailable";
  if (error.message === "webhook_timeout") return "timeout";
  if (error.message === "webhook_response_too_large") return "response_too_large";
  return "network_error";
}

export async function POST(request: Request) {
  if (!authorize(request)) return NextResponse.json({ error: "Unauthorized webhook worker." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: "The webhook worker is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  const { data, error } = await admin.rpc("claim_tic_webhook_deliveries", { p_limit: 3 });
  if (error) {
    console.error("tic-webhook-claim-failed", error.code);
    return NextResponse.json({ error: "Webhook deliveries could not be claimed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const deliveries = Array.isArray(data) ? data as Delivery[] : [];
  const results: string[] = [];
  for (const delivery of deliveries) {
    let statusCode: number | null = null;
    let durationMs = 0;
    let errorCode: string | null = null;
    let retryable = true;
    try {
      const sent = await sendSignedWebhook({ url: delivery.endpoint_url, encryptedSecret: delivery.encrypted_secret, eventId: delivery.event_id, eventType: delivery.event_type, payload: delivery.payload });
      statusCode = sent.status;
      durationMs = sent.durationMs;
      retryable = statusCode === 408 || statusCode === 429 || statusCode >= 500;
      if (statusCode < 200 || statusCode >= 300) errorCode = `http_${statusCode}`;
    } catch (cause) {
      errorCode = safeErrorCode(cause);
      retryable = !["unsafe_destination", "invalid_webhook_url", "signing_unavailable", "webhook_secret_corrupt"].includes(errorCode);
    }
    const { data: result, error: completeError } = await admin.rpc("complete_tic_webhook_delivery", {
      p_delivery_id: delivery.delivery_id,
      p_lease_token: delivery.lease_token,
      p_status_code: statusCode,
      p_duration_ms: durationMs,
      p_error_code: errorCode,
      p_retryable: retryable,
    });
    if (completeError) {
      console.error("tic-webhook-result-failed", completeError.code, delivery.delivery_id);
      results.push("record_failed");
    } else results.push(typeof result === "string" ? result : "recorded");
  }
  return NextResponse.json({ claimed: deliveries.length, outcomes: results }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = POST;
