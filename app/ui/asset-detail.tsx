"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CandleInterval, MarketAsset, MarketCandle } from "@/lib/bitget-market";

type Interval = CandleInterval;
type Payload = { asset: MarketAsset };
type CandlePayload = { candles: MarketCandle[]; error?: string };

const intervals: { value: Interval; label: string }[] = [
  { value: "1H", label: "1H" }, { value: "4H", label: "4H" }, { value: "1D", label: "1D" },
];

function money(value: number | null, maxDecimals = 4) {
  if (value === null) return "—";
  const digits = Math.max(0, Math.min(12, maxDecimals));
  const minimum = Math.min(digits, value > 0 && value < 0.01 ? 6 : 2);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: minimum }).format(value);
}

function MarketChart({ candles }: { candles: MarketCandle[] }) {
  const frame = useMemo(() => {
    const low = Math.min(...candles.map((candle) => candle.low));
    const high = Math.max(...candles.map((candle) => candle.high));
    const spread = high - low || Math.max(high * 0.02, 1);
    const ceiling = high + spread * 0.08;
    const floor = low - spread * 0.08;
    const drawable = candles.slice(-140);
    const volumeMax = Math.max(1, ...drawable.map((candle) => candle.volume ?? 0));
    const x = (index: number) => 18 + (index / Math.max(1, drawable.length - 1)) * 864;
    const y = (value: number) => 24 + ((ceiling - value) / (ceiling - floor)) * 198;
    return { drawable, ceiling, floor, volumeMax, x, y };
  }, [candles]);

  if (!candles.length) return <div className="asset-chart-empty">No Bitget candles are available for this interval yet.</div>;

  const barWidth = Math.max(2, Math.min(9, 720 / frame.drawable.length));
  return <div className="asset-chart-wrap">
    <svg className="asset-chart" viewBox="0 0 900 300" role="img" aria-label={`${candles.length} Bitget market candles`}>
      {[0, 1, 2, 3].map((line) => {
        const y = 24 + line * 66;
        const value = frame.ceiling - (line / 3) * (frame.ceiling - frame.floor);
        return <g key={line}><line x1="12" x2="888" y1={y} y2={y} className="chart-gridline" /><text x="12" y={y - 5} className="chart-axis-label">{money(value, 2)}</text></g>;
      })}
      {frame.drawable.map((candle, index) => {
        const x = frame.x(index);
        const openY = frame.y(candle.open);
        const closeY = frame.y(candle.close);
        const up = candle.close >= candle.open;
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(2, Math.abs(closeY - openY));
        const volumeHeight = 36 * ((candle.volume ?? 0) / frame.volumeMax);
        return <g key={candle.timestamp} className={up ? "candle-up" : "candle-down"}>
          <title>{`${new Date(candle.timestamp).toLocaleString()} · O ${money(candle.open)} H ${money(candle.high)} L ${money(candle.low)} C ${money(candle.close)}`}</title>
          <line x1={x} x2={x} y1={frame.y(candle.high)} y2={frame.y(candle.low)} className="chart-wick" />
          <rect x={x - barWidth / 2} y={bodyTop} width={barWidth} height={bodyHeight} rx="1" className="chart-body" />
          <rect x={x - barWidth / 2} y={268 - volumeHeight} width={barWidth} height={volumeHeight} className="chart-volume" />
        </g>;
      })}
      <text x="16" y="294" className="chart-axis-label">{new Date(frame.drawable[0].timestamp).toLocaleDateString()}</text>
      <text x="884" y="294" textAnchor="end" className="chart-axis-label">{new Date(frame.drawable[frame.drawable.length - 1].timestamp).toLocaleDateString()}</text>
      <text x="18" y="248" className="chart-volume-label">VOLUME</text>
    </svg>
  </div>;
}

export default function AssetDetail({ symbol }: { symbol: string }) {
  const [asset, setAsset] = useState<MarketAsset | null>(null);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [interval, setInterval] = useState<Interval>("1D");
  const [loading, setLoading] = useState(true);
  const [loadedChartKey, setLoadedChartKey] = useState("");
  const [error, setError] = useState("");
  const [chartError, setChartError] = useState("");
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(`/api/market/assets/${encodeURIComponent(symbol)}`).then(async (response) => {
      const body = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Market details unavailable");
      if (active) { setAsset(body.asset); setError(""); }
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Market details unavailable"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [symbol]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/market/assets/${encodeURIComponent(symbol)}/candles?interval=${interval}`).then(async (response) => {
      const body = await response.json() as CandlePayload;
      if (!response.ok) throw new Error(body.error ?? "Bitget candle history unavailable");
      if (active) { setCandles(body.candles); setChartError(""); }
    }).catch((cause: unknown) => { if (active) { setCandles([]); setChartError(cause instanceof Error ? cause.message : "Bitget candle history unavailable"); } })
      .finally(() => { if (active) setLoadedChartKey(`${symbol}:${interval}`); });
    return () => { active = false; };
  }, [symbol, interval]);

  const change = asset?.change24h ?? null;
  const lastCandle = candles.at(-1);
  const firstCandle = candles[0];
  const chartLoading = loadedChartKey !== `${symbol}:${interval}`;
  const changeClass = change !== null && change !== undefined && change < 0 ? "negative" : "positive";

  if (loading && !asset) return <div className="content-wrap inner-page asset-page"><div className="asset-loading">Loading verified Bitget market details…</div></div>;
  if (error && !asset) return <div className="content-wrap inner-page asset-page"><Link className="asset-back" href="/markets">← Market map</Link><div className="universe-message"><b>Market details unavailable</b><span>{error}</span></div></div>;
  if (!asset) return null;

  return <div className="content-wrap inner-page asset-page">
    <nav className="asset-breadcrumb" aria-label="Breadcrumb"><Link href="/markets">Market map</Link><span>/</span><span>{asset.symbol}</span></nav>
    <header className="asset-profile">
      <div className={`asset-profile-logo ${asset.kind}`}>{asset.logoUrl && !logoFailed ? <img src={asset.logoUrl} alt="" onError={() => setLogoFailed(true)} /> : <b>{(asset.underlyingTicker ?? asset.baseCoin).slice(0, 1)}</b>}</div>
      <div className="asset-profile-heading"><div className="eyebrow"><span className="eyebrow-line" /> BITGET {asset.kind === "rtoken" ? "REALITY ASSET" : asset.kind === "rwa" ? "RWA MARKET" : "SPOT MARKET"}</div><h1>{asset.name}</h1><p>{asset.underlyingTicker ? `${asset.underlyingTicker} · ${asset.symbol}` : asset.symbol} <span>·</span> {asset.quoteCoin} spot pair</p></div>
      <div className="asset-profile-price"><b>${money(asset.lastPrice)}</b><span className={changeClass}>{change === null ? "Change unavailable" : `${change >= 0 ? "+" : ""}${(change * 100).toFixed(2)}% · 24h`}</span><small>Bitget · {asset.providerTimestamp ? new Date(asset.providerTimestamp).toLocaleString() : "timestamp unavailable"}</small></div>
    </header>

    <div className="asset-detail-grid">
      <section className="asset-panel asset-chart-panel" aria-labelledby="price-chart-title">
        <div className="asset-panel-head"><div><div className="eyebrow small-eyebrow">BITGET SPOT · OHLCV</div><h2 id="price-chart-title">Price history</h2></div><div className="asset-intervals" role="group" aria-label="Chart interval">{intervals.map((item) => <button key={item.value} type="button" aria-pressed={interval === item.value} className={interval === item.value ? "selected" : ""} onClick={() => setInterval(item.value)}>{item.label}</button>)}</div></div>
        {chartLoading ? <div className="asset-chart-empty" role="status">Loading Bitget candles…</div> : chartError ? <div className="asset-chart-empty" role="status">{chartError}</div> : <MarketChart candles={candles} />}
        <div className="asset-chart-foot"><span>{candles.length ? `${candles.length} candles · ${interval}` : "Bitget public candle feed"}</span><span>{lastCandle ? `Last close $${money(lastCandle.close)}` : "No last close"}</span></div>
      </section>

      <aside className="asset-panel asset-facts-panel"><div className="eyebrow small-eyebrow">INSTRUMENT REFERENCE</div><h2>What this market is</h2>
        <dl className="asset-facts"><div><dt>Asset class</dt><dd>{asset.kind === "rtoken" ? "Reality · tokenized US equity" : asset.kind === "rwa" ? "Bitget flagged RWA" : "Digital asset"}</dd></div><div><dt>Underlying</dt><dd>{asset.underlyingTicker ?? "Not applicable"}</dd></div><div><dt>Weekend trading</dt><dd>{asset.weekendTradable === null ? "Not provided" : asset.weekendTradable ? "Supported" : "Not supported"}</dd></div><div><dt>Tradable sessions</dt><dd>{asset.tradingSessions.length ? asset.tradingSessions.map((value) => value.replaceAll("_", " ")).join(" · ") : "Not provided"}</dd></div><div><dt>24h high / low</dt><dd>${money(asset.high24h)} / ${money(asset.low24h)}</dd></div><div><dt>24h turnover</dt><dd>${money(asset.turnover24h, 0)}</dd></div><div><dt>Observed period</dt><dd>{firstCandle && lastCandle ? `${new Date(firstCandle.timestamp).toLocaleDateString()} — ${new Date(lastCandle.timestamp).toLocaleDateString()}` : "Awaiting candles"}</dd></div></dl>
        <div className="asset-source-note"><b>Source and limits</b><p>Prices and candles come from Bitget’s public spot market API. Reality classification, underlying ticker, tradable sessions and weekend status come from Bitget reference data. Mapped company names and logos are display metadata. This is not an order book or a trade recommendation.</p></div>
      </aside>
    </div>

    <section className="asset-next-step"><div><div className="eyebrow small-eyebrow">TAKE THE NEXT STEP</div><h2>Put the move in context.</h2><p>Build an evidence-backed brief, or add this underlying company to your private radar.</p></div><div className="asset-next-actions"><Link href={`/research?symbol=${encodeURIComponent(asset.symbol)}`}>Research this market <span>↗</span></Link><Link href={`/watchlist?symbol=${encodeURIComponent(asset.underlyingTicker ?? asset.baseCoin)}`}>Open company radar <span>↗</span></Link></div></section>
  </div>;
}
