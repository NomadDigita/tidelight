import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBitgetCredentials, bitgetPrivateRequest } from "@/lib/bitget-private";
import { STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your live futures account." }, { status: 401 });
  const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase() ?? "";
  if (!STOCK_PERP_UNIVERSE.some(item => item === symbol)) return NextResponse.json({ error: "Choose a supported futures contract." }, { status: 400 });
  try {
    const admin = createAdminClient();
    const [{ data: access }, credentials] = await Promise.all([
      admin.from("futures_live_access_requests").select("status").eq("user_id", user.id).maybeSingle(),
      getBitgetCredentials(user.id),
    ]);
    if (access?.status !== "approved" || !credentials || credentials.mode !== "live") return NextResponse.json({ error: "Live futures access is not approved and connected." }, { status: 403 });
    const [assetsResult, settingsResult, positionsResult] = await Promise.all([
      bitgetPrivateRequest(credentials,"GET","/api/v3/account/assets"),
      bitgetPrivateRequest(credentials,"GET","/api/v3/account/settings"),
      bitgetPrivateRequest(credentials,"GET","/api/v3/position/current-position?category=USDT-FUTURES&symbol="+encodeURIComponent(symbol)),
    ]);
    const assetsData=assetsResult.data as {accountEquity?:string;usdtEquity?:string;assets?:Array<{coin:string;available?:string;equity?:string}>};
    const settings=settingsResult.data as {holdMode?:string;symbolConfigList?:Array<{category:string;symbol:string;marginMode:string;leverage:string}>};
    const positions=(positionsResult.data as {list?:Array<{symbol:string;posSide:string;available?:string;total?:string;avgPrice?:string;markPrice?:string;unrealisedPnl?:string;leverage?:string;marginMode?:string}>}).list??[];
    return NextResponse.json({availableUSDT:Number(assetsData.assets?.find(item=>item.coin==="USDT")?.available??0),equityUSDT:Number(assetsData.usdtEquity??assetsData.accountEquity??0),holdMode:settings.holdMode??"unknown",symbolSetting:settings.symbolConfigList?.find(item=>item.symbol===symbol&&item.category==="USDT-FUTURES")??null,positions:positions.filter(item=>Number(item.total??item.available??0)>0).map(item=>({symbol:item.symbol,side:item.posSide,quantity:Number(item.available??item.total??0),entryPrice:Number(item.avgPrice??0),markPrice:Number(item.markPrice??0),unrealizedPnl:Number(item.unrealisedPnl??0),leverage:Number(item.leverage??0),marginMode:item.marginMode??"unknown"}))},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({ error: "Bitget live account data is unavailable. Check futures account read permission." }, { status: 503, headers: { "Cache-Control":"no-store" } });
  }
}
