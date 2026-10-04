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

type RadarAsset = Pick<MarketAsset, "symbol" | "baseCoin" | "name" | "underlyingTicker" | "kind" | "isReality" | "lastPrice" | "change24h" | "providerTimestamp" | "logoUrl">;
type MarketSnapshot = { assets: RadarAsset[]; generatedAt: number; staleAfterMs: number };

function price(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 0.01 ? 6 : 2, minimumFractionDigits: 2 }).format(value);
}

function relativeTime(timestamp: number | null, now: number) {
  if (!timestamp) return "Timestamp unavailable";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  return seconds < 5 ? "just now" : `${seconds}s ago`;
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
      return <Link className="company-card" href={asset ? `/markets/${encodeURIComponent(asset.symbol)}` : "/markets"} key={company.symbol}>
        <div className="company-card-top"><IssuerLogo ticker={company.symbol} logoUrl={logoUrl} /><span className="company-symbol">{asset?.symbol ?? company.symbol}</span><span className="company-index">0{index + 1}</span></div>
        <b>{company.name}</b><small>{asset ? `${company.field} · Bitget Reality` : company.field}</small>
        {asset ? <div className="company-card-price"><span>${price(asset.lastPrice)}</span><b className={asset.change24h !== null && asset.change24h < 0 ? "negative" : "positive"}>{asset.change24h === null ? "—" : `${asset.change24h >= 0 ? "+" : ""}${(asset.change24h * 100).toFixed(2)}%`}</b></div> : null}
        <div className="company-card-foot"><span className={`pulse-dot ${feedState}`} /> {asset ? `Bitget · ${relativeTime(asset.providerTimestamp, now)}` : snapshot ? "Issuer reference" : "Market feed unavailable"} <span>↗</span></div>
      </Link>;
    })}</div>
    <div className={`radar-feed-status ${feedState}`} role="status" aria-live="polite">
      <span className="radar-feed-indicator" />
      {feedState === "live" ? "Bitget public market feed · updating every 15 seconds" : feedState === "stale" ? "Showing the last verified quotes · waiting for a fresh Bitget update" : feedState === "reconnecting" ? "Bitget feed reconnecting · last verified quotes are retained" : "Bitget market feed unavailable · no sample prices shown"}
    </div>
  </>;
}
