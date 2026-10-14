import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bitgetPrivateRequest, getBitgetCredentials, BitgetRequestError } from "@/lib/bitget-private";
import { getBitgetStockPerp, STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";
import { MAX_ORDER_ATTEMPTS_PER_HOUR } from "@/lib/bitget-order-policy";

export const dynamic = "force-dynamic";
const MAX_MARGIN = 250;
async function publicInstruments(symbol: string) {
  const query=new URLSearchParams({category:"USDT-FUTURES",symbol});
  const response=await fetch("https://api.bitget.com/api/v3/market/instruments?"+query,{cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error("instrument-feed-unavailable");
  const result=await response.json() as {code?:string;data?:Array<{symbol:string;category:string;status?:string;type?:string;maxLeverage?:string;sizeMultiplier?:string;minOrderAmount?:string}>};
  if(result.code!=="00000")throw new Error("instrument-feed-unavailable");
  return result.data?.find(item=>item.symbol===symbol&&item.category==="USDT-FUTURES"&&(item.status==="online"||item.status===undefined));
}
export async function POST(request:Request) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Sign in to send a live futures order."},{status:401});
  let body:{symbol?:unknown;action?:unknown;margin?:unknown;leverage?:unknown;confirmation?:unknown};
  try{body=await request.json();}catch{return NextResponse.json({error:"Review the order and try again."},{status:400});}
  const symbol=typeof body.symbol==="string"?body.symbol.toUpperCase():"";
  const action=body.action;
  const margin=Number(body.margin);
  const leverage=Number(body.leverage??10);
  if(!Number.isInteger(leverage)||leverage<1||leverage>100)return NextResponse.json({error:"Leverage must be between 1× and 100×."},{status:400});
  if(!STOCK_PERP_UNIVERSE.some(item=>item===symbol)||!["open_long","open_short","close"].includes(String(action)))return NextResponse.json({error:"Choose a supported perpetual and order action."},{status:400});
  if((action==="open_long"||action==="open_short")&&(!Number.isFinite(margin)||margin<10||margin>MAX_MARGIN))return NextResponse.json({error:"Live order margin must be between 10 and 250 USDT."},{status:400});
  try{
    const admin=createAdminClient();
    const [{data:access},credentials]=await Promise.all([
      admin.from("futures_live_access_requests").select("status,accepted_terms").eq("user_id",user.id).maybeSingle(),
      getBitgetCredentials(user.id),
    ]);
    if(access?.status!=="approved"||!access.accepted_terms||!credentials||credentials.mode!=="live")return NextResponse.json({error:"Live futures access, accepted terms and a verified live Bitget key are required."},{status:403});
    if(body.confirmation!=="PLACE LIVE FUTURES ORDER")return NextResponse.json({error:"Confirm the live futures order before sending it."},{status:400});
    const {data:assurance}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if(assurance?.currentLevel!=="aal2")return NextResponse.json({error:"Complete an authenticator check before placing a live futures order.",mfaRequired:true},{status:403});
    const hourAgo=new Date(Date.now()-60*60*1000).toISOString();
    const {count:attempts,error:auditReadError}=await supabase.from("security_events").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("event_type","bitget_order_attempt").gte("created_at",hourAgo);
    if(auditReadError)return NextResponse.json({error:"Could not check the live order safety limit. No order was sent."},{status:503});
    if((attempts??0)>=MAX_ORDER_ATTEMPTS_PER_HOUR)return NextResponse.json({error:"This account has reached the five order attempts per hour safety limit."},{status:429});
    const [market,settingsResult,positionsResult,assetsResult]=await Promise.all([
      getBitgetStockPerp(symbol),
      bitgetPrivateRequest(credentials,"GET","/api/v3/account/settings"),
      bitgetPrivateRequest(credentials,"GET","/api/v3/position/current-position?category=USDT-FUTURES&symbol="+encodeURIComponent(symbol)),
      bitgetPrivateRequest(credentials,"GET","/api/v3/account/assets"),
    ]);
    if(!market?.lastPrice||!market.providerTimestamp||Date.now()-market.providerTimestamp>30000)return NextResponse.json({error:"Bitget's contract quote is stale. No live order was sent."},{status:503});
    const settings=settingsResult.data as {holdMode?:string;symbolConfigList?:Array<{category:string;symbol:string;marginMode:string;leverage:string}>};
    const holdMode=settings.holdMode;
    if(holdMode!=="one_way_mode"&&holdMode!=="hedge_mode")return NextResponse.json({error:"Bitget did not return a supported position mode. No live order was sent."},{status:409});
    const positions=((positionsResult.data as {list?:Array<{symbol:string;posSide:string;available?:string;total?:string}>}).list??[]).filter(position=>position.symbol===symbol&&Number(position.total??position.available??0)>0);
    const assetData=assetsResult.data as {assets?:Array<{coin:string;available?:string}>};
    const available=Number(assetData.assets?.find(item=>item.coin==="USDT")?.available??0);
    let side:"buy"|"sell",qty:number,posSide:"long"|"short"|undefined,reduceOnly:"yes"|undefined;
    if(action==="close"){
      if(positions.length!==1)return NextResponse.json({error:positions.length?"More than one side is open for this contract. Close positions in Bitget first.":"There is no open Bitget position for this contract."},{status:409});
      const position=positions[0],direction=position.posSide==="short"?"short":"long";
      qty=Number(position.available??position.total??0);
      if(!Number.isFinite(qty)||qty<=0)return NextResponse.json({error:"Bitget reports no available position quantity to close."},{status:409});
      side=direction==="long"?"sell":"buy";
      if(holdMode==="hedge_mode")posSide=direction;else reduceOnly="yes";
    }else{
      if(positions.length)return NextResponse.json({error:"A Bitget position is already open for this contract. Close it before opening another."},{status:409});
      if(available<margin+margin*leverage*0.001)return NextResponse.json({error:"Available Bitget USDT is below the requested isolated margin."},{status:409});
      const instrument=await publicInstruments(symbol);
      if(!instrument)return NextResponse.json({error:"Bitget does not currently list this contract for orders."},{status:503});
      const maxLeverage=Number(instrument.maxLeverage??100);
      if(leverage>maxLeverage)return NextResponse.json({error:`Bitget caps ${symbol} at ${maxLeverage}× leverage.`},{status:400});
      const step=Number(instrument.sizeMultiplier??"0.000001"),minimum=Number(instrument.minOrderAmount??"0");
      const raw=margin*leverage/market.lastPrice;
      qty=Number((Math.floor(raw/step)*step).toFixed(8));
      if(!Number.isFinite(qty)||qty<minimum)return NextResponse.json({error:"This margin is below Bitget's minimum order size for the contract."},{status:400});
      side=action==="open_long"?"buy":"sell";
      if(holdMode==="hedge_mode")posSide=action==="open_long"?"long":"short";
      const current=settings.symbolConfigList?.find(item=>item.category==="USDT-FUTURES"&&item.symbol===symbol);
      if(current?.marginMode!=="isolated"||current?.leverage!==String(leverage)){
        await bitgetPrivateRequest(credentials,"POST","/api/v3/account/set-leverage",{category:"USDT-FUTURES",symbol,marginMode:"isolated",leverage:String(leverage),...(holdMode==="hedge_mode"?{posSide:action==="open_long"?"long":"short"}:{})});
      }
    }
    const clientOid="tl"+randomUUID().replaceAll("-","").slice(0,30);
    const payload:Record<string,string>={category:"USDT-FUTURES",symbol,qty:qty.toFixed(8).replace(/0+$/,"").replace(/\.$/,""),side,orderType:"market",marginMode:"isolated",clientOid};
    if(posSide)payload.posSide=posSide;
    if(reduceOnly)payload.reduceOnly=reduceOnly;
    const {error:auditWriteError}=await supabase.from("security_events").insert({user_id:user.id,event_type:"bitget_order_attempt",metadata:{mode:"live",product:"USDT-FUTURES",symbol,action,margin:action==="close"?null:margin,leverage:action==="close"?null:leverage,quantity:qty,createdAt:new Date().toISOString()}});
    if(auditWriteError)return NextResponse.json({error:"Could not write the live order audit record. No order was sent."},{status:503});
    const order=await bitgetPrivateRequest(credentials,"POST","/api/v3/trade/place-order",payload);
    const result=order.data as {orderId?:string;clientOid?:string};
    return NextResponse.json({accepted:true,symbol,action,side,quantity:qty,referencePrice:market.lastPrice,margin:action==="close"?null:margin,leverage:action==="close"?null:leverage,notional:action==="close"?null:qty*market.lastPrice,orderId:result?.orderId??null,clientOid:result?.clientOid??clientOid},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    if(error instanceof BitgetRequestError)return NextResponse.json({error:"Bitget rejected the order or account setting. Check futures trade permission, margin eligibility and contract rules; no success was reported."},{status:422});
    console.warn("Futures live order rejected before success",error instanceof Error?error.name:"unknown");
    return NextResponse.json({error:"Live order could not be confirmed. Check your Bitget order history before retrying."},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
