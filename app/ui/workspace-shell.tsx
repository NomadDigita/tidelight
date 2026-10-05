"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { signOut } from "@/app/actions";
import { ExperienceSwitch, ThemeQuickSwitch } from "@/app/ui/theme-provider";

const navigation = [
  { href: "/", label: "Overview", icon: "◫" },
  { href: "/research", label: "Research desk", icon: "⌕" },
  { href: "/markets", label: "Market map", icon: "⌁" },
  { href: "/strategies", label: "Strategy lab", icon: "⌗", technical: true },
  { href: "/nightwatch", label: "Nightwatch agent", icon: "◉", technical: true },
  { href: "/watchlist", label: "Watchlist", icon: "⌖" },
  { href: "/briefs", label: "Saved briefs", icon: "▤", technical: true },
];
const mobilePrimary = [navigation[0], navigation[1], navigation[2], navigation[4]];

export default function WorkspaceShell({ children, email }: { children: ReactNode; email: string | null }) {
  const pathname = usePathname();
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
            <div className="avatar">{email ? email.slice(0, 1).toUpperCase() : "↗"}</div>
            <div className="user-profile-copy"><b>{email ? email.split("@")[0] : "Guest workspace"}</b><small>{email ?? "Sign in to save research"}</small></div>
            {email ? <form action={signOut}><button className="more" aria-label="Sign out" title="Sign out">↪</button></form> : <Link className="profile-link" href="/login">Sign in</Link>}
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <Link className="mobile-brand" href="/"><Image src="/tidelight-mark.svg" alt="" width={28} height={28} /> Tidelight</Link>
          <div className="breadcrumb">Workspace <span>/</span> {active.label}</div>
          <div className="top-actions"><span className="market-clock"><i /> AFTER HOURS <b>RESEARCH MODE</b></span><ExperienceSwitch /><ThemeQuickSwitch /><Link className="top-signin" href={email ? "/settings" : "/login"}>{email ? "ACCOUNT" : "SIGN IN"}</Link></div>
        </header>
        <div className="route-content">{children}</div>
        <footer className="page-footer"><span>© 2026 Tidelight Research</span><span><b>Clarity when the bell is quiet.</b> <i>Built for markets that never sleep.</i></span><Link href="/settings">PRIVACY & SETTINGS <span className="footer-dot">●</span></Link></footer>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobilePrimary.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link className={`mobile-nav-link${isActive ? " active" : ""}`} href={item.href} key={item.href} aria-current={isActive ? "page" : undefined}>
            <span className="mobile-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label === "Research desk" ? "Research" : item.label === "Market map" ? "Markets" : item.label === "Nightwatch agent" ? "Nightwatch" : "Home"}</span>
          </Link>;
        })}
        <button className={`mobile-nav-link${mobileMenuOpen || navigation.slice(3).some((item) => pathname.startsWith(item.href)) ? " active" : ""}`} type="button" aria-expanded={mobileMenuOpen} aria-controls="mobile-more-menu" onClick={() => setMobileMenuPath(mobileMenuOpen ? null : pathname)}>
          <span className="mobile-nav-icon" aria-hidden="true">{mobileMenuOpen ? "×" : "···"}</span><span>More</span>
        </button>
        {mobileMenuOpen ? <div className="mobile-more-menu" id="mobile-more-menu">
          <div className="mobile-more-heading">YOUR WORKSPACE <button type="button" aria-label="Close navigation menu" onClick={() => setMobileMenuPath(null)}>×</button></div>
          {navigation.filter((item) => !mobilePrimary.some((primary) => primary.href === item.href)).map((item) => {
            const isActive = pathname.startsWith(item.href);
            return <Link data-technical={item.technical ? "true" : undefined} className={`mobile-more-link${isActive ? " active" : ""}`} href={item.href} key={item.href} aria-current={isActive ? "page" : undefined}><span aria-hidden="true">{item.icon}</span>{item.label}<span className="mobile-more-arrow">↗</span></Link>;
          })}
          <Link className="mobile-more-link" href="/settings"><span aria-hidden="true">⚙</span>Settings<span className="mobile-more-arrow">↗</span></Link>
          <Link className="mobile-more-account" href={email ? "/settings" : "/login"}>{email ? email : "Sign in to save your research"}<span>↗</span></Link>
        </div> : null}
      </nav>
    </div>
  );
}
