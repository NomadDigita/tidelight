"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [method, setMethod] = useState<"link" | "code" | "password">("link");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const passkeysEnabled = process.env.NEXT_PUBLIC_SUPABASE_PASSKEYS_ENABLED === "true";
  // Numeric codes require an email template that renders {{ .Token }}. Keep this
  // hidden until that template is configured so users are never sent a link-only email.
  const emailCodesEnabled = process.env.NEXT_PUBLIC_SUPABASE_EMAIL_OTP_ENABLED === "true";

  async function signInWithPasskey() {
    if (!("credentials" in navigator)) { setError("This browser does not support passkeys. Try email or password instead."); return; }
    setPasskeyBusy(true); setError("");
    try {
      const { error: passkeyError } = await createClient().auth.signInWithPasskey();
      if (passkeyError) setError("Passkey sign-in could not be completed. Check the passkey provider setup or choose another sign-in method.");
      else { const client = createClient(); const { data: { user } } = await client.auth.getUser(); if (user) await client.from("security_events").insert({ user_id: user.id, event_type: "passkey_signin", metadata: {} }); router.replace("/"); router.refresh(); }
    } catch {
      setError("Passkey sign-in is unavailable on this device or provider setup. Choose another sign-in method.");
    } finally { setPasskeyBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      if (method === "code" && codeSent) {
        const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
        if (verifyError) throw verifyError;
        router.replace("/");
        router.refresh();
        return;
      }
      const authError = method === "link" || method === "code"
        ? (await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })).error
        : isSignUp
          ? (await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })).error
          : (await supabase.auth.signInWithPassword({ email, password })).error;
      if (authError) throw authError;
      if (method === "code") setCodeSent(true);
      else if (method === "link" || isSignUp) setSent(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(method === "code"
        ? (codeSent ? "That code could not be verified. Check it and try again." : "We couldn't send a sign-in code. Try again or use an email link.")
        : method === "link"
          ? "We couldn't send a sign-in link. Check your email address and try again."
          : message || "We couldn't complete sign-in. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page"><section className="auth-card">
    <Link className="auth-brand" href="/"><Image src="/tidelight-mark.svg" alt="" width={42} height={42} /><span>tidelight<small>MARKET RESEARCH DESK</small></span></Link>
    {sent ? <><div className="auth-eyebrow">CHECK YOUR INBOX</div><h1>{isSignUp ? "Confirm your account." : "Your link is on its way."}</h1><p>We sent the next secure step to <b>{email}</b>. Open it on this device to continue.</p><button className="auth-secondary" onClick={() => setSent(false)}>Use a different method</button></> : codeSent ? <><div className="auth-eyebrow">CHECK YOUR INBOX</div><h1>Enter your sign-in code.</h1><p>We sent a one-time code to <b>{email}</b>. It expires soon and can only be used once.</p><form onSubmit={submit} className="auth-form"><label htmlFor="email-code">Email verification code</label><input id="email-code" type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={12} value={code} onChange={event => setCode(event.target.value)} placeholder="Enter your code" /><button type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify and sign in"}<span>↗</span></button>{error ? <div className="form-error" role="alert">{error}</div> : null}<button type="button" className="auth-secondary auth-toggle" onClick={() => { setCodeSent(false); setCode(""); setError(""); }}>Use a different sign-in method</button></form></> : <><div className="auth-eyebrow">YOUR PRIVATE RESEARCH DESK</div><h1>{isSignUp ? "Create your workspace." : "Welcome back."}</h1><p>Sign in to keep your watchlist, briefs, and paper ledger together.</p><button type="button" className="auth-google" onClick={async () => { setError(""); const { error: authError } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } }); if (authError) setError("Google sign-in is not enabled in the authentication provider yet. Use email sign-in while the Google OAuth client is configured."); }}>Continue with Google <span>↗</span></button>{passkeysEnabled ? <button type="button" className="auth-google auth-passkey" disabled={passkeyBusy} onClick={() => void signInWithPasskey()}>{passkeyBusy ? "Waiting for your passkey…" : "Continue with a passkey"}<span>⌁</span></button> : <p className="auth-passkey-note">Passkey sign-in is ready for this app and will appear here after Supabase Auth is configured.</p>}<div className="auth-divider"><span>or</span></div><div className={`auth-methods${emailCodesEnabled ? " auth-methods-with-code" : ""}`}><button type="button" className={method === "link" ? "selected" : ""} onClick={() => { setMethod("link"); setError(""); }}>Email link</button>{emailCodesEnabled ? <button type="button" className={method === "code" ? "selected" : ""} onClick={() => { setMethod("code"); setError(""); }}>Email code</button> : null}<button type="button" className={method === "password" ? "selected" : ""} onClick={() => { setMethod("password"); setError(""); }}>Password</button></div><form onSubmit={submit} className="auth-form"><label htmlFor="email">Email address</label><input id="email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" />{method === "password" ? <label htmlFor="password">Password<input id="password" type="password" required minLength={8} autoComplete={isSignUp ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /></label> : null}<button type="submit" disabled={busy}>{busy ? "Working…" : method === "link" ? "Continue with email" : method === "code" ? "Send sign-in code" : isSignUp ? "Create account" : "Sign in with password"}<span>↗</span></button>{method === "password" ? <button type="button" className="auth-secondary auth-toggle" onClick={() => setIsSignUp(!isSignUp)}>{isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}</button> : null}{error ? <div className="form-error" role="alert">{error}</div> : null}</form></>}
    <Link className="auth-back" href="/">← Back to Tidelight</Link>
  </section></main>;
}
