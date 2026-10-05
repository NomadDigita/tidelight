import { randomUUID } from "node:crypto";
import { getBitgetMarketUniverse } from "@/lib/bitget-market";

export const dynamic = "force-dynamic";

export async function GET() {
  const runId = randomUUID();
  const started = performance.now();
  try {
    const market = await getBitgetMarketUniverse();
    const ageMs = Math.max(0, Date.now() - market.generatedAt);
    return Response.json({
      runId,
      checkedAt: new Date().toISOString(),
      requestMs: Math.round(performance.now() - started),
      deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local",
      providers: {
        bitget: { state: ageMs <= market.staleAfterMs ? "available" : "stale", ageMs, staleAfterMs: market.staleAfterMs, assets: market.coverage.total, reality: market.coverage.rTokens, sessionMetadata: market.marketSessionStatus, assetMetadata: market.metadataStatus },
        qwen: { state: process.env.BITGET_QWEN_API_KEY ? "configured" : "not_configured" },
        supabase: { state: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? "configured" : "not_configured" },
        nightwatchScheduler: { state: process.env.CRON_SECRET && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) ? "configured" : "setup_required" },
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ runId, checkedAt: new Date().toISOString(), requestMs: Math.round(performance.now() - started), deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local", providers: { bitget: { state: "unavailable" }, qwen: { state: process.env.BITGET_QWEN_API_KEY ? "configured" : "not_configured" }, supabase: { state: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? "configured" : "not_configured" }, nightwatchScheduler: { state: process.env.CRON_SECRET && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) ? "configured" : "setup_required" } } }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  }
}
