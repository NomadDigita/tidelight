"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import IssuerLogo from "@/app/ui/issuer-logo";

export type PickableAsset = {
  symbol: string;
  name: string;
  lastPrice?: number;
  ticker?: string | null;
  logoUrl?: string | null;
};

export default function AssetSearchPicker({
  label,
  assets,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  assets: PickableAsset[];
  value: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = assets.find((asset) => asset.symbol === value);

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return assets
      .filter((asset) => `${asset.symbol} ${asset.name} ${asset.ticker ?? ""}`.toLocaleLowerCase().includes(needle))
      .sort((left, right) => {
        const leftExact = left.symbol.toLocaleLowerCase() === needle || left.ticker?.toLocaleLowerCase() === needle;
        const rightExact = right.symbol.toLocaleLowerCase() === needle || right.ticker?.toLocaleLowerCase() === needle;
        const leftPrefix = `${left.symbol} ${left.name} ${left.ticker ?? ""}`.toLocaleLowerCase().split(" ").some((part) => part.startsWith(needle));
        const rightPrefix = `${right.symbol} ${right.name} ${right.ticker ?? ""}`.toLocaleLowerCase().split(" ").some((part) => part.startsWith(needle));
        return Number(rightExact) - Number(leftExact) || Number(rightPrefix) - Number(leftPrefix) || left.name.localeCompare(right.name);
      })
      .slice(0, 50);
  }, [assets, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); setQuery(""); }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(asset: PickableAsset) {
    onChange(asset.symbol);
    setOpen(false);
    setQuery("");
  }

  return <div className="asset-search-picker" ref={rootRef}>
    <span className="asset-picker-label">{label}</span>
    <button type="button" className="asset-picker-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen((current) => !current); setQuery(""); }} disabled={disabled || assets.length === 0}>
      {selected ? <IssuerLogo key={selected.symbol} ticker={selected.ticker || selected.symbol} logoUrl={selected.logoUrl ?? null} className="asset-picker-logo" /> : <span className="asset-picker-empty-mark">⌁</span>}
      <span className="asset-picker-current"><b>{selected?.name ?? "No eligible token"}</b><small>{selected?.ticker ? `${selected.ticker} · ` : ""}{selected?.symbol ?? ""}</small></span>
      <span className="asset-picker-chevron" aria-hidden="true">⌄</span>
    </button>
    {open ? <div className="asset-picker-popover">
      <label className="asset-picker-search"><span aria-hidden="true">⌕</span><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${assets.length.toLocaleString()} tokens`} aria-label={`Search ${label.toLowerCase()}`} autoComplete="off" spellCheck={false} /><kbd>ESC</kbd></label>
      <div className="asset-picker-results" role="listbox" aria-label={label}>
        {!query.trim() ? <p className="asset-picker-hint">Search by token symbol, company name, or underlying ticker.</p> : matches.length ? <>
          <div className="asset-picker-count">{matches.length === 50 ? "50+" : matches.length} MATCHING TOKENS</div>
          {matches.map((asset) => <button type="button" role="option" aria-selected={asset.symbol === value} className={`asset-picker-option${asset.symbol === value ? " selected" : ""}`} key={asset.symbol} onClick={() => choose(asset)}>
            <IssuerLogo ticker={asset.ticker || asset.symbol} logoUrl={asset.logoUrl ?? null} className="asset-picker-logo" />
            <span className="asset-picker-option-copy"><b>{asset.name}</b><small>{asset.ticker ? `${asset.ticker} · ` : ""}{asset.symbol}</small></span>
            {typeof asset.lastPrice === "number" ? <span className="asset-picker-price">${new Intl.NumberFormat("en-US", { maximumSignificantDigits: 7 }).format(asset.lastPrice)}</span> : null}
            {asset.symbol === value ? <span className="asset-picker-check" aria-label="Selected">✓</span> : null}
          </button>)}
          {matches.length === 50 ? <p className="asset-picker-hint">Showing the first 50 matches. Refine your search to narrow the list.</p> : null}
        </> : <p className="asset-picker-hint">No token matches “{query.trim()}”. Try a ticker or company name.</p>}
      </div>
    </div> : null}
  </div>;
}
