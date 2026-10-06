import Link from "next/link";
import { getBitgetMarketUniverse } from "@/lib/bitget-market";
import { createClient } from "@/lib/supabase/server";
import TradingWorkspace from "@/app/ui/trading-workspace";

export const revalidate = 60;
export default async function TradingPage() {
  const [supabase, universe] = await Promise.all([createClient(), getBitgetMarketUniverse().catch(() => null)]);
  const { data: { user } } = await supabase.auth.getUser();
  const assets = (universe?.assets ?? []).filter((asset) => asset.isReality && asset.kind === "rtoken" && asset.quoteCoin === "USDT").map((asset) => ({ symbol: asset.symbol, name: asset.name, lastPrice: asset.lastPrice }));
  return <div className="content-wrap inner-page">
    <section className="page-heading compact-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> TIDELIGHT / BITGET EXECUTION</div><h1>Trade with <span>clear limits.</span></h1><p>Connect a dedicated Bitget API key for demo or live spot orders on verified tokenized stocks.</p></div></section>
    <TradingWorkspace signedIn={Boolean(user)} assets={assets}/>
    <div className="route-footnote"><span>i</span> Live orders can lose money and may execute immediately. Start in demo mode. Nightwatch scheduled agent remains paper-only; live agent automation is not enabled by this order desk. <Link href="/nightwatch">Review Nightwatch controls</Link></div>
  </div>;
}
