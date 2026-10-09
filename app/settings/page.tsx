import AiProviderCheck from "@/app/ui/ai-provider-check";
import { configuredAiProviders } from "@/lib/ai-fallback";
import { MAX_ORDER_ATTEMPTS_PER_HOUR, MAX_ORDER_NOTIONAL_USDT } from "@/lib/bitget-order-policy";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { updateRiskProfile } from "@/app/actions";
import { ThemePicker } from "@/app/ui/theme-provider";
import SecurityFactors from "@/app/ui/security-factors";
import PasskeyControls from "@/app/ui/passkey-controls";
import ProfileEditor from "@/app/ui/profile-editor";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; updated?: string; setup?: string }> }) {
  const params = await searchParams;
  const providers = configuredAiProviders();
  const qwen = providers.find(provider => provider.label === "qwen");
  const gemini = providers.find(provider => provider.label === "gemini");
  const secureStorageConfigured = Boolean(
    process.env.BITGET_CREDENTIALS_ENCRYPTION_KEY && process.env.BITGET_CREDENTIALS_ENCRYPTION_KEY.length >= 32
    && process.env.NEXT_PUBLIC_SUPABASE_URL
    && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: preferences } = user
    ? await supabase.from("user_preferences").select("risk_profile, default_region").eq("user_id", user.id).maybeSingle()
    : { data: null };
  const { data: communityProfile } = user
    ? await supabase.from("community_profiles").select("handle,display_name,avatar_url,handle_changed_at").eq("id", user.id).maybeSingle()
    : { data: null };
  const { data: securityEvents } = user
    ? await supabase.from("security_events").select("id,event_type,metadata,created_at").order("created_at", { ascending: false }).limit(8)
    : { data: [] };

  const eventLabel = (type: string, metadata: unknown) => {
    const details = metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
    if (type === "mfa_required") return { title: "Extra verification requested", detail: "A sensitive control asked for an authenticator check." };
    if (type === "mfa_verified") return { title: "Authenticator check passed", detail: "Your identity was confirmed for a sensitive control." };
    if (type === "passkey_signin") return { title: "Passkey sign-in completed", detail: "A passkey was used to access your workspace." };
    if (type === "passkey_registered") return { title: "Passkey added", detail: "A new passkey was registered to your account." };
    if (type === "passkey_removed") return { title: "Passkey removed", detail: "A passkey was removed from your account." };
    if (type === "control_change") return { title: details.paused === true ? "Nightwatch paused" : "Nightwatch resumed", detail: "Paper agent control changed." };
    if (type === "paper_exit") return { title: "Paper position closed", detail: typeof details.symbol === "string" ? `Simulated position: ${details.symbol.replace(/[^A-Za-z0-9_/-]/g, "").slice(0, 20)}` : "A simulated position was closed." };
    return { title: "Account security event", detail: "A security-related action was recorded." };
  };

  return <div className="content-wrap inner-page settings-page">
    <section className="page-heading compact-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> WORKSPACE PREFERENCES</div><h1>Set your <span>pace.</span></h1><p>Account, research, and data-source details in one place.</p></div></section>
    {params.setup ? <p className="action-notice">Your account is ready. Choose a 4–8 character username to finish setting up your Tidelight profile.</p> : null}{params.updated ? <p className="action-notice">Your preference has been saved.</p> : null}{params.error ? <p className="action-error">We couldn’t save that change. Try again.</p> : null}
    <div className="settings-layout">
      <section className="settings-card theme-card"><div className="settings-card-head"><span className="settings-icon">◐</span><div><span className="eyebrow small-eyebrow">APPEARANCE</span><h2>Your desk, your light.</h2></div></div><p>Choose a palette that feels right. Your choice is saved on this device.</p><ThemePicker /></section>
      <section className="settings-card account-card"><div className="settings-card-head"><span className="settings-icon">◉</span><div><span className="eyebrow small-eyebrow">ACCOUNT</span><h2>Your workspace</h2></div></div>
        {user ? <><div className="account-identity"><div className="avatar large-avatar">{communityProfile?.avatar_url ? <Image src={communityProfile.avatar_url} alt="" width={48} height={48} unoptimized /> : (communityProfile?.display_name ?? user.email ?? "T").slice(0, 1).toUpperCase()}</div><div><b>{communityProfile?.display_name ?? user.email}</b><small>@{communityProfile?.handle ?? "set up a community handle"} · sign-in protected</small></div><span className="connected-pill"><i /> PRIVATE</span></div><ProfileEditor userId={user.id} initialName={communityProfile?.display_name ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Tidelight member"} initialHandle={communityProfile?.handle ?? user.id.replace(/-/g, "").slice(0, 8).toLowerCase()} initialAvatar={communityProfile?.avatar_url ?? user.user_metadata?.avatar_url ?? ""} profileExists={Boolean(communityProfile)} handleChangedAt={communityProfile?.handle_changed_at ?? null} /><div className="settings-divider" /><div className="preference-row"><div><b>Research lens</b><small>This preference is saved to your account.</small></div><form action={updateRiskProfile} className="preference-form"><select name="risk_profile" defaultValue={preferences?.risk_profile ?? "balanced"} aria-label="Research lens"><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="growth">Growth</option></select><button type="submit">Save</button></form></div></> : <div className="settings-empty"><p>You’re browsing as a guest. Sign in to save preferences and keep your research private across sessions.</p><Link className="primary-link" href="/login">Sign in <span>↗</span></Link></div>}
      </section>
      {user ? <section className="settings-card security-card"><div className="settings-card-head"><span className="settings-icon blue">⌑</span><div><span className="eyebrow small-eyebrow">ACCOUNT SECURITY</span><h2>Protect the desk.</h2></div></div><p>Add an authenticator to protect sensitive controls. A completed authenticator check is required before each live Bitget order.</p><SecurityFactors /><div className="settings-divider"/><div className="passkey-card-heading"><span className="eyebrow small-eyebrow">PASSKEYS / WEBAUTHN</span><b>Sign in with the device you trust.</b><small>Passkeys use your device or password manager, and can’t be reused on a fake login page.</small></div><PasskeyControls enabled={process.env.NEXT_PUBLIC_SUPABASE_PASSKEYS_ENABLED === "true"}/></section> : null}
      {user ? <section className="settings-card security-activity-card"><div className="settings-card-head"><span className="settings-icon mint">⌁</span><div><span className="eyebrow small-eyebrow">RECENT ACTIVITY</span><h2>Your security trail.</h2></div></div><p>Recent account checks and paper-agent controls, visible only to you.</p>{securityEvents?.length ? <ol className="security-activity">{securityEvents.map((event) => { const label = eventLabel(event.event_type, event.metadata); return <li key={event.id}><span className="security-activity-mark">✓</span><div><b>{label.title}</b><small>{label.detail}</small></div><time dateTime={event.created_at}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(event.created_at))}</time></li>; })}</ol> : <div className="security-activity-empty"><span>✳</span><div><b>No recent security activity</b><small>When an account check or paper control is used, it will appear here.</small></div></div>}</section> : null}
      <section className="settings-card connection-card"><div className="settings-card-head"><span className="settings-icon mint">✳</span><div><span className="eyebrow small-eyebrow">AI PROVIDERS</span><h2>Research synthesis</h2></div></div><p>Tidelight uses Bitget’s Qwen gateway with Gemini as a fallback to draft source-bounded research. Provider responses must pass the research workflow’s evidence checks before they can inform a decision.</p><div className="connection-row"><span><i className="pending-dot" /> Bitget Qwen gateway</span><b>{qwen ? "CONFIGURED" : "SETUP NEEDED"}</b></div><div className="connection-row"><span><i className="pending-dot" /> Google Gemini</span><b>{gemini ? "CONFIGURED" : "SETUP NEEDED"}</b></div><div className="connection-meta"><span>QWEN MODEL</span><b>{qwen?.model ?? "Not configured"}</b><span>GEMINI MODEL</span><b>{gemini?.model ?? "Not configured"}</b></div><small className="settings-footnote">Configuration does not confirm provider access, model availability, or quota. {user ? "Run a connection check below to see the current result." : "Sign in to check each provider’s current response."}</small>{user ? <AiProviderCheck /> : null}</section>
      <section className="settings-card connection-card live-gate-card"><div className="settings-card-head"><span className="settings-icon blue">⌁</span><div><span className="eyebrow small-eyebrow">BITGET EXECUTION CONTROLS</span><h2>You confirm every order.</h2></div></div><p>Connect a dedicated Bitget demo or live account in the trading desk. Credentials are encrypted on the server and are not returned to your browser. Tidelight checks trade read access before saving a connection; Bitget checks order permissions when you confirm an order.</p><div className="connection-row"><span><i className="pending-dot" /> Secure connection storage</span><b>{secureStorageConfigured ? "CONFIGURED" : "SETUP NEEDED"}</b></div><div className="connection-row"><span><i className="pending-dot" /> Demo and live spot orders</span><b>VERIFICATION REQUIRED</b></div><small className="settings-footnote">Orders are limited to verified Reality stock tokens, {MAX_ORDER_NOTIONAL_USDT} USDT in estimated value, and {MAX_ORDER_ATTEMPTS_PER_HOUR} attempts per hour. Live orders require explicit confirmation and an authenticator check. Nightwatch automation remains paper-only.</small><div className="privacy-links"><Link href="/trading">Manage your Bitget connection <span>↗</span></Link><Link href="/nightwatch">Review paper agent controls <span>↗</span></Link></div></section>
      <section className="settings-card privacy-card"><div className="settings-card-head"><span className="settings-icon blue">⌑</span><div><span className="eyebrow small-eyebrow">DATA & PRIVACY</span><h2>Your research stays yours.</h2></div></div><p>Saved research is attached to your Supabase account. Database row-level security prevents signed-in users from reading each other’s notes and watchlists.</p><div className="privacy-links"><Link href="/briefs">Open your private briefs <span>↗</span></Link><Link href="/watchlist">Manage your watchlist <span>↗</span></Link></div><small className="settings-footnote">Market views use public Bitget prices and candle history. Briefs use the source passages you provide.</small></section>
    </div>
  </div>;
}
