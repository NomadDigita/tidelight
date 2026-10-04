import { getBitgetMarketUniverse } from "@/lib/bitget-market";

const RADAR_TICKERS = new Set(["NVDA", "TSLA", "MSFT", "AMZN"]);

export async function GET() {
  try {
    const market = await getBitgetMarketUniverse();
    const assets = market.assets
      .filter((asset) => asset.isReality && RADAR_TICKERS.has(asset.underlyingTicker ?? ""))
      .map(({ symbol, baseCoin, name, underlyingTicker, kind, isReality, lastPrice, change24h, providerTimestamp, logoUrl }) => ({
        symbol, baseCoin, name, underlyingTicker, kind, isReality, lastPrice, change24h, providerTimestamp, logoUrl,
      }));
    return Response.json({ assets, generatedAt: market.generatedAt, staleAfterMs: market.staleAfterMs }, {
      headers: { "Cache-Control": "public, s-maxage=12, stale-while-revalidate=24" },
    });
  } catch (error) {
    console.error("Bitget company radar unavailable", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Bitget market data is temporarily unavailable. Try again shortly." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
