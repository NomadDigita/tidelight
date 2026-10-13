import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailFrame, emailSenders } from "./brand";

export async function enqueueFuturesTradeEmail(input: {
  admin: SupabaseClient;
  userId: string;
  eventKey: string;
  title: string;
  body: string;
}) {
  const { error } = await input.admin.from("email_delivery_queue").upsert({
    user_id: input.userId,
    event_key: input.eventKey,
    category: "futures_paper_trade",
    payload: { title: input.title.slice(0, 160), body: input.body.slice(0, 1000) },
  }, { onConflict: "event_key", ignoreDuplicates: true });
  if (error) throw new Error("Could not queue the futures paper trade receipt.");
}

export function renderFuturesTradeEmail(title: string, body: string) {
  return {
    from: emailSenders.security,
    subject: "Paper futures fill · " + title,
    html: emailFrame({
      eyebrow: "US stock perpetuals · simulated paper fill",
      title,
      body,
      action: { label: "Open Futures workstation", url: "https://tidelight.app/futures" },
      footer: "Paper execution only. No live Bitget order was sent. Tidelight records this receipt for your account activity.",
    }),
  };
}
