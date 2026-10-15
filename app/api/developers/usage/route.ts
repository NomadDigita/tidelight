import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to review usage." }, { status: 401 });
  try {
    const { data, error } = await createAdminClient().from("developer_api_requests").select("id,project_id,key_id,endpoint,status_code,duration_ms,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return Response.json({ requests: data }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Usage is temporarily unavailable." }, { status: 503 }); }
}
