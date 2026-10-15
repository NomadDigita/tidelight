import { ALERTS_SCOPE, apiError, authorizeDeveloperRequest, finishUsage } from "@/lib/tic/credentials";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const started = performance.now();
  const auth = await authorizeDeveloperRequest(request, "/v1/webhooks/deliveries", ALERTS_SCOPE);
  if (auth.error) return auth.error;
  const { admin, requestId, usageId, projectId } = auth;
  try {
    const { data, error } = await admin.from("tic_webhook_deliveries")
      .select("id,endpoint_id,project_id,event_id,event_type,payload,status,attempt_count,last_status_code,last_error_code,last_duration_ms,created_at,completed_at,tic_webhook_delivery_attempts(attempt_number,status_code,duration_ms,error_code,created_at)")
      .eq("project_id", projectId).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const endpointIds = [...new Set((data ?? []).map(item => item.endpoint_id))];
    const { data: endpoints, error: endpointError } = endpointIds.length ? await admin.from("tic_webhook_endpoints").select("id,name").in("id", endpointIds).eq("project_id", projectId) : { data: [], error: null };
    if (endpointError) throw endpointError;
    const names = new Map((endpoints ?? []).map(item => [item.id, item.name]));
    await finishUsage(admin, usageId, 200, started);
    return Response.json({ deliveries: (data ?? []).map(item => ({ ...item, endpoint_name: names.get(item.endpoint_id) ?? "Webhook" })), request_id: requestId }, { headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
  } catch {
    await finishUsage(admin, usageId, 503, started);
    return apiError(503, "service_unavailable", "Webhook delivery history is temporarily unavailable.", requestId);
  }
}
