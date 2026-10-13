"use client";
import { useState } from "react";

export default function ProductRating() {
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating) { setStatus("Choose a star rating first."); return; }
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page: "/rate", message: `Site rating: ${rating}/5 stars\n\n${message.trim() || "No additional comment."}` }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Your rating could not be sent.");
      setStatus("Thank you. Your rating was sent privately to the Tidelight team."); setMessage("");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Your rating could not be sent. Please try again."); }
    finally { setBusy(false); }
  }
  return <form className="product-rating-form" onSubmit={submit}><fieldset><legend>Your rating</legend><div className="rating-stars">{[1,2,3,4,5].map(value => <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} star${value===1?"":"s"}`} aria-pressed={rating===value} className={value<=rating?"selected":""}>★</button>)}</div><small>{rating ? `${rating} out of 5` : "Select a rating"}</small></fieldset><label htmlFor="rate-comment">What should we improve? <span>(optional)</span></label><textarea id="rate-comment" maxLength={1800} value={message} onChange={event => setMessage(event.target.value)} placeholder="Tell us what worked well or what could be better."/><button className="primary-link" type="submit" disabled={busy}>{busy ? "Sending…" : "Send rating"}<span>↗</span></button><p role="status" className="rating-status">{status}</p></form>;
}
