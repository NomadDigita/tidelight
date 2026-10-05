"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [method, setMethod] = useState<"link" | "password">("link");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const authError = method === "link"
        ? (await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })).error
        : isSignUp
          ? (await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })).error
          : (await supabase.auth.signInWithPassword({ email, password })).error;
      if (authError) throw authError;
      if (method === "link" || isSignUp) setSent(true);
    } catch {
      setError("We couldn't send a sign-in link. Check your email address and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-card">
    <Link className="auth-brand" href="/"><Image src="/tidelight-mark.svg" alt="" width={42} height={42} /><span>tidelight<small>MARKET RESEARCH DESK</small></span></Link>
    {sent ? <><div className="auth-eyebrow">CHECK YOUR INBOX</div><h1>{isSignUp ? "Confirm your account." : "Your link is on its way."}</h1><p>We sent the next secure step to <b>{email}</b>. Open it on this device to continue.</p><button className="auth-secondary" onClick={() => setSent(false)}>Use a different method</button></> : <><div className="auth-eyebrow">YOUR PRIVATE RESEARCH DESK</div><h1>{isSignUp ? "Create your workspace." : "Welcome back."}</h1><p>Sign in to keep your watchlist, briefs, and paper ledger together.</p><button type="button" className="auth-google" onClick={async () => { const supabase = createClient(); const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } }); if (authError) setError("Google sign-in is not available on this deployment yet."); }}>Continue with Google <span>↗</span></button><div className="auth-divider"><span>or</span></div><div className="auth-methods"><button type="button" className={method === "link" ? "selected" : ""} onClick={() => setMethod("link")}>Email link</button><button type="button" className={method === "password" ? "selected" : ""} onClick={() => setMethod("password")}>Password</button></div><form onSubmit={submit} className="auth-form"><label htmlFor="email">Email address</label><input id="email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" />{method === "password" ? <label htmlFor="password">Password<input id="password" type="password" required minLength={8} autoComplete={isSignUp ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /></label> : null}<button type="submit" disabled={busy}>{busy ? "Working…" : method === "link" ? "Continue with email" : isSignUp ? "Create account" : "Sign in with password"}<span>↗</span></button>{method === "password" ? <button type="button" className="auth-secondary auth-toggle" onClick={() => setIsSignUp(!isSignUp)}>{isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}</button> : null}{error ? <div className="form-error" role="alert">{error}</div> : null}</form></>}
    <Link className="auth-back" href="/">← Back to Tidelight</Link>
  </section></main>;
}
