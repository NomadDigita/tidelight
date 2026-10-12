import "server-only";

export type ResendMessage = { from: string; to: string; subject: string; html: string; idempotencyKey: string; replyTo?: string; headers?: Record<string, string> };
export type ResendResult = { id: string };

export async function sendWithResend(message: ResendMessage): Promise<ResendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email provider is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": message.idempotencyKey },
    body: JSON.stringify({ from: message.from, to: [message.to], subject: message.subject, html: message.html, reply_to: message.replyTo, headers: message.headers }),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => null) as { id?: unknown; message?: unknown; name?: unknown } | null;
  if (!response.ok || typeof data?.id !== "string") {
    // Never include provider response text because it may echo recipient data or message content.
    throw Object.assign(new Error("Email provider rejected the delivery."), { code: `resend_${response.status}` });
  }
  return { id: data.id };
}

