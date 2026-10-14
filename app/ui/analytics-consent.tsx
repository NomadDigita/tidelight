"use client";

import { useCallback, useEffect, useState } from "react";

const MEASUREMENT_ID = "G-JOP7HOTN38";
const CONSENT_KEY = "tidelight-analytics-consent-v1";
type Choice = "accepted" | "rejected";

function validChoice(value: unknown): value is Choice { return value === "accepted" || value === "rejected"; }

function enableAnalytics() {
  if (document.getElementById("tidelight-google-analytics")) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) { window.dataLayer?.push(args); };
  window.gtag("consent", "default", {
    analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
  });
  window.gtag("consent", "update", { analytics_storage: "granted" });
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, { anonymize_ip: true });
  const script = document.createElement("script");
  script.id = "tidelight-google-analytics";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

declare global {
  interface Window { dataLayer?: unknown[][]; gtag?: (...args: unknown[]) => void; }
}

export default function AnalyticsConsent() {
  const [open, setOpen] = useState(false);
  const [accountChoice, setAccountChoice] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const local = window.localStorage.getItem(CONSENT_KEY);
    const apply = (choice: Choice) => {
      window.localStorage.setItem(CONSENT_KEY, choice);
      if (choice === "accepted") enableAnalytics();
      if (active) setOpen(false);
    };
    void (async () => {
      try {
        const response = await fetch("/api/privacy/analytics-consent", { cache: "no-store" });
        if (response.status === 401) {
          if (!active) return;
          setAccountChoice(false);
          if (validChoice(local)) { if (local === "accepted") enableAnalytics(); }
          else setOpen(true);
          return;
        }
        if (!response.ok) throw new Error("Account privacy settings are unavailable.");
        const data = await response.json() as { choice?: unknown };
        if (!active) return;
        setAccountChoice(true);
        if (validChoice(data.choice)) { apply(data.choice); return; }
        if (validChoice(local)) {
          const saved = await fetch("/api/privacy/analytics-consent", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice: local }) });
          if (saved.ok) { if (active) apply(local); return; }
        }
        setOpen(true);
      } catch {
        if (!active) return;
        setAccountChoice(null);
        if (validChoice(local)) { if (local === "accepted") enableAnalytics(); }
        else setOpen(true);
      }
    })();
    return () => { active = false; };
  }, []);

  const saveChoice = useCallback(async (next: Choice) => {
    setSaving(true);
    setError("");
    try {
      if (accountChoice !== false) {
        const response = await fetch("/api/privacy/analytics-consent", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice: next }) });
        if (!(accountChoice === null && response.status === 401) && !response.ok) throw new Error("We couldn’t save this choice to your account. Please try again.");
      }
      window.localStorage.setItem(CONSENT_KEY, next);
      setOpen(false);
      if (next === "accepted") enableAnalytics();
      else window.gtag?.("consent", "update", { analytics_storage: "denied" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t save your privacy choice. Please try again.");
    } finally { setSaving(false); }
  }, [accountChoice]);

  return <>
    {!open && <button className="analytics-privacy-trigger" type="button" onClick={() => setOpen(true)}>Privacy choices</button>}
    {open && <section className="analytics-consent" aria-label="Analytics privacy choices" aria-live="polite">
      <div className="analytics-consent-copy">
        <strong>Choose your analytics setting</strong>
        <p>Analytics stays off unless you allow it. Your choice is saved to your Tidelight account when signed in, or to this browser when signed out. You can change it any time from Privacy choices. No advertising cookies are enabled.</p>
        {error && <p role="alert" className="analytics-consent-error">{error}</p>}
      </div>
      <div className="analytics-consent-actions">
        <button type="button" className="analytics-consent-reject" disabled={saving} onClick={() => void saveChoice("rejected")}>{saving ? "Saving…" : "Reject analytics"}</button>
        <button type="button" className="analytics-consent-accept" disabled={saving} onClick={() => void saveChoice("accepted")}>{saving ? "Saving…" : "Allow analytics"}</button>
      </div>
    </section>}
    <style jsx global>{`
      .analytics-consent{position:relative;z-index:10;width:min(760px,calc(100% - 28px));margin:12px auto 0;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel);box-shadow:0 5px 18px #0000000d;color:var(--text)}
      .analytics-consent-copy strong{font-size:13px}.analytics-consent-copy p{margin:6px 0 0;color:var(--muted);font-size:11px;line-height:1.5}.analytics-consent-copy .analytics-consent-error{color:#b94855}
      .analytics-consent-actions{display:flex;gap:8px;margin-top:12px}.analytics-consent-actions button,.analytics-privacy-trigger{border:1px solid var(--line);border-radius:999px;padding:9px 13px;background:transparent;color:var(--text);font:600 11px/1.2 inherit;cursor:pointer;white-space:nowrap}.analytics-consent-actions button{flex:1}.analytics-consent-actions .analytics-consent-accept{background:var(--text);color:var(--panel)}.analytics-consent-actions button:disabled{opacity:.6;cursor:wait}
      .analytics-consent-actions button:focus-visible,.analytics-privacy-trigger:focus-visible{outline:3px solid var(--accent,#6b8cff);outline-offset:3px}
      .analytics-privacy-trigger{position:fixed;z-index:9998;right:14px;bottom:14px;background:var(--panel);box-shadow:0 3px 14px #0002;font-size:10px}
      @media(max-width:600px){.analytics-consent{width:calc(100% - 20px);padding:11px}.analytics-privacy-trigger{right:10px;bottom:10px}}
    `}</style>
  </>;
}
