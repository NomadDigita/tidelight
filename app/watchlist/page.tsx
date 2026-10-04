import { createClient } from "@/lib/supabase/server";
import WatchlistBoard from "@/app/ui/watchlist-board";

const companies = [
  { symbol: "NVDA", company_name: "NVIDIA Corporation", field: "Semiconductors", color: "green", mark: "N" },
  { symbol: "TSLA", company_name: "Tesla, Inc.", field: "Mobility", color: "red", mark: "T" },
  { symbol: "MSFT", company_name: "Microsoft Corporation", field: "Cloud & AI", color: "blue", mark: "M" },
  { symbol: "AMZN", company_name: "Amazon.com, Inc.", field: "Commerce", color: "amber", mark: "a" },
  { symbol: "AAPL", company_name: "Apple Inc.", field: "Consumer technology", color: "violet", mark: "A" },
  { symbol: "GOOGL", company_name: "Alphabet Inc.", field: "Platforms", color: "blue", mark: "G" },
  { symbol: "META", company_name: "Meta Platforms, Inc.", field: "Social & AI", color: "blue", mark: "M" },
  { symbol: "AMD", company_name: "Advanced Micro Devices, Inc.", field: "Semiconductors", color: "red", mark: "A" },
];

export default async function WatchlistPage({ searchParams }: { searchParams: Promise<{ error?: string; added?: string; removed?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = user
    ? await supabase.from("watchlist_items").select("id, symbol, company_name, notes, created_at").order("created_at", { ascending: true })
    : { data: null };
  const watchlist = data?.length ? data.map((item) => ({ ...item, ...companies.find((company) => company.symbol === item.symbol) })) : user ? [] : companies.slice(0, 4);

  return <div className="content-wrap inner-page watchlist-page">
    <section className="page-heading compact-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR COMPANY RADAR</div><h1>Keep a closer <span>watch.</span></h1><p>Build a personal map of the companies behind the stories you follow.</p></div></section>
    {params.added ? <p className="action-notice">Added to your watchlist.</p> : null}{params.removed ? <p className="action-notice">Removed from your watchlist.</p> : null}
    {params.error ? <p className="action-error">That update didn’t go through. Please try again.</p> : null}
    <WatchlistBoard items={watchlist} signedIn={Boolean(user)} />
    <div className="route-footnote"><span>i</span> No live prices are shown here. Quotes and tokenized-equity instrument coverage have not been verified for this workspace.</div>
  </div>;
}
