"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

export default function IssuerLogo({ ticker, logoUrl, className = "" }: { ticker: string; logoUrl: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  return <span className={`issuer-logo ${className}`} aria-hidden="true">
    {logoUrl && !failed ? <img src={logoUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <b>{ticker.slice(0, 1)}</b>}
  </span>;
}
