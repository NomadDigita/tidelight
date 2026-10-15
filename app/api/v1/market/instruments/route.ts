import { listTokenizedEquityInstruments, validateInstrumentQuery } from "@/lib/tic/market";
import { apiError, authorizeMarketRequest, finishUsage } from "@/lib/tic/credentials";

export async function GET(request: Request) {
  const started = performance.now();
  const auth = await authorizeMarketRequest(request, "/v1/market/instruments");
  if (auth.error) return auth.error;
  const { admin, requestId, usageId } = auth;
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") ?? "rtoken";
  const limitRaw = params.get("limit") ?? "20";
  const cursor = params.get("cursor");
  const query = validateInstrumentQuery(kind, limitRaw, cursor);
  if (!query) {
    await finishUsage(admin, usageId, 400, started);
    return apiError(400, "invalid_request", "Use kind=rtoken, limit=1..100, and an instrument symbol cursor.", requestId);
  }
  try {
    const result = await listTokenizedEquityInstruments(query.limit, query.cursor);
    await finishUsage(admin, usageId, 200, started);
    return Response.json({ ...result, request_id: requestId }, { headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
  } catch {
    await finishUsage(admin, usageId, 503, started);
    return apiError(503, "provider_unavailable", "Verified tokenized equity data is temporarily unavailable.", requestId);
  }
}
