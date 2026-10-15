import { apiError, authorizeDeveloperRequest, finishUsage, RESEARCH_SCOPE } from "@/lib/tic/credentials";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveJob(request: Request, context: { params: Promise<{ jobId: string }> }, started: number) {
  const { jobId } = await context.params;
  if (!UUID.test(jobId)) return { response: apiError(400, "invalid_request", "A valid research job ID is required.", crypto.randomUUID()) };
  const auth = await authorizeDeveloperRequest(request, `/v1/research/jobs/${jobId}`, RESEARCH_SCOPE);
  if (auth.error) return { response: auth.error };
  const { admin, projectId, usageId, requestId } = auth;
  const { data: job, error } = await admin.from("tic_research_jobs").select("id,ticker,status,attempt_count,max_attempts,result,error_code,created_at,started_at,completed_at,next_attempt_at").eq("id", jobId).eq("project_id", projectId).maybeSingle();
  if (error) {
    await finishUsage(admin, usageId, 503, started);
    return { response: apiError(503, "service_unavailable", "The research job is temporarily unavailable.", requestId) };
  }
  if (!job) {
    await finishUsage(admin, usageId, 404, started);
    return { response: apiError(404, "job_not_found", "This job is unavailable in the key's project.", requestId) };
  }
  return { admin, job, projectId, usageId, requestId };
}

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const started = performance.now();
  const result = await resolveJob(request, context, started);
  if ("response" in result) return result.response;
  await finishUsage(result.admin, result.usageId, 200, started);
  return Response.json({
    job_id: result.job.id,
    ticker: result.job.ticker,
    status: result.job.status,
    attempts: result.job.attempt_count,
    max_attempts: result.job.max_attempts,
    result: result.job.status === "complete" ? result.job.result : null,
    error: result.job.status === "failed" ? { code: result.job.error_code ?? "research_failed", message: "The research job could not be completed." } : null,
    created_at: result.job.created_at,
    started_at: result.job.started_at,
    completed_at: result.job.completed_at,
    retry_at: result.job.status === "retry_wait" ? result.job.next_attempt_at : null,
    request_id: result.requestId,
  }, { headers: { "Cache-Control": "no-store", "X-Request-Id": result.requestId } });
}

export async function DELETE(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const started = performance.now();
  const result = await resolveJob(request, context, started);
  if ("response" in result) return result.response;
  const { data: status, error } = await result.admin.rpc("cancel_tic_research_job", { p_id: result.job.id, p_project_id: result.projectId });
  if (error) {
    await finishUsage(result.admin, result.usageId, 503, started);
    return apiError(503, "service_unavailable", "The job could not be cancelled.", result.requestId);
  }
  if (!status) {
    await finishUsage(result.admin, result.usageId, 409, started);
    return apiError(409, "job_not_cancellable", "This job has already finished.", result.requestId);
  }
  await finishUsage(result.admin, result.usageId, 202, started);
  return Response.json({ job_id: result.job.id, status: status === "running" ? "cancellation_requested" : status, request_id: result.requestId }, { status: 202, headers: { "Cache-Control": "no-store", "X-Request-Id": result.requestId } });
}
