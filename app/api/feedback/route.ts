import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { emailFrame, emailSenders } from "@/lib/email/brand";
import { sendWithResend } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers });

function emailAddress(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 254) return undefined;
  const email = value.trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : undefined;
}

function safePath(value: unknown) {
  return typeof value === "string" && /^\/[A-Za-z0-9/_-]{0,120}$/.test(value) ? value : "/";
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) return json({ error: "Open feedback from Tidelight." }, 403);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 5000) return json({ error: "Please shorten your feedback." }, 413);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 5000) return json({ error: "Please shorten your feedback." }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Send a feedback message." }, 400);
    body = parsed as Record<string, unknown>;
  } catch { return json({ error: "Send a valid feedback message." }, 400); }

  // Quiet honeypot for simple bots. A filled field receives a generic success response.
  if (typeof body.company === "string" && body.company.trim()) return json({ ok: true });
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 8 || message.length > 2000) return json({ error: "Feedback must be between 8 and 2,000 characters." }, 400);
  const replyTo = emailAddress(body.replyTo);
  if (body.replyTo && !replyTo) return json({ error: "Enter a valid reply email, or leave it blank." }, 400);
  if (!process.env.RESEND_API_KEY || !process.env.CRON_SECRET) return json({ error: "Feedback delivery is temporarily unavailable." }, 503);

  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  const clientIp = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || forwarded.at(-1) || "unknown";
  const ipFingerprint = createHmac("sha256", process.env.CRON_SECRET).update(`feedback-ip:${clientIp}`).digest("hex");
  const fingerprints = [ipFingerprint];

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      fingerprints.push(createHmac("sha256", process.env.CRON_SECRET).update(`feedback-user:${user.id}`).digest("hex"));
    }
  } catch { /* Feedback remains available if optional session lookup fails. */ }

  try {
    const admin = createAdminClient();
    const { data: allowed, error: rateError } = await admin.rpc("reserve_feedback_rate_limit", { p_fingerprints: fingerprints });
    if (rateError) throw new Error("rate_limit_unavailable");
    if (allowed !== true) return json({ error: "Please wait before sending more feedback." }, 429);
    await admin.from("feedback_rate_windows").delete().lt("window_started_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    const page = safePath(body.page);
    const id = typeof body.requestId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)
      ? body.requestId
      : randomUUID();
    const sent = await sendWithResend({
      from: emailSenders.auth,
      to: "feedback@tidelight.app",
      replyTo,
      subject: "Product feedback from Tidelight",
      html: emailFrame({
        eyebrow: "PRODUCT FEEDBACK",
        title: "A note from the Tidelight desk",
        body: [`Page: ${page}`, userId ? "From a signed-in Tidelight member" : "From a Tidelight visitor", "", message].join("\n"),
        footer: "A user shared this feedback through the Tidelight product. Please handle any personal information with care.",
      }),
      idempotencyKey: `feedback:${id}`,
    });
    return json({ ok: true, id: sent.id });
  } catch {
    return json({ error: "We couldn’t send your feedback just now. Please try again." }, 503);
  }
}
