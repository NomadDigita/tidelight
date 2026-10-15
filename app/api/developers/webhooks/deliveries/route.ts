import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAccessibleProjects } from "@/lib/tic/organizations";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to review webhook deliveries." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const projects = await listAccessibleProjects(admin, user.id);
    if (!projects.length) return Response.json({ deliveries: [] }, { headers: { "Cache-Control": "no-store" } });
    const { data, error } = await admin.from("tic_webhook_deliveries")
      .select("id,endpoint_id,project_id,event_id,event_type,payload,status,attempt_count,last_status_code,last_error_code,last_duration_ms,created_at,completed_at,tic_webhook_delivery_attempts(attempt_number,status_code,duration_ms,error_code,created_at)")
      .in("project_id", projects.map(project => project.id)).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const endpoints = [...new Set((data ?? []).map(item => item.endpoint_id))];
    const { data: names, error: namesError } = endpoints.length ? await admin.from("tic_webhook_endpoints").select("id,name").in("id", endpoints) : { data: [], error: null };
    if (namesError) throw namesError;
    const nameMap = new Map((names ?? []).map(endpoint => [endpoint.id, endpoint.name]));
    return Response.json({ deliveries: (data ?? []).map(item => ({ ...item, endpoint_name: nameMap.get(item.endpoint_id) ?? "Webhook" })) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Webhook delivery history is temporarily unavailable." }, { status: 503 }); }
}
