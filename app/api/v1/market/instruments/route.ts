import { listTokenizedEquityInstruments, validateInstrumentQuery } from "@/lib/tic/market";
import { apiError, authorizeMarketRequest, finishUsage } from "@/lib/tic/credentials";
import { MarketRedistributionNotAuthorizedError } from "@/lib/tic/market-terms";

export async function GET(request: Request) {
  const started = performance.now();
  const auth = await authorizeMarketRequest(request, "/v1/market/instruments");
  if (auth.error) return auth.error;
  const { admin, requestId, usageId } = auth;
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") ?? "rtoken";
  const limitRaw = params.get("limit") ?? "20";
  const cursor = params.get("cursor");
  const underlyingTicker = params.get("underlying_ticker");
  const query = validateInstrumentQuery(kind, limitRaw, cursor, underlyingTicker);
  if (!query) {
    await finishUsage(admin, usageId, 400, started);
    return apiError(400, "invalid_request", "Set kind=rtoken and limit=1..100; cursor must be an instrument symbol, and underlying_ticker must be a valid ticker when provided.", requestId);
  }
  try {
    const result = await listTokenizedEquityInstruments(query.limit, query.cursor, query.underlyingTicker);
    await finishUsage(admin, usageId, 200, started);
    return Response.json({ ...result, request_id: requestId }, { headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
  } catch (error) {
    await finishUsage(admin, usageId, 503, started);
    if (error instanceof MarketRedistributionNotAuthorizedError) {
      return apiError(503, "provider_terms_unconfirmed", "Redistribution permission for the upstream market data has not been confirmed.", requestId);
    }
    return apiError(503, "provider_unavailable", "Verified tokenized equity data is temporarily unavailable.", requestId);
  }
}
