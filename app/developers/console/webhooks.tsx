"use client";
import { useEffect, useState } from "react";
import { ConsoleState } from "./state";

type Project = { id: string; name: string };
type Endpoint = { id: string; project_id: string; name: string; url: string; events: string[]; enabled: boolean; created_at: string };
type Delivery = { id: string; endpoint_name: string; event_id: string; event_type: string; payload: unknown; status: string; attempt_count: number; last_status_code: number | null; last_error_code: string | null; last_duration_ms: number | null; created_at: string; completed_at: string | null; tic_webhook_delivery_attempts: { attempt_number: number; status_code: number | null; error_code: string | null; created_at: string }[] };
const eventOptions = ["research.job.completed", "research.job.failed"];

export default function Webhooks({ projects }: { projects: Project[] }) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([eventOptions[0]]);
  const [oneTimeSecret, setOneTimeSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true);
    try {
      const [a, d] = await Promise.all([fetch("/api/developers/webhooks", { cache: "no-store" }), fetch("/api/developers/webhooks/deliveries", { cache: "no-store" })]);
      const [ab, db] = await Promise.all([a.json(), d.json()]);
      if (!a.ok || !d.ok) throw new Error(ab.error ?? db.error ?? "Could not load webhooks.");
      setEndpoints(ab.endpoints); setDeliveries(db.deliveries); setError(""); setLoadFailed(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load webhooks."); setLoadFailed(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);
  async function mutate(urlPath: string, method: "POST" | "PATCH" | "DELETE", body: object) {
    const response = await fetch(urlPath, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Webhook request failed.");
    return result;
  }
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await mutate("/api/developers/webhooks", "POST", { projectId, name, url, events }); setOneTimeSecret(result.signing_secret); setName(""); setUrl(""); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create webhook."); }
    finally { setBusy(false); }
  }
  async function update(id: string, patch: object) {
    setBusy(true); setError("");
    try { const result = await mutate(`/api/developers/webhooks/${id}`, "PATCH", patch); if (result.signing_secret) setOneTimeSecret(result.signing_secret); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update webhook."); }
    finally { setBusy(false); }
  }
  async function copySecret() {
    try { await navigator.clipboard.writeText(oneTimeSecret); }
    catch { setError("Clipboard access failed. Select and copy the signing secret manually."); }
  }
  return <><p className="tic-eyebrow">DELIVERY / WEBHOOKS</p><h1>Webhook endpoints</h1><p className="tic-lead">Receive signed events when an asynchronous research job completes or fails. Destinations must use public HTTPS on port 443.</p>{error && !loadFailed && <div className="tic-alert" role="alert"><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}{oneTimeSecret && <section className="tic-panel" aria-live="polite"><h2>Copy your signing secret now</h2><p>It is shown once. Store it securely and use it to verify the <code>Tidelight-Signature</code> header.</p><div className="tic-secret"><code>{oneTimeSecret}</code><button onClick={() => void copySecret()}>Copy</button><button onClick={() => setOneTimeSecret("")}>Dismiss</button></div></section>}{projects.length ? <form className="tic-panel tic-form" onSubmit={create}><h2>Add endpoint</h2><label>Project<select required value={projectId} onChange={e => setProjectId(e.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Endpoint name<input required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Research alerts" /></label><label>HTTPS destination<input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/tidelight" /></label><fieldset><legend>Events</legend>{eventOptions.map(option => <label key={option}><input type="checkbox" checked={events.includes(option)} onChange={e => setEvents(current => e.target.checked ? [...current, option] : current.filter(item => item !== option))} /> {option}</label>)}</fieldset><button className="tic-button tic-primary" disabled={busy || !projectId || !events.length}>Create endpoint</button></form> : <section className="tic-panel"><h2>Project access required</h2><p>Create a project and join it with a developer, admin, or owner role to manage webhook endpoints.</p></section>}{loading ? <ConsoleState kind="loading" title="Loading webhook activity" description="Retrieving configured destinations and recent delivery records." /> : loadFailed ? <ConsoleState kind="error" eyebrow="DELIVERY / WEBHOOKS" title="Webhook activity couldn’t load" description={error} action={{ label: "Try again", onClick: () => void load() }} /> : endpoints.length ? <section className="tic-panel"><div className="tic-job-toolbar"><h2>Configured endpoints</h2><button className="tic-button" onClick={() => void load()}>Refresh</button></div><div className="tic-table-wrap"><table><thead><tr><th>Name / project</th><th>Destination</th><th>Events</th><th>Status</th><th>Actions</th></tr></thead><tbody>{endpoints.map(endpoint => <tr key={endpoint.id}><td>{endpoint.name}<small>{projects.find(project => project.id === endpoint.project_id)?.name ?? "Project"}</small></td><td><code>{endpoint.url}</code></td><td>{endpoint.events.map(item => <small key={item}>{item}</small>)}</td><td>{endpoint.enabled ? "Active" : "Disabled"}</td><td><button disabled={busy} onClick={() => void update(endpoint.id, { enabled: !endpoint.enabled })}>{endpoint.enabled ? "Disable" : "Enable"}</button> <button disabled={busy} onClick={() => void update(endpoint.id, { rotate_secret: true })}>Rotate secret</button></td></tr>)}</tbody></table></div></section> : <ConsoleState eyebrow="DELIVERY / WEBHOOKS" title="No endpoints configured" description="Add a verified HTTPS destination to receive supported research job events." action={{ label: "Add an endpoint", onClick: () => document.querySelector<HTMLInputElement>(".tic-form input")?.focus() }} />}{!loading && <section className="tic-panel"><div className="tic-job-toolbar"><h2>Recent deliveries</h2><button className="tic-button" onClick={() => void load()}>Refresh</button></div>{deliveries.length ? <div className="tic-table-wrap"><table><thead><tr><th>Time</th><th>Endpoint</th><th>Event</th><th>Status</th><th>Attempts</th><th>Last response</th><th>Payload</th></tr></thead><tbody>{deliveries.map(item => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString()}</td><td>{item.endpoint_name}</td><td><code>{item.event_type}</code></td><td>{item.status}</td><td>{item.attempt_count}/8</td><td>{item.last_status_code ?? item.last_error_code ?? "—"}{item.last_duration_ms !== null ? ` · ${item.last_duration_ms} ms` : ""}</td><td><details><summary>View</summary><pre>{JSON.stringify(item.payload, null, 2)}</pre>{item.tic_webhook_delivery_attempts.map(attempt => <small key={attempt.attempt_number}>Attempt {attempt.attempt_number}: {attempt.status_code ?? attempt.error_code ?? "failed"} · {new Date(attempt.created_at).toLocaleString()}</small>)}</details></td></tr>)}</tbody></table></div> : <ConsoleState eyebrow="DELIVERY / HISTORY" title="No delivery attempts yet" description="Delivery records appear when a completed or failed research job matches one of your configured endpoints." />}</section>}</>;
}
