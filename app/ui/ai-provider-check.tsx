"use client";
import { useState } from "react";
type Check = { provider: string; model: string; state: string; failure: string; requestMs: number };
export default function AiProviderCheck() {
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);
  const [error, setError] = useState("");
  async function check() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/system/ai-check", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Provider check failed.");
      setChecks(body.providers);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Provider check failed."); }
    finally { setBusy(false); }
  }
  return <div><button className="secondary-link" disabled={busy} onClick={check}>{busy ? "Checking providers…" : "Check AI availability"}</button><div aria-live="polite">{error ? <p className="action-error">{error}</p> : null}{checks.map(item => <div className="connection-row" key={item.provider}><span>{item.provider === "qwen" ? "Bitget Qwen" : "Gemini"} · {item.model}</span><span>{item.state} · {(item.requestMs / 1000).toFixed(1)}s{item.failure ? <small> {item.failure}</small> : null}</span></div>)}</div></div>;
}
