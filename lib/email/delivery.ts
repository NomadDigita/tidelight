import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWithResend } from "./resend";
import { renderNightwatchEmail, renderSecurityEmail, type NightwatchEmailKind } from "./nightwatch";
import { renderFuturesAccessEmail, type FuturesAccessEmailKind } from "./futures-access";
import { EMAIL_MAX_ATTEMPTS, nextEmailRetryAt } from "./retry";

type Job = { id: string; user_id: string; event_key: string; category: string; payload: { title?: unknown; body?: unknown }; attempts: number };

export async function drainEmailQueue(admin: SupabaseClient) {
  if (!process.env.RESEND_API_KEY) throw new Error("Resend is not configured.");
  await admin.from("email_delivery_queue").update({ state: "failed", last_error_code: "attempts_exhausted" }).eq("state", "sending").gte("attempts", EMAIL_MAX_ATTEMPTS).lte("next_attempt_at", new Date().toISOString());
  const { data: jobs, error } = await admin.rpc("claim_email_delivery_jobs", { p_limit: 20 });
  if (error) throw new Error("Could not claim the email delivery queue.");
  let delivered = 0, suppressed = 0, retried = 0, failed = 0;
  for (const job of (jobs ?? []) as Job[]) {
    try {
      const { data: preferences } = await admin.from("email_notification_preferences").select("nightwatch_signals,nightwatch_fills,nightwatch_risks,nightwatch_research,nightwatch_daily_summary").eq("user_id", job.user_id).maybeSingle();
      const enabled = job.category === "nightwatch_signal" ? preferences?.nightwatch_signals : job.category === "nightwatch_fill" ? preferences?.nightwatch_fills : job.category === "nightwatch_risk" ? preferences?.nightwatch_risks : job.category === "nightwatch_research" ? preferences?.nightwatch_research : job.category === "nightwatch_summary" ? preferences?.nightwatch_daily_summary : job.category === "security" || job.category === "futures_access_request" || job.category === "futures_access_decision" ? true : false;
      if (!enabled) {
        await admin.from("email_delivery_queue").update({ state: "suppressed" }).eq("id", job.id);
        suppressed++;
        continue;
      }
      const { data: userResult, error: userError } = await admin.auth.admin.getUserById(job.user_id);
      const recipient = userResult.user?.email;
      if (userError || !recipient) throw Object.assign(new Error("Email recipient is unavailable."), { code: "recipient_unavailable" });
      if (!userResult.user?.email_confirmed_at) {
        await admin.from("email_delivery_queue").update({ state: "suppressed", last_error_code: "unverified_recipient" }).eq("id", job.id);
        suppressed++;
        continue;
      }
      const title = typeof job.payload?.title === "string" ? job.payload.title.slice(0, 160) : "Nightwatch update";
      const body = typeof job.payload?.body === "string" ? job.payload.body.slice(0, 1000) : "A new Nightwatch update is available in your workspace.";
      const rendered = job.category === "security" ? renderSecurityEmail(title, body) : job.category === "futures_access_request" || job.category === "futures_access_decision" ? renderFuturesAccessEmail(job.category as FuturesAccessEmailKind, title, body) : renderNightwatchEmail(job.category as NightwatchEmailKind, title, body);
      const result = await sendWithResend({ ...rendered, to: recipient, idempotencyKey: job.event_key });
      const { error: logError } = await admin.from("email_delivery_queue").update({ state: "sent", provider_message_id: result.id, sent_at: new Date().toISOString(), last_error_code: null }).eq("id", job.id);
      if (logError) throw Object.assign(new Error("Could not record email delivery."), { code: "delivery_log_failed" });
      delivered++;
    } catch (deliveryError) {
      const code = deliveryError instanceof Error && "code" in deliveryError && typeof deliveryError.code === "string" ? deliveryError.code.slice(0, 64) : "delivery_failed";
      const attempts = Number(job.attempts ?? 1);
      const retryAt = nextEmailRetryAt(attempts);
      const terminal = retryAt === null;
      await admin.from("email_delivery_queue").update({ state: "failed", ...(retryAt ? { next_attempt_at: retryAt } : {}), last_error_code: terminal ? `terminal_${code}` : code }).eq("id", job.id);
      if (terminal) failed++; else retried++;
    }
  }
  const retentionCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from("email_delivery_queue").delete().in("state", ["sent", "suppressed", "failed"]).lt("created_at", retentionCutoff);
  return { state: "complete" as const, claimed: jobs?.length ?? 0, delivered, suppressed, retried, failed };
}

