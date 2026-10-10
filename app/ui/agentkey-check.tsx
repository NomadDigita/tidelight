"use client";

import { useState } from "react";

export default function AgentKeyCheck() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  async function check() {
    setBusy(true);
    setResult("");
    try {
      const response = await fetch("/api/system/agentkey-check", { method: "POST" });
      const body = await response.json();
      setResult(response.ok ? `AgentKey ${body.state} · ${body.operation} · ${(body.requestMs / 1000).toFixed(1)}s${body.failure ? ` · ${body.failure}` : ""}` : body.error ?? body.state ?? "Connection check failed.");
    } catch { setResult("Connection check failed."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" className="secondary-link" disabled={busy} onClick={check}>{busy ? "Checking AgentKey…" : "Check AgentKey connection"}</button><div aria-live="polite">{result ? <p className="settings-footnote">{result}</p> : null}</div></div>;
}
