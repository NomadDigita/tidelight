import { getBitgetCandles, getBitgetStockPerp, STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";

const allowed = new Set(["15m","1H","4H","1D"]);
async function publicData(path: string) {
  const response = await fetch("https://api.bitget.com/api/v3" + path, { next: { revalidate: 5 }, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Bitget public market feed unavailable");
  const body = await response.json() as { code?: string; data?: unknown; requestTime?: number };
  if (body.code && body.code !== "00000") throw new Error("Bitget public market feed unavailable");
  return body;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const symbol = query.get("symbol")?.toUpperCase() ?? "";
  const interval = query.get("interval") ?? "15m";
  if (!STOCK_PERP_UNIVERSE.some((item) => item === symbol)) return Response.json({ error: "Choose a supported stock perpetual." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (!allowed.has(interval)) return Response.json({ error: "Choose a supported chart interval." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const params = new URLSearchParams({ category: "USDT-FUTURES", symbol });
    const [asset, candles, depthResult, tradesResult] = await Promise.all([
      getBitgetStockPerp(symbol),
      getBitgetCandles(symbol, interval as "15m"|"1H"|"4H"|"1D", 120, "USDT-FUTURES"),
      publicData("/market/orderbook?" + new URLSearchParams({ ...Object.fromEntries(params), limit: "20" })),
      publicData("/market/fills?" + new URLSearchParams({ ...Object.fromEntries(params), limit: "30" })).catch(() => ({ data: [] as unknown })),
    ]);
    if (!asset) return Response.json({ error: "This stock perpetual is not currently available from Bitget." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const depth = depthResult.data as { asks?: string[][]; bids?: string[][]; ts?: string } | undefined;
    const fills = tradesResult.data as Array<{ tradeId?: string; execId?: string; price?: string; size?: string; side?: string; ts?: string }> | undefined;
    return Response.json({
      provider: "Bitget", category: "USDT-FUTURES", interval,
      market: { symbol, lastPrice: asset.lastPrice, change24h: asset.change24h, high24h: asset.high24h, low24h: asset.low24h, open24h: asset.open24h, volume24h: asset.volume24h, turnover24h: asset.turnover24h, providerTimestamp: asset.providerTimestamp },
      candles: candles.slice(-120).map(({ timestamp, open, high, low, close, volume }) => ({ timestamp, open, high, low, close, volume })),
      orderbook: { asks: (depth?.asks ?? []).slice(0,12).map(([price,size])=>({price:Number(price),size:Number(size)})).filter(row=>Number.isFinite(row.price)&&Number.isFinite(row.size)), bids: (depth?.bids ?? []).slice(0,12).map(([price,size])=>({price:Number(price),size:Number(size)})).filter(row=>Number.isFinite(row.price)&&Number.isFinite(row.size)), timestamp: Number(depth?.ts) || null },
      trades: (fills ?? []).map((trade,index)=>({id:trade.tradeId??trade.execId??String(index),price:Number(trade.price),size:Number(trade.size),side:String(trade.side).toLowerCase()==="buy"?"buy" as const:"sell" as const,timestamp:Number(trade.ts)})).filter(trade=>Number.isFinite(trade.price)&&Number.isFinite(trade.size)&&Number.isFinite(trade.timestamp)).slice(0,30),
    }, { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" } });
  } catch {
    return Response.json({ error: "Bitget stock perpetual market data is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
