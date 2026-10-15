"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ApiExplorer from "./explorer";
import Webhooks from "./webhooks";
import { canManageOrganization } from "@/lib/tic/organization-rbac";

type Project = { id: string; organization_id: string; name: string; created_at: string };
type Organization = { id: string; name: string; slug: string; role: "owner" | "admin" | "developer" | "reader" };
type OrganizationMember = { user_id: string; email: string; role: Organization["role"]; created_at: string };
type OrganizationAudit = { id: number; action: string; previous_role: string | null; new_role: string | null; created_at: string };
type Key = { id: string; project_id: string; owner_id: string; name: string; environment: string; key_prefix: string; scopes: string[]; expires_at: string | null; revoked_at: string | null; last_used_at: string | null; created_at: string };
type Call = { id: string; project_id: string; key_id: string | null; endpoint: string; status_code: number | null; duration_ms: number | null; created_at: string };
type ResearchJob = { id: string; project_id: string; ticker: string; status: string; attempt_count: number; max_attempts: number; result: unknown; error_code: string | null; created_at: string; completed_at: string | null; cancel_requested_at: string | null };
type View = "overview" | "projects" | "keys" | "explorer" | "usage" | "research" | "organizations" | "webhooks";

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "The request failed.");
  return body;
}
async function mutate(url: string, method: "POST" | "PATCH" | "DELETE", body: object) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "The request failed.");
  return result;
}

export default function DeveloperConsole({ userId }: { userId: string }) {
  const [view, setView] = useState<View>("overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [keys, setKeys] = useState<Key[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [organizationAudit, setOrganizationAudit] = useState<OrganizationAudit[]>([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "developer" | "reader">("developer");
  const [organizationName, setOrganizationName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projectName, setProjectName] = useState("");
  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<string[]>(["market:read"]);
  const [projectId, setProjectId] = useState("");
  const [environment, setEnvironment] = useState<"test" | "production">("test");
  const [days, setDays] = useState(90);
  const [secret, setSecret] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const reload = useCallback(async () => {
    try {
      const [p, k, u, j, o] = await Promise.all([readJson<{ projects: Project[] }>("/api/developers/projects"), readJson<{ keys: Key[] }>("/api/developers/keys"), readJson<{ requests: Call[] }>("/api/developers/usage"), readJson<{ jobs: ResearchJob[] }>("/api/developers/jobs"), readJson<{ organizations: Organization[] }>("/api/developers/organizations")]);
      setProjects(p.projects); setKeys(k.keys); setCalls(u.requests); setJobs(j.jobs); setOrganizations(o.organizations); setError(""); setCurrentTime(Date.now());
      setOrganizationId(current => o.organizations.some(org => org.id === current) ? current : o.organizations[0]?.id ?? "");
      setProjectId(current => {
        const canUse = (project: Project) => o.organizations.some(org => org.id === project.organization_id && org.role !== "reader");
        return p.projects.some(project => project.id === current && canUse(project)) ? current : p.projects.find(canUse)?.id ?? "";
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load the console."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void reload(), 0); return () => window.clearTimeout(timer); }, [reload]);
  useEffect(() => {
    if (view !== "organizations" || !organizationId) return;
    let alive = true;
    void readJson<{ members: OrganizationMember[]; audit: OrganizationAudit[] }>(`/api/developers/organizations/${organizationId}/members`)
      .then(result => { if (alive) { setMembers(result.members); setOrganizationAudit(result.audit); } })
      .catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : "Could not load organization members."); });
    return () => { alive = false; };
  }, [view, organizationId]);
  function selectOrganization(id: string) {
    setMembers([]); setOrganizationAudit([]); setOrganizationId(id);
  }
  useEffect(() => {
    if (!window.matchMedia("(max-width: 620px)").matches) return;
    const selected = document.querySelector<HTMLButtonElement>(".tic-console-nav button.selected");
    if (!selected) return;
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    selected.scrollIntoView({ block: "nearest", inline: "center", behavior });
  }, [view]);
  async function createProject(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await mutate("/api/developers/projects", "POST", { name: projectName, organizationId }); setProjectName(""); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create project."); }
    finally { setBusy(false); }
  }
  async function createKey(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await mutate("/api/developers/keys", "POST", { projectId, name: keyName, environment, expiresInDays: days, scopes: keyScopes }); setSecret(result.secret); setKeyName(""); await reload(); }
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
  async function cancelJob(id: string) {
    if (!window.confirm("Cancel this research job? A running provider request may finish, but its result will be discarded.")) return;
    setBusy(true); setError("");
    try { await mutate("/api/developers/jobs", "DELETE", { id }); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not cancel the research job."); }
    finally { setBusy(false); }
  }
  async function createOrganization(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await mutate("/api/developers/organizations", "POST", { name: organizationName }); setOrganizationName(""); selectOrganization(result.organization.id); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create organization."); }
    finally { setBusy(false); }
  }
  async function addMember(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await mutate(`/api/developers/organizations/${organizationId}/members`, "POST", { email: memberEmail, role: memberRole }); setMemberEmail(""); const result = await readJson<{ members: OrganizationMember[]; audit: OrganizationAudit[] }>(`/api/developers/organizations/${organizationId}/members`); setMembers(result.members); setOrganizationAudit(result.audit); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add organization member."); }
    finally { setBusy(false); }
  }
  async function refreshMembers() {
    const result = await readJson<{ members: OrganizationMember[]; audit: OrganizationAudit[] }>(`/api/developers/organizations/${organizationId}/members`);
    setMembers(result.members); setOrganizationAudit(result.audit);
  }
  async function updateMember(memberUserId: string, role: OrganizationMember["role"]) {
    setBusy(true); setError("");
    try { await mutate(`/api/developers/organizations/${organizationId}/members`, "PATCH", { userId: memberUserId, role }); if (memberUserId === userId) await reload(); await refreshMembers(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update organization member."); }
    finally { setBusy(false); }
  }
  async function removeMember(memberUserId: string) {
    if (!window.confirm("Remove this member from the organization? Credentials they created for its projects will be revoked immediately.")) return;
    setBusy(true); setError("");
    try { await mutate(`/api/developers/organizations/${organizationId}/members`, "DELETE", { userId: memberUserId }); if (memberUserId === userId) { setMembers([]); setOrganizationAudit([]); await reload(); } else await refreshMembers(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove organization member."); }
    finally { setBusy(false); }
  }
  const activeKeys = keys.filter(key => !key.revoked_at && (!key.expires_at || Date.parse(key.expires_at) > currentTime));
  const writableProjects = projects.filter(project => organizations.some(org => org.id === project.organization_id && org.role !== "reader"));
  const writableProjectIds = new Set(writableProjects.map(project => project.id));
  const activeOrganization = organizations.find(org => org.id === organizationId);
  const canManageTeam = activeOrganization ? canManageOrganization(activeOrganization.role) : false;
  const isLastOwner = (member: OrganizationMember) => member.role === "owner" && members.filter(candidate => candidate.role === "owner").length === 1;
  return <main className="tic tic-console"><header className="tic-console-header"><Link href="/developers" className="tic-brand">Tidelight <span>Intelligence Cloud</span></Link><Link href="/developers/docs">Documentation →</Link></header><div className="tic-console-grid"><aside className="tic-console-nav"><p className="tic-eyebrow">WORKSPACE</p>{(["overview", "organizations", "projects", "keys", "explorer", "research", "webhooks", "usage"] as View[]).map(item => <button type="button" className={view === item ? "selected" : ""} key={item} onClick={() => { setSecret(""); setView(item); if (item === "usage" || item === "overview" || item === "research") void reload(); }}>{item === "keys" ? "API keys" : item === "explorer" ? "API explorer" : item === "usage" ? "Request usage" : item === "research" ? "Research jobs" : item === "organizations" ? "Organizations & team" : item === "webhooks" ? "Webhooks" : item[0].toUpperCase() + item.slice(1)}</button>)}<div className="tic-nav-foot">Scoped API access<br/><span>Research jobs use existing market and evidence sources.</span></div></aside><div className="tic-console-main">{error && <div className="tic-alert" role="alert">{error} <button onClick={() => void reload()}>Retry</button></div>}{loading ? <p role="status">Loading your developer workspace…</p> : <>{view === "overview" && <><p className="tic-eyebrow">DEVELOPER WORKSPACE</p><h1>Build on clear signals.</h1><p className="tic-lead">Manage credentials for Tidelight’s verified tokenized equity market source.</p><div className="tic-stat-grid"><div><span>PROJECTS</span><strong>{projects.length}</strong></div><div><span>ACTIVE KEYS</span><strong>{activeKeys.length}</strong></div><div><span>RECENT REQUESTS</span><strong>{calls.length}</strong><small>Latest 100 records</small></div></div><section className="tic-panel"><h2>Get started</h2><ol><li><button onClick={() => setView("projects")}>Create a project →</button></li><li><button onClick={() => setView("keys")}>Issue a scoped key →</button></li><li><Link href="/developers/docs">Make your first request →</Link></li><li><button onClick={() => setView("usage")}>Review request history →</button></li></ol></section></>}{view === "organizations" && <><p className="tic-eyebrow">WORKSPACE / ORGANIZATIONS</p><h1>Organizations &amp; team</h1><p className="tic-lead">Group developer projects under shared roles. Add existing Tidelight accounts; invitations by email are not enabled until delivery is configured.</p><form className="tic-inline-form" onSubmit={createOrganization}><label>Organization name<input value={organizationName} onChange={event => setOrganizationName(event.target.value)} minLength={2} maxLength={80} required placeholder="Research team" /></label><button className="tic-button tic-primary" disabled={busy}>Create organization</button></form><section className="tic-panel"><h2>Organization</h2><label>Select workspace<select value={organizationId} onChange={event => selectOrganization(event.target.value)}>{organizations.map(org => <option key={org.id} value={org.id}>{org.name} · {org.role}</option>)}</select></label>{organizations.find(org => org.id === organizationId) && <p><code>{organizations.find(org => org.id === organizationId)?.slug}</code> · {organizations.find(org => org.id === organizationId)?.role}</p>}</section><section className="tic-panel"><h2>Members</h2>{canManageTeam && <form className="tic-inline-form" onSubmit={addMember}><label>Registered account email<input type="email" value={memberEmail} onChange={event => setMemberEmail(event.target.value)} required maxLength={254} placeholder="colleague@example.com" /></label><label>Role<select value={memberRole} onChange={event => setMemberRole(event.target.value as "admin" | "developer" | "reader")}><option value="developer">Developer</option><option value="reader">Reader</option>{organizations.find(org => org.id === organizationId)?.role === "owner" && <option value="admin">Admin</option>}</select></label><button className="tic-button tic-primary" disabled={busy}>Add member</button></form>}{members.length ? <ul className="tic-list tic-member-list">{members.map(member => <li className="tic-member-row" key={member.user_id}><div className="tic-member-identity"><strong>{member.email}</strong></div><span>{member.role}</span>{canManageTeam && <><select aria-label={`Role for ${member.email}`} value={member.role} disabled={busy || isLastOwner(member) || (activeOrganization?.role === "admin" && ["owner","admin"].includes(member.role)) || (member.role === "owner" && activeOrganization?.role !== "owner")} onChange={event => void updateMember(member.user_id,event.target.value as OrganizationMember["role"])}><option value="owner">Owner</option><option value="admin">Admin</option><option value="developer">Developer</option><option value="reader">Reader</option></select><button disabled={busy || isLastOwner(member) || (activeOrganization?.role === "admin" && ["owner","admin"].includes(member.role))} title={isLastOwner(member) ? "An organization must keep one owner." : undefined} onClick={() => void removeMember(member.user_id)}>Remove</button></>}</li>)}</ul> : <p>No members found.</p>}</section>{organizationAudit.length > 0 && <section className="tic-panel"><h2>Recent member changes</h2><ul className="tic-list">{organizationAudit.map(event => <li key={event.id}><strong>{event.action.replaceAll("_"," ")}</strong><small>{event.previous_role ? `${event.previous_role} → ${event.new_role ?? "removed"}` : event.new_role}</small><time>{new Date(event.created_at).toLocaleString()}</time></li>)}</ul></section>}</>}{view === "projects" && <><p className="tic-eyebrow">ACCESS / PROJECTS</p><h1>Projects</h1><p className="tic-lead">Each project groups the credentials and request history for one application.</p><form className="tic-inline-form" onSubmit={createProject}><label>Project name<input value={projectName} onChange={event => setProjectName(event.target.value)} minLength={2} maxLength={80} required placeholder="My research application" /></label><label>Organization<select value={organizationId} onChange={event => selectOrganization(event.target.value)} required>{organizations.map(org => <option key={org.id} value={org.id}>{org.name} · {org.role}</option>)}</select></label><button className="tic-button tic-primary" disabled={busy || organizations.find(org => org.id === organizationId)?.role === "reader"}>Create project</button></form><div className="tic-panel"><h2>Workspace projects</h2>{projects.length ? <ul className="tic-list">{projects.map(project => <li key={project.id}><strong>{project.name}</strong><small>{organizations.find(org => org.id === project.organization_id)?.name ?? "Organization"}</small><small>{project.id}</small><time>{new Date(project.created_at).toLocaleDateString()}</time></li>)}</ul> : <p>No developer projects yet. Create one above to start.</p>}</div></>}{view === "keys" && <><p className="tic-eyebrow">ACCESS / CREDENTIALS</p><h1>API keys</h1><p className="tic-lead">Secrets appear only when created. Store them in your server’s secret manager.</p>{secret && <div className="tic-secret" role="status"><strong>Copy this key now. It will not be shown again.</strong><code>{secret}</code><button className="tic-button" onClick={() => void navigator.clipboard.writeText(secret)}>Copy secret</button><button className="tic-button" onClick={() => setSecret("")}>Done</button></div>}<form className="tic-key-form" onSubmit={createKey}><label>Project<select value={projectId} onChange={event => setProjectId(event.target.value)} required>{writableProjects.map(project => <option key={project.id} value={project.id}>{project.name} · {organizations.find(org => org.id === project.organization_id)?.name}</option>)}</select></label><label>Key name<input value={keyName} onChange={event => setKeyName(event.target.value)} minLength={2} maxLength={80} required placeholder="Server integration" /></label><label>Environment<select value={environment} onChange={event => setEnvironment(event.target.value as "test" | "production")}><option value="test">Test</option><option value="production">Production</option></select></label><label>Expires in days<input type="number" min="1" max="365" value={days} onChange={event => setDays(Number(event.target.value))} required /></label><fieldset className="tic-scope-picker"><legend>Permissions</legend><label><input type="checkbox" checked={keyScopes.includes("market:read")} onChange={() => setKeyScopes(current => current.includes("market:read") ? current.filter(scope => scope !== "market:read") : [...current, "market:read"])} /> <code>market:read</code><small>Read supported market instruments.</small></label><label><input type="checkbox" checked={keyScopes.includes("research:run")} onChange={() => setKeyScopes(current => current.includes("research:run") ? current.filter(scope => scope !== "research:run") : [...current, "research:run"])} /> <code>research:run</code><small>Start and inspect company research snapshots.</small></label><label><input type="checkbox" checked={keyScopes.includes("alerts:manage")} onChange={() => setKeyScopes(current => current.includes("alerts:manage") ? current.filter(scope => scope !== "alerts:manage") : [...current, "alerts:manage"])} /> <code>alerts:manage</code><small>Manage project webhook subscriptions.</small></label></fieldset><p>Limits: 30 API requests per minute · 10,000 per month. Research jobs: 10 per project per hour.</p><button className="tic-button tic-primary" disabled={busy || !writableProjects.length || !keyScopes.length}>Create key</button>{!writableProjects.length && <p>A developer, admin, or owner role is required to issue credentials.</p>}</form><div className="tic-panel"><h2>Issued credentials</h2>{keys.length ? <div className="tic-table-wrap"><table><thead><tr><th>Name</th><th>Prefix</th><th>Environment</th><th>Last used</th><th>Status</th><th></th></tr></thead><tbody>{keys.map(key => <tr key={key.id}><td>{key.name}</td><td><code>{key.key_prefix}…</code></td><td>{key.environment}</td><td>{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "Never"}</td><td>{key.revoked_at ? "Revoked" : key.expires_at && Date.parse(key.expires_at) <= currentTime ? "Expired" : "Active"}</td><td>{!key.revoked_at && organizations.some(org => org.id === projects.find(project => project.id === key.project_id)?.organization_id && (org.role !== "reader" || key.owner_id === userId)) && <button disabled={busy} onClick={() => void revokeKey(key.id)}>Revoke</button>}</td></tr>)}</tbody></table></div> : <p>No credentials issued yet.</p>}</div></>}{view === "explorer" && <ApiExplorer projects={writableProjects} keys={keys.filter(key => writableProjectIds.has(key.project_id))} currentTime={currentTime} />}{view === "research" && <><p className="tic-eyebrow">RESEARCH / JOBS</p><h1>Research jobs</h1><p className="tic-lead">Track asynchronous company snapshots created with a research scoped API key.</p><div className="tic-panel"><div className="tic-job-toolbar"><h2>Recent jobs</h2><button className="tic-button" onClick={() => void reload()}>Refresh</button></div>{jobs.length ? <div className="tic-table-wrap"><table><thead><tr><th>Ticker</th><th>Status</th><th>Attempts</th><th>Created</th><th>Finished</th><th>Result</th><th></th></tr></thead><tbody>{jobs.map(job => <tr key={job.id}><td><strong>{job.ticker}</strong></td><td><span className={`tic-job-status is-${job.status}`}>{job.cancel_requested_at && job.status === "running" ? "cancelling" : job.status.replace("_", " ")}</span>{job.error_code && <small>{job.error_code}</small>}</td><td>{job.attempt_count}/{job.max_attempts}</td><td>{new Date(job.created_at).toLocaleString()}</td><td>{job.completed_at ? new Date(job.completed_at).toLocaleString() : "—"}</td><td>{job.status === "complete" && job.result !== null && typeof job.result === "object" && <details><summary>Snapshot JSON</summary><pre>{JSON.stringify(job.result, null, 2)}</pre></details>}</td><td>{["queued", "retry_wait", "running"].includes(job.status) && organizations.some(org => org.id === projects.find(project => project.id === job.project_id)?.organization_id && org.role !== "reader") && <button disabled={busy || !!job.cancel_requested_at} onClick={() => void cancelJob(job.id)}>Cancel</button>}</td></tr>)}</tbody></table></div> : <p>No research jobs yet. Create one with a <code>research:run</code> key using the API or SDK.</p>}</div></>}{view === "webhooks" && <Webhooks projects={writableProjects} />}{view === "usage" && <><p className="tic-eyebrow">OBSERVABILITY / REQUESTS</p><h1>Request usage</h1><p className="tic-lead">Real authorized calls, ordered newest first. The latest 100 records are shown.</p><div className="tic-panel">{calls.length ? <div className="tic-table-wrap"><table><thead><tr><th>Time</th><th>Endpoint</th><th>Project</th><th>Status</th><th>Duration</th></tr></thead><tbody>{calls.map(call => <tr key={call.id}><td>{new Date(call.created_at).toLocaleString()}</td><td><code>{call.endpoint}</code></td><td>{projects.find(project => project.id === call.project_id)?.name ?? call.project_id}</td><td>{call.status_code ?? "Pending"}</td><td>{call.duration_ms == null ? "—" : `${call.duration_ms} ms`}</td></tr>)}</tbody></table></div> : <p>No authorized API requests recorded yet.</p>}</div></>}</>}</div></div></main>;
}
