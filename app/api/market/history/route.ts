import { NextResponse } from "next/server";
import { getBitgetCandles } from "@/lib/bitget-market";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase().match(/^[A-Z0-9]{2,32}$/)?.[0];
  if (!symbol) return NextResponse.json({ error: "Invalid market symbol." }, { status: 400 });
  const candles = await getBitgetCandles(symbol, "4H", 120).catch(() => []);
  const fourHours = 4 * 60 * 60 * 1000;
  return NextResponse.json({ symbol, candles: candles.filter((candle) => candle.timestamp + fourHours <= Date.now()).map((candle) => ({ t: candle.timestamp, c: candle.close })) });
}
