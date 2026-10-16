"use client";

import { useMemo, useState } from "react";

type Project = { id: string; name: string };
type Key = { id: string; project_id: string; name: string; environment: string; revoked_at: string | null; expires_at: string | null };
type Language = "curl" | "typescript" | "python";

const languages: Language[] = ["curl", "typescript", "python"];

export default function ApiExplorer({ projects, keys, currentTime }: { projects: Project[]; keys: Key[]; currentTime: number }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [keyId, setKeyId] = useState("");
  const [limit, setLimit] = useState(20);
  const [cursor, setCursor] = useState("");
  const [underlyingTicker, setUnderlyingTicker] = useState("");
  const [language, setLanguage] = useState<Language>("curl");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [requestId, setRequestId] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const availableKeys = keys.filter(key => key.project_id === projectId && !key.revoked_at && (!key.expires_at || Date.parse(key.expires_at) > currentTime));
  const selectedKeyId = availableKeys.some(key => key.id === keyId) ? keyId : availableKeys[0]?.id ?? "";
  const snippet = useMemo(() => {
    const safeCursor = /^[A-Z0-9]{2,32}$/.test(cursor) ? cursor : "";
    const safeTicker = /^[A-Z][A-Z0-9.]{0,9}$/i.test(underlyingTicker) ? underlyingTicker.toUpperCase() : "";
    const query = `kind=rtoken&limit=${limit}${safeTicker ? `&underlying_ticker=${encodeURIComponent(safeTicker)}` : ""}${safeCursor ? `&cursor=${encodeURIComponent(safeCursor)}` : ""}`;
    if (language === "typescript") return `import { TidelightClient } from "@tidelight/sdk";\n\nconst client = new TidelightClient({ apiKey: process.env.TIDELIGHT_API_KEY! });\nconst page = await client.listTokenizedEquities({ limit: ${limit}${safeTicker ? `, underlyingTicker: "${safeTicker}"` : ""}${safeCursor ? `, cursor: "${safeCursor}"` : ""} });\nconsole.log(page.data);`;
    if (language === "python") return `import os\nfrom tidelight import Client\n\nclient = Client(os.environ["TIDELIGHT_API_KEY"])\npage = client.list_tokenized_equities(limit=${limit}${safeTicker ? `, underlying_ticker="${safeTicker}"` : ""}${safeCursor ? `, cursor="${safeCursor}"` : ""})\nprint(page.data)`;
    return `curl 'https://api.tidelight.app/v1/market/instruments?${query}' \\\n  -H 'Authorization: Bearer YOUR_TIDELIGHT_KEY'`;
  }, [cursor, language, limit, underlyingTicker]);

  async function execute(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    setStatus(null);
    setRequestId("");
    setDuration(null);
    const began = performance.now();
    try {
      const response = await fetch("/api/developers/explore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyId: selectedKeyId, kind: "rtoken", limit, cursor: cursor || null, underlyingTicker: underlyingTicker || null }) });
      const body = await response.json();
      setStatus(response.status);
      setResult(body);
      setRequestId(body.request_id ?? body.error?.request_id ?? response.headers.get("x-request-id") ?? "");
      setDuration(typeof body.duration_ms === "number" ? body.duration_ms : Math.round(performance.now() - began));
    } catch {
      setStatus(null);
      setResult({ error: { code: "network_error", message: "The API explorer could not reach Tidelight. Check your connection and try again." } });
      setDuration(Math.round(performance.now() - began));
    } finally {
      setBusy(false);
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 2200);
  }

  return <>
    <p className="tic-eyebrow">DEVELOPER TOOLS / API EXPLORER</p>
    <h1>Explore the API</h1>
    <p className="tic-lead">Make an authorized request using an active project key. The secret stays hidden; this console checks your account and applies the same key quota.</p>
    <form className="tic-explorer-form" onSubmit={execute}>
      <div className="tic-explorer-route"><span>REQUEST</span><code><b>GET</b> /v1/market/instruments</code><small>Tokenized equity instruments</small></div>
      <label>Project<select value={projectId} onChange={event => { setProjectId(event.target.value); setKeyId(""); }}>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label>Credential<select value={selectedKeyId} onChange={event => setKeyId(event.target.value)} required>{availableKeys.length ? availableKeys.map(key => <option key={key.id} value={key.id}>{key.name} · {key.environment}</option>) : <option value="">No active key</option>}</select></label>
      <label>Limit<input type="number" min="1" max="100" value={limit} onChange={event => setLimit(Number(event.target.value))} required /></label>
      <label>Underlying ticker <span>(optional)</span><input value={underlyingTicker} onChange={event => setUnderlyingTicker(event.target.value.toUpperCase())} pattern="[A-Z][A-Z0-9.]{0,9}" placeholder="e.g. AAPL" /></label>
      <label>Cursor <span>(optional)</span><input value={cursor} onChange={event => setCursor(event.target.value.toUpperCase())} pattern="[A-Z0-9]{2,32}" placeholder="Next cursor from a response" /></label>
      <button type="submit" className="tic-button tic-primary" disabled={busy || !selectedKeyId} aria-busy={busy}>{busy ? <><span className="tic-explorer-spinner" aria-hidden="true" />Executing request…</> : "Execute request"}</button>
    </form>
    {!projects.length && <p className="tic-explorer-hint">Create a project and an API key to start.</p>}
    {projects.length > 0 && !availableKeys.length && <p className="tic-explorer-hint">Issue an active market read key for this project to start.</p>}

    <section className="tic-panel tic-explorer-output" aria-labelledby="tic-response-title">
      <div className="tic-panel-head"><div><p className="tic-explorer-kicker">LIVE REQUEST OUTPUT</p><h2 id="tic-response-title">Response</h2></div>{status !== null && <span className={status < 400 ? "tic-response-ok" : "tic-response-error"}>HTTP {status}</span>}</div>
      {busy ? <div className="tic-response-state" role="status"><span className="tic-explorer-spinner" aria-hidden="true" /><div><strong>Request in progress</strong><p>Waiting for the authorized API response…</p></div></div> : result ? <>
        <div className="tic-response-meta"><span>Request ID <code>{requestId || "Unavailable"}</code></span><span>Response time <code>{duration ?? "—"} ms</code></span><span>Usage <code>{typeof result === "object" && result !== null && "usage" in result && result.usage && typeof result.usage === "object" && "requests" in result.usage && result.usage.requests === 1 ? "1 request" : "Unavailable"}</code></span></div>
        <pre tabIndex={0} aria-label="JSON response"><code>{JSON.stringify(result, null, 2)}</code></pre>
      </> : <div className="tic-response-empty"><span aria-hidden="true" /><div><strong>Your response will appear here</strong><p>Run the request to inspect live data, request metadata, and any API errors.</p></div></div>}
    </section>

    <section className="tic-panel tic-code-example" aria-labelledby="tic-code-title">
      <div className="tic-panel-head"><div><p className="tic-explorer-kicker">READY-TO-USE EXAMPLE</p><h2 id="tic-code-title">Use it in your application</h2></div><button type="button" onClick={() => void copySnippet()} aria-live="polite">{copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy code"}</button></div>
      <div className="tic-code-tabs" aria-label="Choose code language">{languages.map(item => <button key={item} type="button" aria-pressed={language === item} onClick={() => { setLanguage(item); setCopyState("idle"); }}>{item === "typescript" ? "TypeScript" : item === "python" ? "Python" : "curl"}</button>)}</div>
      <pre tabIndex={0} aria-label={`${language} example code`}><code>{snippet}</code></pre>
      <p>Use a server environment variable for your key. Never put a secret in browser code.</p>
    </section>
  </>;
}
