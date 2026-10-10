import { configuredAgentKey } from "@/lib/agentkey";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Use this check from your workspace." }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to check the data source." }, { status: 401 });
  const client = configuredAgentKey();
  if (!client) return Response.json({ state: "not_configured" }, { status: 503 });
  // Reuse the authenticated, atomic two-per-hour provider diagnostic budget.
  const { data: checkId, error } = await supabase.rpc("reserve_ai_provider_check");
  if (error) return Response.json({ error: "Could not reserve a diagnostic." }, { status: 503 });
  if (!checkId) return Response.json({ error: "Provider checks are limited to twice per hour." }, { status: 429 });
  const started = Date.now();
  let state = "available";
  let failure = "";
  try {
    // Catalog discovery only. No billable execute_tool call and no user input.
    await client.findTools("Find public US equity company news and market sources");
  } catch (cause) {
    state = "unavailable";
    failure = cause instanceof Error ? cause.message : "agentkey-upstream";
  }
  const result = { provider: "agentkey", state, failure, requestMs: Date.now() - started, operation: "catalog discovery" };
  await supabase.from("ai_provider_checks").update({ status: "complete", result }).eq("id", checkId);
  return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
