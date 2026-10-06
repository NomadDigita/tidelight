import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Candle = { timestamp: string; close: number; signal?: number };
function mean(values: number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function stdev(values: number[]) { const avg = mean(values); return Math.sqrt(mean(values.map((v) => (v - avg) ** 2))); }

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to validate a strategy." }, { status: 401 });
  let body: { candles?: unknown; feeBps?: unknown; slippageBps?: unknown } = {};
  try { body = await request.json(); } catch {}
  const candles = Array.isArray(body.candles) ? body.candles.filter((item): item is Candle => Boolean(item && typeof item === "object" && typeof (item as Candle).close === "number" && typeof (item as Candle).timestamp === "string")).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)) : [];
  if (candles.length < 120) return NextResponse.json({ error: "Provide at least 120 ordered candles so the 60-day and 30-day validation windows remain meaningful." }, { status: 422 });
  const fee = Math.max(0, Math.min(100, Number(body.feeBps) || 8)) / 10000;
  const slippage = Math.max(0, Math.min(100, Number(body.slippageBps) || 5)) / 10000;
  const returns = candles.slice(1).map((candle, index) => {
    const previous = candles[index].close;
    const gross = previous ? candle.close / previous - 1 : 0;
    const signal = Number(candle.signal ?? 0);
    const side = signal > 0 ? 1 : signal < 0 ? -1 : 0;
    return { timestamp: candle.timestamp, net: side * gross - (side ? fee + slippage : 0), side };
  });
  const split = Math.max(60, Math.floor(returns.length * 0.67));
  const windows = { in_sample: returns.slice(0, split), out_of_sample: returns.slice(split) };
  const summarize = (items: typeof returns) => {
    let equity = 1, peak = 1, maxDrawdown = 0, wins = 0, trades = 0;
    const values: number[] = [];
    for (const item of items) { equity *= 1 + item.net; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, peak ? (peak - equity) / peak : 0); values.push(item.net); if (item.side) { trades++; if (item.net > 0) wins++; } }
    const volatility = stdev(values);
    return { totalReturn: equity - 1, sharpe: volatility ? mean(values) / volatility * Math.sqrt(365) : 0, maxDrawdown, winRate: trades ? wins / trades : 0, trades, equityCurveEnd: equity };
  };
  return NextResponse.json({
    methodology: { feeBps: fee * 10000, slippageBps: slippage * 10000, splitIndex: split, totalObservations: returns.length },
    inSample: summarize(windows.in_sample),
    outOfSample: summarize(windows.out_of_sample),
    warnings: ["Synthetic or incomplete candles can invalidate these results.", "Past performance is not a prediction.", "rTokens may diverge from their underlying during low liquidity or market-closure periods."]
  });
}
