"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "@/app/actions";
import { useExperience } from "@/app/ui/theme-provider";
import { ExperienceSwitch, ThemeQuickSwitch } from "@/app/ui/theme-provider";
import { NavigationIcon, type NavigationIconName } from "@/app/ui/navigation-icon";

const navigation: { href: string; label: string; icon: NavigationIconName; technical?: boolean }[] = [
  { href: "/", label: "Overview", icon: "overview" },
  { href: "/guide", label: "Start here", icon: "guide" },
  { href: "/research", label: "Research desk", icon: "research" },
  { href: "/flow", label: "Agent flow", icon: "flow" },
  { href: "/community", label: "Research community", icon: "community" },
  { href: "/markets", label: "Market map", icon: "markets" },
  { href: "/strategies", label: "Strategy lab", icon: "strategies", technical: true },
  { href: "/nightwatch", label: "Nightwatch agent", icon: "nightwatch", technical: true },
  { href: "/futures", label: "Futures paper desk", icon: "futures", technical: true },
  { href: "/trading", label: "Bitget trading", icon: "trading", technical: true },
  { href: "/watchlist", label: "Watchlist", icon: "watchlist" },
  { href: "/briefs", label: "Saved briefs", icon: "briefs", technical: true },
  { href: "/demo", label: "Product walkthrough", icon: "demo", technical: true },
  { href: "/systems", label: "Research systems", icon: "systems", technical: true },
];

const BRAND_STORIES = [
  "Read the signal between sessions.",
  "Trace company events into tokenized equities.",
  "Test a market view against the record.",
  "Keep evidence and risk in the same frame.",
];

function BrandStoryTypewriter() {
  const [storyIndex, setStoryIndex] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReduceMotion(preference.matches);
    syncPreference();
    preference.addEventListener("change", syncPreference);
    return () => preference.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const story = BRAND_STORIES[storyIndex];
    let delay = 46;
    let nextCount = characterCount;
    let nextDeleting = deleting;
    let nextStoryIndex = storyIndex;

    if (!deleting && characterCount >= story.length) {
      delay = 1750;
      nextDeleting = true;
    } else if (deleting && characterCount <= 0) {
      delay = 260;
      nextDeleting = false;
      nextStoryIndex = (storyIndex + 1) % BRAND_STORIES.length;
    } else {
      nextCount = characterCount + (deleting ? -1 : 1);
      if (deleting) delay = 24;
    }

    const timer = window.setTimeout(() => {
      setCharacterCount(nextCount);
      setDeleting(nextDeleting);
      setStoryIndex(nextStoryIndex);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [characterCount, deleting, reduceMotion, storyIndex]);

  const visibleStory = reduceMotion ? BRAND_STORIES[0] : BRAND_STORIES[storyIndex].slice(0, characterCount);
  return <div className="mobile-brand-story" aria-label="Tidelight product stories">
    <span className="brand-story-copy" aria-hidden="true">{visibleStory}</span>
    <span className="sr-only">{BRAND_STORIES[reduceMotion ? 0 : storyIndex]}</span>
  </div>;
}

export default function WorkspaceShell({ children, email, avatarUrl, displayName }: { children: ReactNode; email: string | null; avatarUrl: string | null; displayName: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode } = useExperience();
  const visibleNavigation = mode === "mini" ? navigation.filter((item) => !item.technical) : navigation;
  const profileLabel = displayName?.trim() || (email ? email.split("@")[0] : "Guest workspace");
  const profileInitial = profileLabel.slice(0, 1).toUpperCase() || "T";
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = mobileMenuPath === pathname;
  const active = navigation.find((item) => item.href === pathname) ?? navigation[0];

  useEffect(() => {
    if (mode !== "mini") return;
    const isTechnicalRoute = navigation.some((item) => item.technical && (pathname === item.href || pathname.startsWith(`${item.href}/`)));
    if (isTechnicalRoute) router.replace("/");
  }, [mode, pathname, router]);

  if (pathname.startsWith("/login") || pathname.startsWith("/auth/") || (pathname === "/" && !email)) return children;

  return (
    <div className="app-shell" data-experience={mode}>
      <aside className="sidebar" aria-label="Main navigation">
        <Link className="brand" href="/" aria-label="Tidelight home">
          <Image src="/tidelight-mark.svg" alt="" width={36} height={36} priority />
          <span>tide<span className="brand-light">light</span><small>MARKET RESEARCH DESK</small></span>
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="nav-list">
          {visibleNavigation.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <Link data-technical={item.technical ? "true" : undefined} className={`nav-link${isActive ? " active" : ""}`} href={item.href} key={item.href} aria-current={isActive ? "page" : undefined}>
              <span className="nav-icon"><NavigationIcon name={item.icon} /></span>{item.label}{item.href === "/briefs" ? <span className="nav-count">↗</span> : null}
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
            <div className="avatar">{avatarUrl ? <Image src={avatarUrl} alt={profileLabel + " profile photo"} width={30} height={30} unoptimized /> : profileInitial}</div>
            <div className="user-profile-copy"><b>{profileLabel}</b><small>{email ?? "Sign in to save research"}</small></div>
            {email ? <form action={signOut}><button className="more" aria-label="Sign out" title="Sign out">↪</button></form> : <Link className="profile-link" href="/login">Sign in</Link>}
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <Link className="mobile-brand" href="/"><Image src="/tidelight-mark.svg" alt="" width={36} height={36} priority /><span>tide<span className="brand-light">light</span></span></Link><BrandStoryTypewriter />
          <div className="breadcrumb">Workspace <span>/</span> {active.label}</div><div className="mobile-utility"><button type="button" className="mobile-menu-toggle" aria-label={mobileMenuOpen ? "Close workspace navigation" : "Open workspace navigation"} aria-expanded={mobileMenuOpen} aria-controls="mobile-workspace-drawer" onClick={() => setMobileMenuPath(mobileMenuOpen ? null : pathname)}><i/><i/><i/></button><b>{active.label}</b><div className="mobile-utility-controls"><ExperienceSwitch /><ThemeQuickSwitch /><Link className="top-signin" href={email ? "/settings" : "/login"}>{email ? "ACCOUNT" : "SIGN IN"}</Link></div></div>
          <div className="top-actions"><span className="market-clock"><i /> AFTER HOURS <b>RESEARCH MODE</b></span><ExperienceSwitch /><ThemeQuickSwitch /><Link className="top-signin" href={email ? "/settings" : "/login"}>{email ? "ACCOUNT" : "SIGN IN"}</Link></div>
        </header>
        <div className="route-content">{children}</div>
        <footer className="page-footer"><span>© 2026 Tidelight Research</span><span><b>Clarity when the bell is quiet.</b> <i>Built for markets that never sleep.</i></span><nav className="legal-footer-links" aria-label="Legal and account links"><Link href="/terms">TERMS</Link><Link href="/privacy">PRIVACY</Link><Link href="/settings">SETTINGS <span className="footer-dot">●</span></Link></nav></footer>
      </main>
      {mobileMenuOpen ? <div className="mobile-drawer-backdrop" onClick={() => setMobileMenuPath(null)}><aside className="mobile-workspace-drawer" id="mobile-workspace-drawer" aria-label="Workspace navigation" onClick={(event) => event.stopPropagation()}><div className="mobile-drawer-head"><span>YOUR WORKSPACE</span><button type="button" aria-label="Close menu" onClick={() => setMobileMenuPath(null)}>×</button></div><nav className="mobile-drawer-links">{visibleNavigation.map((item) => { const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link key={item.href} data-technical={item.technical ? "true" : undefined} className={`mobile-drawer-link${isActive ? " active" : ""}`} href={item.href} onClick={() => setMobileMenuPath(null)} aria-current={isActive ? "page" : undefined}><span className="mobile-drawer-icon"><NavigationIcon name={item.icon} /></span>{item.label}<i>↗</i></Link>; })}<Link className="mobile-drawer-link" href="/settings" onClick={() => setMobileMenuPath(null)}><span className="mobile-drawer-icon"><NavigationIcon name="settings" /></span>Settings<i>↗</i></Link></nav><div className="mobile-drawer-foot"><div className="mobile-profile-avatar">{avatarUrl ? <Image src={avatarUrl} alt={profileLabel + " profile photo"} width={30} height={30} unoptimized /> : <span>{profileInitial}</span>}</div><span><b>{email ? profileLabel : "Your Tidelight desk"}</b><small>{email ?? "Sign in to save your research"}</small></span></div></aside></div> : null}
    </div>
  );
}
