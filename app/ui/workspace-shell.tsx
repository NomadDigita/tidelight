"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions";

const navigation = [
  { href: "/", label: "Overview", icon: "◫" },
  { href: "/research", label: "Research desk", icon: "⌕" },
  { href: "/markets", label: "Market map", icon: "⌁" },
  { href: "/strategies", label: "Strategy lab", icon: "⌗" },
  { href: "/watchlist", label: "Watchlist", icon: "⌖" },
  { href: "/briefs", label: "Saved briefs", icon: "▤" },
];

export default function WorkspaceShell({ children, email }: { children: ReactNode; email: string | null }) {
  const pathname = usePathname();
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
            return <Link className={`nav-link${isActive ? " active" : ""}`} href={item.href} key={item.href} aria-current={isActive ? "page" : undefined}>
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
          <div className="top-actions"><span className="market-clock"><i /> AFTER HOURS <b>RESEARCH MODE</b></span><Link className="top-signin" href={email ? "/settings" : "/login"}>{email ? "ACCOUNT" : "SIGN IN"}</Link></div>
        </header>
        <div className="route-content">{children}</div>
        <footer className="page-footer"><span>© 2026 Tidelight Research</span><span><b>Clarity when the bell is quiet.</b> <i>Built for markets that never sleep.</i></span><Link href="/settings">PRIVACY & SETTINGS <span className="footer-dot">●</span></Link></footer>
      </main>
    </div>
  );
}
