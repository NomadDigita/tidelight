import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const groups = [
  { title: "My info", intro: "Your public identity and account details.", items: [{ label: "Profile & username", detail: "Photo, display name and community handle", href: "/settings#account-profile", icon: "◎" }, { label: "Research preferences", detail: "Language, theme and research lens", href: "/settings#account-preferences", icon: "◐" }] },
  { title: "Security", intro: "Keep sign-in and sensitive actions protected.", items: [{ label: "Account security", detail: "Authenticator, passkeys and recent activity", href: "/settings#account-security", icon: "⌑" }, { label: "Connections & trading controls", detail: "Review your Bitget setup and access gates", href: "/settings#account-connections", icon: "↗" }] },
  { title: "General", intro: "Help, contact and information about Tidelight.", items: [{ label: "Help center", detail: "Product guides and common questions", href: "/help", icon: "?" }, { label: "Contact support", detail: "Reach the Tidelight support team", href: "/contact", icon: "◖" }, { label: "About us", detail: "What Tidelight is and how it works", href: "/about", icon: "i" }, { label: "Storage management", detail: "Review locally saved Tidelight data", href: "/storage", icon: "▱" }, { label: "Rate Tidelight", detail: "Share a rating and product feedback", href: "/rate", icon: "☆" }] },
];

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("community_profiles").select("handle,display_name,avatar_url").eq("id", user.id).maybeSingle() : { data: null };
  const name = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Tidelight guest";
  return <main className="content-wrap inner-page account-center">
    <header className="account-center-hero"><div className="account-center-identity"><div className="account-center-avatar">{profile?.avatar_url ? <Image src={profile.avatar_url} alt="" width={70} height={70} unoptimized /> : name.slice(0,1).toUpperCase()}</div><div><span className="eyebrow">TIDELIGHT ACCOUNT</span><h1>{name}</h1><p>{user?.email ?? "Sign in to save preferences and secure your research."}{profile?.handle ? ` · @${profile.handle}` : ""}</p></div></div><Link className="account-center-edit" href={user ? "/settings#account-profile" : "/login"}>{user ? "Edit profile" : "Sign in"}<span>↗</span></Link></header>
    <div className="account-center-tabs" aria-label="Account sections"><a href="#my-info">My info</a><a href="#security">Security</a><a href="#general">General</a></div>
    {groups.map((group) => <section className="account-center-group" id={group.title.toLowerCase().replace(" ", "-")} key={group.title}><div className="account-center-group-head"><div><span className="eyebrow">ACCOUNT CENTER</span><h2>{group.title}</h2></div><p>{group.intro}</p></div><div className="account-center-list">{group.items.map(item => <Link className="account-center-row" href={item.href} key={item.label}><span className="account-center-icon" aria-hidden="true">{item.icon}</span><span className="account-center-row-copy"><b>{item.label}</b><small>{item.detail}</small></span><span className="account-center-arrow" aria-hidden="true">↗</span></Link>)}</div></section>)}
    <footer className="account-center-footer"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><span>Clarity when the bell is quiet.</span></footer>
  </main>;
}
