import "server-only";
import { emailFrame, emailSenders } from "./brand";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NightwatchEmailKind = "nightwatch_signal" | "nightwatch_fill" | "nightwatch_risk" | "nightwatch_research" | "nightwatch_summary";

export async function enqueueNightwatchEmail(input: {
  admin: SupabaseClient;
  userId: string;
  eventKey: string;
  kind: NightwatchEmailKind;
  title: string;
  body: string;
}) {
  const { data: preferences, error: preferenceError } = await input.admin.from("email_notification_preferences").select("nightwatch_signals,nightwatch_fills,nightwatch_risks,nightwatch_research,nightwatch_daily_summary").eq("user_id", input.userId).maybeSingle();
  if (preferenceError) throw new Error("Could not read email notification preferences.");
  const enabled = input.kind === "nightwatch_signal" ? preferences?.nightwatch_signals : input.kind === "nightwatch_fill" ? preferences?.nightwatch_fills : input.kind === "nightwatch_risk" ? preferences?.nightwatch_risks : input.kind === "nightwatch_research" ? preferences?.nightwatch_research : preferences?.nightwatch_daily_summary;
  if (!enabled) return "suppressed" as const;
  const { error } = await input.admin.from("email_delivery_queue").upsert({ user_id: input.userId, event_key: input.eventKey, category: input.kind, payload: { title: input.title.slice(0, 160), body: input.body.slice(0, 1000) } }, { onConflict: "event_key", ignoreDuplicates: true });
  if (error) throw new Error("Could not queue the email notification.");
  return "queued" as const;
}

export function renderNightwatchEmail(kind: NightwatchEmailKind, title: string, body: string) {
  return {
    from: emailSenders.alerts,
    subject: `${kind === "nightwatch_summary" ? "Nightwatch daily brief" : kind === "nightwatch_risk" ? "Nightwatch risk review" : kind === "nightwatch_research" ? "Nightwatch research note" : "Nightwatch alert"} · ${title}`.slice(0, 180),
    html: emailFrame({ eyebrow: kind === "nightwatch_summary" ? "Nightwatch · Daily brief" : kind === "nightwatch_risk" ? "Nightwatch · Risk context" : kind === "nightwatch_research" ? "Nightwatch · Linked research" : "Nightwatch · Paper signal", title, body, action: { label: "Open Nightwatch", url: "https://tidelight.app/nightwatch" }, footer: "You received this because you enabled this Nightwatch email in Tidelight settings. Manage delivery preferences in your workspace settings." }),
  };
}

export async function enqueueSecurityEmail(input: { admin: SupabaseClient; userId: string; eventKey: string; title: string; body: string }) {
  const { error } = await input.admin.from("email_delivery_queue").upsert({ user_id: input.userId, event_key: input.eventKey, category: "security", payload: { title: input.title.slice(0, 160), body: input.body.slice(0, 1000) } }, { onConflict: "event_key", ignoreDuplicates: true });
  if (error) throw new Error("Could not queue the account security notice.");
  return "queued" as const;
}

export function renderSecurityEmail(title: string, body: string) {
  return {
    from: "Tidelight Security <security@tidelight.app>",
    subject: `Account security · ${title}`.slice(0, 180),
    html: emailFrame({ eyebrow: "Account security", title, body, action: { label: "Review account security", url: "https://tidelight.app/settings" }, footer: "This important account security notice was sent to help you protect your Tidelight account." }),
  };
}

