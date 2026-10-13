"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ALPHA_STRATEGIES, BACKTEST_STRATEGY, type StrategyKey } from "@/lib/backtest";
import { STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";
import ChartShareButton, { type ShareCandle, type ShareMarker } from "@/app/ui/chart-share-button";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/app/ui/language-provider";

type PaperPosition={symbol:string;direction:"long"|"short";quantity:number;entry_fill:number;margin:number;entry_fee:number;opened_at:string};
type Fill={id:string;symbol:string;action:string;direction:string;quantity:number;fill_price:number;notional:number;fee:number;realized_pnl:number;created_at:string};
type Decision={id:string;symbol:string;action:string;outcome:string;reason:string;reference_price:number;realized_pnl:number;created_at:string};
type Candle=ShareCandle;
type Depth={price:number;size:number};
type PublicTrade={id:string;price:number;size:number;side:"buy"|"sell";timestamp:number};
type LiveAccount={availableUSDT:number;equityUSDT:number;holdMode:string;symbolSetting:{marginMode:string;leverage:string}|null;positions:Array<{symbol:string;side:string;quantity:number;entryPrice:number;markPrice:number;unrealizedPnl:number;leverage:number;marginMode:string}>};
type MarketPayload={market:{symbol:string;lastPrice:number;change24h:number|null;high24h:number|null;low24h:number|null;open24h:number|null;volume24h:number|null;turnover24h:number|null;providerTimestamp:number|null};candles:Candle[];orderbook:{asks:Depth[];bids:Depth[];timestamp:number|null};trades:PublicTrade[];interval:string};
const usd=(value:number,decimals=2)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:decimals,minimumFractionDigits:decimals}).format(value);
const compact=(value:number)=>new Intl.NumberFormat("en-US",{notation:"compact",maximumFractionDigits:2}).format(value);
const time=(value:string|number)=>new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
const intervals=["15m","1H","4H","1D"] as const;
type Interval=typeof intervals[number];
type AccessStatus="not_requested"|"pending"|"approved"|"rejected";
const LIVE_TERMS=[
  {key:"market_risk",title:"Market and liquidation risk",body:"US stock perpetuals are leveraged derivatives. Price gaps, volatility and liquidation can rapidly reduce or eliminate the margin you commit; weekend and overnight liquidity can be thin."},
  {key:"liquidation",title:"Margin, fees and execution",body:"Market orders can fill at a different price than the quote shown. Funding, trading fees, slippage and exchange risk controls affect results. You are responsible for maintaining margin and monitoring positions."},
  {key:"api_permissions",title:"Exchange account and permissions",body:"You must own and be authorized to use the connected Bitget account, comply with Bitget terms and local law, and grant only the API permissions needed for trading. Never enable withdrawals for a trading key."},
  {key:"key_security",title:"Credential security",body:"Tidelight stores API credentials encrypted server-side. You remain responsible for key scope, IP allowlisting, rotation and revocation. Do not share keys or paste them into chat."},
  {key:"manual_orders",title:"Your order responsibility",body:"You will review each live order and its size before submission. Research, charts and agent analysis are informational and do not guarantee outcomes or make decisions on your behalf."},
] as const;
const tradeSide=(fill:Fill):"B"|"S"=>fill.action==="open_long"||(fill.action==="close"&&fill.direction==="short")?"B":"S";

function CandlestickChart({candles,symbol,lastPrice,interval,fills,position}:{candles:Candle[];symbol:string;lastPrice:number|null;interval:string;fills:Fill[];position:PaperPosition|null}){
  const visible=candles.slice(-96);
  if(visible.length<2)return <div className="station-chart-empty">Bitget candles are loading for this contract.</div>;
  const rawLow=Math.min(...visible.map(c=>c.low)),rawHigh=Math.max(...visible.map(c=>c.high)),rawSpan=rawHigh-rawLow||Math.max(rawHigh*.01,.01),floor=rawLow-rawSpan*.06,ceiling=rawHigh+rawSpan*.06,span=ceiling-floor||1;
  const plot={left:30,right:900,top:24,bottom:304,volTop:330,volBottom:394};
  const slot=(plot.right-plot.left)/visible.length,body=Math.max(2,Math.min(8,slot*.62)),maxVol=Math.max(1,...visible.map(c=>c.volume??0));
  const yAt=(price:number)=>plot.bottom-((price-floor)/span)*(plot.bottom-plot.top),xAt=(index:number)=>plot.left+slot*(index+.5);
  const highs=Array.from({length:5},(_,i)=>ceiling-(span*i/4));
  const markers:ShareMarker[]=[];
  for(const fill of fills.filter(item=>item.symbol===symbol&&item.fill_price>0)){
    const stamp=new Date(fill.created_at).getTime();if(stamp<visible[0].timestamp||stamp>visible.at(-1)!.timestamp)continue;
    markers.push({side:tradeSide(fill),timestamp:stamp,price:fill.fill_price});
  }
  if(position?.symbol===symbol&&position.opened_at){
    const stamp=new Date(position.opened_at).getTime();
    if(stamp>=visible[0].timestamp&&stamp<=visible.at(-1)!.timestamp&&!markers.some(m=>Math.abs(m.timestamp-stamp)<60_000))markers.push({side:position.direction==="long"?"B":"S",timestamp:stamp,price:position.entry_fill});
  }
  const markerPoints=markers.map((marker,index)=>{
    const candleIndex=visible.reduce((best,candle,i)=>Math.abs(candle.timestamp-marker.timestamp)<Math.abs(visible[best].timestamp-marker.timestamp)?i:best,0);
    return {...marker,index,x:xAt(candleIndex),y:Math.max(plot.top+8,Math.min(plot.bottom-8,yAt(marker.price)+(index%2?10:-10)))};
  });
  const first=visible[0],last=visible.at(-1)!;
  return <div className="station-chart-canvas"><svg viewBox="0 0 1000 440" role="img" aria-label={symbol+" Bitget "+interval+" candlestick chart"}>
    {highs.map((price,index)=>{const y=plot.top+index*(plot.bottom-plot.top)/4;return <g key={index}><line x1={plot.left} x2={plot.right} y1={y} y2={y} className="station-grid"/><text x={plot.right+12} y={y+4} className="station-axis">{price.toLocaleString(undefined,{maximumFractionDigits:4})}</text></g>;})}
    {visible.map((candle,index)=>{const x=xAt(index),up=candle.close>=candle.open,color=up?"#28d5b8":"#e77a82",openY=yAt(candle.open),closeY=yAt(candle.close),volumeHeight=(plot.volBottom-plot.volTop)*(candle.volume??0)/maxVol;return <g key={candle.timestamp} className={up?"station-candle-up":"station-candle-down"}><title>{time(candle.timestamp)+" · O "+candle.open+" H "+candle.high+" L "+candle.low+" C "+candle.close}</title><line x1={x} x2={x} y1={yAt(candle.high)} y2={yAt(candle.low)} stroke={color} strokeWidth="1.2"/><rect x={x-body/2} y={Math.min(openY,closeY)} width={body} height={Math.max(1.5,Math.abs(closeY-openY))} rx=".6" fill={color}/><rect x={x-body/2} y={plot.volBottom-volumeHeight} width={body} height={volumeHeight} fill={color} opacity=".45"/></g>;})}
    {lastPrice&&lastPrice>0?<g><line x1={plot.left} x2={plot.right} y1={yAt(lastPrice)} y2={yAt(lastPrice)} className="station-last-line"/><rect x="905" y={yAt(lastPrice)-10} width="86" height="20" rx="5" className="station-price-chip"/><text x="948" y={yAt(lastPrice)+4} textAnchor="middle" className="station-price-text">{lastPrice.toLocaleString(undefined,{maximumFractionDigits:4})}</text></g>:null}
    {markerPoints.map(marker=><g key={String(marker.timestamp)+"-"+marker.index} transform={"translate("+marker.x+" "+marker.y+")"} className={marker.side==="B"?"station-fill-marker buy":"station-fill-marker sell"}><title>{marker.side==="B"?"Buy / long entry":"Sell / short entry or long exit"}</title><circle r="7"/><text textAnchor="middle" dominantBaseline="central">{marker.side}</text></g>)}
    <line x1={plot.left} x2={plot.right} y1={plot.volTop-8} y2={plot.volTop-8} className="station-grid"/>
    <text x={plot.left} y="420" className="station-axis">{time(first.timestamp)}</text><text x={plot.right} y="420" textAnchor="end" className="station-axis">{time(last.timestamp)}</text><text x={plot.left} y={plot.volTop+10} className="station-volume-label">VOLUME</text>
  </svg></div>;
}

function OrderBook({payload,tab,setTab,chinese}:{payload:MarketPayload|null;tab:"book"|"trades";setTab:(tab:"book"|"trades")=>void;chinese:boolean}){
  const asks=payload?.orderbook.asks.slice(0,8).reverse()??[],bids=payload?.orderbook.bids.slice(0,8)??[];
  const maxSize=Math.max(1,...asks.map(x=>x.size),...bids.map(x=>x.size));
  const bestAsk=payload?.orderbook.asks[0]?.price,bestBid=payload?.orderbook.bids[0]?.price,spread=bestAsk&&bestBid?bestAsk-bestBid:null;
  return <section className="station-panel station-depth">
    <div className="station-panel-head"><div><span className="station-eyebrow">{chinese?"BITGET · 公开市场数据":"BITGET · PUBLIC MARKET DATA"}</span><h2>{chinese?"市场深度":"Market depth"}</h2></div><div className="station-tabs"><button type="button" aria-pressed={tab==="book"} onClick={()=>setTab("book")}>{chinese?"订单簿":"Order book"}</button><button type="button" aria-pressed={tab==="trades"} onClick={()=>setTab("trades")}>{chinese?"近期成交":"Recent trades"}</button></div></div>
    {tab==="book"?<><div className="station-book-labels"><span>{chinese?"价格（USDT）":"Price (USDT)"}</span><span>{chinese?"数量":"Size"}</span><span>{chinese?"累计":"Total"}</span></div><div className="station-book-asks">{asks.map((level,index)=><div className="station-book-row ask" key={"a"+index}><i style={{width:Math.max(2,level.size/maxSize*100)+"%"}}/><b>{level.price.toLocaleString(undefined,{maximumFractionDigits:4})}</b><span>{level.size.toFixed(4)}</span><small>{(level.price*level.size).toLocaleString(undefined,{maximumFractionDigits:2})}</small></div>)}</div><div className="station-spread"><b>{payload?usd(payload.market.lastPrice,4):"—"}</b><span>{spread===null?(chinese?"价差计算中":"Spread waiting"):(chinese?"价差 "+spread.toFixed(4)+" USDT":"Spread "+spread.toFixed(4)+" USDT")}</span></div><div className="station-book-bids">{bids.map((level,index)=><div className="station-book-row bid" key={"b"+index}><i style={{width:Math.max(2,level.size/maxSize*100)+"%"}}/><b>{level.price.toLocaleString(undefined,{maximumFractionDigits:4})}</b><span>{level.size.toFixed(4)}</span><small>{(level.price*level.size).toLocaleString(undefined,{maximumFractionDigits:2})}</small></div>)}</div><p className="station-data-note">{chinese?"Bitget 公开市场深度 · 随行情快照更新":"Public depth from Bitget · refreshed with market snapshot"}</p></>:<div className="station-trades">{(payload?.trades??[]).slice(0,14).map(trade=><div className="station-trade-row" key={trade.id}><b className={trade.side==="buy"?"buy":"sell"}>{trade.price.toLocaleString(undefined,{maximumFractionDigits:4})}</b><span>{trade.size.toFixed(4)}</span><small>{time(trade.timestamp)}</small></div>)}</div>}
  </section>;
}

function LiveTradePanel({symbol,price}:{symbol:string;price:number|null}){
  const router=useRouter();
  const [account,setAccount]=useState<LiveAccount|null>(null);
  const [accountError,setAccountError]=useState("");
  const [margin,setMargin]=useState("50");
  const [action,setAction]=useState<"open_long"|"open_short"|"close"|null>(null);
  const [acknowledged,setAcknowledged]=useState(false);
  const [mfaCode,setMfaCode]=useState("");
  const [mfaVerified,setMfaVerified]=useState(false);
  const [mfaBusy,setMfaBusy]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    let active=true;const controller=new AbortController();
    const refresh=async()=>{try{const response=await fetch("/api/futures/live-account?symbol="+encodeURIComponent(symbol),{cache:"no-store",signal:controller.signal});const next=await response.json() as LiveAccount&{error?:string};if(!response.ok)throw new Error(next.error??"Live account unavailable.");if(active){setAccount(next);setAccountError("");}}catch(cause){if(active&&!(cause instanceof DOMException&&cause.name==="AbortError"))setAccountError(cause instanceof Error?cause.message:"Live account unavailable.");}};
    void refresh();const timer=window.setInterval(()=>void refresh(),10000);
    return()=>{active=false;controller.abort();window.clearInterval(timer);};
  },[symbol]);
  const position=account?.positions[0]??null;
  const quantity=price&&Number(margin)>0?Math.floor((Number(margin)/price)*1e6)/1e6:0;
  async function verifyAuthenticator(){
    if(!/^\d{6}$/.test(mfaCode)){setError("Enter the six-digit code from your authenticator app.");return;}
    setMfaBusy(true);setError("");
    try{
      const client=createClient();
      const {data,error:factorError}=await client.auth.mfa.listFactors();
      if(factorError)throw factorError;
      const factor=data.totp.find(item=>item.status==="verified");
      if(!factor)throw new Error("Add and verify an authenticator in Settings before trading live.");
      const {data:challenge,error:challengeError}=await client.auth.mfa.challenge({factorId:factor.id});
      if(challengeError)throw challengeError;
      const {error:verifyError}=await client.auth.mfa.verify({factorId:factor.id,challengeId:challenge.id,code:mfaCode});
      if(verifyError)throw verifyError;
      setMfaVerified(true);setError("");
    }catch(cause){setError(cause instanceof Error?cause.message:"Authenticator verification failed.");}
    finally{setMfaBusy(false);}
  }
  async function submit(){
    if(!action||!acknowledged||!mfaVerified)return;
    setBusy(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/futures/live-order",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol,action,margin:action==="close"?0:Number(margin),confirmation:"PLACE LIVE FUTURES ORDER"})});
      const result=await response.json() as {accepted?:boolean;orderId?:string|null;clientOid?:string;error?:string};
      if(!response.ok||!result.accepted)throw new Error(result.error??"Bitget did not confirm this order.");
      setNotice("Bitget accepted the live order · "+(result.orderId?"Order "+result.orderId:"Ref "+result.clientOid));
      setAction(null);setAcknowledged(false);
      window.setTimeout(()=>router.refresh(),800);
    }catch(cause){setError(cause instanceof Error?cause.message:"Live order could not be confirmed.");}
    finally{setBusy(false);}
  }
  return <section className="station-panel station-live-ticket">
    <div className="station-panel-head"><div><span className="station-eyebrow">LIVE EXECUTION · BITGET</span><h2>Trade {symbol}</h2></div><span className="station-leverage">ISOLATED · 1×</span></div>
    <div className="station-live-wallet"><div><span>USDT equity</span><b>{account?usd(account.equityUSDT):"—"}</b></div><div><span>Available</span><b>{account?usd(account.availableUSDT):"—"}</b></div></div>
    <label className="station-size-field"><span>Isolated margin <small>USDT · cap $250 per order</small></span><span className="station-size-input"><input type="number" min="10" max="250" step="1" value={margin} onChange={event=>setMargin(event.target.value)} disabled={!!position}/></span></label>
    <div className="station-live-estimate"><span>Market execution</span><b>{price?usd(price,4)+" USDT":"Waiting for Bitget quote"}</b><span>Est. quantity · 1×</span><b>{quantity?quantity.toFixed(6)+" "+symbol.replace("USDT",""):"—"}</b><span>Account mode</span><b>{account?.holdMode?.replaceAll("_"," ")??"Loading…"}</b></div>
    {!position?<div className="station-ticket-switch"><button type="button" className="buy" disabled={busy||!price||!!accountError||Number(margin)<10||Number(margin)>250||Number(margin)>(account?.availableUSDT??0)} onClick={()=>{setAction("open_long");setAcknowledged(false);setMfaCode("");setMfaVerified(false);setError("");}}>Open Long</button><button type="button" className="sell" disabled={busy||!price||!!accountError||Number(margin)<10||Number(margin)>250||Number(margin)>(account?.availableUSDT??0)} onClick={()=>{setAction("open_short");setAcknowledged(false);setMfaCode("");setMfaVerified(false);setError("");}}>Open Short</button></div>:<div className="station-open-position"><div><span>OPEN {position.side.toUpperCase()} · LIVE</span><b>{position.quantity.toFixed(6)} {symbol.replace("USDT","")}</b></div><div><small>Entry {usd(position.entryPrice,4)}</small><small>Unrealized {usd(position.unrealizedPnl)}</small></div><button type="button" className="station-close-button" disabled={busy||!position.quantity} onClick={()=>{setAction("close");setAcknowledged(false);setMfaCode("");setMfaVerified(false);setError("");}}>Close live position at market</button></div>}
    <p className="station-risk-note">Every live order requires a separate confirmation. New positions are capped at $250 isolated margin and set to 1×. Check your Bitget positions and order history after execution.</p>
    {accountError?<p className="station-error" role="alert">{accountError}</p>:null}{error?<p className="station-error" role="alert">{error}</p>:null}{notice?<p className="station-notice" role="status">{notice}</p>:null}
    <div className="station-live-footer"><span>Live position snapshot refreshes every 10 seconds</span><a href="/settings">API connection settings ↗</a></div>
    {action?<div className="station-modal-backdrop"><section className="station-terms-modal station-live-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="live-order-confirm-title"><button className="station-modal-close" type="button" aria-label="Cancel live order" onClick={()=>{setAction(null);setMfaCode("");setMfaVerified(false);}}>×</button><span className="station-eyebrow">BITGET · LIVE ORDER CONFIRMATION</span><h2 id="live-order-confirm-title">{action==="close"?"Close live position":action==="open_long"?"Open live long":"Open live short"} · {symbol}</h2><div className="station-live-order-summary"><div><span>Execution</span><b>Market order</b></div><div><span>Reference price</span><b>{price?usd(price,4)+" USDT":"—"}</b></div><div><span>{action==="close"?"Position quantity":"Estimated quantity"}</span><b>{action==="close"?(position?.quantity??0).toFixed(6)+" "+symbol.replace("USDT",""):quantity.toFixed(6)+" "+symbol.replace("USDT","")}</b></div><div><span>{action==="close"?"Account margin":"Isolated margin · 1×"}</span><b>{action==="close"?"Bitget position":usd(Number(margin))}</b></div></div><p className="station-terms-note">This submits a real order to Bitget. The final fill price may differ from the quote. Verify the contract, direction and size. Tidelight never requests withdrawal permission.</p><label className="station-live-check"><input type="checkbox" checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)}/><span>I reviewed this live order and authorize Bitget to submit it.</span></label><div className="station-mfa-stepup"><label htmlFor="live-order-totp">Authenticator code · required for each live order</label><div><input id="live-order-totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={event=>{setMfaCode(event.target.value.replace(/\D/g,""));setMfaVerified(false);}} placeholder="000000"/><button type="button" disabled={mfaBusy||mfaCode.length!==6} onClick={()=>void verifyAuthenticator()}>{mfaBusy?"Verifying…":mfaVerified?"Verified ✓":"Verify code"}</button></div></div>{error?<p className="station-error" role="alert">{error}</p>:null}<div className="station-terms-actions"><button type="button" className="station-cancel" onClick={()=>{setAction(null);setMfaCode("");setMfaVerified(false);}}>Cancel order</button><button type="button" className="station-accept" disabled={!acknowledged||!mfaVerified||busy||!price} onClick={()=>void submit()}>{busy?"Submitting…":"Confirm & send live order"}</button></div></section></div>:null}
  </section>;
}

export default function FuturesTradingStation({signedIn,initialSymbol,researchRunId,cash,paused,position,decisions,fills,liveStatus,liveRequestedAt,liveReviewNote,liveKeyConfigured}:{signedIn:boolean;initialSymbol?:string;researchRunId?:string;cash:number;paused:boolean;position:PaperPosition|null;decisions:Decision[];fills:Fill[];liveStatus:AccessStatus;liveRequestedAt:string|null;liveReviewNote:string|null;liveKeyConfigured:boolean}){
  const router=useRouter();
  const {language}=useLanguage();
  const chinese=language==="zh-CN";
  const [symbol,setSymbol]=useState(initialSymbol??position?.symbol??"NVDAUSDT");
  const [interval,setInterval]=useState<Interval>("15m");
  const [payload,setPayload]=useState<MarketPayload|null>(null);
  const [dataError,setDataError]=useState("");
  const [depthTab,setDepthTab]=useState<"book"|"trades">("book");
  const [size,setSize]=useState("50");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [liveMode,setLiveMode]=useState(false);
  const [termsOpen,setTermsOpen]=useState(false);
  const [terms,setTerms]=useState<Record<string,boolean>>({market_risk:false,liquidation:false,api_permissions:false,key_security:false,manual_orders:false});
  const [accessBusy,setAccessBusy]=useState(false);
  const [accessError,setAccessError]=useState("");
  const [isPaused,setPaused]=useState(paused);
  const [playbook,setPlaybook]=useState<StrategyKey>(BACKTEST_STRATEGY);
  const activePosition=position?.symbol===symbol?position:null;
  const allTermsAccepted=LIVE_TERMS.every(item=>terms[item.key]);
  const price=payload?.market.lastPrice??null;
  const quantity=price?Math.max(0,Number(size)||0)/price:0;
  const unrealized=activePosition&&price?activePosition.quantity*(price-activePosition.entry_fill)*(activePosition.direction==="long"?1:-1):0;
  const equity=cash+(activePosition?.margin??0)+unrealized;
  const fillsOnChart=useMemo(()=>fills.filter(fill=>fill.symbol===symbol).map(fill=>({side:tradeSide(fill),timestamp:new Date(fill.created_at).getTime(),price:fill.fill_price})),[fills,symbol]);
  useEffect(()=>{
    let active=true;const controller=new AbortController();
    const refresh=async()=>{
      try{
        const response=await fetch("/api/futures/candles?symbol="+encodeURIComponent(symbol)+"&interval="+encodeURIComponent(interval),{cache:"no-store",signal:controller.signal});
        const next=await response.json() as MarketPayload&{error?:string};
        if(!response.ok)throw new Error(next.error??"Bitget market data is unavailable.");
        if(active){setPayload(next);setDataError("");}
      }catch(cause){if(active&&!(cause instanceof DOMException&&cause.name==="AbortError"))setDataError(cause instanceof Error?cause.message:"Bitget market data is unavailable.");}
    };
    void refresh();const timer=window.setInterval(()=>void refresh(),8000);
    return()=>{active=false;controller.abort();window.clearInterval(timer);};
  },[symbol,interval]);
  function switchToLive(){
    if(!signedIn){router.push("/login");return;}
    if(liveStatus==="approved"&&liveKeyConfigured){setLiveMode(true);return;}
    if(!liveKeyConfigured){router.push("/settings?setup=futures-live");return;}
    setAccessError("");setTermsOpen(true);
  }
  async function requestLiveAccess(){
    if(!allTermsAccepted)return;
    setAccessBusy(true);setAccessError("");
    try{
      const accepted=Object.fromEntries(LIVE_TERMS.map(item=>[item.key,true]));
      const response=await fetch("/api/futures/live-access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({termsVersion:"2026-10-13",accepted})});
      const result=await response.json() as {status?:AccessStatus;error?:string};
      if(!response.ok)throw new Error(result.error??"Could not submit live access request.");
      setTermsOpen(false);setNotice("LIVE ACCESS REQUEST · SUBMITTED FOR REVIEW");router.refresh();
    }catch(cause){setAccessError(cause instanceof Error?cause.message:"Could not submit live access request.");}
    finally{setAccessBusy(false);}
  }
  async function place(action:"open_long"|"open_short"|"close"){
    if(!signedIn){router.push("/login");return;}
    if(!payload?.market.lastPrice){setError("Wait for a verified Bitget quote before placing a paper order.");return;}
    if(action!=="close"&&(!Number.isFinite(Number(size))||Number(size)<10||Number(size)>250)){setError("Enter a paper margin between $10 and $250 USDT.");return;}
    setBusy(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/futures/manual",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol,action,margin:action==="close"?0:Number(size)})});
      const result=await response.json() as {result?:{action:string;outcome:string;reason:string;fillPrice:number;quantity:number};error?:string};
      if(!response.ok||!result.result)throw new Error(result.error??"Order was not accepted.");
      setNotice(result.result.action.replaceAll("_"," ").toUpperCase()+" · "+result.result.outcome.toUpperCase()+" · "+result.result.reason);
      router.refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:"Paper order failed.");}
    finally{setBusy(false);}
  }
  async function runAgent(){
    if(!signedIn){router.push("/login");return;}
    setBusy(true);setError("");setNotice("");
    try{
      const response=await fetch("/api/futures/paper",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({symbol,mode:"check",playbookKey:playbook,researchRunId})});
      const result=await response.json() as {result?:{action?:string;outcome:string;reason:string};error?:string};
      if(!response.ok||!result.result)throw new Error(result.error??"Agent check could not finish.");
      setNotice("ALPHA CHECK · "+(result.result.action??"hold").replaceAll("_"," ").toUpperCase()+" · "+result.result.reason);router.refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:"Alpha Factory check unavailable.");}
    finally{setBusy(false);}
  }
  async function setAccountPause(){
    if(!signedIn){router.push("/login");return;}setBusy(true);setError("");
    try{const response=await fetch("/api/futures/paper",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({paused:!isPaused})});const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error??"Paper control unavailable.");setPaused(!isPaused);router.refresh();}
    catch(cause){setError(cause instanceof Error?cause.message:"Paper control unavailable.");}
    finally{setBusy(false);}
  }
  const bestAsk=payload?.orderbook.asks[0]?.price,bestBid=payload?.orderbook.bids[0]?.price;
  const spread=bestAsk&&bestBid?((bestAsk-bestBid)/((bestAsk+bestBid)/2))*10000:null;
  const freshness=payload?.market.providerTimestamp?Math.max(0,Math.floor((Date.now()-payload.market.providerTimestamp)/1000)):null;
  return <div className="content-wrap inner-page futures-station">
    <header className="station-heading"><div><span className="station-eyebrow">TIDELIGHT · {chinese?"BITGET 美股永续合约":"BITGET USDT FUTURES"}</span><h1>{chinese?<>美股 <span>永续合约</span></>:<>US stock <span>perpetuals</span></>}</h1><p>{chinese?"Bitget 实时行情、10,000 USDT 模拟账户，以及经过审批的实盘权限流程。":"Bitget’s live market, a funded $10,000 paper account, and a gated live access path."}</p></div><div className="station-mode"><i/>{liveMode?"LIVE ACCESS APPROVED":"PAPER ACCOUNT"}<span>{liveMode?"LIVE MODE":"SIMULATED EXECUTION"}</span><div className="station-mode-switch" role="group" aria-label="Execution mode"><button type="button" aria-pressed={!liveMode} onClick={()=>setLiveMode(false)}>{chinese?"模拟":"Paper"}</button><button type="button" aria-pressed={liveMode} onClick={switchToLive}>{chinese?"实盘":"Live"}</button></div></div></header>
    {liveStatus==="pending"?<section className="station-live-status pending"><b>Live access review in progress</b><span>Your request is securely queued for review. Reviews typically take minutes to a few hours. You can continue using paper mode while we review it.</span>{liveRequestedAt?<time>{time(liveRequestedAt)}</time>:null}</section>:null}
    {liveStatus==="rejected"?<section className="station-live-status rejected"><b>Live access needs attention</b><span>Review the operator note below, update your Bitget connection if requested, then submit a new request.</span>{liveReviewNote?<small>{liveReviewNote}</small>:null}</section>:null}
    {liveMode?<section className="station-live-status approved"><b>Live trading access approved</b><span>Live orders affect your Bitget account. Review the contract, quantity and estimated margin before each submission.</span><button type="button" onClick={()=>router.push("/settings")}>Connection settings ↗</button></section>:null}
    {termsOpen?<div className="station-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setTermsOpen(false);}}><section className="station-terms-modal" role="dialog" aria-modal="true" aria-labelledby="live-terms-title"><button className="station-modal-close" type="button" aria-label="Close live access terms" onClick={()=>setTermsOpen(false)}>×</button><span className="station-eyebrow">TIDELIGHT · LIVE ACCESS REVIEW</span><h2 id="live-terms-title">Before you enable live futures</h2><p className="station-terms-intro">Read and acknowledge each item. This requests access; it does not immediately place an order. Your Bitget futures permissions are checked before the request enters review.</p><div className="station-terms-list">{LIVE_TERMS.map(item=><label key={item.key}><input type="checkbox" checked={!!terms[item.key]} onChange={event=>setTerms(value=>({...value,[item.key]:event.target.checked}))}/><span><b>{item.title}</b><small>{item.body}</small></span></label>)}</div><p className="station-terms-note">Live access requires a verified Bitget live connection and operator approval. Approval can take minutes to hours. Your paper account remains available during review.</p>{accessError?<p className="station-error" role="alert">{accessError}</p>:null}<div className="station-terms-actions"><button type="button" className="station-cancel" onClick={()=>setTermsOpen(false)}>Cancel</button><button type="button" className="station-accept" disabled={!allTermsAccepted||accessBusy||liveStatus==="pending"} onClick={()=>void requestLiveAccess()}>{accessBusy?"Checking connection…":"Accept terms & request access"}</button></div></section></div>:null}
    <section className="station-market-strip">
      <label className="station-symbol"><span>CONTRACT</span><select value={symbol} onChange={event=>setSymbol(event.target.value)}>{STOCK_PERP_UNIVERSE.map(item=><option value={item} key={item}>{item}</option>)}</select></label>
      <div className="station-last"><span>LAST PRICE <small>USDT</small></span><b>{price?usd(price,4):"—"}</b><small className={payload?.market.change24h!==null&&payload?.market.change24h!==undefined&&payload.market.change24h>=0?"positive":"negative"}>{payload?.market.change24h===null||payload?.market.change24h===undefined?"24h change —":(payload.market.change24h>=0?"+":"")+(payload.market.change24h*100).toFixed(2)+"% · 24h"}</small></div>
      <div className="station-stat"><span>24H HIGH</span><b>{payload?.market.high24h?usd(payload.market.high24h,4):"—"}</b></div><div className="station-stat"><span>24H LOW</span><b>{payload?.market.low24h?usd(payload.market.low24h,4):"—"}</b></div><div className="station-stat"><span>TURNOVER</span><b>{payload?.market.turnover24h?compact(payload.market.turnover24h)+" USDT":"—"}</b></div><div className="station-feed"><i/>{freshness===null?(chinese?"等待 Bitget 数据":"Waiting for Bitget"):freshness<60?(chinese?"Bitget 报价 · "+freshness+" 秒前":"Bitget quote · "+freshness+"s ago"):(chinese?"报价已过 "+Math.floor(freshness/60)+" 分钟":"Quote is "+Math.floor(freshness/60)+"m old")}</div>
    </section>
    <div className="station-workspace">
      <main className="station-main">
        <section className="station-panel station-chart-panel">
          <div className="station-chart-head"><div><span className="station-eyebrow">{chinese?"BITGET · K线":"BITGET · OHLCV"}</span><h2>{symbol}<small>{chinese?" / USDT 永续合约":" / USDT PERPETUAL"}</small></h2></div><div className="station-chart-tools"><div className="station-intervals" role="group" aria-label="Chart interval">{intervals.map(item=><button type="button" key={item} aria-pressed={interval===item} onClick={()=>setInterval(item)}>{item}</button>)}</div><ChartShareButton symbol={symbol} interval={interval} candles={payload?.candles??[]} markers={fillsOnChart} market="BITGET USDT FUTURES"/></div></div>
          <div className="station-ohlc"><span>O <b>{payload?.candles.at(-1)?.open.toLocaleString(undefined,{maximumFractionDigits:4})??"—"}</b></span><span>H <b>{payload?.candles.at(-1)?.high.toLocaleString(undefined,{maximumFractionDigits:4})??"—"}</b></span><span>L <b>{payload?.candles.at(-1)?.low.toLocaleString(undefined,{maximumFractionDigits:4})??"—"}</b></span><span>C <b>{payload?.candles.at(-1)?.close.toLocaleString(undefined,{maximumFractionDigits:4})??"—"}</b></span><span className="station-volume-read">VOL <b>{payload?.candles.at(-1)?.volume?compact(payload.candles.at(-1)!.volume!):"—"}</b></span></div>
          {payload?.candles.length?<CandlestickChart candles={payload.candles} symbol={symbol} lastPrice={price} interval={interval} fills={fills} position={position}/>:<div className="station-chart-empty" role="status">{dataError||"Loading verified Bitget candlesticks…"}</div>}
          <div className="station-chart-foot"><span>{payload?.candles.length??0} candles · {interval} · Bitget USDT-FUTURES</span><span>Prices in USDT · completed and current market bars</span></div>
        </section>
        <OrderBook payload={payload} tab={depthTab} setTab={setDepthTab} chinese={chinese}/>
        {!liveMode?        <section className="station-panel station-history"><div className="station-panel-head"><div><span className="station-eyebrow">{chinese?"私人模拟执行":"PRIVATE SIMULATED EXECUTION"}</span><h2>Recent fills</h2></div><span className="station-subtle">{fills.length} recorded</span></div>{fills.length?<div className="station-fill-table"><div className="station-table-labels"><span>Side</span><span>Contract</span><span>Fill price</span><span>Quantity</span><span>Time</span></div>{fills.slice(0,8).map(fill=><div className="station-fill-row" key={fill.id}><b className={tradeSide(fill)==="B"?"buy":"sell"}>{tradeSide(fill)} · {fill.action.replaceAll("_"," ")}</b><span>{fill.symbol}</span><span>{usd(fill.fill_price,4)}</span><span>{Number(fill.quantity).toFixed(5)}</span><small>{time(fill.created_at)}</small></div>)}</div>:<p className="station-empty">Your paper fills appear here after an order is submitted.</p>}</section>:null}
      </main>
      <aside className="station-aside">
        {!liveMode?<section className="station-panel station-ticket">
          <div className="station-panel-head"><div><span className="station-eyebrow">{chinese?"下单 · 市价":"ORDER ENTRY · MARKET"}</span><h2>Trade {symbol}</h2></div><span className="station-leverage">ISOLATED · 1×</span></div>
          <div className="station-ticket-switch"><button type="button" className="buy" disabled={!!position||busy||isPaused||!signedIn} onClick={()=>void place("open_long")}>Buy / Long</button><button type="button" className="sell" disabled={!!position||busy||isPaused||!signedIn} onClick={()=>void place("open_short")}>Sell / Short</button></div>
          <label className="station-size-field"><span>Margin size <small>USDT</small></span><span className="station-size-input"><input type="number" min="10" max="250" step="1" value={size} onChange={event=>setSize(event.target.value)} disabled={!!position}/><button type="button" onClick={()=>setSize("250")} disabled={!!position}>MAX</button></span></label>
          <div className="station-size-rail" aria-hidden="true"><i style={{width:Math.max(0,Math.min(100,(Number(size)||0)/250*100))+"%"}}/></div>
          <dl className="station-order-estimates"><div><dt>Order type</dt><dd>Market</dd></div><div><dt>Est. quantity</dt><dd>{quantity?quantity.toFixed(6)+" "+symbol.replace("USDT",""):"—"}</dd></div><div><dt>Initial margin</dt><dd>{Number(size)>=10?usd(Number(size)):"—"}</dd></div><div><dt>Fee estimate</dt><dd>{Number(size)>=10?usd(Number(size)*.001):"—"}</dd></div><div><dt>Best bid / ask</dt><dd>{bestBid&&bestAsk?bestBid.toFixed(4)+" / "+bestAsk.toFixed(4):"—"}</dd></div><div><dt>Spread</dt><dd>{spread===null?"—":spread.toFixed(2)+" bps"}</dd></div></dl>
          <p className="station-risk-note">{chinese?"模拟成交参考 Bitget 最新公开价格，预计不利滑点为 0.05%，手续费为 0.10%。初始保证金上限为 250 USDT，杠杆 1×。":"Paper fills use Bitget's latest public mark with 0.05% estimated adverse slippage and a 0.10% fee. Maximum initial margin is $250 at 1×."}</p>
          {!signedIn?<a className="station-signin" href="/login">Sign in to place paper orders</a>:isPaused?<button className="station-submit-muted" disabled>Entries paused · resume below</button>:null}
          {position&&position.symbol===symbol?<div className="station-open-position"><div><span>OPEN {position.direction.toUpperCase()}</span><b>{Number(position.quantity).toFixed(6)} {symbol.replace("USDT","")}</b></div><div><small>Entry {usd(Number(position.entry_fill),4)}</small><small>Unrealized {usd(unrealized)}</small></div><button type="button" className="station-close-button" disabled={busy} onClick={()=>void place("close")}>{busy?"Closing…":"Close position at market"}</button></div>:position?<p className="station-risk-note">You have an open {position.symbol} position. Close it before opening another contract.</p>:null}
          {error?<p className="station-error" role="alert">{error}</p>:null}{notice?<p className="station-notice" role="status">{notice}</p>:null}
        </section> : <LiveTradePanel symbol={symbol} price={price}/> }
        {!liveMode?<section className="station-panel station-account">
          <div className="station-panel-head"><div><span className="station-eyebrow">{chinese?"您的模拟账户":"YOUR PAPER ACCOUNT"}</span><h2>Risk & collateral</h2></div><button type="button" className="station-pause" onClick={()=>void setAccountPause()} disabled={busy||!signedIn}>{isPaused?"Resume entries":"Pause entries"}</button></div>
          <div className="station-account-grid"><div><span>Equity</span><b>{usd(equity)}</b></div><div><span>Available cash</span><b>{usd(cash)}</b></div><div><span>Reserved margin</span><b>{usd(position?.margin??0)}</b></div><div><span>Unrealized P&L</span><b className={unrealized>=0?"positive":"negative"}>{usd(unrealized)}</b></div></div>
          <p className="station-account-foot">{chinese?"仅使用模拟资金 · 独立保证金 · 每日亏损熔断 200 美元 · 每天最多 5 笔成交":"Paper capital only · isolated position · daily loss circuit $200 · up to 5 fills per day"}</p>
        </section> : null}
        {!liveMode?<details className="station-panel station-agent">
          <summary><span><span className="station-eyebrow">{chinese?"ALPHA FACTORY · 可选策略检查":"ALPHA FACTORY · OPTIONAL AGENT CHECK"}</span><b>{chinese?"使用策略分析此市场":"Review this market with a strategy"}</b></span><i>⌄</i></summary>
          <p>{chinese?"此策略会单独检查已完成的 K 线，不会与手动模拟订单混用。":"Runs the existing completed-candle strategy review separately from manual paper orders."}</p>
          <label>Playbook<select value={playbook} onChange={event=>setPlaybook(event.target.value as StrategyKey)}>{Object.entries(ALPHA_STRATEGIES).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}</select></label>
          <button type="button" onClick={()=>void runAgent()} disabled={busy||!signedIn}>{busy?(chinese?"分析中…":"Reviewing…"):(chinese?"运行策略检查":"Run strategy check")}</button>
          {decisions.slice(0,3).map(item=><div className="station-decision" key={item.id}><span>{item.symbol} · {item.action.replaceAll("_"," ")} · {item.outcome}</span><small>{item.reason}</small></div>)}
        </details>:null}
      </aside>
    </div>
    {!liveMode?<div className="station-mobile-tradebar" role="group" aria-label={chinese?"模拟交易控制":"Paper trading controls"}>
      <button type="button" className="mobile-long" disabled={!!position||busy||isPaused||!price} onClick={()=>void place("open_long")}><span>{chinese?"做多":"Long"}</span><b>{price?price.toLocaleString(undefined,{maximumFractionDigits:4}):"—"}</b></button>
      <label className="mobile-size"><span>Margin · USDT</span><input type="number" min="10" max="250" step="1" inputMode="decimal" aria-label="Paper margin in USDT" value={size} onChange={event=>setSize(event.target.value)} disabled={!!position}/></label>
      <button type="button" className="mobile-short" disabled={!!position||busy||isPaused||!price} onClick={()=>void place("open_short")}><span>{chinese?"做空":"Short"}</span><b>{price?price.toLocaleString(undefined,{maximumFractionDigits:4}):"—"}</b></button>
    </div>:null}
    <p className="station-boundary">{liveMode?(chinese?"实盘模式会将逐笔确认的 USDT 永续合约订单发送至 Bitget。模拟资金与实盘资金相互独立。":"Approved live mode routes individually confirmed USDT perpetual orders to Bitget. Paper capital remains separate."):(chinese?"模拟模式使用 Bitget 公开行情和 Tidelight 模拟撮合，不会发送真实订单。":"Paper mode uses Bitget public market data and Tidelight paper execution. No real orders are sent.")}</p>
  </div>;
}
