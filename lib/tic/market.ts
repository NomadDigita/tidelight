import "server-only";
import { getBitgetMarketUniverse } from "@/lib/bitget-market";
import { filterAndPageTokenizedEquities, type InstrumentFilter } from "@/lib/tic/market-query";

export { validateInstrumentQuery } from "@/lib/tic/market-query";

export async function listTokenizedEquityInstruments(limit: number, cursor: string | null, underlyingTicker: string | null = null) {
  const market = await getBitgetMarketUniverse();
  const filter: InstrumentFilter = { limit, cursor, underlyingTicker };
  const { assets, hasMore } = filterAndPageTokenizedEquities(market.assets, filter);
  const instruments = assets.map(asset => ({
    symbol: asset.symbol, instrument_type: "tokenized_equity_spot" as const, underlying_ticker: asset.underlyingTicker!,
    issuer_name: asset.name, quote_currency: asset.quoteCoin, last_price: asset.lastPrice,
    change_24h: asset.change24h, provider_timestamp: asset.providerTimestamp,
    market_session_status: asset.marketSessionStatus, source: "Bitget Reality spot" as const
  }));
  return { data: instruments, next_cursor: hasMore ? instruments.at(-1)?.symbol ?? null : null, generated_at: market.generatedAt };
}
