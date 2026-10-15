import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { issueSecret, sameOrigin } from "@/lib/tic/credentials";
import { getProjectRole } from "@/lib/tic/organizations";
import { canRevokeOrganizationKey } from "@/lib/tic/organization-rbac";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to rotate a key." }, { status: 401 });

  const { keyId } = await params;
  if (!UUID.test(keyId)) return Response.json({ error: "Invalid key ID." }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data: key, error: keyError } = await admin.from("developer_api_keys")
      .select("id,project_id,owner_id,environment,revoked_at,expires_at")
      .eq("id", keyId).maybeSingle();
    if (keyError) throw keyError;
    if (!key || key.revoked_at || (key.expires_at && Date.parse(key.expires_at) <= Date.now())) {
      return Response.json({ error: "Active key not found." }, { status: 404 });
    }

    const role = await getProjectRole(admin, key.project_id, user.id);
    if (!role) return Response.json({ error: "Active key not found." }, { status: 404 });
    if (!canRevokeOrganizationKey(role, key.owner_id === user.id)) {
      return Response.json({ error: "Your organization role cannot rotate this credential." }, { status: 403 });
    }

    const replacement = issueSecret(key.environment);
    const { data: replacementId, error: rotateError } = await admin.rpc("rotate_developer_api_key", {
      p_key_id: key.id,
      p_key_hash: replacement.hash,
      p_key_prefix: replacement.prefix,
    });
    if (rotateError || typeof replacementId !== "string") throw rotateError ?? new Error("Invalid rotation result");

    return Response.json({ rotated: true, keyId: replacementId, secret: replacement.secret }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Key could not be rotated." }, { status: 503 });
  }
}
