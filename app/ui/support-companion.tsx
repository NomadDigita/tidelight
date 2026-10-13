"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useIntelligence } from "@/app/ui/intelligence-provider";
import { useExperience } from "@/app/ui/theme-provider";
import { composeIntelligenceBlocks } from "@/lib/intelligence-ui";
import { RegistryBlock } from "@/app/ui/intelligence-results";
import TidelightAnimatedMark from "@/app/ui/tidelight-animated-mark";

type Resource = { label: string; href: string };
type Message = { role: "user" | "assistant"; content: string; links?: Resource[]; source?: "knowledge" | "ai" };
type Conversation = { id: string; title: string; updatedAt: number; messages: Message[] };
const HISTORY_KEY = "tidelight-tide-history";
const historyDate = (value: unknown) => {
  if (typeof value !== "number" || value < 100_000_000_000 || !Number.isFinite(value)) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { timeZone: "Africa/Lagos", month: "short", day: "numeric", year: "numeric" }).format(date);
};

function TypingReply({ text }: { text: string }) {
  const [visible, setVisible] = useState(0);
  const reducedMotion = useRef(false);
  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setVisible(reducedMotion.current ? text.length : 0);
  }, [text]);
  useEffect(() => {
    if (reducedMotion.current || visible >= text.length) return;
    const timer = window.setTimeout(() => setVisible((value) => Math.min(text.length, value + Math.max(2, Math.ceil(text.length / 72)))), 16);
    return () => window.clearTimeout(timer);
  }, [text, visible]);
  return <p>{text.slice(0, visible)}{visible < text.length ? <span className="tide-guide-cursor" aria-hidden="true" /> : null}</p>;
}

const starts: Record<string, string[]> = {
  "/trading": ["How do I get a Bitget demo API key?", "What protects a live order?", "What is the difference between demo and paper trading?"],
  "/flow": ["How does Agent Flow decide?", "Why is a trade on hold?", "Where do its sources come from?"],
  "/research": ["How do I research a stock?", "How are sources checked?", "Where can I save a brief?"],
  "/strategies": ["How do I validate a strategy?", "What does out-of-sample mean?", "How do fees affect results?"],
  "/community": ["How do I share research?", "Are my messages private?", "Can I show Studio stats on my profile?"],
};
const defaultStarts = ["What can Tidelight do?", "Guide me through the workspace", "How do I use Bitget demo trading?"];

function TideGuideMark({ small = false }: { small?: boolean }) {
  return <svg className={small ? "tide-guide-mark small" : "tide-guide-mark"} viewBox="0 0 64 64" role="img" aria-label="Tide, your Tidelight guide">
    <defs><linearGradient id="tide-guide-glow" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#20d3bd" /><stop offset="1" stopColor="#a6efd1" /></linearGradient></defs>
    <path className="tide-guide-fin" d="M15 28 5 21l1 19 12-2M49 28l10-7-1 19-12-2" />
    <path className="tide-guide-body" d="M32 5C21 15 13 24 13 36a19 19 0 0 0 38 0C51 24 43 15 32 5Z" />
    <path className="tide-guide-sheen" d="M22 21c-5 7-7 12-7 18" />
    <circle cx="25" cy="35" r="2.3" fill="#092b2b" /><circle cx="39" cy="35" r="2.3" fill="#092b2b" />
    <path d="M27 44q5 4 10 0" fill="none" stroke="#092b2b" strokeWidth="2" strokeLinecap="round" />
    <circle className="tide-guide-spark" cx="49" cy="12" r="2" />
  </svg>;
}

export default function SupportCompanion() {
  const pathname = usePathname();
  const intelligence = useIntelligence();
  const { mode: experienceMode } = useExperience();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"guide" | "research">("guide");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string>("new");
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const positionRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  function viewportBounds() {
    const viewport = window.visualViewport;
    const width = Math.max(1, Math.floor(viewport?.width ?? document.documentElement.clientWidth ?? window.innerWidth));
    const height = Math.max(1, Math.floor(viewport?.height ?? document.documentElement.clientHeight ?? window.innerHeight));
    const launcher = launcherRef.current?.getBoundingClientRect();
    const buttonWidth = Math.max(46, launcher?.width ?? 46);
    const buttonHeight = Math.max(46, launcher?.height ?? 46);
    return { maxX: Math.max(4, width - buttonWidth - 4), maxY: Math.max(4, height - buttonHeight - 4) };
  }
  function clampPosition(point: { x: number; y: number }) {
    const bounds = viewportBounds();
    return { x: Math.max(4, Math.min(point.x, bounds.maxX)), y: Math.max(4, Math.min(point.y, bounds.maxY)) };
  }
  const suggestions = starts[Object.keys(starts).find((path) => pathname.startsWith(path)) ?? ""] ?? defaultStarts;

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]") as Conversation[];
      const valid = Array.isArray(saved) ? saved.filter((item) => item && Array.isArray(item.messages)).slice(0, 10) : [];
      window.setTimeout(() => {
        setConversations(valid);
        if (valid[0]?.messages?.length) { conversationIdRef.current = valid[0].id; setMessages(valid[0].messages); }
      }, 0);
    } catch { /* a corrupt local history should never block Tide */ }
  }, []);

  useEffect(() => {
    const bounds = viewportBounds();
    let restored: { x: number; y: number } = { x: bounds.maxX, y: bounds.maxY };
    try {
      const saved = window.localStorage.getItem("tidelight-tide-position");
      if (saved) {
        const value: unknown = JSON.parse(saved);
        if (value && typeof value === "object" && "x" in value && "y" in value && typeof value.x === "number" && typeof value.y === "number") restored = { x: value.x, y: value.y };
      } else {
        const oldBottom = Number(window.localStorage.getItem("tidelight-tide-bottom"));
        if (Number.isFinite(oldBottom) && oldBottom > 0) restored.y = bounds.maxY;
      }
    } catch { /* Invalid saved placement falls back to the lower-right corner. */ }
    restored = clampPosition(restored);
    const timer = window.setTimeout(() => { positionRef.current = restored; setPosition(restored); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function saveConversation(nextMessages: Message[], updatedAt: number) {
    if (!nextMessages.length) return;
    const title = nextMessages.find((item) => item.role === "user")?.content.slice(0, 64) || "Tide conversation";
    const currentId = conversationIdRef.current === "new" ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48) || "tide-conversation" : conversationIdRef.current;
    conversationIdRef.current = currentId;
    const next: Conversation = { id: currentId, title, updatedAt, messages: nextMessages.slice(-24) };
    const rest = conversations.filter((item) => item.id !== currentId);
    const updated = [next, ...rest].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
    setConversations(updated);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }

  function selectConversation(conversation: Conversation) {
    conversationIdRef.current = conversation.id;
    setMessages(conversation.messages);
    setHistoryOpen(false);
    setOpen(true);
  }

  function startConversation() {
    conversationIdRef.current = "new";
    setMessages([]);
    setHistoryOpen(false);
    setError("");
    setOpen(true);
  }

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    const closeGuide = () => { setOpen(false); setHistoryOpen(false); };
    const openGuide = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: unknown }>).detail?.prompt;
      if (typeof prompt === "string") setDraft(prompt.slice(0, 800));
      setHistoryOpen(false);
      setOpen(true);
    };
    window.addEventListener("tidelight:close-guide", closeGuide);
    window.addEventListener("tidelight:open-guide", openGuide);
    return () => { window.removeEventListener("tidelight:close-guide", closeGuide); window.removeEventListener("tidelight:open-guide", openGuide); };
  }, []);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, open, intelligence.result, intelligence.stages.length]);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    const clamp = () => {
      const current = positionRef.current;
      if (!current) return;
      const bounded = clampPosition(current);
      positionRef.current = bounded;
      setPosition(bounded);
    };
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);
  function startDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = viewportBounds();
    const origin = positionRef.current ?? { x: bounds.maxX, y: bounds.maxY };
    dragRef.current = { startX: event.clientX, startY: event.clientY, originX: origin.x, originY: origin.y };
    draggedRef.current = false;
  }
  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return;
    if (Math.hypot(event.clientX - dragRef.current.startX, event.clientY - dragRef.current.startY) > 5) draggedRef.current = true;
    const next = clampPosition({ x: dragRef.current.originX + event.clientX - dragRef.current.startX, y: dragRef.current.originY + event.clientY - dragRef.current.startY });
    positionRef.current = next;
    setPosition(next);
  }
  function endDrag() {
    if (dragRef.current && positionRef.current) window.localStorage.setItem("tidelight-tide-position", JSON.stringify(positionRef.current));
    dragRef.current = null;
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/auth/")) return null;

  async function ask(question: string, updatedAt: number) {
    const text = question.trim();
    if (!text || busy || text.length > 800) return;
    setOpen(true);
    setDraft("");
    setError("");
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    saveConversation(nextMessages, updatedAt);
    setBusy(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch("/api/support", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, pathname, history }), signal: controller.signal });
      const result: { answer?: string; links?: Resource[]; source?: "knowledge" | "ai"; error?: string } = await response.json();
      if (!response.ok || !result.answer) throw new Error(result.error || "The guide is unavailable right now. Please try again.");
      const completed = [...nextMessages, { role: "assistant" as const, content: result.answer!, links: result.links ?? [], source: result.source }];
      setMessages(completed);
      saveConversation(completed, updatedAt);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "The guide is unavailable right now. Please try again.");
    } finally {
      setBusy(false);
      requestRef.current = null;
    }
  }

  function pageContext() {
    const url = new URL(window.location.href);
    const symbol = url.searchParams.get("symbol")?.toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 24);
    const context = `${url.pathname}${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ""}`;
    const page = url.pathname.split("/").filter(Boolean).map((part) => {
      try { return decodeURIComponent(part).replace(/[-_]/g, " "); }
      catch { return part.replace(/[-_]/g, " "); }
    }).join(" · ") || "Tidelight workspace";
    return { context, page: symbol ? `${page} · ${symbol}` : page };
  }

  async function research(question: string) {
    const text = question.trim();
    if (!text || intelligence.busy || text.length > 500) return;
    setView("research");
    setDraft("");
    setError("");
    const contextRunId = intelligence.result?.researchRunId ?? null;
    const tickers = intelligence.result?.assets.map((asset) => asset.ticker) ?? [];
    const scopedQuestion = contextRunId && tickers.length ? `${tickers.join(" and ")} context: ${text}`.slice(0, 500) : text;
    const context = pageContext();
    await intelligence.start(scopedQuestion, contextRunId, context.context, false);
  }

  const viewportHeight = typeof window === "undefined" ? 844 : window.innerHeight;
  const opensDown = position ? position.y < viewportHeight / 2 : false;
  const viewportWidth = typeof window === "undefined" ? 390 : window.innerWidth;
  const panelWidth = Math.min(viewportWidth <= 600 ? 344 : 390, viewportWidth - 16);
  const panelOffset = position ? Math.max(8 - position.x, Math.min(74 - panelWidth / 2, viewportWidth - panelWidth - 8 - position.x)) : 0;
  const availableHeight = position ? Math.max(190, Math.min(600, viewportHeight - 32, opensDown ? viewportHeight - position.y - 64 : position.y - 20)) : Math.min(600, viewportHeight - 32);
  const widgetStyle = position ? { left: position.x, top: position.y, right: "auto", bottom: "auto", "--tide-panel-x": `${panelOffset}px`, "--tide-panel-available": `${availableHeight}px` } as CSSProperties : undefined;
  return <div className={`tide-guide${open ? " is-open" : ""}${opensDown ? " opens-down" : " opens-up"}`} style={widgetStyle}>
    {open ? <section className="tide-guide-panel" role="dialog" aria-modal="false" aria-label="Tide, Tidelight product guide">
      <header className="tide-guide-head"><span className="tide-guide-head-avatar"><TideGuideMark small /></span><div><span className="tide-guide-kicker">TIDELIGHT / YOUR GUIDE</span><h2>Tide <span className="tide-guide-online" aria-label="Available" /></h2><p>One question. A clearer next step.</p></div><div className="tide-guide-head-actions">{view === "guide" && messages.length ? <button type="button" onClick={startConversation} aria-label="Start a new Tide conversation" title="Start over">↺</button> : null}{view === "guide" ? <button type="button" onClick={() => setHistoryOpen((value) => !value)} aria-label="Show Tide conversation history" title="Conversation history">☷</button> : null}<button type="button" onClick={() => setOpen(false)} aria-label="Close Tide guide">×</button></div></header>
      <nav className="tide-guide-modes" aria-label="Tide workspace mode"><button type="button" className={view === "guide" ? "active" : ""} aria-pressed={view === "guide"} onClick={() => { setView("guide"); setHistoryOpen(false); }}>Guide</button><button type="button" className={view === "research" ? "active" : ""} aria-pressed={view === "research"} onClick={() => { setView("research"); setHistoryOpen(false); }}>Research</button></nav>
      {historyOpen ? <aside className="tide-guide-history" aria-label="Recent Tide conversations"><div className="tide-guide-history-head"><b>RECENT CONVERSATIONS</b><button type="button" onClick={startConversation}>New</button></div>{conversations.length ? conversations.map((conversation) => <button type="button" className="tide-guide-history-item" key={conversation.id} onClick={() => selectConversation(conversation)}><span>{conversation.title}</span><small>{historyDate(conversation.updatedAt)}</small></button>) : <p>No saved conversations yet.</p>}</aside> : null}
      {view === "guide" ? <div className="tide-guide-thread" role="log" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 ? <div className="tide-guide-welcome"><div className="tide-guide-portrait" aria-hidden="true"><span className="tide-guide-portrait-halo" /><TideGuideMark /><span className="tide-guide-portrait-signal">✦</span></div><span className="tide-guide-welcome-tag">YOUR RESEARCH COPILOT</span><h3>Find your way through the signal.</h3><p>Ask me how Tidelight works, troubleshoot a step, or let me guide you across the desk. I can find the right product docs, explain a workflow, or crack a joke when the market needs one.</p><div className="tide-guide-prompts"><span>START WITH A QUESTION</span>{suggestions.map((prompt) => <button key={prompt} type="button" onClick={() => void ask(prompt, Date.now())}>{prompt}<span>↗</span></button>)}</div></div> : messages.map((message, index) => <div className={`tide-guide-message ${message.role}`} key={index}><span className="tide-guide-speaker">{message.role === "assistant" ? `TIDE · ${message.source === "ai" ? "AI ASSISTED" : "VERIFIED GUIDE"}` : "YOU"}</span>{message.role === "assistant" ? <TypingReply text={message.content} /> : <p>{message.content}</p>}{message.links?.length ? <div className="tide-guide-resources">{message.links.map((link) => link.href.startsWith("/") ? <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label} ↗</Link> : <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</div> : null}</div>)}
        {busy ? <div className="tide-guide-working"><span /><span /><span /><span>Checking the guide…</span></div> : null}
        <div ref={endRef} />
      </div> : <div className="tide-guide-thread tide-guide-research" role="region" aria-label="Tidelight research workspace">
        {intelligence.result ? <div className="intelligent-overview"><div className="tide-guide-research-heading"><span className="tide-guide-welcome-tag">GENERATED FROM VALIDATED RESEARCH DATA</span><h3>{intelligence.result.question}</h3><p>Research opened from {intelligence.result.workspaceContext ? intelligence.result.workspaceContext.split("?")[0].replace(/^\//, "").replace(/[-_/]/g, " · ") : pageContext().page}. Evidence and gates are attached below.</p></div><div className="iu-composed-workspace" aria-label="Validated generated research workspace">{composeIntelligenceBlocks(intelligence.result).map((block) => <RegistryBlock key={block.id} block={block} result={intelligence.result!} mode={experienceMode}/>)}</div></div> : intelligence.busy ? <div className="tide-guide-research-progress"><span className="tide-guide-welcome-tag">RESEARCH IN PROGRESS</span><h3>Following the evidence.</h3><p>{intelligence.question}</p><ol>{intelligence.stages.slice(-6).map((stage) => <li key={stage.id} className={`activity-${stage.status}`}><i>{stage.status === "complete" ? "✓" : stage.status === "blocked" ? "!" : "·"}</i><span><b>{stage.agent}{stage.asset ? ` · ${stage.asset}` : ""}</b><small>{stage.title}</small></span></li>)}</ol><small>Operational checkpoints only. Private model reasoning is not displayed.</small></div> : <div className="tide-guide-welcome"><div className="tide-guide-orbit"><TidelightAnimatedMark /></div><span className="tide-guide-welcome-tag">SOURCE-FIRST MARKET RESEARCH</span><h3>Research from anywhere in your desk.</h3><p>Ask a question about a supported US stock. Tidelight will gather public evidence, check Bitget market data, show risks and operational gates, then offer relevant next steps.</p><div className="tide-guide-prompts"><span>THIS WORKSPACE</span><button type="button" onClick={() => { const { context, page } = pageContext(); const ticker = context.match(/(?:symbol=|\/)(?:R)?(NVDA|TSLA|AAPL|AMD|MSFT|META|AMZN|GOOGL|INTC|ASML|QCOM|MU)/i)?.[1]; void research(page.toLowerCase().includes("market") && ticker ? `Review the latest evidence and risks for ${ticker}` : "Compare NVDA and TSLA using recent evidence and outline the main risks"); }}>{pageContext().page}<span>↗</span></button></div><p className="tide-guide-research-limit">The current agent flow covers up to three supported US stock underlyings. Page context can preselect a symbol; it does not read private page data or portfolio exposure.</p></div>}
      </div>}
      {view === "guide" && error ? <p className="tide-guide-error" role="alert">{error}</p> : null}
      {view === "research" && intelligence.error ? <p className="tide-guide-error" role="alert">{intelligence.error}</p> : null}
      <form className="tide-guide-composer" onSubmit={(event) => { event.preventDefault(); if (view === "research") void research(draft); else void ask(draft, Date.now()); }}><label htmlFor="tide-guide-question" className="sr-only">{view === "research" ? "Ask the Tidelight research agents" : "Ask Tide a question"}</label><input id="tide-guide-question" ref={inputRef} value={draft} maxLength={view === "research" ? 500 : 800} onChange={(event) => setDraft(event.target.value)} placeholder={view === "research" ? "Ask about a supported market…" : "Ask about Tidelight…"} disabled={view === "research" ? intelligence.busy : busy} /><button type="submit" disabled={!draft.trim() || (view === "research" ? intelligence.busy : busy)} aria-label="Send question">↗</button></form>
      <small className="tide-guide-note">{view === "research" ? "Research interpretation, not a trade instruction. All trading actions require your review." : "Product guidance. Check sources and confirm trading choices yourself."}</small>
    </section> : null}
    <button ref={launcherRef} type="button" className="tide-guide-launcher" aria-label={open ? "Close Tide guide" : "Ask Tide for help"} aria-expanded={open} aria-describedby="tide-guide-move-hint" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={() => { if (draggedRef.current) { draggedRef.current = false; return; } if (!open) window.dispatchEvent(new Event("tidelight:close-navigation")); setOpen((previous) => !previous); }}><TideGuideMark /><span>{open ? "Close guide" : "Ask Tide"}</span><i aria-hidden="true">⋮⋮</i></button><span id="tide-guide-move-hint" className="sr-only">Drag this button anywhere on the screen to move it.</span>
  </div>;
}
