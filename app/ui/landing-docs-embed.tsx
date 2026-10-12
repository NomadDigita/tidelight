"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavigationTrail } from "@/app/ui/navigation-icon";
import { useLanguage } from "@/app/ui/language-provider";

const DOCS_URL = "https://docs.tidelight.app";
const DOCS_ZH_URL = `${DOCS_URL}/untitled-zh`;
const EMBED_SCRIPT = `${DOCS_URL}/~gitbook/embed/script.js`;
const DEFAULT_DOC_PATH = "/use-tidelight/start-here";
const CHINESE_DOC_PATHS: Record<string, string> = {
  "/use-tidelight/start-here": "/shi-yong-tidelight/cong-zhe-li-kai-shi",
  "/use-tidelight/research-desk": "/shi-yong-tidelight/yan-jiu-tai",
  "/use-tidelight/markets-and-watchlists": "/shi-yong-tidelight/shi-chang-yu-zi-xuan-lie-biao",
};

declare global {
  interface Window {
    GitBook?: (command: string, ...args: unknown[]) => void;
  }
}

export default function LandingDocsEmbed() {
  const { language } = useLanguage();
  const chinese = language === "zh-CN";
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [requested, setRequested] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [widgetRoot, setWidgetRoot] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState("");
  const readyRef = useRef(false);
  const initializedSite = useRef<string | null>(null);
  const pendingOpen = useRef(false);
  const pendingPage = useRef<string | null>(null);
  const docsSite = chinese ? DOCS_ZH_URL : DOCS_URL;

  function resolveDocUrl(path?: string | null) {
    if (!path) return chinese ? DOCS_ZH_URL : DOCS_URL;
    const page = chinese ? CHINESE_DOC_PATHS[path] ?? "/bao" : path;
    return `${docsSite}${page}`;
  }

  const configureEmbed = useCallback(() => {
    if (!window.GitBook) return;
    window.GitBook("configure", {
      button: { label: chinese ? "Tidelight 文档" : "Tidelight docs", icon: "book" },
      assistantName: chinese ? "Tidelight 指南" : "Tidelight Guide",
      greeting: chinese
        ? { title: "了解 Tidelight", subtitle: "浏览产品手册，或直接提问。" }
        : { title: "Find your way through Tidelight", subtitle: "Browse the handbook or ask a question." },
      suggestions: chinese
        ? ["如何开始使用？", "Agent Flow 如何运作？", "如何研究代币化股票？"]
        : ["How do I get started?", "How does Agent Flow work?", "How do I research a tokenized stock?"],
      tabs: ["docs", "assistant", "search"],
      closeButton: true,
      trademark: true,
    });
  }, [chinese]);

  const revealEmbed = useCallback((path?: string | null) => {
    if (!window.GitBook) return;
    window.GitBook("open");
    if (path) {
      const page = chinese ? CHINESE_DOC_PATHS[path] ?? "/bao" : path;
      window.setTimeout(() => window.GitBook?.("navigateToPage", page), 250);
    }
    setIsOpen(true);
  }, [chinese]);

  function initializeEmbed() {
    if (!window.GitBook) return;
    const theme = document.documentElement.dataset.theme === "daylight" ? "light" : "dark";
    if (!document.getElementById("tidelight-gitbook-layout")) {
      const style = document.createElement("style");
      style.id = "tidelight-gitbook-layout";
      style.textContent = `
        #gitbook-widget-window{transition:width .2s ease,height .2s ease,transform .2s ease!important}
        #gitbook-widget-window{box-sizing:border-box!important;width:min(440px,calc(100vw - 32px))!important;height:min(540px,calc(100dvh - 112px))!important;max-width:calc(100vw - 32px)!important;max-height:calc(100dvh - 112px)!important;left:auto!important;right:20px!important;top:auto!important;bottom:76px!important;overflow:hidden!important;border:1px solid #9dd8bf!important;border-radius:15px!important;box-shadow:0 22px 68px #07120e55!important}
        #gitbook-widget-iframe{width:100%!important;height:100%!important}
        @media(max-width:780px){#gitbook-widget-window{width:min(390px,calc(100vw - 24px))!important;height:min(500px,calc(100dvh - 112px))!important;max-width:calc(100vw - 24px)!important;max-height:calc(100dvh - 112px)!important;right:12px!important;bottom:78px!important;border-radius:14px!important}}
      `;
      document.head.appendChild(style);
    }
    window.GitBook("init", { siteURL: docsSite }, { colorScheme: theme });
    initializedSite.current = docsSite;
    configureEmbed();
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

  useEffect(() => {
    if (!ready || !window.GitBook) return;
    if (initializedSite.current !== docsSite) {
      const theme = document.documentElement.dataset.theme === "daylight" ? "light" : "dark";
      window.GitBook("init", { siteURL: docsSite }, { colorScheme: theme });
      initializedSite.current = docsSite;
      if (isOpen) {
        window.GitBook("open");
        const page = docsSite === DOCS_ZH_URL ? CHINESE_DOC_PATHS[DEFAULT_DOC_PATH] : DEFAULT_DOC_PATH;
        window.setTimeout(() => window.GitBook?.("navigateToPage", page), 250);
      }
    }
    configureEmbed();
  }, [configureEmbed, docsSite, isOpen, ready, revealEmbed]);

  useEffect(() => {
    const openFromHelp = () => {
      if (readyRef.current && window.GitBook) {
        window.GitBook("open");
        setIsOpen(true);
      } else if (failed) {
        window.open(docsSite, "_blank", "noopener,noreferrer");
      } else {
        setRequested(true);
        pendingOpen.current = true;
        pendingPage.current = DEFAULT_DOC_PATH;
      }
    };
    window.addEventListener("tidelight:open-docs", openFromHelp);
    return () => window.removeEventListener("tidelight:open-docs", openFromHelp);
  }, [docsSite, failed]);

  useEffect(() => {
    if (!ready) return;
    const syncOpenState = () => {
      const widget = document.getElementById("gitbook-widget-window");
      setWidgetRoot(widget);
      setIsOpen(Boolean(widget && !widget.classList.contains("hidden")));
    };
    const observer = new MutationObserver(syncOpenState);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    syncOpenState();
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideTap = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("#gitbook-widget-window") || target.closest("[data-docs-launcher]")) return;
      window.GitBook?.("close");
      setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideTap, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsideTap, true);
  }, [isOpen]);

  function openEmbed(path?: string) {
    if (readyRef.current && window.GitBook) {
      revealEmbed(path ?? "/use-tidelight/start-here");
      setStatus("The Tidelight guide is open.");
      return;
    }
    if (failed) {
      window.open(resolveDocUrl(path), "_blank", "noopener,noreferrer");
      return;
    }
    setRequested(true);
    pendingOpen.current = true;
    pendingPage.current = path ?? DEFAULT_DOC_PATH;
    setStatus("Loading the Tidelight guide…");
    window.setTimeout(() => {
      if (pendingOpen.current && !readyRef.current) {
        pendingOpen.current = false;
        setStatus("The embedded guide is taking longer than expected. Use the handbook link below.");
      }
    }, 10000);
  }

  function closeEmbed() {
    window.GitBook?.("close");
    setIsOpen(false);
  }

  return <>
    {requested ? <Script id="tidelight-gitbook-embed" src={EMBED_SCRIPT} strategy="afterInteractive" onReady={initializeEmbed} onError={() => { setFailed(true); setStatus("The embedded guide could not load. Open the handbook directly instead."); }} /> : null}
    {isOpen && widgetRoot ? createPortal(<button className="landing-docs-close" type="button" onClick={closeEmbed} aria-label="Close handbook">×</button>, widgetRoot) : null}
    {ready && !isOpen ? <button className="landing-docs-launcher" type="button" data-docs-launcher onClick={() => openEmbed()} aria-label="Open Tidelight handbook" aria-expanded="false"><span aria-hidden="true">▤</span><b>Handbook</b></button> : null}
    <section className="landing-docs" id="handbook" aria-labelledby="landing-docs-title">
      <div className="landing-docs-copy">
        <span className="landing-kicker"><i /> THE TIDELIGHT HANDBOOK</span>
        <h2 id="landing-docs-title">The context is here.<br /><em>So are the answers.</em></h2>
        <p>Explore the Tidelight guide without leaving the desk. Browse product docs, search a topic, or ask the handbook a question.</p>
        <div className="landing-docs-actions">
          <button className="landing-docs-open" type="button" onClick={() => openEmbed()} aria-describedby="landing-docs-status">Open the handbook <NavigationTrail className="landing-arrow" /></button>
          <a href={docsSite} target="_blank" rel="noopener noreferrer">Read in a new tab <NavigationTrail className="landing-arrow" /></a>
        </div>
        <span id="landing-docs-status" className="landing-docs-status" role="status" aria-live="polite">{status || (ready ? "Handbook ready · opens only when you ask" : "The guide loads only when you open it.")}</span>
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
