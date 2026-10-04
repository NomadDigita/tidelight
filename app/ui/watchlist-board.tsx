"use client";

import Link from "next/link";
import { addWatchlistItem, removeWatchlistItem } from "@/app/actions";

type Item = { id?: string; symbol: string; company_name: string; field?: string; color?: string; mark?: string; notes?: string | null };
const options = ["NVDA", "TSLA", "MSFT", "AMZN", "AAPL", "GOOGL", "META", "AMD"];

export default function WatchlistBoard({ items, signedIn }: { items: Item[]; signedIn: boolean }) {
  const held = new Set(items.map((item) => item.symbol));
  const available = options.filter((symbol) => !held.has(symbol));
  return <>
    <section className="watchlist-tools panel">
      <div><span className="eyebrow small-eyebrow">A PERSONAL RESEARCH UNIVERSE</span><h2>{items.length.toString().padStart(2, "0")} <span>companies</span></h2><p>{signedIn ? "This list is saved to your private account." : "Preview the starter universe. Sign in to make it yours."}</p></div>
      {signedIn ? <form action={addWatchlistItem} className="watchlist-add"><label className="sr-only" htmlFor="watchlist-symbol">Add a company</label><select name="symbol" id="watchlist-symbol" defaultValue="" required disabled={!available.length}><option value="" disabled>Add a company…</option>{available.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}</select><button type="submit" disabled={!available.length}>＋ <span>Add</span></button></form> : <Link className="primary-link" href="/login">Sign in to save <span>↗</span></Link>}
    </section>
    {items.length ? <section className="watchlist-grid" aria-label="Companies in your watchlist">{items.map((item, index) => <article className="watch-card" key={item.id ?? item.symbol}>
      <div className="watch-card-top"><span className={`ticker-mark ${item.color ?? "green"}`}>{item.mark ?? item.symbol.slice(0, 1)}</span><span className="watch-card-number">RADAR / {String(index + 1).padStart(2, "0")}</span>{item.id ? <form action={removeWatchlistItem.bind(null, item.id)}><button className="remove-watch" aria-label={`Remove ${item.symbol} from watchlist`} title="Remove from watchlist">×</button></form> : null}</div>
      <div className="watch-card-main"><div><h2>{item.symbol}</h2><p>{item.company_name}</p></div><span className="watchline-glyph" aria-hidden="true">∿</span></div>
      <div className="watch-card-bottom"><span>{item.field ?? "Company research"}</span><Link href={`/markets#${item.symbol.toLowerCase()}`}>VIEW CONTEXT <b>↗</b></Link></div>
    </article>)}</section> : <div className="empty-library"><span className="empty-glyph">⌖</span><h2>Your watchlist starts with one name.</h2><p>Add a company above to make it part of your research workspace.</p></div>}
  </>;
}
