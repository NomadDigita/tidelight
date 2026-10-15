"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

const QUICK_ACTIONS_POSITION_KEY = "tidelight-quick-actions-position-v1";

export default function ProductQuickActions() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const requestId = useRef(crypto.randomUUID());

  useEffect(() => {
    let timer = 0;
    try {
      const saved = window.localStorage.getItem(QUICK_ACTIONS_POSITION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { left?: unknown; top?: unknown };
        if (typeof parsed.left === "number" && typeof parsed.top === "number") {
          timer = window.setTimeout(() => setPosition({ left: Math.max(0, Math.min(parsed.left as number, window.innerWidth - 64)), top: Math.max(0, Math.min(parsed.top as number, window.innerHeight - 64)) }), 0);
        }
      }
    } catch { /* Ignore malformed saved positions. */ }
    return () => window.clearTimeout(timer);
  }, []);

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button") === null) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: bounds.left, top: bounds.top, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (!active.moved && Math.hypot(dx, dy) < 5) return;
    active.moved = true;
    suppressClick.current = true;
    const next = {
      left: Math.max(0, Math.min(active.left + dx, window.innerWidth - event.currentTarget.offsetWidth)),
      top: Math.max(0, Math.min(active.top + dy, window.innerHeight - event.currentTarget.offsetHeight)),
    };
    setPosition(next);
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.moved) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const next = { left: bounds.left, top: bounds.top };
      setPosition(next);
      try { window.localStorage.setItem(QUICK_ACTIONS_POSITION_KEY, JSON.stringify(next)); } catch { /* Keep the current position for this visit. */ }
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
    drag.current = null;
  }

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) triggerRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    messageRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, open]);

  if (pathname.startsWith("/login") || pathname.startsWith("/auth/")) return null;

  function askForHelp() {
    if (pathname === "/") window.dispatchEvent(new Event("tidelight:open-docs"));
    else window.dispatchEvent(new CustomEvent("tidelight:open-guide", { detail: { prompt: pathname.startsWith("/flow") ? "How does Agent Flow decide?" : "Help me understand this page." } }));
  }

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || message.trim().length < 8) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), replyTo: replyTo.trim(), page: pathname, requestId: requestId.current, company }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Feedback could not be sent.");
      setStatus("Thank you. Your note reached the Tidelight team.");
      setMessage("");
      setReplyTo("");
      setCompany("");
      requestId.current = crypto.randomUUID();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Feedback could not be sent. Please try again.");
    } finally { setBusy(false); }
  }

  function keepFocusInside(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not(.feedback-honeypot),textarea:not(:disabled)')];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  if (pathname === "/status") return null;
  return <>
    <nav
      className={`product-quick-actions${pathname === "/" ? " is-landing" : ""}${position ? " is-positioned" : ""}`}
      aria-label="Product help and feedback"
      title="Drag to move these controls"
      style={position ? { left: position.left, top: position.top, right: "auto", bottom: "auto" } : undefined}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}
    >
      <button ref={triggerRef} type="button" onClick={() => { setOpen(true); setStatus(""); }} aria-label="Share feedback" title="Share feedback"><span aria-hidden="true">💡</span></button>
      <button type="button" onClick={askForHelp} aria-label="Get help" title="Get help"><span aria-hidden="true">?</span></button>
    </nav>
    {open ? <div className="feedback-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title" aria-describedby="feedback-description" onKeyDown={keepFocusInside}>
        <header><div><span className="feedback-eyebrow">TIDELIGHT / YOUR VOICE</span><h2 id="feedback-title">Share feedback</h2></div><button type="button" className="feedback-close" onClick={() => setOpen(false)} disabled={busy} aria-label="Close feedback">×</button></header>
        <p id="feedback-description">Tell us what could be clearer, smoother, or more useful. Your message goes to the Tidelight team.</p>
        <form onSubmit={submitFeedback}>
          <label htmlFor="feedback-message">Your thoughts, ideas, or suggestions</label>
          <textarea ref={messageRef} id="feedback-message" value={message} onChange={(event) => setMessage(event.target.value)} minLength={8} maxLength={2000} rows={5} required placeholder="What would you like us to know?" disabled={busy} />
          <label htmlFor="feedback-reply">Email for a reply <span>Optional</span></label>
          <input id="feedback-reply" type="email" inputMode="email" autoComplete="email" maxLength={254} value={replyTo} onChange={(event) => setReplyTo(event.target.value)} placeholder="you@example.com" disabled={busy} />
          <input className="feedback-honeypot" type="text" name="company" autoComplete="off" tabIndex={-1} aria-hidden="true" value={company} onChange={(event) => setCompany(event.target.value)} />
          <footer><small>{message.length.toLocaleString()} / 2,000</small><div><button type="button" className="feedback-cancel" onClick={() => setOpen(false)} disabled={busy}>Cancel</button><button type="submit" className="feedback-send" disabled={busy || message.trim().length < 8}>{busy ? "Sending…" : "Send feedback"}</button></div></footer>
        </form>
        {status ? <p className={`feedback-status${status.startsWith("Thank you") ? " is-success" : ""}`} role="status" aria-live="polite">{status}</p> : null}
      </section>
    </div> : null}
  </>;
}
