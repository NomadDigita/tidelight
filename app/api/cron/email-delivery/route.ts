import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { drainEmailQueue } from "@/lib/email/delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !provided) return false;
  const left = Buffer.from(expected), right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized scheduled delivery." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "Email delivery is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "The protected delivery worker is not configured." }, { status: 503 });
  try { return NextResponse.json(await drainEmailQueue(createAdminClient()), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "The email queue could not be processed." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}

