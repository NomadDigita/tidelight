"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

export default function IssuerLogo({ ticker, logoUrl, className = "" }: { ticker: string; logoUrl: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const monogram = ticker.trim().replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "TL";
  return <span className={`issuer-logo ${className}`} aria-hidden="true">
    <b className="issuer-logo-fallback" style={{ opacity: logoUrl && !failed && loaded ? 0 : 1 }}>{monogram}</b>
    {logoUrl && !failed ? <img src={logoUrl} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={{ opacity: loaded ? 1 : 0 }} /> : null}
  </span>;
}
