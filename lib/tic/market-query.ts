export type InstrumentFilter = {
  limit: number;
  cursor: string | null;
  underlyingTicker: string | null;
};

export type TokenizedEquityAsset = {
  symbol: string;
  kind: string;
  isReality: boolean;
  underlyingTicker?: string | null;
};

/** Validate shared parameters for REST, the API explorer, and MCP adapters. */
export function validateInstrumentQuery(kind: unknown, limit: unknown, cursor: unknown, underlyingTicker: unknown = null): InstrumentFilter | null {
  if (kind !== "rtoken" || typeof limit !== "string" || !/^[1-9][0-9]?$|^100$/.test(limit) || (cursor !== null && (typeof cursor !== "string" || !/^[A-Z0-9]{2,32}$/.test(cursor)))) return null;
  if (underlyingTicker !== null && (typeof underlyingTicker !== "string" || !/^[A-Z][A-Z0-9.]{0,9}$/i.test(underlyingTicker))) return null;
  return { limit: Number(limit), cursor: cursor as string | null, underlyingTicker: typeof underlyingTicker === "string" ? underlyingTicker.toUpperCase() : null };
}

/** Apply the ticker filter before pagination so a matching instrument is not hidden by earlier symbols. */
export function filterAndPageTokenizedEquities<T extends TokenizedEquityAsset>(assets: readonly T[], filter: InstrumentFilter) {
  const eligible = assets
    .filter(asset => asset.kind === "rtoken" && asset.isReality && asset.underlyingTicker)
    .filter(asset => !filter.underlyingTicker || asset.underlyingTicker?.toUpperCase() === filter.underlyingTicker)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  const page = eligible.filter(asset => !filter.cursor || asset.symbol > filter.cursor).slice(0, filter.limit + 1);
  return { assets: page.slice(0, filter.limit), hasMore: page.length > filter.limit };
}
