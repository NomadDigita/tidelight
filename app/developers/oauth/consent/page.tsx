import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAccessibleProjects } from "@/lib/tic/organizations";
import "../../tidelight-developers.css";

export const dynamic = "force-dynamic";

function isKeyUnexpired(expiresAt: string | null) {
  return !expiresAt || Date.parse(expiresAt) > Date.now();
}

export default async function OAuthConsentPage({ searchParams }: { searchParams: Promise<{ flow?: string }> }) {
  const { flow: flowId } = await searchParams;
  if (!flowId || !/^[0-9a-f-]{36}$/i.test(flowId)) return <main className="tic tic-docs"><h1>Authorization request expired</h1><p>Return to your MCP client and start the connection again.</p></main>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/developers/oauth/consent?flow=${flowId}`)}`);
  const admin = createAdminClient();
  const { data: flow } = await admin.from("tic_oauth_flows").select("id,client_id,scopes,expires_at").eq("id", flowId).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!flow) return <main className="tic tic-docs"><h1>Authorization request expired</h1><p>Return to your MCP client and start the connection again.</p></main>;
  const [{ data: client }, projects] = await Promise.all([
    admin.from("tic_oauth_clients").select("client_name").eq("client_id", flow.client_id).maybeSingle(),
    listAccessibleProjects(admin, user.id),
  ]);
  const projectIds = projects.map(project => project.id);
  const { data: keys } = projectIds.length ? await admin.from("developer_api_keys").select("id,project_id,name,scopes,expires_at,revoked_at").in("project_id", projectIds).is("revoked_at", null).order("created_at", { ascending: false }) : { data: [] };
  const availableKeys = (keys ?? []).filter(key => isKeyUnexpired(key.expires_at) && flow.scopes.every((scope: string) => key.scopes.includes(scope)));
  return <main className="tic tic-docs"><nav className="tic-top"><Link href="https://tidelight.app/developers" className="tic-brand">Tidelight <span>Secure MCP connection</span></Link></nav><section className="tic-panel tic-oauth-consent"><p className="tic-eyebrow">TIDELIGHT / AUTHORIZATION</p><h1>Connect {client?.client_name ?? "this MCP client"}</h1><p>This client is requesting access to your Tidelight developer project.</p><ul>{flow.scopes.map((scope: string) => <li key={scope}><code>{scope}</code>{scope === "market:read" ? " — read supported tokenized equity market data" : " — start and manage company research jobs"}</li>)}</ul>{availableKeys.length ? <form action="/api/oauth/consent" method="post"><input type="hidden" name="flow_id" value={flow.id} /><label htmlFor="key_id">Developer project credential</label><select id="key_id" name="key_id" required>{availableKeys.map(key => <option key={key.id} value={key.id}>{projects.find(project => project.id === key.project_id)?.name ?? "Project"} · {key.name}</option>)}</select><p>The selected credential&apos;s existing scopes, expiry, quotas, and revocation rules continue to apply. Revoking the selected API key also revokes this connection.</p><button className="tic-button tic-primary" type="submit" name="decision" value="approve">Approve connection</button><button className="tic-button" type="submit" name="decision" value="deny">Deny</button></form> : <><p>No active key in your projects has all of the requested scopes. Create a scoped key first, then retry the connection.</p><Link className="tic-button" href="https://tidelight.app/developers/console">Open developer console →</Link></>}</section></main>;
}
