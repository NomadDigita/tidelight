import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBitgetAsset, getBitgetCandles } from "@/lib/bitget-market";
import { evaluateSmaCrossover } from "@/lib/nightwatch-signal";

const FOUR_HOURS = 4 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to run Nightwatch." }, { status: 401 });

  let symbol = "";
  try {
    const body = await request.json() as { symbol?: unknown };
    symbol = typeof body.symbol === "string" ? body.symbol.toUpperCase() : "";
  } catch {
    return NextResponse.json({ error: "Choose a valid Bitget Reality market." }, { status: 400 });
  }
  if (!/^[A-Z0-9]{2,24}USDT$/.test(symbol)) return NextResponse.json({ error: "Choose a valid Bitget Reality market." }, { status: 400 });

  try {
    const asset = await getBitgetAsset(symbol);
    if (!asset?.isReality) return NextResponse.json({ error: "Nightwatch only monitors Bitget Reality tokenized equities." }, { status: 422 });

    const candles = await getBitgetCandles(symbol, "4H", 1000);
    const now = Date.now();
    const closed = candles.filter((candle) => candle.timestamp + FOUR_HOURS <= now);
    if (closed.length < 51) return NextResponse.json({ error: "Bitget has not returned enough completed 4-hour candles for the 20 / 50 trend check." }, { status: 422 });

    const current = closed.at(-1)!;
    const previous = closed.at(-2)!;
    const closes = closed.map((candle) => candle.close);
    const { signal, fastSma: fast, slowSma: slow, previousFastSma: previousFast, previousSlowSma: previousSlow } = evaluateSmaCrossover(closes);
    const asOfMs = current.timestamp + FOUR_HOURS;
    const { data, error } = await supabase.rpc("nightwatch_tick", {
      p_symbol: symbol,
      p_as_of_ms: asOfMs,
      p_reference_price: current.close,
      p_fast_sma: fast,
      p_slow_sma: slow,
      p_signal: signal,
      p_snapshot: {
        provider: "Bitget public Spot candles",
        interval: "4H",
        closedCandleStart: new Date(current.timestamp).toISOString(),
        closedCandleEnd: new Date(asOfMs).toISOString(),
        previousCandleStart: new Date(previous.timestamp).toISOString(),
        previousFastSma: previousFast,
        previousSlowSma: previousSlow,
        assetName: asset.name,
        underlyingTicker: asset.underlyingTicker,
        feeRate: 0.001,
        slippageRate: 0.0005,
        rule: "SMA20/50 completed-candle crossover v1",
      },
    });
    if (error) {
      console.error("Nightwatch paper tick failed", { code: error.code, message: error.message });
      return NextResponse.json({ error: error.message.includes("stale") ? error.message : "Could not save the paper decision. Try again shortly." }, { status: 500 });
    }
    return NextResponse.json({ result: data, asset: { symbol: asset.symbol, name: asset.name, ticker: asset.underlyingTicker, logoUrl: asset.logoUrl }, signal, fastSma: fast, slowSma: slow, asOf: new Date(asOfMs).toISOString(), price: current.close, history: closed.slice(-90).map((candle) => ({ t: candle.timestamp, c: candle.close })) });
  } catch (error) {
    console.error("Nightwatch market check failed", error instanceof Error ? error.message : "Unknown market error");
    return NextResponse.json({ error: "Bitget market data is temporarily unavailable. No paper order was placed." }, { status: 502 });
  }
}
