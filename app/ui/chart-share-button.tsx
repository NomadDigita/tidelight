"use client";

import { useState } from "react";

type ShareCandle = { timestamp: number; close: number };
type ShareMarker = { side: "B" | "S"; timestamp: number; price: number };
export default function ChartShareButton({ symbol, candles, markers }: { symbol: string; candles: ShareCandle[]; markers: ShareMarker[] }) {
  const [busy, setBusy] = useState(false);
  async function share() {
    if (busy || candles.length < 2) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200; canvas.height = 675;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const gradient = ctx.createLinearGradient(0, 0, 1200, 675);
      gradient.addColorStop(0, "#101b31"); gradient.addColorStop(1, "#07101f");
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 675);
      ctx.fillStyle = "#21d3bd"; ctx.font = "600 18px ui-monospace, monospace"; ctx.fillText("TIDELIGHT  /  BITGET FUTURES", 68, 68);
      ctx.fillStyle = "#f3f6ff"; ctx.font = "600 38px system-ui, sans-serif"; ctx.fillText(symbol, 68, 126);
      ctx.fillStyle = "#9eabc5"; ctx.font = "16px system-ui, sans-serif"; ctx.fillText("Completed 4H closes · Market reference", 68, 157);
      const visible = candles.slice(-54), low = Math.min(...visible.map(c => c.close)), high = Math.max(...visible.map(c => c.close)), spread = high - low || Math.max(high * .002, 1);
      const left = 78, right = 1120, top = 220, bottom = 545;
      ctx.strokeStyle = "rgba(157,176,209,.16)"; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { const y = top + i * (bottom - top) / 3; ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke(); }
      const xAt = (timestamp:number) => left + Math.max(0, Math.min(1, (timestamp-visible[0].timestamp)/Math.max(1,visible.at(-1)!.timestamp-visible[0].timestamp)))*(right-left);
      const yAt = (price:number) => bottom - ((price-low)/spread)*(bottom-top);
      ctx.beginPath(); visible.forEach((c,i)=>{const x=left+i*(right-left)/(visible.length-1),y=yAt(c.close);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
      ctx.strokeStyle="#20d3bd";ctx.lineWidth=4;ctx.lineJoin="round";ctx.stroke();
      for (const marker of markers.filter(m=>m.timestamp>=visible[0].timestamp&&m.timestamp<=visible.at(-1)!.timestamp)) {
        const x=xAt(marker.timestamp),y=yAt(marker.price);
        ctx.fillStyle=marker.side==="B"?"#20d3bd":"#eaa36f";ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.fill();
        ctx.fillStyle="#07101f";ctx.font="700 14px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(marker.side,x,y);
      }
      ctx.textAlign="left";ctx.textBaseline="alphabetic";ctx.fillStyle="#7586a5";ctx.font="14px ui-monospace, monospace";ctx.fillText(new Date(visible[0].timestamp).toLocaleDateString(),left,582);
      ctx.textAlign="right";ctx.fillText(new Date(visible.at(-1)!.timestamp).toLocaleDateString(),right,582);
      ctx.fillStyle="#7786a0";ctx.font="13px system-ui";ctx.fillText("Reference market data · Not investment advice",68,630);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));
      if(!blob)return;
      const file=new File([blob],`tidelight-${symbol.toLowerCase()}-chart.png`,{type:"image/png"});
      if(navigator.share&&navigator.canShare?.({files:[file]})) await navigator.share({title:`${symbol} chart · Tidelight`,files:[file]});
      else {const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=file.name;link.click();URL.revokeObjectURL(url);}
    } finally { setBusy(false); }
  }
  return <button type="button" className="futures-chart-share" onClick={() => void share()} disabled={busy||candles.length<2}>{busy?"Preparing…":"Share chart"}</button>;
}
