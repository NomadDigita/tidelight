"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authError) throw authError;
      setSent(true);
    } catch {
      setError("We couldn't send a sign-in link. Check your email address and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-card">
    <Link className="auth-brand" href="/"><Image src="/tidelight-mark.svg" alt="" width={42} height={42} /><span>tidelight<small>MARKET RESEARCH DESK</small></span></Link>
    {sent ? <><div className="auth-eyebrow">CHECK YOUR INBOX</div><h1>Your link is on its way.</h1><p>We sent a secure sign-in link to <b>{email}</b>. Open it on this device to continue.</p><button className="auth-secondary" onClick={() => setSent(false)}>Use a different email</button></> : <><div className="auth-eyebrow">YOUR PRIVATE RESEARCH DESK</div><h1>Welcome back.</h1><p>Sign in to keep your watchlist and saved research together.</p><form onSubmit={submit} className="auth-form"><label htmlFor="email">Email address</label><input id="email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /><button type="submit" disabled={busy}>{busy ? "Sending link…" : "Continue with email"}<span>↗</span></button>{error ? <div className="form-error" role="alert">{error}</div> : null}</form></>}
    <Link className="auth-back" href="/">← Back to Tidelight</Link>
  </section></main>;
}
