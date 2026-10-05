import { getBitgetCandles, type CandleInterval } from "@/lib/bitget-market";

const symbolPattern = /^[A-Z0-9]{2,32}$/;
const intervals = new Set<CandleInterval>(["1H", "4H", "1D"]);

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const query = new URL(request.url).searchParams;
  const interval = query.get("interval")?.toUpperCase() as CandleInterval | undefined;
  const rawLimit = query.get("limit");
  const limit = rawLimit === null ? 240 : Number(rawLimit);
  if (!symbolPattern.test(symbol) || !interval || !intervals.has(interval) || !Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return Response.json({ error: "Choose a valid Bitget symbol and interval (1H, 4H, or 1D); limit must be 1–1,000." }, { status: 400 });
  }
  try {
    const candles = await getBitgetCandles(symbol, interval, limit);
    return Response.json({ provider: "Bitget", symbol, interval, candles }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch {
    return Response.json({ error: "Bitget candle history is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
