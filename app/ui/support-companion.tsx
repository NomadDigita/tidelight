"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";

type Resource = { label: string; href: string };
type Message = { role: "user" | "assistant"; content: string; links?: Resource[]; source?: "knowledge" | "ai" };
type Conversation = { id: string; title: string; updatedAt: number; messages: Message[] };
const HISTORY_KEY = "tidelight-tide-history";

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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string>("new");
  const dragRef = useRef<{ startY: number; origin: number } | null>(null);
  const bottomRef = useRef(16);
  const draggedRef = useRef(false);
  const [bottom, setBottom] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const value = Number(window.localStorage.getItem("tidelight-tide-bottom"));
    return Number.isFinite(value) ? Math.max(12, Math.min(value, Math.max(12, window.innerHeight - 92))) : null;
  });
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

  function saveConversation(nextMessages: Message[]) {
    if (!nextMessages.length) return;
    const title = nextMessages.find((item) => item.role === "user")?.content.slice(0, 64) || "Tide conversation";
    const currentId = conversationIdRef.current === "new" ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48) || "tide-conversation" : conversationIdRef.current;
    conversationIdRef.current = currentId;
    const next: Conversation = { id: currentId, title, updatedAt: nextMessages.length, messages: nextMessages.slice(-24) };
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
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, open]);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => { if (bottom !== null) bottomRef.current = bottom; }, [bottom]);
  function startDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startY: event.clientY, origin: bottomRef.current };
    draggedRef.current = false;
  }
  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return;
    if (Math.abs(event.clientY - dragRef.current.startY) > 4) draggedRef.current = true;
    const next = Math.max(12, Math.min(dragRef.current.origin - (event.clientY - dragRef.current.startY), Math.max(12, window.innerHeight - 80)));
    bottomRef.current = next;
    setBottom(next);
  }
  function endDrag() {
    if (dragRef.current) window.localStorage.setItem("tidelight-tide-bottom", String(bottomRef.current));
    dragRef.current = null;
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/auth/")) return null;

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy || text.length > 800) return;
    setOpen(true);
    setDraft("");
    setError("");
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    saveConversation(nextMessages);
    setBusy(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch("/api/support", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, pathname, history }), signal: controller.signal });
      const result: { answer?: string; links?: Resource[]; source?: "knowledge" | "ai"; error?: string } = await response.json();
      if (!response.ok || !result.answer) throw new Error(result.error || "The guide is unavailable right now. Please try again.");
      const completed = [...nextMessages, { role: "assistant" as const, content: result.answer!, links: result.links ?? [], source: result.source }];
      setMessages(completed);
      saveConversation(completed);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "The guide is unavailable right now. Please try again.");
    } finally {
      setBusy(false);
      requestRef.current = null;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void ask(draft); }

  return <div className={`tide-guide${open ? " is-open" : ""}`} style={bottom === null ? undefined : { bottom }}>
    {open ? <section className="tide-guide-panel" role="dialog" aria-modal="false" aria-label="Tide, Tidelight product guide">
      <header className="tide-guide-head"><span className="tide-guide-head-avatar"><TideGuideMark small /></span><div><span className="tide-guide-kicker">TIDELIGHT / YOUR GUIDE</span><h2>Tide <span className="tide-guide-online" aria-label="Available" /></h2><p>One question. A clearer next step.</p></div><div className="tide-guide-head-actions">{messages.length ? <button type="button" onClick={startConversation} aria-label="Start a new Tide conversation" title="Start over">↺</button> : null}<button type="button" onClick={() => setHistoryOpen((value) => !value)} aria-label="Show Tide conversation history" title="Conversation history">☷</button><button type="button" onClick={() => setOpen(false)} aria-label="Close Tide guide">×</button></div></header>
      {historyOpen ? <aside className="tide-guide-history" aria-label="Recent Tide conversations"><div className="tide-guide-history-head"><b>RECENT CONVERSATIONS</b><button type="button" onClick={startConversation}>New</button></div>{conversations.length ? conversations.map((conversation) => <button type="button" className="tide-guide-history-item" key={conversation.id} onClick={() => selectConversation(conversation)}><span>{conversation.title}</span><small>{new Date(conversation.updatedAt).toLocaleDateString()}</small></button>) : <p>No saved conversations yet.</p>}</aside> : null}
      <div className="tide-guide-thread" role="log" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 ? <div className="tide-guide-welcome"><div className="tide-guide-portrait" aria-hidden="true"><span className="tide-guide-portrait-halo" /><TideGuideMark /><span className="tide-guide-portrait-signal">✦</span></div><span className="tide-guide-welcome-tag">YOUR RESEARCH COPILOT</span><h3>Find your way through the signal.</h3><p>Ask me how Tidelight works, troubleshoot a step, or let me guide you across the desk. I can reason with the product guide and show where to go next.</p><div className="tide-guide-prompts"><span>START WITH A QUESTION</span>{suggestions.map((prompt) => <button key={prompt} type="button" onClick={() => void ask(prompt)}>{prompt}<span>↗</span></button>)}</div></div> : messages.map((message, index) => <div className={`tide-guide-message ${message.role}`} key={index}><span className="tide-guide-speaker">{message.role === "assistant" ? `TIDE · ${message.source === "ai" ? "AI ASSISTED" : "VERIFIED GUIDE"}` : "YOU"}</span>{message.role === "assistant" ? <TypingReply text={message.content} /> : <p>{message.content}</p>}{message.links?.length ? <div className="tide-guide-resources">{message.links.map((link) => link.href.startsWith("/") ? <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label} ↗</Link> : <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</div> : null}</div>)}
        {busy ? <div className="tide-guide-working"><span /><span /><span /><span>Checking the guide…</span></div> : null}
        <div ref={endRef} />
      </div>
      {error ? <p className="tide-guide-error" role="alert">{error}</p> : null}
      <form className="tide-guide-composer" onSubmit={submit}><label htmlFor="tide-guide-question" className="sr-only">Ask Tide a question</label><input id="tide-guide-question" ref={inputRef} value={draft} maxLength={800} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about Tidelight…" disabled={busy} /><button type="submit" disabled={busy || !draft.trim()} aria-label="Send question">↗</button></form>
      <small className="tide-guide-note">Product guidance. Check sources and confirm trading choices yourself.</small>
    </section> : null}
    <button type="button" className="tide-guide-launcher" aria-label={open ? "Close Tide guide" : "Ask Tide for help"} aria-expanded={open} aria-describedby="tide-guide-move-hint" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={() => { if (draggedRef.current) { draggedRef.current = false; return; } setOpen((previous) => !previous); }}><TideGuideMark /><span>{open ? "Close guide" : "Ask Tide"}</span><i aria-hidden="true">⋮⋮</i></button><span id="tide-guide-move-hint" className="sr-only">Drag this button up or down to move it.</span>
  </div>;
}
