"use client";

import Script from "next/script";
import { useRef, useState } from "react";
import { NavigationTrail } from "@/app/ui/navigation-icon";

const DOCS_URL = "https://docs.tidelight.app";
const EMBED_SCRIPT = `${DOCS_URL}/~gitbook/embed/script.js`;

declare global {
  interface Window {
    GitBook?: (command: string, ...args: unknown[]) => void;
  }
}

export default function LandingDocsEmbed() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState("");
  const readyRef = useRef(false);
  const pendingOpen = useRef(false);
  const pendingPage = useRef<string | null>(null);

  function revealEmbed(path?: string | null) {
    if (!window.GitBook) return;
    window.GitBook("open");
    if (path) window.setTimeout(() => window.GitBook?.("navigateToPage", path), 250);
  }

  function initializeEmbed() {
    if (!window.GitBook) return;
    const theme = document.documentElement.dataset.theme === "daylight" ? "light" : "dark";
    window.GitBook("init", { siteURL: DOCS_URL }, { colorScheme: theme });
    window.GitBook("configure", {
      button: { label: "Tidelight docs", icon: "book" },
      assistantName: "Tidelight Guide",
      greeting: { title: "Find your way through Tidelight", subtitle: "Browse the handbook or ask a question." },
      suggestions: ["How do I get started?", "How does Agent Flow work?", "How do I research a tokenized stock?"],
      tabs: ["docs", "assistant", "search"],
      closeButton: true,
      trademark: true,
    });
    window.GitBook("hide");
    readyRef.current = true;
    setReady(true);
    setFailed(false);
    if (pendingOpen.current) {
      revealEmbed(pendingPage.current);
      pendingOpen.current = false;
      pendingPage.current = null;
      setStatus("The Tidelight guide is open.");
    }
  }

  function openEmbed(path?: string) {
    if (readyRef.current && window.GitBook) {
      revealEmbed(path ?? "/use-tidelight/start-here");
      setStatus("The Tidelight guide is open.");
      return;
    }
    if (failed) {
      window.open(`${DOCS_URL}${path ?? ""}`, "_blank", "noopener,noreferrer");
      return;
    }
    pendingOpen.current = true;
    pendingPage.current = path ?? "/use-tidelight/start-here";
    setStatus("Loading the Tidelight guide…");
    window.setTimeout(() => {
      if (pendingOpen.current && !readyRef.current) {
        pendingOpen.current = false;
        setStatus("The embedded guide is taking longer than expected. Use the handbook link below.");
      }
    }, 10000);
  }

  return <>
    <Script id="tidelight-gitbook-embed" src={EMBED_SCRIPT} strategy="lazyOnload" onReady={initializeEmbed} onError={() => { setFailed(true); setStatus("The embedded guide could not load. Open the handbook directly instead."); }} />
    <section className="landing-docs" id="handbook" aria-labelledby="landing-docs-title">
      <div className="landing-docs-copy">
        <span className="landing-kicker"><i /> THE TIDELIGHT HANDBOOK</span>
        <h2 id="landing-docs-title">The context is here.<br /><em>So are the answers.</em></h2>
        <p>Explore the Tidelight guide without leaving the desk. Browse product docs, search a topic, or ask the handbook a question.</p>
        <div className="landing-docs-actions">
          <button className="landing-docs-open" type="button" onClick={() => openEmbed()} aria-describedby="landing-docs-status">Open the handbook <NavigationTrail className="landing-arrow" /></button>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">Read in a new tab <NavigationTrail className="landing-arrow" /></a>
        </div>
        <span id="landing-docs-status" className="landing-docs-status" role="status" aria-live="polite">{status || (ready ? "Handbook ready" : "Opens in a secure panel on this page.")}</span>
      </div>
      <div className="landing-docs-window" aria-label="Tidelight handbook preview">
        <div className="landing-docs-window-bar"><span className="landing-docs-window-brand"><i>∿</i> TIDELIGHT / HANDBOOK</span><span className="landing-docs-window-dots" aria-hidden="true"><i /><i /><i /></span></div>
        <div className="landing-docs-window-body">
          <aside className="landing-docs-rail" aria-hidden="true"><b>◫</b><span>⌕</span><span>▤</span><i /></aside>
          <div className="landing-docs-page">
            <span className="landing-docs-page-kicker">PUBLIC HANDBOOK · TIDELIGHT</span>
            <h3>Evidence-first research for tokenized markets.</h3>
            <p>Ask in everyday language. Bring the original source. See what could change the picture.</p>
            <div className="landing-docs-chapters"><button type="button" onClick={() => openEmbed("/use-tidelight/start-here")}><i>01</i><b>Start here</b><small>Turn a question and source into a clear trail.</small></button><button type="button" onClick={() => openEmbed("/use-tidelight/research-desk")}><i>02</i><b>Research desk</b><small>Build source-based briefs you can inspect.</small></button><button type="button" onClick={() => openEmbed("/use-tidelight/markets-and-watchlists")}><i>03</i><b>Markets &amp; watchlists</b><small>Follow public quotes and freshness.</small></button></div>
            <div className="landing-docs-search"><span aria-hidden="true">⌕</span><span>Ask the Tidelight handbook…</span><NavigationTrail className="landing-arrow" /></div>
          </div>
        </div>
        <div className="landing-docs-window-foot"><span><i /> SOURCE-LED PRODUCT GUIDE</span><small>docs.tidelight.app</small></div>
      </div>
    </section>
  </>;
}
