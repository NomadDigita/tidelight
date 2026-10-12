"use client";

import { useEffect, useRef, useState } from "react";

export type PnlCardDetails = {
  ticker: string;
  name?: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  status: "OPEN" | "CLOSED";
  pnl: number | null;
  pnlPercent?: number | null;
  quantity: number;
  entryPrice?: number | null;
  referencePrice?: number | null;
  referenceLabel?: "LAST MARK" | "EXIT FILL";
  timestamp: string;
  desk: "NIGHTWATCH" | "FUTURES PAPER DESK";
};

const money = (value: number, digits = 2) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const number = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
const stamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

function drawCard(canvas: HTMLCanvasElement, details: PnlCardDetails) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = 1200; const h = 630;
  canvas.width = w; canvas.height = h;
  const rounded = (x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
  };
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#081613"); bg.addColorStop(.52, "#0b1e1d"); bg.addColorStop(1, "#101b27");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(890, 300, 12, 890, 300, 460);
  glow.addColorStop(0, "rgba(60,220,174,.20)"); glow.addColorStop(1, "rgba(60,220,174,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(155,235,204,.11)"; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(952, 306, 148 + i * 35, 63 + i * 18, -.18, .08, Math.PI * 1.18); ctx.stroke(); }
  rounded(28, 28, w - 56, h - 56, 28); ctx.strokeStyle = "rgba(174,239,211,.22)"; ctx.lineWidth = 1.5; ctx.stroke();

  // Tidelight's twin tide lines, drawn as vector paths to keep the card self contained.
  rounded(66, 55, 56, 56, 18); ctx.fillStyle = "#123e35"; ctx.fill(); ctx.strokeStyle = "rgba(118,230,190,.35)"; ctx.stroke();
  ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(76, 83); ctx.bezierCurveTo(88, 83, 87, 69, 98, 69); ctx.bezierCurveTo(106, 69, 106, 80, 115, 80); ctx.strokeStyle = "#75e5bd"; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(77, 94); ctx.bezierCurveTo(88, 94, 90, 87, 99, 87); ctx.bezierCurveTo(105, 87, 109, 91, 115, 91); ctx.strokeStyle = "#e3c98d"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = "#d9fff0"; ctx.beginPath(); ctx.arc(109, 67, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eff9f3"; ctx.font = "700 23px Inter, system-ui, sans-serif"; ctx.fillText("TIDELIGHT", 139, 83);
  ctx.fillStyle = "#8ba8a0"; ctx.font = "10px ui-monospace, SFMono-Regular, monospace"; ctx.letterSpacing = "2px"; ctx.fillText("TRADE JOURNAL  /  " + details.desk, 140, 102);
  rounded(941, 62, 190, 34, 17); ctx.fillStyle = "rgba(117,229,189,.09)"; ctx.fill(); ctx.strokeStyle = "rgba(117,229,189,.23)"; ctx.stroke();
  ctx.fillStyle = "#a9eed1"; ctx.font = "10px ui-monospace, monospace"; ctx.letterSpacing = "1.3px"; ctx.fillText("PAPER SIMULATION", 967, 84);

  ctx.letterSpacing = "0px"; ctx.fillStyle = "#f1f7f3"; ctx.font = "600 43px Inter, system-ui, sans-serif";
  ctx.fillText(details.name || details.ticker, 68, 188);
  ctx.fillStyle = "#96aaa3"; ctx.font = "16px ui-monospace, monospace"; ctx.letterSpacing = "1.1px"; ctx.fillText(`${details.ticker}  ·  ${details.symbol}`, 70, 219);
  ctx.letterSpacing = "0px";
  const positive = details.pnl == null || details.pnl >= 0;
  ctx.fillStyle = details.pnl == null ? "#f2f7f4" : positive ? "#8fe7bc" : "#f09a8e";
  ctx.font = "600 80px Inter, system-ui, sans-serif";
  ctx.fillText(details.pnl == null ? "—" : `${details.pnl >= 0 ? "+" : "−"}${money(Math.abs(details.pnl))}`, 66, 338);
  ctx.fillStyle = "#9aafa7"; ctx.font = "19px ui-monospace, monospace"; ctx.letterSpacing = "2px";
  ctx.fillText(details.status === "OPEN" ? "UNREALIZED PAPER P&L" : "REALIZED PAPER P&L", 72, 367);
  if (details.pnlPercent != null && Number.isFinite(details.pnlPercent)) {
    ctx.letterSpacing = "0px"; ctx.fillStyle = positive ? "#8fe7bc" : "#f09a8e"; ctx.font = "600 18px Inter, system-ui, sans-serif";
    ctx.fillText(`${details.pnlPercent >= 0 ? "+" : ""}${details.pnlPercent.toFixed(2)}%`, 72, 401);
  }

  const fields: [string, string][] = [
    ["POSITION", `${details.direction}  ·  ${number(details.quantity)} units`],
    ["ENTRY", details.entryPrice == null ? "Not available" : money(details.entryPrice, 4)],
    [details.referenceLabel ?? (details.status === "OPEN" ? "LAST MARK" : "EXIT FILL"), details.referencePrice == null ? "Not available" : money(details.referencePrice, 4)],
    ["RECORDED", stamp(details.timestamp)],
  ];
  const startY = 457;
  fields.forEach(([label, value], index) => {
    const x = index % 2 === 0 ? 70 : 625;
    const rowY = index < 2 ? startY : startY + 72;
    ctx.fillStyle = "#6f8980"; ctx.font = "17px ui-monospace, monospace"; ctx.letterSpacing = "1.6px"; ctx.fillText(label, x, rowY);
    ctx.fillStyle = "#e2eee8"; ctx.font = index === 3 ? "20px Inter, system-ui, sans-serif" : "25px Inter, system-ui, sans-serif"; ctx.letterSpacing = "0px"; ctx.fillText(value, x, rowY + 29, 500);
  });
  ctx.strokeStyle = "rgba(171,229,201,.16)"; ctx.beginPath(); ctx.moveTo(70, 564); ctx.lineTo(1130, 564); ctx.stroke();
  ctx.fillStyle = "#7c958b"; ctx.font = "17px Inter, system-ui, sans-serif";
  ctx.fillText(details.status === "OPEN" ? "Mark-based estimate before exit fees and slippage." : "Historical paper fill; not a live exchange execution.", 70, 589);
  ctx.textAlign = "right"; ctx.fillText("TIDELIGHT.APP", 1130, 584); ctx.textAlign = "left";
}

export default function PnlShareCard({ details, label = "Share P&L" }: { details: PnlCardDetails; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return;
    if (canvasRef.current) drawCard(canvasRef.current, details);
    const initialOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = initialOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [open, details]);

  async function exportCard(share: boolean) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) { setNotice("The card could not be created. Please try again."); return; }
    const filename = `tidelight-${details.ticker.toLowerCase()}-${details.status.toLowerCase()}-pnl.png`;
    const file = new File([blob], filename, { type: "image/png" });
    if (share && navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `Tidelight ${details.status.toLowerCase()} paper P&L`, text: `${details.ticker} · ${details.desk} · paper simulation` }); setNotice("Shared."); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(share ? "Image saved. Share it from your downloads." : "Image downloaded.");
  }

  return <>
    <button type="button" className="pnl-share-trigger" onClick={() => { setNotice(""); setOpen(true); }} aria-label={`${label} for ${details.ticker}`}>{label}<svg aria-hidden="true" viewBox="0 0 12 12"><path d="M2 10 10 2M3 2h7v7"/></svg></button>
    {open ? <div className="pnl-share-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="pnl-share-dialog" role="dialog" aria-modal="true" aria-labelledby="pnl-share-title">
        <header><div><span className="eyebrow small-eyebrow">A TIDELIGHT TRADE CARD</span><h2 id="pnl-share-title">Share your {details.status.toLowerCase()} position.</h2></div><button type="button" className="pnl-share-close" autoFocus onClick={() => setOpen(false)} aria-label="Close share card">×</button></header>
        <canvas ref={canvasRef} className="pnl-share-canvas" aria-label={`${details.ticker} ${details.status.toLowerCase()} P&L card`} />
        <p className="pnl-share-caption">This card is created on your device. Personal account details are never included.</p>
        <div className="pnl-share-actions"><button type="button" className="pnl-share-download" onClick={() => void exportCard(false)}>Download PNG</button><button type="button" className="pnl-share-send" onClick={() => void exportCard(true)}>Share card <svg aria-hidden="true" viewBox="0 0 12 12"><path d="M2 10 10 2M3 2h7v7"/></svg></button></div>
        <p className="pnl-share-notice" role="status">{notice}</p>
      </section>
    </div> : null}
  </>;
}
