import { createClient } from "@/lib/supabase/server";
import { getBitgetAsset, getBitgetCandles, getBitgetMarketUniverse } from "@/lib/bitget-market";
import { issuerLogoUrl } from "@/lib/issuer-logo";
import NightwatchDesk from "@/app/ui/nightwatch-desk";

export const revalidate = 60;

export default async function NightwatchPage({ searchParams }: { searchParams: Promise<{ symbol?: string; researchRunId?: string }> }) {
  const { symbol: requestedSymbol, researchRunId: requestedResearchRunId } = await searchParams;
  const researchRunId = requestedResearchRunId?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)?.[0] ?? null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const universe = await getBitgetMarketUniverse().catch(() => null);
  const assets = (universe?.assets ?? []).filter((asset) => asset.isReality).map((asset) => ({
    symbol: asset.symbol, name: asset.name, ticker: asset.underlyingTicker, lastPrice: asset.lastPrice, change24h: asset.change24h,
    logoUrl: asset.logoUrl ?? issuerLogoUrl(asset),
  }));
  const defaultSymbol = (requestedSymbol && assets.some((asset) => asset.symbol === requestedSymbol.toUpperCase())
    ? requestedSymbol.toUpperCase()
    : null) ?? assets.find((asset) => asset.symbol === "RAAPLUSDT")?.symbol ?? assets[0]?.symbol ?? "RAAPLUSDT";
  const [accountResult, runsResult, ordersResult, positionsResult, alertsResult] = user ? await Promise.all([
    supabase.rpc("nightwatch_ensure_account").maybeSingle(),
    supabase.from("nightwatch_runs").select("id, symbol, signal, outcome, reason, as_of, reference_price, fast_sma, slow_sma, snapshot, created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("nightwatch_orders").select("id, symbol, side, quantity, simulated_fill_price, notional, fee, realized_pnl, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("nightwatch_positions").select("id, symbol, quantity, average_cost, opened_at"),
    supabase.from("nightwatch_alerts").select("id, kind, title, body, read_at, created_at").order("created_at", { ascending: false }).limit(20),
  ]) : [{ data: null }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const positions = await Promise.all((positionsResult.data ?? []).map(async (position) => {
    const asset = assets.find((item) => item.symbol === position.symbol) ?? await getBitgetAsset(position.symbol).catch(() => null);
    const ticker = asset ? ("ticker" in asset ? asset.ticker : asset.underlyingTicker) : null;
    return { ...position, currentPrice: asset?.lastPrice ?? null, name: asset?.name ?? position.symbol, ticker,
      logoUrl: asset?.logoUrl ?? (asset ? issuerLogoUrl(asset) : issuerLogoUrl({ symbol: position.symbol })) };
  }));
  const initialHistory = await getBitgetCandles(defaultSymbol, "4H", 1000).then((candles) => {
    const fourHours = 4 * 60 * 60 * 1000;
    return candles.filter((candle) => candle.timestamp + fourHours <= Date.now()).slice(-90).map((candle) => ({ t: candle.timestamp, c: candle.close }));
  }).catch(() => []);

  return <NightwatchDesk
    signedIn={Boolean(user)}
    assets={assets}
    initialRuns={(runsResult.data ?? []) as never}
    initialOrders={(ordersResult.data ?? []) as never}
    positions={positions as never}
    cashBalance={Number(accountResult.data?.cash_balance ?? 10000)}
    paused={accountResult.data?.paused ?? false}
    initialHistory={initialHistory}
    defaultSymbol={defaultSymbol}
    researchRunId={researchRunId}
    initialAlerts={(alertsResult.data ?? []) as never}
  />;
}
