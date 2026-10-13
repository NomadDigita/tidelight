"use client";

import { useState } from "react";

export type ShareCandle = { timestamp:number; open:number; high:number; low:number; close:number; volume?:number|null };
export type ShareMarker = { side:"B"|"S"; timestamp:number; price:number };
export default function ChartShareButton({symbol,interval,candles,markers=[],market="BITGET MARKET"}:{symbol:string;interval:string;candles:ShareCandle[];markers?:ShareMarker[];market?:string}) {
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  async function share() {
    if(busy||candles.length<2)return;
    setBusy(true);setNotice("");
    try {
      const visible=candles.slice(-100),canvas=document.createElement("canvas");
      canvas.width=1200;canvas.height=700;
      const ctx=canvas.getContext("2d");if(!ctx)return;
      const bg=ctx.createLinearGradient(0,0,1200,700);bg.addColorStop(0,"#101b31");bg.addColorStop(1,"#07101f");
      ctx.fillStyle=bg;ctx.fillRect(0,0,1200,700);
      ctx.fillStyle="#21d3bd";ctx.font="600 17px ui-monospace,monospace";ctx.fillText("TIDELIGHT  /  "+market,64,58);
      ctx.fillStyle="#f3f6ff";ctx.font="650 38px system-ui,sans-serif";ctx.fillText(symbol,64,112);
      ctx.fillStyle="#9eabc5";ctx.font="15px system-ui,sans-serif";ctx.fillText("Bitget public market data  ·  "+interval+" candles",64,142);
      const plot={left:72,right:1080,top:190,bottom:520,volTop:545,volBottom:610};
      const lo=Math.min(...visible.map(c=>c.low)),hi=Math.max(...visible.map(c=>c.high)),gap=(hi-lo||hi*.01)*.08,floor=lo-gap,ceiling=hi+gap,span=ceiling-floor||1;
      const yAt=(price:number)=>plot.bottom-(price-floor)/span*(plot.bottom-plot.top);
      const slot=(plot.right-plot.left)/visible.length,body=Math.max(2,Math.min(10,slot*.64)),maxVol=Math.max(1,...visible.map(c=>c.volume??0));
      ctx.strokeStyle="rgba(157,176,209,.16)";ctx.lineWidth=1;ctx.font="12px ui-monospace,monospace";ctx.fillStyle="#8291aa";
      for(let i=0;i<5;i++){const y=plot.top+i*(plot.bottom-plot.top)/4;ctx.beginPath();ctx.moveTo(plot.left,y);ctx.lineTo(plot.right,y);ctx.stroke();const price=ceiling-i*span/4;ctx.fillText(price.toLocaleString(undefined,{maximumFractionDigits:4}),plot.right+12,y+4);}
      visible.forEach((c,index)=>{const x=plot.left+slot*(index+.5),up=c.close>=c.open,color=up?"#20d3bd":"#eb7477",openY=yAt(c.open),closeY=yAt(c.close);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,yAt(c.high));ctx.lineTo(x,yAt(c.low));ctx.stroke();ctx.fillStyle=color;ctx.fillRect(x-body/2,Math.min(openY,closeY),body,Math.max(2,Math.abs(closeY-openY)));const vh=plot.volBottom-plot.volTop;ctx.globalAlpha=.65;ctx.fillRect(x-body/2,plot.volBottom-vh*(c.volume??0)/maxVol,body,vh*(c.volume??0)/maxVol);ctx.globalAlpha=1;});
      const start=visible[0].timestamp,end=visible.at(-1)!.timestamp;
      markers.filter(m=>m.timestamp>=start&&m.timestamp<=end).forEach(m=>{const index=visible.reduce((best,c,i)=>Math.abs(c.timestamp-m.timestamp)<Math.abs(visible[best].timestamp-m.timestamp)?i:best,0),x=plot.left+slot*(index+.5),y=yAt(m.price);ctx.fillStyle=m.side==="B"?"#20d3bd":"#eaa36f";ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();ctx.fillStyle="#07101f";ctx.font="700 12px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(m.side,x,y);});
      ctx.textAlign="left";ctx.textBaseline="alphabetic";ctx.fillStyle="#7786a0";ctx.font="13px ui-monospace,monospace";ctx.fillText(new Date(start).toLocaleString(),plot.left,645);ctx.textAlign="right";ctx.fillText(new Date(end).toLocaleString(),plot.right,645);
      ctx.textAlign="left";ctx.fillStyle="#7786a0";ctx.font="12px system-ui,sans-serif";ctx.fillText("Reference data · Tidelight",64,674);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));if(!blob)return;
      const file=new File([blob],"tidelight-"+symbol.toLowerCase()+"-chart.png",{type:"image/png"});
      if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:symbol+" chart · Tidelight",files:[file]});setNotice("Chart shared");}
      else {const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=file.name;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice("Chart image saved");}
    } catch(error) { if(!(error instanceof DOMException&&error.name==="AbortError"))setNotice("Could not share chart. Try again."); }
    finally {setBusy(false);}
  }
  return <span className="chart-share-wrap"><button type="button" className="chart-share-button" onClick={()=>void share()} aria-label="Share chart" title="Share chart" disabled={busy||candles.length<2}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.6 6.6-4.2M8.7 13.4l6.6 4.2"/></svg></button>{notice?<span className="chart-share-toast" role="status">{notice}</span>:null}</span>;
}
