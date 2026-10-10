"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Resource = { label: string; href: string };
type Message = { role: "user" | "assistant"; content: string; links?: Resource[]; source?: "knowledge" | "ai" };

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
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const suggestions = starts[Object.keys(starts).find((path) => pathname.startsWith(path)) ?? ""] ?? defaultStarts;

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy, open]);
  useEffect(() => () => requestRef.current?.abort(), []);

  if (pathname.startsWith("/login") || pathname.startsWith("/auth/")) return null;

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy || text.length > 800) return;
    setOpen(true);
    setDraft("");
    setError("");
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    setMessages((previous) => [...previous, { role: "user", content: text }]);
    setBusy(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch("/api/support", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, pathname, history }), signal: controller.signal });
      const result: { answer?: string; links?: Resource[]; source?: "knowledge" | "ai"; error?: string } = await response.json();
      if (!response.ok || !result.answer) throw new Error(result.error || "The guide is unavailable right now. Please try again.");
      setMessages((previous) => [...previous, { role: "assistant", content: result.answer!, links: result.links ?? [], source: result.source }]);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "The guide is unavailable right now. Please try again.");
    } finally {
      setBusy(false);
      requestRef.current = null;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void ask(draft); }

  return <div className={`tide-guide${open ? " is-open" : ""}`}>
    {open ? <section className="tide-guide-panel" role="dialog" aria-modal="false" aria-label="Tide, Tidelight product guide">
      <header className="tide-guide-head"><TideGuideMark small /><div><span className="tide-guide-kicker">TIDELIGHT / YOUR GUIDE</span><h2>Ask Tide</h2><p>Explore the desk, one step at a time.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close Tide guide">×</button></header>
      <div className="tide-guide-thread" role="log" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 ? <div className="tide-guide-welcome"><span className="tide-guide-orbit">✳</span><h3>Find your way through the signal.</h3><p>I can explain Tidelight, its research checks, paper trading, Bitget setup, and where to go next.</p><div className="tide-guide-prompts">{suggestions.map((prompt) => <button key={prompt} type="button" onClick={() => void ask(prompt)}>{prompt}<span>↗</span></button>)}</div></div> : messages.map((message, index) => <div className={`tide-guide-message ${message.role}`} key={index}><span className="tide-guide-speaker">{message.role === "assistant" ? `TIDE · ${message.source === "ai" ? "AI ASSISTED" : "PRODUCT GUIDE"}` : "YOU"}</span><p>{message.content}</p>{message.links?.length ? <div className="tide-guide-resources">{message.links.map((link) => link.href.startsWith("/") ? <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label} ↗</Link> : <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</div> : null}</div>)}
        {busy ? <div className="tide-guide-working"><span /><span /><span /><span>Checking the guide…</span></div> : null}
        <div ref={endRef} />
      </div>
      {error ? <p className="tide-guide-error" role="alert">{error}</p> : null}
      <form className="tide-guide-composer" onSubmit={submit}><label htmlFor="tide-guide-question" className="sr-only">Ask Tide a question</label><input id="tide-guide-question" ref={inputRef} value={draft} maxLength={800} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about Tidelight…" disabled={busy} /><button type="submit" disabled={busy || !draft.trim()} aria-label="Send question">↗</button></form>
      <small className="tide-guide-note">Product guidance. Check sources and confirm trading choices yourself.</small>
    </section> : null}
    <button type="button" className="tide-guide-launcher" aria-label={open ? "Close Tide guide" : "Ask Tide for help"} aria-expanded={open} onClick={() => setOpen((previous) => !previous)}><TideGuideMark /><span>{open ? "Close guide" : "Ask Tide"}</span></button>
  </div>;
}
