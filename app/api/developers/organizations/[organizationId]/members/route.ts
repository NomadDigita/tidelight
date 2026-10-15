import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganizationRole, type DeveloperRole } from "@/lib/tic/organizations";
import { canManageOrganization } from "@/lib/tic/organization-rbac";
import { sameOrigin } from "@/lib/tic/credentials";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ organizationId: string }> };

async function actorFor(context: Context) {
  const { organizationId } = await context.params;
  if (!UUID.test(organizationId)) return { response: Response.json({ error: "Organization not found." }, { status: 404 }) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: Response.json({ error: "Sign in to manage organization members." }, { status: 401 }) };
  const admin = createAdminClient();
  const role = await getOrganizationRole(admin, organizationId, user.id);
  if (!role) return { response: Response.json({ error: "Organization not found." }, { status: 404 }) };
  return { admin, organizationId, user, role };
}

function actionError(message: string) {
  if (/account not found/i.test(message)) return Response.json({ error: "That email does not belong to a registered Tidelight account yet." }, { status: 404 });
  if (/already exists|duplicate key/i.test(message)) return Response.json({ error: "That member is already in this organization." }, { status: 409 });
  if (/owner/i.test(message) && /requires/i.test(message)) return Response.json({ error: "An organization must keep at least one owner." }, { status: 409 });
  if (/permission denied/i.test(message)) return Response.json({ error: "Your organization role cannot make that change." }, { status: 403 });
  if (/member not found/i.test(message)) return Response.json({ error: "That member is no longer in this organization." }, { status: 404 });
  if (/invalid role/i.test(message)) return Response.json({ error: "Choose a supported organization role." }, { status: 400 });
  return Response.json({ error: "Organization member change could not be completed." }, { status: 503 });
}

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await actorFor(context);
    if ("response" in actor) return actor.response;
    const { data, error } = await actor.admin.rpc("list_developer_organization_members", { p_organization_id: actor.organizationId, p_actor_id: actor.user.id });
    if (error) throw error;
    let audit: unknown[] = [];
    if (canManageOrganization(actor.role)) {
      const { data: events, error: auditError } = await actor.admin.from("developer_organization_audit")
        .select("id,actor_id,target_user_id,action,previous_role,new_role,created_at")
        .eq("organization_id", actor.organizationId).order("created_at", { ascending: false }).limit(50);
      if (auditError) throw auditError;
      audit = events ?? [];
    }
    return Response.json({ role: actor.role, members: data ?? [], audit }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Organization members are temporarily unavailable." }, { status: 503 }); }
}

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Send a JSON object." }, { status: 400 }); }
  const email = body && typeof body === "object" && "email" in body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body && typeof body === "object" && "role" in body && typeof body.role === "string" ? body.role : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["admin", "developer", "reader"].includes(role)) return Response.json({ error: "Provide a registered email and a supported role." }, { status: 400 });
  try {
    const actor = await actorFor(context);
    if ("response" in actor) return actor.response;
    const { error } = await actor.admin.rpc("add_developer_organization_member", { p_organization_id: actor.organizationId, p_actor_id: actor.user.id, p_email: email, p_role: role });
    if (error) return actionError(error.message);
    return Response.json({ added: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Organization member could not be added." }, { status: 503 }); }
}

export async function PATCH(request: Request, context: Context) {
  return changeMember(request, context, false);
}

export async function DELETE(request: Request, context: Context) {
  return changeMember(request, context, true);
}

async function changeMember(request: Request, context: Context, remove: boolean) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Send a JSON object." }, { status: 400 }); }
  const userId = body && typeof body === "object" && "userId" in body && typeof body.userId === "string" ? body.userId : "";
  const role = body && typeof body === "object" && "role" in body && typeof body.role === "string" ? body.role : "";
  if (!UUID.test(userId) || (!remove && !["owner", "admin", "developer", "reader"].includes(role))) return Response.json({ error: "Choose a valid member and role." }, { status: 400 });
  try {
    const actor = await actorFor(context);
    if ("response" in actor) return actor.response;
    const { error } = await actor.admin.rpc("change_developer_organization_member", {
      p_organization_id: actor.organizationId, p_actor_id: actor.user.id, p_member_id: userId,
      p_role: remove ? null : role as DeveloperRole, p_remove: remove,
    });
    if (error) return actionError(error.message);
    return Response.json({ changed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Organization member change could not be completed." }, { status: 503 }); }
}
