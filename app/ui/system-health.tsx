"use client";

import { useCallback, useEffect, useState } from "react";

type Health = { runId: string; checkedAt: string; requestMs: number; deployment: string; providers: { bitget: { state: string; ageMs?: number; staleAfterMs?: number; assets?: number; reality?: number; sessionMetadata?: string; assetMetadata?: string }; qwen: { state: string }; supabase: { state: string }; nightwatchScheduler: { state: string } } };

function label(state: string) {
  return state === "available" ? "Available" : state === "stale" ? "Stale" : state === "unavailable" ? "Unavailable" : state === "configured" || state === "ready" ? "Configured · not live-probed" : "Setup required";
}

export default function SystemHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/system/health", { cache: "no-store" });
      const value = await response.json() as Health;
      setHealth(value); setError("");
    } catch { setError("The status endpoint could not be reached. Retry when the connection is available."); }
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => void refresh(), 0); const timer = window.setInterval(() => void refresh(), 30_000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [refresh]);
  const providers = health?.providers;
  return <section className="system-health-board" aria-live="polite">
    <div className="system-health-top"><div><span className="eyebrow small-eyebrow">LIVE SERVICE SNAPSHOT</span><h2>Know what the desk can see.</h2><p>Provider configuration and public market freshness, checked from this deployment.</p></div><button type="button" onClick={() => void refresh()}>Refresh status ↻</button></div>
    {error ? <p className="system-health-error" role="alert">{error}</p> : null}
    <div className="system-provider-grid">
      <article><span className={`system-state ${providers?.bitget.state ?? "pending"}`}><i/>{label(providers?.bitget.state ?? "checking")}</span><b>Bitget public markets</b><small>{providers?.bitget.assets != null ? `${providers.bitget.assets.toLocaleString()} spot assets · ${providers.bitget.reality?.toLocaleString()} Reality instruments` : "Checking market feed…"}</small><small>{providers?.bitget.ageMs != null ? `Snapshot age ${Math.floor(providers.bitget.ageMs / 1000)}s · stale after ${Math.floor((providers.bitget.staleAfterMs ?? 0) / 1000)}s` : "No current feed snapshot"}</small><small>Session metadata: {providers?.bitget.sessionMetadata ?? "checking"} · issuer metadata: {providers?.bitget.assetMetadata ?? "checking"}</small></article>
      <article><span className={`system-state ${providers?.qwen.state ?? "pending"}`}><i/>{label(providers?.qwen.state ?? "checking")}</span><b>Qwen research synthesis</b><small>Key presence only; a configured key does not prove upstream availability.</small></article>
      <article><span className={`system-state ${providers?.supabase.state ?? "pending"}`}><i/>{label(providers?.supabase.state ?? "checking")}</span><b>Supabase identity & storage</b><small>Connection settings are present. Signed-in private workflows provide the authenticated health check.</small></article>
      <article><span className={`system-state ${providers?.nightwatchScheduler.state ?? "pending"}`}><i/>{label(providers?.nightwatchScheduler.state ?? "checking")}</span><b>Nightwatch scheduled runner</b><small>Configuration only; scheduled for 09:00 UTC daily (Hobby may start it during 09:00–09:59). This check does not prove a cron run succeeded. Each run rechecks opt-in and pause in Postgres.</small></article>
    </div>
    <div className="system-health-foot"><span>Deploy {health?.deployment ?? "pending"} · request {health?.requestMs ?? "—"} ms · request ID <code>{health?.runId ?? "pending"}</code></span><span>Checked {health?.checkedAt ? new Date(health.checkedAt).toLocaleTimeString() : "waiting"} · refreshes every 30 seconds</span></div>
  </section>;
}
