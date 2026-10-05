"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name: string | null; status: string; factor_type: string };

export default function SecurityFactors() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [qrCode, setQrCode] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadFactors() {
    const { data, error: factorError } = await createClient().auth.mfa.listFactors();
    if (factorError) { setError("Multi-factor settings are not available yet."); return; }
    setFactors(data.all.filter((factor) => factor.status === "verified") as Factor[]);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadFactors(); }, []);

  async function beginEnrollment() {
    setBusy(true); setError(""); setMessage("");
    const { data, error: enrollError } = await createClient().auth.mfa.enroll({ factorType: "totp", friendlyName: "Tidelight authenticator" });
    if (enrollError || !data?.totp) { setError(enrollError?.message ?? "Could not start authenticator enrollment."); setBusy(false); return; }
    setFactorId(data.id); setQrCode(data.totp.qr_code); setBusy(false);
  }

  async function verifyEnrollment() {
    if (!factorId || !/^\d{6}$/.test(code)) { setError("Enter the six-digit code from your authenticator app."); return; }
    setBusy(true); setError("");
    const client = createClient();
    const challenge = await client.auth.mfa.challenge({ factorId });
    if (challenge.error) { setError(challenge.error.message); setBusy(false); return; }
    const verification = await client.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
    if (verification.error) setError(verification.error.message);
    else { setMessage("Authenticator protection is enabled."); setQrCode(""); setFactorId(""); setCode(""); await loadFactors(); }
    setBusy(false);
  }

  return <div className="security-factors"><div className="connection-row"><span><i className={factors.length ? "connected-dot" : "pending-dot"} /> Authenticator MFA</span><b>{factors.length ? "ENABLED" : "OPTIONAL"}</b></div>{factors.map((factor) => <small className="security-factor" key={factor.id}>{factor.friendly_name ?? "Authenticator app"} · verified</small>)}{qrCode ? <div className="mfa-enroll"><p>Scan this QR code with an authenticator app, then enter the six-digit code.</p>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={qrCode} alt="Authenticator enrollment QR code"/><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000"/><button type="button" onClick={() => void verifyEnrollment()} disabled={busy}>{busy ? "Verifying…" : "Verify authenticator"}</button></div> : <button type="button" className="auth-secondary security-enroll-button" onClick={() => void beginEnrollment()} disabled={busy}>{busy ? "Preparing…" : factors.length ? "Add another authenticator" : "Add authenticator MFA"}</button>}{message ? <p className="action-notice">{message}</p> : null}{error ? <p className="action-error">{error}</p> : null}<small className="settings-footnote">Authenticator codes are available now. Provider-dependent passkey setup is shown below.</small></div>;
}
