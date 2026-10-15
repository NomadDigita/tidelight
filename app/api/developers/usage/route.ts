import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAccessibleProjects } from "@/lib/tic/organizations";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to review usage." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const projects = await listAccessibleProjects(admin, user.id);
    if (!projects.length) return Response.json({ requests: [], daily: [] }, { headers: { "Cache-Control": "no-store" } });
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const { data: daily, error: analyticsError } = await admin.rpc("get_tic_usage_analytics", {
      p_project_ids: projects.map(project => project.id),
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
    if (analyticsError) throw analyticsError;
    const { data, error } = await admin.from("developer_api_requests").select("id,project_id,key_id,endpoint,status_code,duration_ms,created_at").in("project_id", projects.map(project => project.id)).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return Response.json({ requests: data, daily, period: { from: from.toISOString(), to: to.toISOString() } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Usage is temporarily unavailable." }, { status: 503 }); }
}
