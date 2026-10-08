import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBitgetMarketUniverse } from "@/lib/bitget-market";
import { mapResearchExposure } from "@/lib/exposure-map";

function sectorFor(ticker: string | null) {
  const groups: Record<string,string> = {
    NVDA:"Semiconductors & AI", AMD:"Semiconductors & AI", AVGO:"Semiconductors & AI", MSFT:"Cloud & software", GOOGL:"Cloud & advertising", AMZN:"Commerce & cloud", META:"Platforms & advertising", TSLA:"Automotive & autonomy", AAPL:"Consumer technology", JPM:"Financials", WMT:"Consumer staples", SPY:"Broad US equities"
  };
  return ticker ? groups[ticker] ?? "US listed equities" : "Tokenized US market";
}
function context(ticker:string|null) {
 const sector=sectorFor(ticker);
 const isTech=/AI|Semiconductor|Cloud|software|advertising|technology/i.test(sector);
 return {sector,catalysts:isTech?["Issuer guidance and earnings","Product demand, margins, and industry events"]:["Issuer filings and earnings","Sector demand, policy, and market conditions"],risks:["Underlying equity volatility","Token liquidity, tracking, and trading-session differences"]};
}
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to resolve exposure." }, { status: 401 });
  let query="";
  try { const body=await request.json() as {token?:unknown}; query=typeof body.token==="string"?body.token.trim().replace(/\s+/g," ").slice(0,80):""; } catch {}
  if (!query) return NextResponse.json({ error: "Enter a token or issuer name." }, { status: 400 });
  const normalized=query.toUpperCase().replace(/[^A-Z0-9]/g,"");
  try {
    const {assets}=await getBitgetMarketUniverse();
    const equityAssets=assets.filter(asset=>asset.isReality);
    const direct=equityAssets.filter(asset=>asset.symbol.toUpperCase()===normalized || asset.baseCoin.toUpperCase()===normalized || asset.underlyingTicker?.toUpperCase()===normalized);
    const exact=(direct.length ? direct : equityAssets.filter(asset=>{
      const symbol=asset.symbol.toUpperCase(), base=asset.baseCoin.toUpperCase(), underlying=asset.underlyingTicker?.toUpperCase()??"";
      const issuer=asset.name.toUpperCase().replace(/[^A-Z0-9]/g,"");
      return symbol===normalized || base===normalized || underlying===normalized || issuer===normalized ||
        (normalized.length>=4 && issuer.includes(normalized));
    })).sort((a,b)=>{
      const rank=(x:typeof a)=>x.symbol.toUpperCase()===normalized?0:x.baseCoin.toUpperCase()===normalized?1:x.underlyingTicker?.toUpperCase()===normalized?2:3;
      return rank(a)-rank(b);
    }).slice(0,5);
    const matches=exact.map(asset=>{
      const ticker=asset.underlyingTicker?.toUpperCase()??null, details=context(ticker);
      return {symbol:asset.symbol,name:asset.name,instrument:"rtoken",issuer:asset.name,underlying:ticker??asset.name,sector:details.sector,catalysts:details.catalysts,risks:details.risks};
    });
    if (matches.length) return NextResponse.json({query,matches,disclaimer:"Reality rToken exposure mapped to its underlying US issuer. Token and underlying prices, liquidity, trading hours, and legal rights can differ; this is research context, not a recommendation."});
  } catch {}
  const fallback=mapResearchExposure(query);
  const matches=fallback.map(item=>({symbol:item.realityPair,name:item.issuer,instrument:"rtoken",issuer:item.issuer,underlying:item.ticker,sector:item.sector,catalysts:[item.scenarios.upside],risks:[item.scenarios.downside,item.scenarios.invalidation]}));
  return NextResponse.json({query,matches,disclaimer:"Exposure mapping covers supported Reality rTokens and their US issuers. A missing match means the live market catalog did not confirm an instrument."});
}
