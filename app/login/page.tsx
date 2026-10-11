"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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
  const [recovering, setRecovering] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryComplete, setRecoveryComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const passkeysEnabled = process.env.NEXT_PUBLIC_SUPABASE_PASSKEYS_ENABLED === "true";
  const googleEnabled = process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED === "true";
  // Numeric codes require an email template that renders {{ .Token }}. Keep this
  // hidden until that template is configured so users are never sent a link-only email.
  const emailCodesEnabled = process.env.NEXT_PUBLIC_SUPABASE_EMAIL_OTP_ENABLED === "true";

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("recovery") !== "1") return;
    const timer = window.setTimeout(() => { setRecovering(true); setMethod("password"); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
      if (recovering) {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) throw passwordError;
        setRecovering(false); setPassword(""); setRecoveryComplete(true); router.replace("/login"); return;
      }
      if (method === "code" && codeSent) {
        const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
        if (verifyError) throw verifyError;
        const isNew = verified.user?.created_at && Date.now() - Date.parse(verified.user.created_at) < 10 * 60 * 1000;
        router.replace(isNew ? "/settings?setup=username#profile" : "/");
        router.refresh();
        return;
      }
      // Numeric email OTP verification stays on this page. Supplying a redirect URL
      // here makes Supabase validate it against the Auth redirect allow-list even
      // though the user never follows a magic link, which can reject code requests.
      const authResult = method === "code"
        ? (await supabase.auth.signInWithOtp({ email })).error
        : method === "link"
          ? (await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })).error
          : isSignUp
            ? (await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })).error
            : await supabase.auth.signInWithPassword({ email, password });
      const authError = authResult && typeof authResult === "object" && "error" in authResult ? authResult.error : authResult;
      if (authError) throw authError;
      if (method === "code") setCodeSent(true);
      else if (method === "link" || isSignUp) setSent(true);
      else { router.replace("/"); router.refresh(); }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const normalized = message.toLowerCase();
      setError(method === "code"
        ? codeSent
          ? normalized.includes("expired")
            ? "That code has expired. Request a new code and try again."
            : "That code could not be verified. Check the 8 digits and try again."
          : normalized.includes("rate limit") || normalized.includes("too many")
            ? "Too many code requests. Wait a minute before requesting another one."
            : normalized.includes("redirect") || normalized.includes("not allowed")
              ? "Supabase rejected the auth redirect. Check the production URL in Supabase Auth → URL Configuration."
              : normalized.includes("sending") || normalized.includes("smtp") || normalized.includes("email")
                ? "Supabase Auth could not send the email. Check Auth → SMTP Settings, the sender address, and the OTP email template."
                : `We couldn't send a sign-in code${message ? ` (${message.slice(0, 120)})` : ""}. Try again or use an email link.`
        : method === "link"
          ? "We couldn't send a sign-in link. Check your email address and try again."
          : message || "We couldn't complete sign-in. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset() {
    setError("");
    if (!email.trim()) { setError("Enter your email address first so we know where to send the secure reset link."); return; }
    setBusy(true);
    try {
      const next = encodeURIComponent("/login?recovery=1");
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=${next}` });
      if (resetError) throw resetError;
      setRecoverySent(true);
    } catch { setError("We couldn’t send a password reset link. Check your email address and Supabase Auth email settings, then try again."); }
    finally { setBusy(false); }
  }

  return <main className="auth-page"><section className="auth-card">
    <Link className="auth-brand" href="/"><Image src="/tidelight-mark.svg" alt="" width={42} height={42} /><span>tidelight<small>MARKET RESEARCH DESK</small></span></Link>
    {recoverySent ? <><div className="auth-eyebrow">CHECK YOUR INBOX</div><h1>Reset link sent.</h1><p>If an account exists for <b>{email}</b>, Supabase will send a secure password reset link. Open it on this device to choose a new password.</p><button className="auth-secondary" onClick={() => setRecoverySent(false)}>Back to sign in</button></> : recoveryComplete ? <><div className="auth-eyebrow">PASSWORD UPDATED</div><h1>You’re all set.</h1><p>Your password has been changed. Sign in with your new password to continue.</p><button className="auth-secondary" onClick={() => { setRecoveryComplete(false); setMethod("password"); }}>Sign in</button></> : recovering ? <><div className="auth-eyebrow">SECURE ACCOUNT RECOVERY</div><h1>Choose a new password.</h1><p>Use at least eight characters. This change only updates your Tidelight sign-in.</p><form onSubmit={submit} className="auth-form"><label htmlFor="password">New password<input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /></label><button type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}<span>↗</span></button>{error ? <div className="form-error" role="alert">{error}</div> : null}</form></> : sent ? <><div className="auth-eyebrow">CHECK YOUR INBOX</div><h1>{isSignUp ? "Confirm your account." : "Your link is on its way."}</h1><p>We sent the next secure step to <b>{email}</b>. Open it on this device to continue.</p><button className="auth-secondary" onClick={() => setSent(false)}>Use a different method</button></> : codeSent ? <><div className="auth-eyebrow">CHECK YOUR INBOX</div><h1>Enter your 8-digit code.</h1><p>We sent a one-time code to <b>{email}</b>. It expires in 10 minutes and can only be used once.</p><form onSubmit={submit} className="auth-form"><label htmlFor="email-code">Email verification code</label><input id="email-code" type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={8} pattern="[0-9]{8}" title="Enter the 8-digit code from your email" value={code} onChange={event => setCode(event.target.value)} placeholder="8-digit code" /><button type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify and sign in"}<span>↗</span></button>{error ? <div className="form-error" role="alert">{error}</div> : null}<button type="button" className="auth-secondary auth-toggle" onClick={() => { setCodeSent(false); setCode(""); setError(""); }}>Use a different sign-in method</button></form></> : <><div className="auth-eyebrow">YOUR PRIVATE RESEARCH DESK</div><h1>{isSignUp ? "Create your workspace." : "Welcome back."}</h1><p>{method === "code" ? "Enter your email to sign in or create an account with a one-time code." : "Sign in to keep your watchlist, briefs, and paper ledger together."}</p>{googleEnabled ? <button type="button" className="auth-google" onClick={async () => { setError(""); const { error: authError } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } }); if (authError) setError("Google sign-in could not start. Use email sign-in or check the provider setup."); }}>Continue with Google <span>↗</span></button> : <p className="auth-provider-note">Google sign-in is being configured. Email links are available while OAuth is set up.</p>}{passkeysEnabled ? <button type="button" className="auth-google auth-passkey" disabled={passkeyBusy} onClick={() => void signInWithPasskey()}>{passkeyBusy ? "Waiting for your passkey…" : "Continue with a passkey"}<span>⌁</span></button> : <p className="auth-passkey-note">Passkey sign-in is currently off. It will appear once Supabase Auth enables WebAuthn for tidelight.app.</p>}<div className="auth-divider"><span>or</span></div><div className={`auth-methods${emailCodesEnabled ? " auth-methods-with-code" : ""}`}><button type="button" className={method === "link" ? "selected" : ""} onClick={() => { setMethod("link"); setError(""); }}>Email link</button>{emailCodesEnabled ? <button type="button" className={method === "code" ? "selected" : ""} onClick={() => { setMethod("code"); setError(""); }}>Email code</button> : null}<button type="button" className={method === "password" ? "selected" : ""} onClick={() => { setMethod("password"); setError(""); }}>Password</button></div>{!emailCodesEnabled ? <p className="auth-provider-note">Email codes appear after a sending service and code template are configured.</p> : null}<form onSubmit={submit} className="auth-form"><label htmlFor="email">Email address</label><input id="email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" />{method === "password" ? <label htmlFor="password">Password<input id="password" type="password" required minLength={8} autoComplete={isSignUp ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /></label> : null}<button type="submit" disabled={busy}>{busy ? "Working…" : method === "link" ? "Continue with email" : method === "code" ? "Send email code" : isSignUp ? "Create account" : "Sign in with password"}<span>↗</span></button>{method === "password" ? <><button type="button" className="auth-secondary auth-toggle" onClick={() => setIsSignUp(!isSignUp)}>{isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}</button>{!isSignUp ? <button type="button" className="auth-secondary auth-toggle" onClick={() => void requestPasswordReset()} disabled={busy}>Forgot password? Send a reset link</button> : null}</> : null}{error ? <div className="form-error" role="alert">{error}</div> : null}</form></>}
    <div className="auth-legal-links"><Link href="/terms">Terms of Service</Link><Link href="/privacy">Privacy Policy</Link></div>
    <Link className="auth-back" href="/">← Back to Tidelight</Link>
  </section></main>;
}
