"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MarketAsset } from "@/lib/bitget-market";
import { issuerLogoUrl } from "@/lib/issuer-logo";
import IssuerLogo from "@/app/ui/issuer-logo";

type MarketPayload = {
  provider: string;
  generatedAt: number;
  assets: MarketAsset[];
  session: { market: string; daylightType: string | null; schedule: Array<{ state: string; startTime: string; endTime: string }> } | null;
  coverage: { total: number; rTokens: number; rwa: number; crypto: number };
  staleAfterMs: number;
  marketSessionStatus?: "available" | "empty" | "unavailable";
};

type Filter = "all" | "rtoken" | "rwa" | "crypto";
const filterOptions: { value: Filter; label: string }[] = [
  { value: "all", label: "All spot assets" }, { value: "rtoken", label: "rTokens" }, { value: "rwa", label: "Other RWA" }, { value: "crypto", label: "Crypto" },
];

function price(value: number | null, maximumDecimals = 6) {
  if (value === null) return "—";
  const digits = Math.max(0, Math.min(20, maximumDecimals));
  const minimumDigits = Math.min(digits, value > 0 && value < 0.01 ? 4 : 2);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: minimumDigits }).format(value);
}

function easternSessionReference(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  const weekday = part("weekday");
  const minutes = Number(part("hour")) * 60 + Number(part("minute"));
  if (weekday === "Sat" || weekday === "Sun") return "Weekend";
  if (minutes >= 240 && minutes < 570) return "Pre-market";
  if (minutes >= 570 && minutes < 960) return "Regular hours";
  if (minutes >= 960 && minutes < 1200) return "After-hours";
  return "Overnight";
}

function freshness(timestamp: number | null, staleAfterMs: number) {
  if (!timestamp) return { label: "Timestamp unavailable", fresh: false };
  const age = Math.max(0, Date.now() - timestamp);
  if (age > staleAfterMs) return { label: `Updated ${Math.floor(age / 60_000)}m ago`, fresh: false };
  return { label: age < 10_000 ? "Just updated" : `Updated ${Math.floor(age / 1000)}s ago`, fresh: true };
}

export default function MarketUniverse() {
  const [payload, setPayload] = useState<MarketPayload | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [visibleCount, setVisibleCount] = useState(18);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/market/universe", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Market data unavailable");
        if (active) { setPayload(body as MarketPayload); setError(""); setCheckedAt(Date.now()); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load market data");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const filteredAssets = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (payload?.assets ?? []).filter((asset) => {
      const matchesFilter = filter === "all" || (filter === "rtoken" ? asset.kind === "rtoken" : asset.kind === filter);
      const matchesQuery = !text || `${asset.symbol} ${asset.baseCoin} ${asset.name} ${asset.underlyingTicker ?? ""}`.toLowerCase().includes(text);
      return matchesFilter && matchesQuery;
    });
  }, [payload, query, filter]);

  const sessionLabel = payload?.session?.schedule.length
    ? `US sessions · ${payload.session.daylightType === "dst" ? "Daylight saving" : "Standard time"}`
    : payload?.marketSessionStatus === "unavailable" ? `Hours reference · ${easternSessionReference()}` : payload?.marketSessionStatus === "empty" ? "Session schedule not published" : "US session calendar warming up";

  return <section className="universe-section" aria-labelledby="universe-title">
    <div className="universe-heading">
      <div><div className="eyebrow small-eyebrow">BITGET SPOT · LIVE MARKET FEED</div><h2 id="universe-title">The tradable universe</h2><p>Bitget instruments, current tickers, token classification, and stock reference data.</p></div>
      <div className="universe-source"><span className={error ? "universe-status stale" : "universe-status"}><i /> {error ? "Feed unavailable" : "Bitget connected"}</span><small>{checkedAt ? `Checked ${new Date(checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Connecting to public market data…"}</small></div>
    </div>
    <div className="universe-stats" aria-label="Market coverage">
      <div><span>REALITY rTOKENS</span><b>{payload?.coverage.rTokens ?? "—"}</b><small>Bitget classified</small></div>
      <div><span>RWA SPOT PAIRS</span><b>{payload?.coverage.rwa ?? "—"}</b><small>Flagged by instrument metadata</small></div>
      <div><span>CRYPTO SPOT PAIRS</span><b>{payload?.coverage.crypto ?? "—"}</b><small>USDT quoted</small></div>
      <div><span>SESSION REFERENCE</span><b className="session-value">{sessionLabel}</b><small>{payload?.marketSessionStatus === "unavailable" ? "Estimated by Eastern Time · live status not returned" : "Bitget Reality market states"}</small></div>
    </div>
    <div className="universe-controls">
      <label className="universe-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(18); }} placeholder="Search ticker, token, or company" aria-label="Search market assets" /></label>
      <div className="universe-filters" role="group" aria-label="Filter asset class">{filterOptions.map((item) => <button type="button" key={item.value} className={filter === item.value ? "selected" : ""} aria-pressed={filter === item.value} onClick={() => { setFilter(item.value); setVisibleCount(18); }}>{item.label}</button>)}</div>
    </div>
    {error && !payload ? <div className="universe-message" role="alert"><b>Live feed is unavailable right now.</b><span>{error}</span><small>We won’t substitute sample or stale prices.</small></div> : null}
    {!payload && !error ? <div className="universe-loading" role="status">Connecting to Bitget spot instruments and tickers…</div> : null}
    {payload ? <>
      {error ? <div className="universe-stale" role="status">Last verified Bitget response is shown with its original timestamp. {error}</div> : null}
      <div className="universe-grid">{filteredAssets.slice(0, visibleCount).map((asset) => {
        const age = freshness(asset.providerTimestamp, payload.staleAfterMs);
        return <Link className="universe-card-link" href={`/markets/${encodeURIComponent(asset.symbol)}`} aria-label={`Open ${asset.name} market details`} key={asset.symbol}><article className="universe-card">
          <div className="universe-card-head"><IssuerLogo className={`universe-logo ${asset.kind}`} ticker={asset.underlyingTicker ?? asset.baseCoin} logoUrl={asset.logoUrl ?? issuerLogoUrl(asset)} /><div className="universe-identity"><b>{asset.name}</b><span>{asset.underlyingTicker ? `${asset.underlyingTicker} · ${asset.symbol}` : asset.symbol}</span></div><span className={`asset-class ${asset.kind}`}>{asset.kind === "rtoken" ? "rTOKEN" : asset.kind === "rwa" ? "RWA" : "SPOT"}</span></div>
          <div className="universe-price">${price(asset.lastPrice)} <span className={asset.change24h !== null && asset.change24h < 0 ? "negative" : "positive"}>{asset.change24h === null ? "—" : `${asset.change24h >= 0 ? "+" : ""}${(asset.change24h * 100).toFixed(2)}%`}</span></div>
          <div className="universe-range"><span><small>24H LOW</small><b>${price(asset.low24h)}</b></span><span className="range-line"><i style={{ left: `${asset.high24h && asset.low24h && asset.high24h > asset.low24h ? Math.max(0, Math.min(100, ((asset.lastPrice - asset.low24h) / (asset.high24h - asset.low24h)) * 100)) : 50}%` }} /></span><span><small>24H HIGH</small><b>${price(asset.high24h)}</b></span></div>
          <div className="universe-card-foot"><span className={age.fresh ? "quote-fresh" : "quote-stale"}><i /> {age.label}</span><span>VOL ${price(asset.turnover24h, 0)}</span></div>
          {asset.kind === "rtoken" ? <div className="universe-token-details"><span>{asset.weekendTradable ? "Weekend tradable" : "Equity-backed token"}</span><span>{asset.tradingSessions.length ? asset.tradingSessions.map((value) => value.replaceAll("_", " ")).join(" · ") : "Session details pending"}</span></div> : null}
        </article></Link>;
      })}</div>
      {!filteredAssets.length ? <div className="universe-message">No Bitget spot assets match that search. Try another symbol or asset class.</div> : null}
      {filteredAssets.length > visibleCount ? <button className="universe-more" type="button" onClick={() => setVisibleCount((count) => count + 18)}>Show more assets <span>{visibleCount} of {filteredAssets.length}</span></button> : null}
      <p className="universe-disclaimer"><span>i</span> Quotes are public Bitget spot snapshots, refreshed about every 15 seconds. Feed timestamps and asset classification are shown separately; this is not an order book or an instruction to trade.</p>
    </> : null}
  </section>;
}
