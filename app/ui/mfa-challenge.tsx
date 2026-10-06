"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MfaChallenge({ onVerified, context = "nightwatch_control" }: { onVerified: () => void; context?: string }) {
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function verify() {
    if (!/^\d{6}$/.test(code)) { setError("Enter the six-digit authenticator code."); return; }
    setBusy(true); setError(""); const client = createClient(); const factors = await client.auth.mfa.listFactors(); const factor = factors.data?.totp.find((item) => item.status === "verified");
    if (!factor) { setError("No verified authenticator was found."); setBusy(false); return; }
    const challenge = await client.auth.mfa.challenge({ factorId: factor.id });
    if (challenge.error) { setError(challenge.error.message); setBusy(false); return; }
    const result = await client.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.data.id, code });
    if (result.error) setError(result.error.message); else {
      const { data: { user } } = await client.auth.getUser();
      if (user) await client.from("security_events").insert({ user_id: user.id, event_type: "mfa_verified", metadata: { factor_type: "totp", context } });
      onVerified();
    }
    setBusy(false);
  }
  return <div className="mfa-challenge" role="dialog" aria-label="Verify authenticator"><div><span className="eyebrow small-eyebrow">STEP-UP SECURITY</span><h3>Confirm it’s you.</h3><p>This action needs your authenticator code before it can continue.</p></div><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000"/><button type="button" onClick={() => void verify()} disabled={busy}>{busy ? "Checking…" : "Verify and continue"}</button>{error ? <small className="action-error">{error}</small> : null}</div>;
}
