import { getBitgetCandles, getBitgetMarketUniverse, STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";

const RADAR_TICKERS = new Set(["NVDA", "TSLA", "MSFT", "AMZN"]);

export async function GET() {
  try {
    const market = await getBitgetMarketUniverse();
    const assets = await Promise.all(market.assets
      .filter((asset) => asset.isReality && RADAR_TICKERS.has(asset.underlyingTicker ?? ""))
      .map(async ({ symbol, baseCoin, name, underlyingTicker, kind, isReality, lastPrice, change24h, providerTimestamp, logoUrl, high24h, low24h, turnover24h }) => {
        // Reality spot tokens do not have a Bitget /market/candles history
        // endpoint. Use a separately identified stock perpetual reference only
        // where Bitget actually lists the corresponding contract.
        const historySymbol = `${underlyingTicker ?? ""}USDT`;
        const hasPerpetualReference = (STOCK_PERP_UNIVERSE as readonly string[]).includes(historySymbol);
        const candles = hasPerpetualReference ? await getBitgetCandles(historySymbol, "4H", 18, "USDT-FUTURES").catch(() => []) : [];
        const completed = candles.filter((candle) => candle.timestamp + 4 * 60 * 60 * 1000 <= Date.now());
        return {
          symbol, baseCoin, name, underlyingTicker, kind, isReality, lastPrice, change24h, providerTimestamp, logoUrl,
          high24h, low24h, turnover24h,
          historySymbol: hasPerpetualReference ? historySymbol : null,
          history: completed.slice(-16).map(({ timestamp, close }) => ({ timestamp, close })),
        };
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
