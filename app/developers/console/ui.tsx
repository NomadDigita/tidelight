"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ApiExplorer from "./explorer";

type Project = { id: string; name: string; created_at: string };
type Key = { id: string; project_id: string; name: string; environment: string; key_prefix: string; scopes: string[]; expires_at: string | null; revoked_at: string | null; last_used_at: string | null; created_at: string };
type Call = { id: string; project_id: string; key_id: string | null; endpoint: string; status_code: number | null; duration_ms: number | null; created_at: string };
type View = "overview" | "projects" | "keys" | "explorer" | "usage";

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "The request failed.");
  return body;
}
async function mutate(url: string, method: "POST" | "DELETE", body: object) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "The request failed.");
  return result;
}

export default function DeveloperConsole() {
  const [view, setView] = useState<View>("overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [keys, setKeys] = useState<Key[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projectName, setProjectName] = useState("");
  const [keyName, setKeyName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [environment, setEnvironment] = useState<"test" | "production">("test");
  const [days, setDays] = useState(90);
  const [secret, setSecret] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const reload = useCallback(async () => {
    try {
      const [p, k, u] = await Promise.all([readJson<{ projects: Project[] }>("/api/developers/projects"), readJson<{ keys: Key[] }>("/api/developers/keys"), readJson<{ requests: Call[] }>("/api/developers/usage")]);
      setProjects(p.projects); setKeys(k.keys); setCalls(u.requests); setError(""); setCurrentTime(Date.now());
      setProjectId(current => current || p.projects[0]?.id || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load the console."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void reload(), 0); return () => window.clearTimeout(timer); }, [reload]);
  async function createProject(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await mutate("/api/developers/projects", "POST", { name: projectName }); setProjectName(""); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create project."); }
    finally { setBusy(false); }
  }
  async function createKey(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await mutate("/api/developers/keys", "POST", { projectId, name: keyName, environment, expiresInDays: days }); setSecret(result.secret); setKeyName(""); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create key."); }
    finally { setBusy(false); }
  }
  async function revokeKey(id: string) {
    if (!window.confirm("Revoke this credential? Requests using it will stop immediately.")) return;
    setBusy(true); setError("");
    try { await mutate("/api/developers/keys", "DELETE", { id }); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not revoke key."); }
    finally { setBusy(false); }
  }
  const activeKeys = keys.filter(key => !key.revoked_at && (!key.expires_at || Date.parse(key.expires_at) > currentTime));
  return <main className="tic tic-console"><header className="tic-console-header"><Link href="/developers" className="tic-brand">Tidelight <span>Intelligence Cloud</span></Link><Link href="/developers/docs">Documentation →</Link></header><div className="tic-console-grid"><aside className="tic-console-nav"><p className="tic-eyebrow">WORKSPACE</p>{(["overview", "projects", "keys", "explorer", "usage"] as View[]).map(item => <button type="button" className={view === item ? "selected" : ""} key={item} onClick={() => { setSecret(""); setView(item); }}>{item === "keys" ? "API keys" : item === "explorer" ? "API explorer" : item === "usage" ? "Request usage" : item[0].toUpperCase() + item.slice(1)}</button>)}<div className="tic-nav-foot">Read only market access<br/><span>More capabilities are in development.</span></div></aside><div className="tic-console-main">{error && <div className="tic-alert" role="alert">{error} <button onClick={() => void reload()}>Retry</button></div>}{loading ? <p role="status">Loading your developer workspace…</p> : <>{view === "overview" && <><p className="tic-eyebrow">DEVELOPER WORKSPACE</p><h1>Build on clear signals.</h1><p className="tic-lead">Manage credentials for Tidelight’s verified tokenized equity market source.</p><div className="tic-stat-grid"><div><span>PROJECTS</span><strong>{projects.length}</strong></div><div><span>ACTIVE KEYS</span><strong>{activeKeys.length}</strong></div><div><span>RECENT REQUESTS</span><strong>{calls.length}</strong><small>Latest 100 records</small></div></div><section className="tic-panel"><h2>Get started</h2><ol><li><button onClick={() => setView("projects")}>Create a project →</button></li><li><button onClick={() => setView("keys")}>Issue a scoped key →</button></li><li><Link href="/developers/docs">Make your first request →</Link></li><li><button onClick={() => setView("usage")}>Review request history →</button></li></ol></section></>}{view === "projects" && <><p className="tic-eyebrow">ACCESS / PROJECTS</p><h1>Projects</h1><p className="tic-lead">Each project groups the credentials and request history for one application.</p><form className="tic-inline-form" onSubmit={createProject}><label>Project name<input value={projectName} onChange={event => setProjectName(event.target.value)} minLength={2} maxLength={80} required placeholder="My research application" /></label><button className="tic-button tic-primary" disabled={busy}>Create project</button></form><div className="tic-panel"><h2>Your projects</h2>{projects.length ? <ul className="tic-list">{projects.map(project => <li key={project.id}><strong>{project.name}</strong><small>{project.id}</small><time>{new Date(project.created_at).toLocaleDateString()}</time></li>)}</ul> : <p>No developer projects yet. Create one above to start.</p>}</div></>}{view === "keys" && <><p className="tic-eyebrow">ACCESS / CREDENTIALS</p><h1>API keys</h1><p className="tic-lead">Secrets appear only when created. Store them in your server’s secret manager.</p>{secret && <div className="tic-secret" role="status"><strong>Copy this key now. It will not be shown again.</strong><code>{secret}</code><button className="tic-button" onClick={() => void navigator.clipboard.writeText(secret)}>Copy secret</button><button className="tic-button" onClick={() => setSecret("")}>Done</button></div>}<form className="tic-key-form" onSubmit={createKey}><label>Project<select value={projectId} onChange={event => setProjectId(event.target.value)} required>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Key name<input value={keyName} onChange={event => setKeyName(event.target.value)} minLength={2} maxLength={80} required placeholder="Server integration" /></label><label>Environment<select value={environment} onChange={event => setEnvironment(event.target.value as "test" | "production")}><option value="test">Test</option><option value="production">Production</option></select></label><label>Expires in days<input type="number" min="1" max="365" value={days} onChange={event => setDays(Number(event.target.value))} required /></label><p>Scope: <code>market:read</code> · 30 requests/minute · 10,000 requests/month</p><button className="tic-button tic-primary" disabled={busy || !projects.length}>Create key</button>{!projects.length && <p>Create a project first.</p>}</form><div className="tic-panel"><h2>Issued credentials</h2>{keys.length ? <div className="tic-table-wrap"><table><thead><tr><th>Name</th><th>Prefix</th><th>Environment</th><th>Last used</th><th>Status</th><th></th></tr></thead><tbody>{keys.map(key => <tr key={key.id}><td>{key.name}</td><td><code>{key.key_prefix}…</code></td><td>{key.environment}</td><td>{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "Never"}</td><td>{key.revoked_at ? "Revoked" : key.expires_at && Date.parse(key.expires_at) <= currentTime ? "Expired" : "Active"}</td><td>{!key.revoked_at && <button disabled={busy} onClick={() => void revokeKey(key.id)}>Revoke</button>}</td></tr>)}</tbody></table></div> : <p>No credentials issued yet.</p>}</div></>}{view === "explorer" && <ApiExplorer projects={projects} keys={keys} currentTime={currentTime} />}{view === "usage" && <><p className="tic-eyebrow">OBSERVABILITY / REQUESTS</p><h1>Request usage</h1><p className="tic-lead">Real authorized calls, ordered newest first. The latest 100 records are shown.</p><div className="tic-panel">{calls.length ? <div className="tic-table-wrap"><table><thead><tr><th>Time</th><th>Endpoint</th><th>Project</th><th>Status</th><th>Duration</th></tr></thead><tbody>{calls.map(call => <tr key={call.id}><td>{new Date(call.created_at).toLocaleString()}</td><td><code>{call.endpoint}</code></td><td>{projects.find(project => project.id === call.project_id)?.name ?? call.project_id}</td><td>{call.status_code ?? "Pending"}</td><td>{call.duration_ms == null ? "—" : `${call.duration_ms} ms`}</td></tr>)}</tbody></table></div> : <p>No authorized API requests recorded yet.</p>}</div></>}</>}</div></div></main>;
}
