"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ALPHA_STRATEGIES, BACKTEST_STRATEGY, type StrategyKey } from "@/lib/backtest";
import { STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";
import ChartShareButton, { type ShareCandle, type ShareMarker } from "@/app/ui/chart-share-button";

type PaperPosition={symbol:string;direction:"long"|"short";quantity:number;entry_fill:number;margin:number;entry_fee:number;opened_at:string};
type Fill={id:string;symbol:string;action:string;direction:string;quantity:number;fill_price:number;notional:number;fee:number;realized_pnl:number;created_at:string};
type Decision={id:string;symbol:string;action:string;outcome:string;reason:string;reference_price:number;realized_pnl:number;created_at:string};
type Candle=ShareCandle;
type Depth={price:number;size:number};
type PublicTrade={id:string;price:number;size:number;side:"buy"|"sell";timestamp:number};
type MarketPayload={market:{symbol:string;lastPrice:number;change24h:number|null;high24h:number|null;low24h:number|null;open24h:number|null;volume24h:number|null;turnover24h:number|null;providerTimestamp:number|null};candles:Candle[];orderbook:{asks:Depth[];bids:Depth[];timestamp:number|null};trades:PublicTrade[];interval:string};
const usd=(value:number,decimals=2)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:decimals,minimumFractionDigits:decimals}).format(value);
const compact=(value:number)=>new Intl.NumberFormat("en-US",{notation:"compact",maximumFractionDigits:2}).format(value);
const time=(value:string|number)=>new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
const intervals=["15m","1H","4H","1D"] as const;
type Interval=typeof intervals[number];
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

function OrderBook({payload,tab,setTab}:{payload:MarketPayload|null;tab:"book"|"trades";setTab:(tab:"book"|"trades")=>void}){
  const asks=payload?.orderbook.asks.slice(0,8).reverse()??[],bids=payload?.orderbook.bids.slice(0,8)??[];
  const maxSize=Math.max(1,...asks.map(x=>x.size),...bids.map(x=>x.size));
  const bestAsk=payload?.orderbook.asks[0]?.price,bestBid=payload?.orderbook.bids[0]?.price,spread=bestAsk&&bestBid?bestAsk-bestBid:null;
  return <section className="station-panel station-depth">
    <div className="station-panel-head"><div><span className="station-eyebrow">BITGET · PUBLIC MARKET DATA</span><h2>Market depth</h2></div><div className="station-tabs"><button type="button" aria-pressed={tab==="book"} onClick={()=>setTab("book")}>Order book</button><button type="button" aria-pressed={tab==="trades"} onClick={()=>setTab("trades")}>Recent trades</button></div></div>
    {tab==="book"?<><div className="station-book-labels"><span>Price (USDT)</span><span>Size</span><span>Total</span></div><div className="station-book-asks">{asks.map((level,index)=><div className="station-book-row ask" key={"a"+index}><i style={{width:Math.max(2,level.size/maxSize*100)+"%"}}/><b>{level.price.toLocaleString(undefined,{maximumFractionDigits:4})}</b><span>{level.size.toFixed(4)}</span><small>{(level.price*level.size).toLocaleString(undefined,{maximumFractionDigits:2})}</small></div>)}</div><div className="station-spread"><b>{payload?usd(payload.market.lastPrice,4):"—"}</b><span>{spread===null?"Spread waiting":("Spread "+spread.toFixed(4)+" USDT")}</span></div><div className="station-book-bids">{bids.map((level,index)=><div className="station-book-row bid" key={"b"+index}><i style={{width:Math.max(2,level.size/maxSize*100)+"%"}}/><b>{level.price.toLocaleString(undefined,{maximumFractionDigits:4})}</b><span>{level.size.toFixed(4)}</span><small>{(level.price*level.size).toLocaleString(undefined,{maximumFractionDigits:2})}</small></div>)}</div><p className="station-data-note">Public depth from Bitget · refreshed with market snapshot</p></>:<div className="station-trades">{(payload?.trades??[]).slice(0,14).map(trade=><div className="station-trade-row" key={trade.id}><b className={trade.side==="buy"?"buy":"sell"}>{trade.price.toLocaleString(undefined,{maximumFractionDigits:4})}</b><span>{trade.size.toFixed(4)}</span><small>{time(trade.timestamp)}</small></div>)}</div>}
  </section>;
}

export default function FuturesTradingStation({signedIn,initialSymbol,researchRunId,cash,paused,position,decisions,fills}:{signedIn:boolean;initialSymbol?:string;researchRunId?:string;cash:number;paused:boolean;position:PaperPosition|null;decisions:Decision[];fills:Fill[]}){
  const router=useRouter();
  const [symbol,setSymbol]=useState(initialSymbol??position?.symbol??"NVDAUSDT");
  const [interval,setInterval]=useState<Interval>("15m");
  const [payload,setPayload]=useState<MarketPayload|null>(null);
  const [dataError,setDataError]=useState("");
  const [depthTab,setDepthTab]=useState<"book"|"trades">("book");
  const [size,setSize]=useState("50");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [isPaused,setPaused]=useState(paused);
  const [playbook,setPlaybook]=useState<StrategyKey>(BACKTEST_STRATEGY);
  const activePosition=position?.symbol===symbol?position:null;
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
    <header className="station-heading"><div><span className="station-eyebrow">TIDELIGHT · BITGET USDT FUTURES</span><h1>US stock <span>perpetuals</span></h1><p>Live Bitget market data with a private, risk limited paper execution account.</p></div><div className="station-mode"><i/>PAPER EXECUTION<span>LIVE ORDERS NOT CONNECTED</span></div></header>
    <section className="station-market-strip">
      <label className="station-symbol"><span>CONTRACT</span><select value={symbol} onChange={event=>setSymbol(event.target.value)}>{STOCK_PERP_UNIVERSE.map(item=><option value={item} key={item}>{item}</option>)}</select></label>
      <div className="station-last"><span>LAST PRICE <small>USDT</small></span><b>{price?usd(price,4):"—"}</b><small className={payload?.market.change24h!==null&&payload?.market.change24h!==undefined&&payload.market.change24h>=0?"positive":"negative"}>{payload?.market.change24h===null||payload?.market.change24h===undefined?"24h change —":(payload.market.change24h>=0?"+":"")+(payload.market.change24h*100).toFixed(2)+"% · 24h"}</small></div>
      <div className="station-stat"><span>24H HIGH</span><b>{payload?.market.high24h?usd(payload.market.high24h,4):"—"}</b></div><div className="station-stat"><span>24H LOW</span><b>{payload?.market.low24h?usd(payload.market.low24h,4):"—"}</b></div><div className="station-stat"><span>TURNOVER</span><b>{payload?.market.turnover24h?compact(payload.market.turnover24h)+" USDT":"—"}</b></div><div className="station-feed"><i/>{freshness===null?"Waiting for Bitget":freshness<60?"Bitget quote · "+freshness+"s ago":"Quote is "+Math.floor(freshness/60)+"m old"}</div>
    </section>
    <div className="station-workspace">
      <main className="station-main">
        <section className="station-panel station-chart-panel">
          <div className="station-chart-head"><div><span className="station-eyebrow">BITGET · OHLCV</span><h2>{symbol}<small> / USDT PERPETUAL</small></h2></div><div className="station-chart-tools"><div className="station-intervals" role="group" aria-label="Chart interval">{intervals.map(item=><button type="button" key={item} aria-pressed={interval===item} onClick={()=>setInterval(item)}>{item}</button>)}</div><ChartShareButton symbol={symbol} interval={interval} candles={payload?.candles??[]} markers={fillsOnChart} market="BITGET USDT FUTURES"/></div></div>
          <div className="station-ohlc"><span>O <b>{payload?.candles.at(-1)?.open.toLocaleString(undefined,{maximumFractionDigits:4})??"—"}</b></span><span>H <b>{payload?.candles.at(-1)?.high.toLocaleString(undefined,{maximumFractionDigits:4})??"—"}</b></span><span>L <b>{payload?.candles.at(-1)?.low.toLocaleString(undefined,{maximumFractionDigits:4})??"—"}</b></span><span>C <b>{payload?.candles.at(-1)?.close.toLocaleString(undefined,{maximumFractionDigits:4})??"—"}</b></span><span className="station-volume-read">VOL <b>{payload?.candles.at(-1)?.volume?compact(payload.candles.at(-1)!.volume!):"—"}</b></span></div>
          {payload?.candles.length?<CandlestickChart candles={payload.candles} symbol={symbol} lastPrice={price} interval={interval} fills={fills} position={position}/>:<div className="station-chart-empty" role="status">{dataError||"Loading verified Bitget candlesticks…"}</div>}
          <div className="station-chart-foot"><span>{payload?.candles.length??0} candles · {interval} · Bitget USDT-FUTURES</span><span>Prices in USDT · completed and current market bars</span></div>
        </section>
        <OrderBook payload={payload} tab={depthTab} setTab={setDepthTab}/>
        <section className="station-panel station-history"><div className="station-panel-head"><div><span className="station-eyebrow">PRIVATE SIMULATED EXECUTION</span><h2>Recent fills</h2></div><span className="station-subtle">{fills.length} recorded</span></div>{fills.length?<div className="station-fill-table"><div className="station-table-labels"><span>Side</span><span>Contract</span><span>Fill price</span><span>Quantity</span><span>Time</span></div>{fills.slice(0,8).map(fill=><div className="station-fill-row" key={fill.id}><b className={tradeSide(fill)==="B"?"buy":"sell"}>{tradeSide(fill)} · {fill.action.replaceAll("_"," ")}</b><span>{fill.symbol}</span><span>{usd(fill.fill_price,4)}</span><span>{Number(fill.quantity).toFixed(5)}</span><small>{time(fill.created_at)}</small></div>)}</div>:<p className="station-empty">Your paper fills appear here after an order is submitted.</p>}</section>
      </main>
      <aside className="station-aside">
        <section className="station-panel station-ticket">
          <div className="station-panel-head"><div><span className="station-eyebrow">ORDER ENTRY · MARKET</span><h2>Trade {symbol}</h2></div><span className="station-leverage">ISOLATED · 1×</span></div>
          <div className="station-ticket-switch"><button type="button" className="buy" disabled={!!position||busy||isPaused||!signedIn} onClick={()=>void place("open_long")}>Buy / Long</button><button type="button" className="sell" disabled={!!position||busy||isPaused||!signedIn} onClick={()=>void place("open_short")}>Sell / Short</button></div>
          <label className="station-size-field"><span>Margin size <small>USDT</small></span><span className="station-size-input"><input type="number" min="10" max="250" step="1" value={size} onChange={event=>setSize(event.target.value)} disabled={!!position}/><button type="button" onClick={()=>setSize("250")} disabled={!!position}>MAX</button></span></label>
          <div className="station-size-rail" aria-hidden="true"><i style={{width:Math.max(0,Math.min(100,(Number(size)||0)/250*100))+"%"}}/></div>
          <dl className="station-order-estimates"><div><dt>Order type</dt><dd>Market</dd></div><div><dt>Est. quantity</dt><dd>{quantity?quantity.toFixed(6)+" "+symbol.replace("USDT",""):"—"}</dd></div><div><dt>Initial margin</dt><dd>{Number(size)>=10?usd(Number(size)):"—"}</dd></div><div><dt>Fee estimate</dt><dd>{Number(size)>=10?usd(Number(size)*.001):"—"}</dd></div><div><dt>Best bid / ask</dt><dd>{bestBid&&bestAsk?bestBid.toFixed(4)+" / "+bestAsk.toFixed(4):"—"}</dd></div><div><dt>Spread</dt><dd>{spread===null?"—":spread.toFixed(2)+" bps"}</dd></div></dl>
          <p className="station-risk-note">Paper fills use Bitget's latest public mark with 0.05% estimated adverse slippage and a 0.10% fee. Maximum initial margin is $250 at 1×.</p>
          {!signedIn?<a className="station-signin" href="/login">Sign in to place paper orders</a>:isPaused?<button className="station-submit-muted" disabled>Entries paused · resume below</button>:null}
          {position&&position.symbol===symbol?<div className="station-open-position"><div><span>OPEN {position.direction.toUpperCase()}</span><b>{Number(position.quantity).toFixed(6)} {symbol.replace("USDT","")}</b></div><div><small>Entry {usd(Number(position.entry_fill),4)}</small><small>Unrealized {usd(unrealized)}</small></div><button type="button" className="station-close-button" disabled={busy} onClick={()=>void place("close")}>{busy?"Closing…":"Close position at market"}</button></div>:position?<p className="station-risk-note">You have an open {position.symbol} position. Close it before opening another contract.</p>:null}
          {error?<p className="station-error" role="alert">{error}</p>:null}{notice?<p className="station-notice" role="status">{notice}</p>:null}
        </section>
        <section className="station-panel station-account">
          <div className="station-panel-head"><div><span className="station-eyebrow">YOUR PAPER ACCOUNT</span><h2>Risk & collateral</h2></div><button type="button" className="station-pause" onClick={()=>void setAccountPause()} disabled={busy||!signedIn}>{isPaused?"Resume entries":"Pause entries"}</button></div>
          <div className="station-account-grid"><div><span>Equity</span><b>{usd(equity)}</b></div><div><span>Available cash</span><b>{usd(cash)}</b></div><div><span>Reserved margin</span><b>{usd(position?.margin??0)}</b></div><div><span>Unrealized P&L</span><b className={unrealized>=0?"positive":"negative"}>{usd(unrealized)}</b></div></div>
          <p className="station-account-foot">Paper capital only · isolated position · daily loss circuit $200 · up to 5 fills per day</p>
        </section>
        <details className="station-panel station-agent">
          <summary><span><span className="station-eyebrow">ALPHA FACTORY · OPTIONAL AGENT CHECK</span><b>Review this market with a strategy</b></span><i>⌄</i></summary>
          <p>Runs the existing completed-candle strategy review separately from manual paper orders.</p>
          <label>Playbook<select value={playbook} onChange={event=>setPlaybook(event.target.value as StrategyKey)}>{Object.entries(ALPHA_STRATEGIES).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}</select></label>
          <button type="button" onClick={()=>void runAgent()} disabled={busy||!signedIn}>{busy?"Reviewing…":"Run strategy check"}</button>
          {decisions.slice(0,3).map(item=><div className="station-decision" key={item.id}><span>{item.symbol} · {item.action.replaceAll("_"," ")} · {item.outcome}</span><small>{item.reason}</small></div>)}
        </details>
      </aside>
    </div>
    <p className="station-boundary">This workstation uses Bitget public market data and Tidelight paper execution. It does not send real exchange orders. Live US-stock perpetual execution is not connected.</p>
  </div>;
}
