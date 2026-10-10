"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Passkey = { id: string; friendly_name?: string | null; created_at: string; last_used_at?: string | null };

export default function PasskeyControls({ enabled }: { enabled: boolean }) {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [secureContext, setSecureContext] = useState(false);

  async function refresh() {
    try {
      const { data, error: listError } = await createClient().auth.passkey.list();
      if (listError) { setError("Passkeys could not be loaded. Check that Supabase Auth passkeys are enabled."); return; }
      setPasskeys(data ?? []);
    } catch { setError("Passkeys could not be loaded. Check that Supabase Auth passkeys are enabled."); }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSecureContext(window.isSecureContext && "credentials" in navigator);
    if (enabled) void refresh();
  }, [enabled]);

  async function addPasskey() {
    setBusy(true); setMessage(""); setError("");
    try {
      const client = createClient();
      const { data, error: registerError } = await client.auth.registerPasskey();
      if (registerError) setError(registerError.message.includes("NotAllowed") ? "The passkey prompt was cancelled or timed out. You can try again." : "Passkey setup didn’t complete. Check provider activation and try again.");
      else { setPasskeys((items) => [...items, data]); const { data: { user } } = await client.auth.getUser(); if (user) await client.from("security_events").insert({ user_id: user.id, event_type: "passkey_registered", metadata: {} }); setMessage("Passkey added to this account."); }
    } catch { setError("Passkey setup didn’t complete. Check provider activation and try again."); }
    finally { setBusy(false); }
  }

  async function removePasskey(id: string) {
    if (passkeys.length === 1 && !window.confirm("This is your last passkey. You will need another sign-in method to access your account. Remove it?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const client = createClient();
      const { error: removeError } = await client.auth.passkey.delete({ passkeyId: id });
      if (removeError) setError("That passkey could not be removed. Please try again.");
      else { setPasskeys((items) => items.filter((item) => item.id !== id)); const { data: { user } } = await client.auth.getUser(); if (user) await client.from("security_events").insert({ user_id: user.id, event_type: "passkey_removed", metadata: {} }); setMessage("Passkey removed."); }
    } catch { setError("That passkey could not be removed. Please try again."); }
    finally { setBusy(false); }
  }

  if (!enabled) return <div className="passkey-readiness"><div className="passkey-readiness-status"><span className="pending-dot"/><div><b>Ready for WebAuthn · provider activation pending</b><small>This project’s Auth provider has not been confirmed as enabled from this session.</small></div></div><p>When enabling it in Supabase, use <b>Tidelight</b> as the display name, <code>tidelight.app</code> as the relying-party ID, and <code>https://tidelight.app</code> as the allowed origin. Then enable <code>NEXT_PUBLIC_SUPABASE_PASSKEYS_ENABLED=true</code> on the app and redeploy.</p><a href="https://supabase.com/dashboard/project/plmdnzbmvgigkzfmfwov/auth/passkeys" target="_blank" rel="noreferrer">Open Supabase Passkeys settings ↗</a></div>;

  return <div className="passkey-controls"><div className="connection-row"><span><i className={passkeys.length ? "connected-dot" : "pending-dot"}/> Passkeys on this account</span><b>{passkeys.length ? `${passkeys.length} SAVED` : "NONE SAVED"}</b></div>{passkeys.map((passkey) => <div className="passkey-row" key={passkey.id}><span><b>{passkey.friendly_name || "Passkey"}</b><small>Added {new Date(passkey.created_at).toISOString().slice(0, 10)}</small></span><button type="button" onClick={() => void removePasskey(passkey.id)} disabled={busy}>Remove</button></div>)}<button type="button" className="auth-secondary security-enroll-button" onClick={() => void addPasskey()} disabled={busy || !secureContext}>{busy ? "Waiting for device…" : "Add a passkey"}</button>{!secureContext ? <small className="settings-footnote">Passkeys require a secure HTTPS connection and a WebAuthn-capable browser.</small> : null}{message ? <p className="action-notice">{message}</p> : null}{error ? <p className="action-error">{error}</p> : null}</div>;
}
