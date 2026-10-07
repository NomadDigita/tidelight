"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOut } from "@/app/actions";
import { ExperienceSwitch, ThemeQuickSwitch } from "@/app/ui/theme-provider";

const navigation = [
  { href: "/", label: "Overview", icon: "◫" },
  { href: "/guide", label: "Start here", icon: "◎" },
  { href: "/research", label: "Research desk", icon: "⌕" },
  { href: "/community", label: "Research community", icon: "✳" },
  { href: "/markets", label: "Market map", icon: "⌁" },
  { href: "/strategies", label: "Strategy lab", icon: "⌗", technical: true },
  { href: "/nightwatch", label: "Nightwatch agent", icon: "◉", technical: true },
  { href: "/trading", label: "Bitget trading", icon: "⌁", technical: true },
  { href: "/watchlist", label: "Watchlist", icon: "⌖" },
  { href: "/briefs", label: "Saved briefs", icon: "▤", technical: true },
  { href: "/demo", label: "Product walkthrough", icon: "▷", technical: true },
  { href: "/systems", label: "Research systems", icon: "◉", technical: true },
];

export default function WorkspaceShell({ children, email, avatarUrl, displayName }: { children: ReactNode; email: string | null; avatarUrl: string | null; displayName: string | null }) {
  const pathname = usePathname();
  const profileLabel = displayName?.trim() || (email ? email.split("@")[0] : "Guest workspace");
  const profileInitial = profileLabel.slice(0, 1).toUpperCase() || "T";
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = mobileMenuPath === pathname;
  const active = navigation.find((item) => item.href === pathname) ?? navigation[0];

  if (pathname.startsWith("/login") || pathname.startsWith("/auth/")) return children;

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <Link className="brand" href="/" aria-label="Tidelight home">
          <Image src="/tidelight-mark.svg" alt="" width={36} height={36} priority />
          <span>tide<span className="brand-light">light</span><small>MARKET RESEARCH DESK</small></span>
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="nav-list">
          {navigation.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <Link data-technical={item.technical ? "true" : undefined} className={`nav-link${isActive ? " active" : ""}`} href={item.href} key={item.href} aria-current={isActive ? "page" : undefined}>
              <span className="nav-icon">{item.icon}</span>{item.label}{item.href === "/briefs" ? <span className="nav-count">↗</span> : null}
            </Link>;
          })}
        </nav>
        <div className="sidebar-promo">
          <div className="promo-mark">∿</div>
          <b>Markets don’t keep office hours.</b>
          <p>Follow the facts across the quiet hours.</p>
          <Link href="/research">Open research desk <span>↗</span></Link>
        </div>
        <div className="sidebar-bottom">
          <Link className="data-status" href="/settings">
            <span className="status-dot" /><span><b>Research systems</b><small>Source-first · Qwen assisted</small></span><span className="status-arrow">↗</span>
          </Link>
          <div className="user-profile">
            <div className="avatar">{avatarUrl ? <img src={avatarUrl} alt={profileLabel + " profile photo"} /> : profileInitial}</div>
            <div className="user-profile-copy"><b>{profileLabel}</b><small>{email ?? "Sign in to save research"}</small></div>
            {email ? <form action={signOut}><button className="more" aria-label="Sign out" title="Sign out">↪</button></form> : <Link className="profile-link" href="/login">Sign in</Link>}
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <Link className="mobile-brand" href="/"><Image src="/tidelight-mark.svg" alt="" width={36} height={36} priority /><span>tide<span className="brand-light">light</span></span></Link><div className="mobile-brand-story" aria-label="Tidelight product stories"><span>Read the signal between sessions.</span><span>Trace company events into tokenized equities.</span><span>Test a market view against the record.</span><span>Keep evidence and risk in the same frame.</span></div>
          <div className="breadcrumb">Workspace <span>/</span> {active.label}</div><div className="mobile-utility"><button type="button" className="mobile-menu-toggle" aria-label={mobileMenuOpen ? "Close workspace navigation" : "Open workspace navigation"} aria-expanded={mobileMenuOpen} aria-controls="mobile-workspace-drawer" onClick={() => setMobileMenuPath(mobileMenuOpen ? null : pathname)}><i/><i/><i/></button><b>{active.label}</b><div className="mobile-utility-controls"><ExperienceSwitch /><ThemeQuickSwitch /><Link className="top-signin" href={email ? "/settings" : "/login"}>{email ? "ACCOUNT" : "SIGN IN"}</Link></div></div>
          <div className="top-actions"><span className="market-clock"><i /> AFTER HOURS <b>RESEARCH MODE</b></span><ExperienceSwitch /><ThemeQuickSwitch /><Link className="top-signin" href={email ? "/settings" : "/login"}>{email ? "ACCOUNT" : "SIGN IN"}</Link></div>
        </header>
        <div className="route-content">{children}</div>
        <footer className="page-footer"><span>© 2026 Tidelight Research</span><span><b>Clarity when the bell is quiet.</b> <i>Built for markets that never sleep.</i></span><Link href="/settings">PRIVACY & SETTINGS <span className="footer-dot">●</span></Link></footer>
      </main>
      {mobileMenuOpen ? <div className="mobile-drawer-backdrop" onClick={() => setMobileMenuPath(null)}><aside className="mobile-workspace-drawer" id="mobile-workspace-drawer" aria-label="Workspace navigation" onClick={(event) => event.stopPropagation()}><div className="mobile-drawer-head"><span>YOUR WORKSPACE</span><button type="button" aria-label="Close menu" onClick={() => setMobileMenuPath(null)}>×</button></div><nav className="mobile-drawer-links">{navigation.map((item) => { const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link key={item.href} data-technical={item.technical ? "true" : undefined} className={`mobile-drawer-link${isActive ? " active" : ""}`} href={item.href} onClick={() => setMobileMenuPath(null)} aria-current={isActive ? "page" : undefined}><span>{item.icon}</span>{item.label}<i>↗</i></Link>; })}<Link className="mobile-drawer-link" href="/settings" onClick={() => setMobileMenuPath(null)}><span>⚙</span>Settings<i>↗</i></Link></nav><div className="mobile-drawer-foot"><div className="mobile-profile-avatar">{avatarUrl ? <img src={avatarUrl} alt={profileLabel + " profile photo"} /> : <span>{profileInitial}</span>}</div><span><b>{email ? profileLabel : "Your Tidelight desk"}</b><small>{email ?? "Sign in to save your research"}</small></span></div></aside></div> : null}
    </div>
  );
}
