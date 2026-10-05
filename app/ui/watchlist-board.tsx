"use client";

import Link from "next/link";
import { addWatchlistItem, removeWatchlistItem } from "@/app/actions";
import IssuerLogo from "@/app/ui/issuer-logo";
import { issuerLogoUrl } from "@/lib/issuer-logo";

type Item = { id?: string; symbol: string; company_name: string; field?: string; color?: string; mark?: string; notes?: string | null };

export default function WatchlistBoard({ items, signedIn, suggestedSymbol = "" }: { items: Item[]; signedIn: boolean; suggestedSymbol?: string }) {
  return <>
    <section className="watchlist-tools panel">
      <div><span className="eyebrow small-eyebrow">A PERSONAL RESEARCH UNIVERSE</span><h2>{items.length.toString().padStart(2, "0")} <span>companies</span></h2><p>{signedIn ? "This list is saved to your private account." : "Preview the starter universe. Sign in to make it yours."}</p></div>
      {signedIn ? <form action={addWatchlistItem} className="watchlist-add"><label className="sr-only" htmlFor="watchlist-symbol">Add a Bitget market pair</label><input name="symbol" id="watchlist-symbol" defaultValue={suggestedSymbol} placeholder="Search a Bitget pair, e.g. RAAPLUSDT" autoComplete="off" required maxLength={32} pattern="[A-Za-z0-9]{2,32}" /><button type="submit">＋ <span>Add</span></button></form> : <Link className="primary-link" href="/login">Sign in to save <span>↗</span></Link>}
    </section>
    {items.length ? <section className="watchlist-grid" aria-label="Companies in your watchlist">{items.map((item, index) => <article className="watch-card" key={item.id ?? item.symbol}>
      <div className="watch-card-top"><IssuerLogo className={`ticker-mark ${item.color ?? "green"}`} ticker={item.symbol} logoUrl={issuerLogoUrl({ symbol: item.symbol, name: item.company_name })} /><span className="watch-card-number">RADAR / {String(index + 1).padStart(2, "0")}</span>{item.id ? <form action={removeWatchlistItem.bind(null, item.id)}><button className="remove-watch" aria-label={`Remove ${item.symbol} from watchlist`} title="Remove from watchlist">×</button></form> : null}</div>
      <div className="watch-card-main"><div><h2>{item.symbol}</h2><p>{item.company_name}</p></div><span className="watchline-glyph" aria-hidden="true">∿</span></div>
      <div className="watch-card-bottom"><span>{item.field ?? "Bitget market radar"}</span><Link href={`/markets/${encodeURIComponent(item.symbol)}`}>VIEW CONTEXT <b>↗</b></Link></div>
    </article>)}</section> : <div className="empty-library"><span className="empty-glyph">⌖</span><h2>Your watchlist starts with one name.</h2><p>Add a company above to make it part of your research workspace.</p></div>}
  </>;
}
