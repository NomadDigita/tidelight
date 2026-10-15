import { getBitgetMarketUniverse } from "@/lib/bitget-market";
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
  if (kind !== "rtoken" || !/^[1-9][0-9]?$|^100$/.test(limitRaw) || (cursor !== null && !/^[A-Z0-9]{2,32}$/.test(cursor))) {
    await finishUsage(admin, usageId, 400, started);
    return apiError(400, "invalid_request", "Use kind=rtoken, limit=1..100, and an instrument symbol cursor.", requestId);
  }
  try {
    const market = await getBitgetMarketUniverse();
    const eligible = market.assets.filter(asset => asset.kind === "rtoken" && asset.isReality && asset.underlyingTicker).sort((a, b) => a.symbol.localeCompare(b.symbol));
    const page = eligible.filter(asset => !cursor || asset.symbol > cursor).slice(0, Number(limitRaw) + 1);
    const hasMore = page.length > Number(limitRaw);
    const instruments = page.slice(0, Number(limitRaw)).map(asset => ({
      symbol: asset.symbol, instrument_type: "tokenized_equity_spot", underlying_ticker: asset.underlyingTicker,
      issuer_name: asset.name, quote_currency: asset.quoteCoin, last_price: asset.lastPrice,
      change_24h: asset.change24h, provider_timestamp: asset.providerTimestamp,
      market_session_status: asset.marketSessionStatus, source: "Bitget Reality spot"
    }));
    await finishUsage(admin, usageId, 200, started);
    return Response.json({ data: instruments, next_cursor: hasMore ? instruments.at(-1)?.symbol : null, generated_at: market.generatedAt, request_id: requestId }, { headers: { "Cache-Control": "private, no-store", "X-Request-Id": requestId } });
  } catch {
    await finishUsage(admin, usageId, 503, started);
    return apiError(503, "provider_unavailable", "Verified tokenized equity data is temporarily unavailable.", requestId);
  }
}
