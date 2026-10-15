import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sameOrigin } from "@/lib/tic/credentials";
import { getProjectRole, listAccessibleProjects } from "@/lib/tic/organizations";
import { canWriteOrganization } from "@/lib/tic/organization-rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to review research jobs." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const projects = await listAccessibleProjects(admin, user.id);
    if (!projects.length) return Response.json({ jobs: [] }, { headers: { "Cache-Control": "no-store" } });
    const { data, error } = await admin.from("tic_research_jobs")
      .select("id,project_id,ticker,status,attempt_count,max_attempts,result,error_code,created_at,started_at,completed_at,next_attempt_at,cancel_requested_at")
      .in("project_id", projects.map(project => project.id)).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return Response.json({ jobs: data }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Research jobs are temporarily unavailable." }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to cancel research jobs." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Send a JSON object." }, { status: 400 }); }
  const id = body && typeof body === "object" && "id" in body && typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return Response.json({ error: "Invalid research job ID." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const projects = await listAccessibleProjects(admin, user.id);
    const projectIds = projects.map(project => project.id);
    if (!projectIds.length) return Response.json({ error: "Research job not found." }, { status: 404 });
    const { data: job, error: jobError } = await admin.from("tic_research_jobs").select("id,project_id").eq("id", id).in("project_id", projectIds).maybeSingle();
    if (jobError) throw jobError;
    if (!job) return Response.json({ error: "Research job not found." }, { status: 404 });
    const role = await getProjectRole(admin, job.project_id, user.id);
    if (!role || !canWriteOrganization(role)) return Response.json({ error: "Your organization role cannot cancel research jobs." }, { status: 403 });
    const { data: status, error } = await admin.rpc("cancel_tic_research_job", { p_id: id, p_project_id: job.project_id });
    if (error) throw error;
    if (!status) return Response.json({ error: "This job has already finished." }, { status: 409 });
    return Response.json({ job_id: id, status: status === "running" ? "cancellation_requested" : status }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Research job could not be cancelled." }, { status: 503 }); }
}
