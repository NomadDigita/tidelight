import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Exposure = {
  symbol: string;
  name: string;
  instrument: "crypto" | "rtoken" | "tokenized_equity" | "unknown";
  issuer: string;
  underlying: string;
  sector: string;
  catalysts: string[];
  risks: string[];
};

const catalog: Exposure[] = [
  { symbol: "BTC", name: "Bitcoin", instrument: "crypto", issuer: "Bitcoin network", underlying: "BTC", sector: "Digital assets", catalysts: ["Network activity", "Liquidity and macro regime"], risks: ["Volatility", "Custody and regulatory risk"] },
  { symbol: "ETH", name: "Ethereum", instrument: "crypto", issuer: "Ethereum network", underlying: "ETH", sector: "Digital assets", catalysts: ["Network usage", "Protocol upgrades"], risks: ["Volatility", "Smart-contract and regulatory risk"] },
  { symbol: "TSLA", name: "Tesla", instrument: "tokenized_equity", issuer: "Bitget/Reality ecosystem", underlying: "Tesla Inc.", sector: "Automotive and technology", catalysts: ["Vehicle deliveries", "Margins and autonomy updates"], risks: ["Equity volatility", "Trading-hours and liquidity differences"] },
  { symbol: "AAPL", name: "Apple", instrument: "tokenized_equity", issuer: "Bitget/Reality ecosystem", underlying: "Apple Inc.", sector: "Technology", catalysts: ["Product cycle", "Services growth"], risks: ["Valuation", "Supply-chain and regulatory risk"] },
  { symbol: "NVDA", name: "NVIDIA", instrument: "tokenized_equity", issuer: "Bitget/Reality ecosystem", underlying: "NVIDIA Corporation", sector: "Semiconductors and AI", catalysts: ["Data-center demand", "AI infrastructure spending"], risks: ["Valuation", "Export controls and concentration"] },
  { symbol: "MSFT", name: "Microsoft", instrument: "tokenized_equity", issuer: "Bitget/Reality ecosystem", underlying: "Microsoft Corporation", sector: "Technology and cloud", catalysts: ["Cloud growth", "Enterprise AI adoption"], risks: ["Valuation", "Competition and regulation"] },
  { symbol: "SPY", name: "S&P 500 exposure", instrument: "rtoken", issuer: "Reality ecosystem", underlying: "S&P 500", sector: "Broad US equities", catalysts: ["Macro liquidity", "Earnings breadth"], risks: ["Market drawdown", "Underlying-market tracking difference"] }
];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to resolve exposure." }, { status: 401 });
  let query = "";
  try { const body = await request.json() as { token?: unknown }; query = typeof body.token === "string" ? body.token.trim().slice(0, 80) : ""; } catch {}
  if (!query) return NextResponse.json({ error: "Enter a token or symbol." }, { status: 400 });
  const normalized = query.toUpperCase();
  const matches = catalog.filter((item) => item.symbol === normalized || item.name.toUpperCase().includes(normalized) || item.underlying.toUpperCase().includes(normalized));
  return NextResponse.json({
    query,
    matches,
    disclaimer: "This is an exposure map, not a recommendation. Verify the current instrument, issuer, liquidity, fees, and tracking terms before trading."
  });
}
