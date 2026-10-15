import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCompanySnapshot } from "@/lib/tic/research-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

function authorize(request: Request) {
  const expected = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !provided) return false;
  const left = Buffer.from(expected), right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  if (!authorize(request)) return NextResponse.json({ error: "Unauthorized research worker." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: "The research worker is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  let claim: Awaited<ReturnType<typeof admin.rpc>>;
  try { claim = await admin.rpc("claim_tic_research_job"); }
  catch {
    return NextResponse.json({ error: "The research queue could not be claimed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const { data, error } = claim;
  if (error) {
    console.error("tic-research-claim-failed", error.code);
    return NextResponse.json({ error: "The research queue could not be claimed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const job = Array.isArray(data) ? data[0] : null;
  if (!job) return NextResponse.json({ claimed: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const result = await runCompanySnapshot(job.ticker);
    const { data: status, error: completeError } = await admin.rpc("complete_tic_research_job", {
      p_id: job.id,
      p_lease_token: job.lease_token,
      p_result: result,
    });
    if (completeError) throw new Error(`complete:${completeError.code}`);
    if (!status) return NextResponse.json({ claimed: true, completed: false, reason: "lease_lost" }, { status: 409, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ claimed: true, completed: status === "complete", status }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    const code = cause instanceof Error && cause.message.startsWith("complete:") ? "result_store_failed" : "provider_unavailable";
    console.warn("tic-research-job-failed", code, job.id);
    try {
      const { data: status, error: failError } = await admin.rpc("fail_tic_research_job", { p_id: job.id, p_lease_token: job.lease_token, p_error_code: code });
      if (failError) {
        console.error("tic-research-failure-record-failed", failError.code);
        return NextResponse.json({ claimed: true, completed: false, error: "failure_state_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json({ claimed: true, completed: false, status }, { status: 503, headers: { "Cache-Control": "no-store" } });
    } catch {
      console.error("tic-research-failure-record-failed", "network_error");
      return NextResponse.json({ claimed: true, completed: false, error: "failure_state_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
}
