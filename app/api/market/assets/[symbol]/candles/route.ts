import { getBitgetCandles, type CandleInterval } from "@/lib/bitget-market";

const symbolPattern = /^[A-Z0-9]{2,32}$/;
const intervals = new Set<CandleInterval>(["1H", "4H", "1D"]);

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const interval = new URL(request.url).searchParams.get("interval")?.toUpperCase() as CandleInterval | undefined;
  if (!symbolPattern.test(symbol) || !interval || !intervals.has(interval)) {
    return Response.json({ error: "Choose a valid Bitget symbol and interval (1H, 4H, or 1D)." }, { status: 400 });
  }
  try {
    const candles = await getBitgetCandles(symbol, interval);
    return Response.json({ provider: "Bitget", symbol, interval, candles }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch {
    return Response.json({ error: "Bitget candle history is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
