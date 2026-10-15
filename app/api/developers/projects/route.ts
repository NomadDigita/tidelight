import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sameOrigin } from "@/lib/tic/credentials";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to manage projects." }, { status: 401 });
  try {
    const { data, error } = await createAdminClient().from("developer_projects").select("id,name,created_at").eq("owner_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ projects: data }, { headers: { "Cache-Control": "no-store" } });
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
  if (name.length < 2 || name.length > 80) return Response.json({ error: "Name must be 2 to 80 characters." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const { count, error: countError } = await admin.from("developer_projects").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
    if (countError) throw countError;
    if ((count ?? 0) >= 10) return Response.json({ error: "Project limit reached." }, { status: 429 });
    const { data, error } = await admin.from("developer_projects").insert({ owner_id: user.id, name }).select("id,name,created_at").single();
    if (error) throw error;
    return Response.json({ project: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Project could not be created." }, { status: 503 }); }
}
