import "server-only";
import { getBitgetMarketUniverse } from "@/lib/bitget-market";

export async function listTokenizedEquityInstruments(limit: number, cursor: string | null) {
  const market = await getBitgetMarketUniverse();
  const eligible = market.assets.filter(asset => asset.kind === "rtoken" && asset.isReality && asset.underlyingTicker).sort((a, b) => a.symbol.localeCompare(b.symbol));
  const page = eligible.filter(asset => !cursor || asset.symbol > cursor).slice(0, limit + 1);
  const hasMore = page.length > limit;
  const instruments = page.slice(0, limit).map(asset => ({
    symbol: asset.symbol, instrument_type: "tokenized_equity_spot" as const, underlying_ticker: asset.underlyingTicker!,
    issuer_name: asset.name, quote_currency: asset.quoteCoin, last_price: asset.lastPrice,
    change_24h: asset.change24h, provider_timestamp: asset.providerTimestamp,
    market_session_status: asset.marketSessionStatus, source: "Bitget Reality spot" as const
  }));
  return { data: instruments, next_cursor: hasMore ? instruments.at(-1)?.symbol ?? null : null, generated_at: market.generatedAt };
}

export function validateInstrumentQuery(kind: unknown, limit: unknown, cursor: unknown) {
  if (kind !== "rtoken" || typeof limit !== "string" || !/^[1-9][0-9]?$|^100$/.test(limit) || (cursor !== null && (typeof cursor !== "string" || !/^[A-Z0-9]{2,32}$/.test(cursor)))) return null;
  return { limit: Number(limit), cursor: cursor as string | null };
}
