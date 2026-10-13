import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/actions";
import AccountCopyButton from "@/app/ui/account-copy-button";
import { createClient } from "@/lib/supabase/server";

type AccountRow = { label: string; detail: string; href?: string; value?: string; icon: string; state?: string };

function Row({ item }: { item: AccountRow }) {
  const content = <><span className="account-center-icon" aria-hidden="true">{item.icon}</span><span className="account-center-row-copy"><b>{item.label}</b><small>{item.detail}</small></span>{item.value ? <span className="account-center-row-value">{item.value}</span> : null}{item.state ? <span className="account-center-row-state">{item.state}</span> : null}{item.href ? <span className="account-center-arrow" aria-hidden="true">→</span> : null}</>;
  return item.href ? <Link className="account-center-row" href={item.href}>{content}</Link> : <div className="account-center-row account-center-row-static">{content}</div>;
}

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("community_profiles").select("handle,display_name,avatar_url").eq("id", user.id).maybeSingle() : { data: null };
  const name = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Tidelight guest";
  const groups: { id: string; title: string; intro: string; rows: AccountRow[] }[] = [
    { id: "my-info", title: "My info", intro: "Your Tidelight identity and connected workspace.", rows: [
      { label: "Profile picture", detail: "Update the photo shown on your community profile", href: "/settings#account-profile", icon: "◉", value: "↗" },
      { label: "Nickname & handle", detail: "Your display name and community username", href: "/settings#account-profile", icon: "▤", value: profile?.handle ? `@${profile.handle}` : "Set up" },
      ...(user ? [{ label: "Tidelight UID", detail: "Private account reference · tap to copy", icon: "ID", value: user.id } as AccountRow] : []),
      { label: "Identity verification", detail: "Tidelight does not hold customer funds or provide exchange KYC", href: "/settings#account-connections", icon: "✓", state: "Not required" },
      { label: "Tidelight plan", detail: "Your research workspace access · no paid tier configured", href: "/about", icon: "✦", state: "Core" },
      { label: "Trading fees", detail: "Execution fees are set by Bitget and shown by the exchange", href: "/trading", icon: "%", value: "Bitget" },
      { label: "Subaccounts", detail: "Tidelight does not create exchange subaccounts", icon: "♧", state: "Bitget only" },
      { label: "Linked accounts", detail: "Tidelight community identity and sign-in methods", href: "/settings#account-profile", icon: "@", value: "Manage" },
      { label: "Community profile", detail: "Posts, follows, and public profile details", href: "/community", icon: "♧", value: "↗" },
    ] },
    { id: "security", title: "Security", intro: "Protect sign-in, account data, and any trading action you authorize.", rows: [
      { label: "Sign-in email", detail: "Your verified account identity", icon: "✉", value: user?.email ?? "Guest" },
      { label: "Authenticator & passkeys", detail: "Step-up checks and device-bound sign-in", href: user ? "/settings#account-security" : "/login", icon: "⌑", value: user ? "Manage" : "Sign in" },
      { label: "Recent security activity", detail: "Review account checks and protected actions", href: user ? "/settings#account-security-activity" : "/login", icon: "◷", value: "View" },
      { label: "Trusted sign-in devices", detail: "Manage passkeys registered with your devices", href: user ? "/settings#account-security" : "/login", icon: "▣", value: "Passkeys" },
      { label: "Anti-phishing code", detail: "Tidelight does not offer a personal email code yet", icon: "⌑", state: "Not available" },
      { label: "Live order protection", detail: "MFA, risk limits, and per-order confirmation", href: "/futures", icon: "◇", state: "Protected" },
      { label: "Bitget connection", detail: "Review connected exchange credentials and permissions", href: "/trading?intent=live", icon: "↗", value: "Manage" },
      { label: "Fund password & withdrawal security", detail: "Tidelight never holds or withdraws your exchange funds", href: "/settings#account-connections", icon: "▱", state: "Bitget only" },
    ] },
    { id: "preference", title: "Preference", intro: "Tune how Tidelight presents research and sends product updates.", rows: [
      { label: "Currency display", detail: "US equity and paper-trading values are quoted in US dollars", icon: "$", state: "USD" },
      { label: "Color theme", detail: "Choose Daylight, Night Tide, or Blue Hour", href: "/settings#account-appearance", icon: "◐", value: "Change" },
      { label: "Language & research lens", detail: "Choose your language and research risk profile", href: "/settings#account-preferences", icon: "文", value: "Manage" },
      { label: "Withdrawal address & limits", detail: "Manage these only in your Bitget account; Tidelight cannot withdraw", href: "/trading", icon: "⌑", state: "Bitget only" },
      { label: "Deposit routing", detail: "Tidelight does not accept deposits or hold customer balances", icon: "↪", state: "Not offered" },
      { label: "Notifications & email subscriptions", detail: "Nightwatch alerts, fills, risks, research, and daily brief", href: "/nightwatch#email-preferences", icon: "♧", value: "Manage" },
      { label: "Always on / screen lock", detail: "Screen locking is controlled by your browser and device", icon: "▣", state: "Device setting" },
    ] },
    { id: "general", title: "General", intro: "Help, feedback, product information, and local data controls.", rows: [
      { label: "Help Center", detail: "Product guides and common questions", href: "/help", icon: "?" },
      { label: "Trade market overview", detail: "Explore tokenized US equities and market context", href: "/overview", icon: "⌁" },
      { label: "Contact Support", detail: "Reach the Tidelight support team", href: "/contact", icon: "◖" },
      { label: "User feedback & rating", detail: "Send a private rating or product suggestion", href: "/rate", icon: "☆" },
      { label: "About Tidelight", detail: "Our research approach and product principles", href: "/about", icon: "i" },
      { label: "Storage management", detail: "Review local browser data without deleting account records", href: "/storage", icon: "▱" },
    ] },
  ];
  return <main className="content-wrap inner-page account-center">
    <header className="account-center-hero"><div className="account-center-identity"><div className="account-center-avatar">{profile?.avatar_url ? <Image src={profile.avatar_url} alt="" width={70} height={70} unoptimized /> : name.slice(0,1).toUpperCase()}</div><div><span className="eyebrow">TIDELIGHT ACCOUNT</span><h1>{name}</h1><p>{user?.email ?? "Sign in to save preferences and secure your research."}{profile?.handle ? ` · @${profile.handle}` : ""}</p></div></div><Link className="account-center-edit" href={user ? "/settings#account-profile" : "/login"}>{user ? "Edit profile" : "Sign in"}<span>↗</span></Link></header>
    <nav className="account-center-tabs" aria-label="Account sections">{groups.map(group => <a href={`#${group.id}`} key={group.id}>{group.title}</a>)}</nav>
    {groups.map(group => <section className="account-center-group" id={group.id} key={group.id}><div className="account-center-group-head"><div><span className="eyebrow">ACCOUNT CENTER</span><h2>{group.title}</h2></div><p>{group.intro}</p></div><div className="account-center-list">{group.rows.map(item => item.label === "Tidelight UID" && user ? <div className="account-center-row account-center-row-static" key={item.label}><span className="account-center-icon" aria-hidden="true">{item.icon}</span><span className="account-center-row-copy"><b>{item.label}</b><small>{item.detail}</small></span><AccountCopyButton value={user.id} /></div> : <Row item={item} key={item.label} />)}</div></section>)}
    <footer className="account-center-footer"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link>{user ? <form action={signOut}><button className="account-center-logout" type="submit">Log out</button></form> : null}<span>Clarity when the bell is quiet.</span></footer>
  </main>;
}
