import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listDeveloperOrganizations } from "@/lib/tic/organizations";
import { sameOrigin } from "@/lib/tic/credentials";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to manage organizations." }, { status: 401 });
  try {
    const organizations = await listDeveloperOrganizations(createAdminClient(), user.id);
    return Response.json({ organizations }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Organizations are temporarily unavailable." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to create an organization." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Send a JSON object." }, { status: 400 }); }
  const name = body && typeof body === "object" && "name" in body && typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) return Response.json({ error: "Organization name must be 2 to 80 characters." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const organizations = await listDeveloperOrganizations(admin, user.id);
    if (organizations.length >= 10) return Response.json({ error: "Organization limit reached." }, { status: 429 });
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 35) || "workspace";
    const slug = `${slugBase}-${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`;
    const { error } = await admin.rpc("create_developer_organization", { p_user_id: user.id, p_name: name, p_slug: slug });
    if (error) throw error;
    const updated = await listDeveloperOrganizations(admin, user.id);
    return Response.json({ organizations: updated, organization: updated.find(item => item.slug === slug) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Organization could not be created." }, { status: 503 }); }
}
