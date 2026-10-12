import { getBitgetCandles, getBitgetStockPerp, STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";

const FOUR_HOURS = 4 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase() ?? "";
  if (!STOCK_PERP_UNIVERSE.some((item) => item === symbol)) {
    return Response.json({ error: "Choose a supported stock perpetual." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const [asset, candles] = await Promise.all([
      getBitgetStockPerp(symbol),
      getBitgetCandles(symbol, "4H", 96, "USDT-FUTURES"),
    ]);
    if (!asset) return Response.json({ error: "This stock perpetual is not currently available from Bitget." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const now = Date.now();
    const completed = candles.filter((candle) => candle.timestamp + FOUR_HOURS <= now);
    return Response.json({
      provider: "Bitget",
      category: "USDT-FUTURES",
      symbol,
      lastPrice: asset.lastPrice,
      providerTimestamp: asset.providerTimestamp,
      candles: completed.slice(-72).map(({ timestamp, open, high, low, close, volume }) => ({ timestamp, open, high, low, close, volume })),
    }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch {
    return Response.json({ error: "Bitget stock perpetual history is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
