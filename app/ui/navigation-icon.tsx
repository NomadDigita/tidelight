import type { ReactNode } from "react";

export type NavigationIconName = "overview" | "guide" | "research" | "flow" | "community" | "markets" | "strategies" | "nightwatch" | "futures" | "trading" | "watchlist" | "briefs" | "demo" | "systems" | "settings";

export function NavigationIcon({ name, className }: { name: NavigationIconName; className?: string }) {
  const shared = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<NavigationIconName, ReactNode> = {
    overview: <><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></>,
    guide: <><circle cx="12" cy="12" r="9"/><path d="m9 15 2-6 6-2-2 6-6 2Z"/></>,
    research: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M8 11h5m-2.5-2.5v5"/></>,
    flow: <><circle cx="5" cy="5" r="2"/><circle cx="19" cy="8" r="2"/><circle cx="7" cy="19" r="2"/><path d="M7 5h6a6 6 0 0 1 6 1M6 7v9m3 2 8-8"/></>,
    community: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20H3.5ZM16 5.5a3 3 0 0 1 0 6m1.5 3a4.5 4.5 0 0 1 3 4.3V20h-3"/></>,
    markets: <><path d="M3 17.5 8 12l4 2.5 8-9M16 5.5h4v4"/><path d="M3 21h18"/></>,
    strategies: <><path d="M3 7h18M3 17h18"/><circle cx="8" cy="7" r="2.5" fill="var(--bg)"/><circle cx="16" cy="17" r="2.5" fill="var(--bg)"/></>,
    nightwatch: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
    futures: <><path d="M3 18h18M5 14l4-4 3 2 6-7m-4 0h4v4"/><path d="M5 18v2"/></>,
    trading: <><path d="m3 10 6-6h7l-6 6H3Zm11 4 7-7v7l-6 6H8l6-6Z"/><path d="m8 20 6-6h7"/></>,
    watchlist: <path d="M5 3.5h14v17l-7-4.5-7 4.5v-17Z"/>,
    briefs: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    demo: <><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/></>,
    systems: <><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M19 5l-3 3M8 16l-3 3"/></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--bg)"/><circle cx="16" cy="12" r="2" fill="var(--bg)"/><circle cx="10" cy="18" r="2" fill="var(--bg)"/></>,
  };
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...shared}>{paths[name]}</svg>;
}
