import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateRiskProfile } from "@/app/actions";
import { ThemePicker } from "@/app/ui/theme-provider";
import SecurityFactors from "@/app/ui/security-factors";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: preferences } = user
    ? await supabase.from("user_preferences").select("risk_profile, default_region").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const { data: securityEvents } = user
    ? await supabase.from("security_events").select("id,event_type,metadata,created_at").order("created_at", { ascending: false }).limit(8)
    : { data: [] };

  const eventLabel = (type: string, metadata: unknown) => {
    const details = metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
    if (type === "mfa_required") return { title: "Extra verification requested", detail: "A sensitive control asked for an authenticator check." };
    if (type === "mfa_verified") return { title: "Authenticator check passed", detail: "Your identity was confirmed for a sensitive control." };
    if (type === "control_change") return { title: details.paused === true ? "Nightwatch paused" : "Nightwatch resumed", detail: "Paper agent control changed." };
    if (type === "paper_exit") return { title: "Paper position closed", detail: typeof details.symbol === "string" ? `Simulated position: ${details.symbol.replace(/[^A-Za-z0-9_/-]/g, "").slice(0, 20)}` : "A simulated position was closed." };
    return { title: "Account security event", detail: "A security-related action was recorded." };
  };

  return <div className="content-wrap inner-page settings-page">
    <section className="page-heading compact-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> WORKSPACE PREFERENCES</div><h1>Set your <span>pace.</span></h1><p>Account, research, and data-source details in one place.</p></div></section>
    {params.updated ? <p className="action-notice">Your preference has been saved.</p> : null}{params.error ? <p className="action-error">We couldn’t save that change. Try again.</p> : null}
    <div className="settings-layout">
      <section className="settings-card theme-card"><div className="settings-card-head"><span className="settings-icon">◐</span><div><span className="eyebrow small-eyebrow">APPEARANCE</span><h2>Your desk, your light.</h2></div></div><p>Choose a palette that feels right. Your choice is saved on this device.</p><ThemePicker /></section>
      <section className="settings-card account-card"><div className="settings-card-head"><span className="settings-icon">◉</span><div><span className="eyebrow small-eyebrow">ACCOUNT</span><h2>Your workspace</h2></div></div>
        {user ? <><div className="account-identity"><div className="avatar large-avatar">{(user.email ?? "T").slice(0, 1).toUpperCase()}</div><div><b>{user.email}</b><small>Personal workspace · sign-in protected</small></div><span className="connected-pill"><i /> PRIVATE</span></div><div className="settings-divider" /><div className="preference-row"><div><b>Research lens</b><small>This preference is saved to your account.</small></div><form action={updateRiskProfile} className="preference-form"><select name="risk_profile" defaultValue={preferences?.risk_profile ?? "balanced"} aria-label="Research lens"><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="growth">Growth</option></select><button type="submit">Save</button></form></div></> : <div className="settings-empty"><p>You’re browsing as a guest. Sign in to save preferences and keep your research private across sessions.</p><Link className="primary-link" href="/login">Sign in <span>↗</span></Link></div>}
      </section>
      {user ? <section className="settings-card security-card"><div className="settings-card-head"><span className="settings-icon blue">⌑</span><div><span className="eyebrow small-eyebrow">ACCOUNT SECURITY</span><h2>Protect the desk.</h2></div></div><p>Use a time-based authenticator as a second factor before any future sensitive control is considered.</p><SecurityFactors /></section> : null}
      {user ? <section className="settings-card security-activity-card"><div className="settings-card-head"><span className="settings-icon mint">⌁</span><div><span className="eyebrow small-eyebrow">RECENT ACTIVITY</span><h2>Your security trail.</h2></div></div><p>Recent account checks and paper-agent controls, visible only to you.</p>{securityEvents?.length ? <ol className="security-activity">{securityEvents.map((event) => { const label = eventLabel(event.event_type, event.metadata); return <li key={event.id}><span className="security-activity-mark">✓</span><div><b>{label.title}</b><small>{label.detail}</small></div><time dateTime={event.created_at}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(event.created_at))}</time></li>; })}</ol> : <div className="security-activity-empty"><span>✳</span><div><b>No recent security activity</b><small>When an account check or paper control is used, it will appear here.</small></div></div>}</section> : null}
      <section className="settings-card connection-card"><div className="settings-card-head"><span className="settings-icon mint">✳</span><div><span className="eyebrow small-eyebrow">AI PROVIDER</span><h2>Qwen research synthesis</h2></div></div><p>Qwen can draft a structured brief from the source excerpt you submit. Each cited claim is checked against that text before saving.</p><div className="connection-row"><span><i className={process.env.BITGET_QWEN_API_KEY ? "connected-dot" : "pending-dot"} /> Bitget Qwen gateway</span><b>{process.env.BITGET_QWEN_API_KEY ? "CONFIGURED" : "SETUP NEEDED"}</b></div><div className="connection-meta"><span>MODEL</span><b>qwen3.8-max</b><span>MODE</span><b>Source-bounded research</b></div></section>
      <section className="settings-card connection-card live-gate-card"><div className="settings-card-head"><span className="settings-icon blue">⌁</span><div><span className="eyebrow small-eyebrow">BITGET EXECUTION GATE</span><h2>Paper mode is the boundary.</h2></div></div><p>Tidelight stores no usable exchange secret in the browser and cannot send a live order. The connection record is metadata-only until encryption, key validation, and an explicit safety review are implemented.</p><div className="connection-row"><span><i className="connected-dot" /> Public Bitget market feed</span><b>AVAILABLE</b></div><div className="connection-row"><span><i className="pending-dot" /> Private order execution</span><b>LOCKED</b></div><small className="settings-footnote">This hard gate is enforced in the database, not only by the interface.</small></section>
      <section className="settings-card privacy-card"><div className="settings-card-head"><span className="settings-icon blue">⌑</span><div><span className="eyebrow small-eyebrow">DATA & PRIVACY</span><h2>Your research stays yours.</h2></div></div><p>Saved research is attached to your Supabase account. Database row-level security prevents signed-in users from reading each other’s notes and watchlists.</p><div className="privacy-links"><Link href="/briefs">Open your private briefs <span>↗</span></Link><Link href="/watchlist">Manage your watchlist <span>↗</span></Link></div><small className="settings-footnote">Market views use public Bitget prices and candle history. Briefs use the source passages you provide.</small></section>
    </div>
  </div>;
}
