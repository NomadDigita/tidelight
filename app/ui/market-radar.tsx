"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MarketAsset } from "@/lib/bitget-market";
import IssuerLogo from "@/app/ui/issuer-logo";

const companies = [
  { symbol: "NVDA", name: "NVIDIA", field: "Semiconductors", color: "green" },
  { symbol: "TSLA", name: "Tesla", field: "Mobility", color: "red" },
  { symbol: "MSFT", name: "Microsoft", field: "Cloud & AI", color: "blue" },
  { symbol: "AMZN", name: "Amazon", field: "Commerce", color: "amber" },
];
const issuerDomains: Record<string, string> = { NVDA: "nvidia.com", TSLA: "tesla.com", MSFT: "microsoft.com", AMZN: "amazon.com" };

type RadarAsset = Pick<MarketAsset, "symbol" | "baseCoin" | "name" | "underlyingTicker" | "kind" | "isReality" | "lastPrice" | "change24h" | "providerTimestamp" | "logoUrl" | "high24h" | "low24h" | "turnover24h"> & { history?: { timestamp: number; close: number }[]; historySymbol?: string | null };
type MarketSnapshot = { assets: RadarAsset[]; generatedAt: number; staleAfterMs: number };

function price(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 0.01 ? 6 : 2, minimumFractionDigits: 2 }).format(value);
}

function relativeTime(timestamp: number | null, now: number) {
  if (!timestamp) return "Timestamp unavailable";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  return seconds < 5 ? "just now" : `${seconds}s ago`;
}

function chartPoints(history: RadarAsset["history"]) {
  if (!history || history.length < 2) return null;
  const values = history.map((item) => item.close);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || Math.max(Math.abs(max) * 0.002, 0.000001);
  return values.map((value, index) => `${(index / (values.length - 1)) * 100},${28 - ((value - min) / span) * 22}`).join(" ");
}

export default function MarketRadar({ initialAssets, initialGeneratedAt, initialNow }: { initialAssets: RadarAsset[]; initialGeneratedAt: number | null; initialNow: number }) {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(initialGeneratedAt ? { assets: initialAssets, generatedAt: initialGeneratedAt, staleAfterMs: 120_000 } : null);
  const [reconnecting, setReconnecting] = useState(false);
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/market/radar", { cache: "no-store" });
        const body = await response.json() as MarketSnapshot & { error?: string };
        if (!response.ok || !Array.isArray(body.assets)) throw new Error(body.error ?? "Market feed unavailable");
        if (active) {
          setSnapshot(body);
          setReconnecting(false);
        }
      } catch {
        if (active) setReconnecting(true);
      }
    };
    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), 15_000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const verifiedAssets = snapshot?.assets ?? [];
  const isStale = Boolean(snapshot && verifiedAssets.some((asset) => !asset.providerTimestamp || now - asset.providerTimestamp > snapshot.staleAfterMs));
  const feedState = reconnecting ? "reconnecting" : isStale ? "stale" : snapshot && verifiedAssets.length ? "live" : "unavailable";

  return <>
    <div className="company-grid">{companies.map((company, index) => {
      const asset = verifiedAssets.find((item) => item.isReality && item.underlyingTicker === company.symbol);
      const logoUrl = asset?.logoUrl ?? `https://www.google.com/s2/favicons?domain=${issuerDomains[company.symbol]}&sz=128`;
      const points = chartPoints(asset?.history);
      const referenceChange = asset?.history && asset.history.length > 1 ? asset.history.at(-1)!.close - asset.history[0].close : null;
      const rangePosition = asset?.high24h && asset.low24h !== null && asset.high24h > asset.low24h ? Math.max(0, Math.min(100, ((asset.lastPrice - asset.low24h) / (asset.high24h - asset.low24h)) * 100)) : 50;
      return <Link className={`company-card${asset ? "" : " is-unavailable"}`} href={asset ? `/markets/${encodeURIComponent(asset.symbol)}` : "/markets"} key={company.symbol}>
        <div className="company-card-top"><IssuerLogo ticker={company.symbol} logoUrl={logoUrl} /><span className="company-symbol">{asset?.symbol ?? company.symbol}</span><span className="company-index">0{index + 1}</span></div>
        <b>{company.name}</b><small>{asset ? `${company.field} · Bitget Reality` : company.field}</small>
        {asset ? <div className="company-card-price"><span>${price(asset.lastPrice)}</span><b className={asset.change24h !== null && asset.change24h < 0 ? "negative" : "positive"}>{asset.change24h === null ? "—" : `${asset.change24h >= 0 ? "+" : ""}${(asset.change24h * 100).toFixed(2)}%`}</b></div> : null}
        {asset ? <>
          <div className="company-chart-wrap">
            {points ? <svg className="company-chart" viewBox="0 0 100 34" preserveAspectRatio="none" role="img" aria-label={`${company.symbol} Bitget ${asset.historySymbol ?? "stock perpetual"} four-hour perpetual reference closes, separate from the Reality spot quote`}>
              <defs><linearGradient id={`radar-fill-${company.symbol}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--brand-teal)" stopOpacity=".22"/><stop offset="1" stopColor="var(--brand-teal)" stopOpacity="0"/></linearGradient></defs>
              <path className="company-chart-area" d={`M ${points.replaceAll(" ", " L ")} L 100 34 L 0 34 Z`} fill={`url(#radar-fill-${company.symbol})`} />
              <polyline points={points} className={referenceChange !== null && referenceChange < 0 ? "down" : "up"} />
              <text x="50" y="20" textAnchor="middle">TIDELIGHT — BITGET</text>
            </svg> : <div className="company-chart-empty">Bitget history unavailable</div>}
          </div>
          {points ? <div className="company-chart-caption">{asset.historySymbol ?? "Stock perpetual"} · 4H REFERENCE</div> : null}
          <div className="company-card-range"><span>24H LOW <b>${price(asset.low24h)}</b></span><i><em style={{ left: `${rangePosition}%` }} /></i><span>24H HIGH <b>${price(asset.high24h)}</b></span></div>
          <div className="company-card-volume"><span>TURNOVER</span><b>{asset.turnover24h === null ? "—" : `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(asset.turnover24h)}`}</b></div>
        </> : null}
        <div className="company-card-foot"><span className={`pulse-dot ${feedState}`} /> {asset ? `Bitget · ${relativeTime(asset.providerTimestamp, now)}` : snapshot ? "Issuer reference" : "Market feed unavailable"} <span>↗</span></div>
      </Link>;
    })}</div>
    <div className={`radar-feed-status ${feedState}`} role="status" aria-live="polite">
      <span className="radar-feed-indicator" />
      {feedState === "live" ? "Bitget public market feed · updating every 15 seconds" : feedState === "stale" ? "Showing the last verified quotes · waiting for a fresh Bitget update" : feedState === "reconnecting" ? "Bitget feed reconnecting · last verified quotes are retained" : "Bitget market feed unavailable · no sample prices shown"}
    </div>
  </>;
}
