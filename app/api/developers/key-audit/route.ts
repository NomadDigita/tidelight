import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAccessibleProjects } from "@/lib/tic/organizations";

export async function GET(request: Request) {
  const action = new URL(request.url).searchParams.get("action");
  if (action && !["created", "rotated", "revoked"].includes(action)) {
    return Response.json({ error: "Choose a supported audit event." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to view the security log." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const projects = await listAccessibleProjects(admin, user.id);
    if (!projects.length) return Response.json({ events: [] }, { headers: { "Cache-Control": "no-store" } });
    let query = admin.from("developer_api_key_audit")
      .select("id,project_id,actor_email,action,key_name,created_at")
      .in("project_id", projects.map(project => project.id))
      .order("created_at", { ascending: false }).limit(100);
    if (action) query = query.eq("action", action);
    const { data, error } = await query;
    if (error) throw error;
    return Response.json({ events: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The security log is temporarily unavailable." }, { status: 503 });
  }
}
