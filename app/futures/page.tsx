import { createClient } from "@/lib/supabase/server";
import { getBitgetStockPerp, STOCK_PERP_UNIVERSE } from "@/lib/bitget-market";
import FuturesPaperDesk from "@/app/ui/futures-paper-desk";
import "./paper.css";

export const dynamic = "force-dynamic";

export default async function FuturesPage({ searchParams }: { searchParams: Promise<{ symbol?: string; researchRunId?: string }> }) {
  const params = await searchParams;
  const requestedSymbol = params.symbol?.toUpperCase() ?? "";
  const researchRunId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.researchRunId ?? "") ? params.researchRunId : undefined;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [account, position, decisions, fills] = user ? await Promise.all([
    supabase.from("futures_paper_accounts").select("cash_balance,paused").maybeSingle(),
    supabase.from("futures_paper_positions").select("symbol,direction,quantity,entry_fill,margin,entry_fee,opened_at").maybeSingle(),
    supabase.from("futures_paper_decisions").select("id,symbol,as_of,action,outcome,reason,reference_price,realized_pnl,snapshot,created_at").order("created_at",{ ascending: false }).limit(30),
    supabase.from("futures_paper_fills").select("id,symbol,action,direction,quantity,fill_price,notional,fee,realized_pnl,created_at").order("created_at",{ ascending: false }).limit(30),
  ]) : [{ data: null }, { data: null }, { data: [] }, { data: [] }, { data: [] }];
  const open = position.data as { symbol: string; direction: "long" | "short"; quantity: number; entry_fill: number; margin: number; entry_fee: number; opened_at: string } | null;
  const mark = open && STOCK_PERP_UNIVERSE.some(symbol => symbol === open.symbol) ? await getBitgetStockPerp(open.symbol).catch(() => null) : null;
  return <FuturesPaperDesk signedIn={Boolean(user)} initialSymbol={STOCK_PERP_UNIVERSE.some(symbol => symbol === requestedSymbol) ? requestedSymbol : undefined} researchRunId={researchRunId} cash={Number(account.data?.cash_balance ?? 10000)} paused={Boolean(account.data?.paused)} position={open} mark={mark?.lastPrice ?? null} markAsOf={mark?.providerTimestamp ?? null} decisions={(decisions.data ?? []) as never} fills={(fills.data ?? []) as never} />;
}
