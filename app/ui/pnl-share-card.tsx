"use client";

import { useEffect, useRef, useState } from "react";
import type { Theme } from "@/app/ui/theme-provider";

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

const themes: { id: Theme; label: string }[] = [
  { id: "daylight", label: "Daylight" },
  { id: "night", label: "Night Tide" },
  { id: "blue", label: "Blue Hour" },
];
const palettes: Record<Theme, { background: string; wash: string; panel: string; ink: string; muted: string; line: string; mint: string; accent: string; loss: string }> = {
  daylight: { background: "#f3f2e9", wash: "#e2eee3", panel: "#fffefa", ink: "#17352a", muted: "#617269", line: "#d7dfd5", mint: "#167351", accent: "#c3964b", loss: "#b84e4a" },
  night: { background: "#071311", wash: "#0c2e28", panel: "#0b1b18", ink: "#eff9f3", muted: "#9bb4aa", line: "#244139", mint: "#a6f4d0", accent: "#f1c377", loss: "#ff978c" },
  blue: { background: "#0b1020", wash: "#19294d", panel: "#111a30", ink: "#f0f2ff", muted: "#a2adca", line: "#2e3b60", mint: "#c5d0ff", accent: "#8ce2d1", loss: "#ff9a9e" },
};

const money = (value: number, digits = 2) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const number = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
const stamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

let brandMarkPromise: Promise<HTMLImageElement> | null = null;
function loadBrandMark() {
  if (!brandMarkPromise) brandMarkPromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = "/tidelight-mark.svg";
  });
  return brandMarkPromise;
}

let qrPromise: Promise<HTMLImageElement> | null = null;
function loadSiteQr() {
  if (!qrPromise) qrPromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = "/tidelight-site-qr.svg";
  });
  return qrPromise;
}

async function drawCard(canvas: HTMLCanvasElement, details: PnlCardDetails, theme: Theme) {
  const [mark, qr] = await Promise.all([loadBrandMark(), loadSiteQr()]);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = 1200; const h = 630; const p = palettes[theme];
  canvas.width = w; canvas.height = h;
  const rounded = (x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
  };

  ctx.fillStyle = p.background; ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(887, 300, 10, 887, 300, 470);
  glow.addColorStop(0, theme === "daylight" ? "rgba(115,194,151,.20)" : theme === "blue" ? "rgba(114,143,255,.24)" : "rgba(61,205,163,.19)");
  glow.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

  rounded(30, 30, 1140, 570, 30); ctx.fillStyle = p.panel; ctx.fill();
  ctx.save(); rounded(30, 30, 1140, 570, 30); ctx.clip();
  const wash = ctx.createRadialGradient(925, 340, 16, 925, 340, 430);
  wash.addColorStop(0, p.wash); wash.addColorStop(1, p.panel); ctx.fillStyle = wash; ctx.fillRect(570, 30, 600, 570); ctx.restore();
  rounded(30, 30, 1140, 570, 30); ctx.strokeStyle = p.line; ctx.lineWidth = 2; ctx.stroke();

  ctx.drawImage(mark, 66, 58, 52, 52);
  ctx.fillStyle = p.ink; ctx.font = "700 23px Inter, Avenir Next, system-ui, sans-serif"; ctx.fillText("TIDELIGHT", 133, 82);
  ctx.fillStyle = p.muted; ctx.font = "10px ui-monospace, SFMono-Regular, monospace"; ctx.letterSpacing = "2px"; ctx.fillText("MARKET RESEARCH DESK", 134, 101);

  const badge = details.status === "OPEN" ? "OPEN POSITION" : "CLOSED POSITION";
  rounded(932, 66, 194, 34, 17); ctx.fillStyle = theme === "daylight" ? "#e8f1e8" : "#ffffff08"; ctx.fill(); ctx.strokeStyle = p.line; ctx.stroke();
  ctx.fillStyle = p.mint; ctx.font = "10px ui-monospace, monospace"; ctx.letterSpacing = "1.25px"; ctx.fillText(badge, 952, 88);

  ctx.letterSpacing = "0px"; ctx.fillStyle = p.muted; ctx.font = "11px ui-monospace, monospace"; ctx.letterSpacing = "2px"; ctx.fillText(`${details.desk}  /  PAPER LEDGER`, 68, 160);
  ctx.letterSpacing = "0px"; ctx.fillStyle = p.ink; ctx.font = "600 43px Inter, Avenir Next, system-ui, sans-serif"; ctx.fillText(details.name || details.ticker, 68, 216);
  ctx.fillStyle = p.muted; ctx.font = "15px ui-monospace, monospace"; ctx.letterSpacing = "1.2px"; ctx.fillText(`${details.ticker}  ·  ${details.symbol}`, 70, 245);

  const positive = details.pnl == null || details.pnl >= 0;
  const resultColor = details.pnl == null ? p.ink : positive ? p.mint : p.loss;
  ctx.letterSpacing = "0px"; ctx.fillStyle = resultColor; ctx.font = "600 74px Inter, Avenir Next, system-ui, sans-serif";
  ctx.fillText(details.pnl == null ? "—" : `${details.pnl >= 0 ? "+" : "−"}${money(Math.abs(details.pnl))}`, 66, 352);
  if (details.pnlPercent != null && Number.isFinite(details.pnlPercent)) {
    ctx.fillStyle = resultColor; ctx.font = "600 19px Inter, Avenir Next, system-ui, sans-serif";
    ctx.fillText(`${details.pnlPercent >= 0 ? "+" : ""}${details.pnlPercent.toFixed(2)}%`, 70, 385);
  }
  ctx.fillStyle = p.muted; ctx.font = "11px ui-monospace, monospace"; ctx.letterSpacing = "1.6px";
  ctx.fillText(details.status === "OPEN" ? "UNREALIZED · MARK-TO-MARKET" : "REALIZED · PAPER FILL", 70, 416);

  ctx.strokeStyle = p.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(70, 456); ctx.lineTo(680, 456); ctx.stroke();
  const fields: [string, string, number][] = [
    ["SIDE / SIZE", `${details.direction}  ·  ${number(details.quantity)} units`, 70],
    ["AVERAGE ENTRY", details.entryPrice == null ? "—" : money(details.entryPrice, 4), 390],
    [details.referenceLabel ?? (details.status === "OPEN" ? "LAST MARK" : "EXIT FILL"), details.referencePrice == null ? "—" : money(details.referencePrice, 4), 70],
    ["RECORDED", stamp(details.timestamp), 390],
  ];
  fields.forEach(([label, value, x], index) => {
    const y = index < 2 ? 491 : 548;
    ctx.fillStyle = p.muted; ctx.font = "10px ui-monospace, monospace"; ctx.letterSpacing = "1.5px"; ctx.fillText(label, x, y);
    ctx.fillStyle = p.ink; ctx.font = index === 3 ? "15px Inter, Avenir Next, system-ui, sans-serif" : "17px Inter, Avenir Next, system-ui, sans-serif"; ctx.letterSpacing = "0px"; ctx.fillText(value, x, y + 24, 320);
  });

  ctx.fillStyle = p.line; ctx.fillRect(730, 146, 1, 430);
  ctx.fillStyle = p.muted; ctx.font = "10px ui-monospace, monospace"; ctx.letterSpacing = "2px"; ctx.fillText("THE TIDELIGHT METHOD", 770, 181);
  ctx.fillStyle = p.ink; ctx.font = "500 24px Inter, Avenir Next, system-ui, sans-serif"; ctx.letterSpacing = "-.5px";
  ctx.fillText("Event", 770, 221); ctx.fillStyle = p.accent; ctx.fillText("→", 838, 221);
  ctx.fillStyle = p.ink; ctx.fillText("Evidence", 864, 221);
  ctx.fillStyle = p.muted; ctx.font = "15px Inter, Avenir Next, system-ui, sans-serif"; ctx.letterSpacing = "0px";
  ctx.fillText(details.status === "OPEN" ? "A live paper mark." : "A recorded paper close.", 770, 259);
  ctx.fillText("A clear view of exposure", 770, 284); ctx.fillText("before the next decision.", 770, 308);
  ctx.fillStyle = p.muted; ctx.font = "10px ui-monospace, monospace"; ctx.letterSpacing = "1.1px";
  ctx.fillText("EXPOSURE  ·  SCENARIO  ·  REVIEW", 770, 333);
  rounded(880, 336, 234, 234, 8); ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.drawImage(qr, 886, 342, 222, 222);
  ctx.fillStyle = p.ink; ctx.font = "12px ui-monospace, monospace"; ctx.letterSpacing = "1px"; ctx.fillText("SCAN · TIDELIGHT.APP", 770, 580);
  ctx.fillStyle = p.accent; ctx.fillRect(770, 587, 338, 2);
}

export default function PnlShareCard({ details, label = "Share P&L" }: { details: PnlCardDetails; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState<Theme>("daylight");

  function openCard() {
    const currentTheme = document.documentElement.dataset.theme;
    setTheme(currentTheme === "night" || currentTheme === "blue" ? currentTheme : "daylight");
    setNotice("");
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const initialOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = initialOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  useEffect(() => {
    if (open && canvasRef.current) void drawCard(canvasRef.current, details, theme).catch(() => setNotice("The card artwork could not be loaded. Please try again."));
  }, [open, details, theme]);

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
    <button type="button" className="pnl-share-trigger" onClick={openCard} aria-label={`${label} for ${details.ticker}`}>{label}<svg aria-hidden="true" viewBox="0 0 12 12"><path d="M2 10 10 2M3 2h7v7"/></svg></button>
    {open ? <div className="pnl-share-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="pnl-share-dialog" role="dialog" aria-modal="true" aria-labelledby="pnl-share-title">
        <header><div><span className="eyebrow small-eyebrow">A TIDELIGHT TRADE CARD</span><h2 id="pnl-share-title">Share your {details.status.toLowerCase()} position.</h2></div><button type="button" className="pnl-share-close" autoFocus onClick={() => setOpen(false)} aria-label="Close share card">×</button></header>
        <div className="pnl-share-theme-picker" role="group" aria-label="Choose card theme">{themes.map((option) => <button type="button" key={option.id} className={theme === option.id ? "selected" : ""} aria-pressed={theme === option.id} onClick={() => { setNotice(""); setTheme(option.id); }}>{option.label}</button>)}</div>
        <canvas ref={canvasRef} className="pnl-share-canvas" aria-label={`${details.ticker} ${details.status.toLowerCase()} P&L card`} />
        <p className="pnl-share-caption">This card is created on your device. Personal account details are never included.</p>
        <div className="pnl-share-actions"><button type="button" className="pnl-share-download" onClick={() => void exportCard(false)}>Download PNG</button><button type="button" className="pnl-share-send" onClick={() => void exportCard(true)}>Share card <svg aria-hidden="true" viewBox="0 0 12 12"><path d="M2 10 10 2M3 2h7v7"/></svg></button></div>
        <p className="pnl-share-notice" role="status">{notice}</p>
      </section>
    </div> : null}
  </>;
}
