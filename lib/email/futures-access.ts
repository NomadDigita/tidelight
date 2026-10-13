import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailFrame, emailSenders } from "./brand";

export type FuturesAccessEmailKind = "futures_access_request" | "futures_access_submitted" | "futures_access_decision";

export async function enqueueFuturesAccessEmail(input: {
  admin: SupabaseClient;
  userId: string;
  eventKey: string;
  kind: FuturesAccessEmailKind;
  title: string;
  body: string;
}) {
  const { error } = await input.admin.from("email_delivery_queue").upsert({
    user_id: input.userId,
    event_key: input.eventKey,
    category: input.kind,
    payload: { title: input.title.slice(0, 160), body: input.body.slice(0, 1000) },
  }, { onConflict: "event_key", ignoreDuplicates: true });
  if (error) throw new Error("Could not queue the futures access email.");
}

export function renderFuturesAccessEmail(kind: FuturesAccessEmailKind, title: string, body: string) {
  const reviewer = kind === "futures_access_request";
  return {
    from: emailSenders.alerts,
    subject: (reviewer ? "Futures access review · " : kind === "futures_access_submitted" ? "Futures access request · " : "Futures access update · ") + title,
    html: emailFrame({
      eyebrow: reviewer ? "US stock perpetuals · operator review" : kind === "futures_access_submitted" ? "US stock perpetuals · request received" : "US stock perpetuals · account update",
      title,
      body,
      action: reviewer
        ? { label: "Open operator review queue", url: "https://tidelight.app/settings/futures-access" }
        : { label: "Open Futures desk", url: "https://tidelight.app/futures" },
      footer: reviewer
        ? "Review and decide in the authenticated Tidelight operator queue. Email does not approve access."
        : kind === "futures_access_submitted" ? "Your request remains pending until an operator reviews it in Tidelight." : "Live access changes only after an operator decision in Tidelight. Email links cannot approve access.",
    }),
  };
}
