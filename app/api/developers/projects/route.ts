import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sameOrigin } from "@/lib/tic/credentials";
import { getOrganizationRole, listAccessibleProjects, listDeveloperOrganizations } from "@/lib/tic/organizations";
import { canWriteOrganization } from "@/lib/tic/organization-rbac";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to manage projects." }, { status: 401 });
  try {
    const admin = createAdminClient();
    const [projects, organizations] = await Promise.all([listAccessibleProjects(admin, user.id), listDeveloperOrganizations(admin, user.id)]);
    return Response.json({ projects, organizations }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Projects are temporarily unavailable." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to create a project." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const name = typeof body === "object" && body !== null && "name" in body && typeof body.name === "string" ? body.name.trim() : "";
  const requestedOrganizationId = typeof body === "object" && body !== null && "organizationId" in body && typeof body.organizationId === "string" ? body.organizationId : "";
  if (name.length < 2 || name.length > 80) return Response.json({ error: "Name must be 2 to 80 characters." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const organizations = await listDeveloperOrganizations(admin, user.id);
    const organizationId = requestedOrganizationId || organizations[0]?.id;
    if (!organizationId) return Response.json({ error: "Create an organization first." }, { status: 409 });
    const role = await getOrganizationRole(admin, organizationId, user.id);
    if (!role) return Response.json({ error: "Organization not found." }, { status: 404 });
    if (!canWriteOrganization(role)) return Response.json({ error: "Your organization role cannot create projects." }, { status: 403 });
    const { count, error: countError } = await admin.from("developer_projects").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
    if (countError) throw countError;
    if ((count ?? 0) >= 10) return Response.json({ error: "This organization has reached its 10-project limit." }, { status: 429 });
    const { data, error } = await admin.from("developer_projects").insert({ owner_id: user.id, organization_id: organizationId, name }).select("id,organization_id,name,created_at").single();
    if (error) throw error;
    return Response.json({ project: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Project could not be created." }, { status: 503 }); }
}
