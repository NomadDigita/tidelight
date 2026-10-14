"use client";

import { useCallback, useEffect, useState } from "react";

const MEASUREMENT_ID = "G-JOP7HOTN38";
const CONSENT_KEY = "tidelight-analytics-consent-v1";

type Choice = "accepted" | "rejected";

function enableAnalytics() {
  if (document.getElementById("tidelight-google-analytics")) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) { window.dataLayer?.push(args); };
  window.gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
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
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

export default function AnalyticsConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(CONSENT_KEY);
    const frame = window.requestAnimationFrame(() => {
      if (saved !== "accepted" && saved !== "rejected") setOpen(true);
    });
    if (saved === "accepted") enableAnalytics();
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const saveChoice = useCallback((next: Choice) => {
    window.localStorage.setItem(CONSENT_KEY, next);
    setOpen(false);
    if (next === "accepted") enableAnalytics();
    else window.gtag?.("consent", "update", { analytics_storage: "denied" });
  }, []);

  return <>
    {!open && <button className="analytics-privacy-trigger" type="button" onClick={() => setOpen(true)}>Privacy choices</button>}
    {open && <section className="analytics-consent" aria-label="Analytics privacy choices" aria-live="polite">
      <div className="analytics-consent-copy">
        <strong>Choose your analytics setting</strong>
        <p>Tidelight uses Google Analytics to understand visits and improve the site. Analytics stays off unless you allow it. Your choice is saved in this browser and you can change it at any time. No advertising cookies are enabled.</p>
      </div>
      <div className="analytics-consent-actions">
        <button type="button" className="analytics-consent-reject" onClick={() => saveChoice("rejected")}>Reject analytics</button>
        <button type="button" className="analytics-consent-accept" onClick={() => saveChoice("accepted")}>Allow analytics</button>
      </div>
    </section>}
    <style jsx global>{`
      .analytics-consent{position:fixed;z-index:10000;right:14px;bottom:58px;width:min(390px,calc(100vw - 28px));padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--panel);box-shadow:0 10px 34px #0002;color:var(--text)}
      .analytics-consent-copy strong{font-size:13px}.analytics-consent-copy p{margin:6px 0 0;color:var(--muted);font-size:11px;line-height:1.5}
      .analytics-consent-actions{display:flex;gap:8px;margin-top:12px}.analytics-consent-actions button,.analytics-privacy-trigger{border:1px solid var(--line);border-radius:999px;padding:9px 13px;background:transparent;color:var(--text);font:600 11px/1.2 inherit;cursor:pointer;white-space:nowrap}.analytics-consent-actions button{flex:1}.analytics-consent-actions .analytics-consent-accept{background:var(--text);color:var(--panel)}
      .analytics-consent-actions button:focus-visible,.analytics-privacy-trigger:focus-visible{outline:3px solid var(--accent,#6b8cff);outline-offset:3px}
      .analytics-privacy-trigger{position:fixed;z-index:9998;right:14px;bottom:14px;background:var(--panel);box-shadow:0 3px 14px #0002;font-size:10px}
      @media(max-width:600px){.analytics-consent{right:10px;bottom:58px;width:calc(100vw - 20px);padding:13px}.analytics-privacy-trigger{right:10px;bottom:10px}}
    `}</style>
  </>;
}
