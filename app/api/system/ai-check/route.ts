import { createClient } from "@/lib/supabase/server";
import { aiJsonWithFallback, configuredAiProviders, safeProviderError } from "@/lib/ai-fallback";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: "Use the provider check from this workspace." }, { status: 403 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to check AI availability." }, { status: 401 });
  const configured = configuredAiProviders();
  if (!configured.length) return Response.json({ error: "No valid AI provider is configured." }, { status: 503 });
  const { data: checkId, error: reserveError } = await supabase.rpc("reserve_ai_provider_check");
  if (reserveError) return Response.json({ error: "Provider check could not be reserved." }, { status: 503 });
  if (!checkId) return Response.json({ error: "Provider checks are limited to twice per hour." }, { status: 429 });
  const providers = await Promise.all(configured.map(async provider => {
    const started = Date.now();
    const modelsUrl = provider.label === "gemini" ? "https://generativelanguage.googleapis.com/v1beta/models" : "https://hackathon.bitgetops.com/v1/models";
    const headers: Record<string, string> = provider.label === "gemini" ? { "x-goog-api-key": provider.key } : { Authorization: `Bearer ${provider.key}` };
    const models = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(5000), cache: "no-store" }).then(async response => {
      if (!response.ok) return { status: response.status, detail: safeProviderError(await response.text(), provider.key) };
      const body = await response.json();
      const list: unknown[] = provider.label === "gemini" ? body.models ?? [] : body.data ?? [];
      const names = list.flatMap(item => { if (!item || typeof item !== "object") return []; const obj = item as Record<string, unknown>; const name = obj.name ?? obj.id; return typeof name === "string" ? [name.replace(/^models\//, "")] : []; });
      return { status: response.status, configuredModelListed: names.includes(provider.model), availableModels: names.slice(0, 80) };
    }).catch(() => ({ status: 0, detail: "Model listing timed out or could not be reached." }));
    let state = "available", failure = "";
    try { await aiJsonWithFallback([{ role: "system", content: "Return valid JSON only." }, { role: "user", content: 'Return only JSON: {"ok":true}' }], value => value.ok === true, { provider: provider.label, budgetMs: 20000 }); }
    catch (cause) { state = "unavailable"; failure = cause instanceof Error ? cause.message : "Request failed"; }
    const result = { provider: provider.label, model: provider.model, state, failure, requestMs: Date.now() - started, models };
    console.info("ai-provider-check", result);
    return result;
  }));
  const { error: finishError } = await supabase.from("ai_provider_checks").update({ status: "complete", result: { providers } }).eq("id", checkId);
  if (finishError) return Response.json({ error: "Check completed but could not be saved." }, { status: 503 });
  return Response.json({ checkedAt: new Date().toISOString(), providers }, { headers: { "Cache-Control": "private, no-store" } });
}
