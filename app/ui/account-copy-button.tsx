"use client";

import { useState } from "react";

export default function AccountCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return <button type="button" className="account-center-copy" onClick={() => void copy()} aria-label="Copy Tidelight UID">{copied ? "Copied" : "Copy ID"}</button>;
}
