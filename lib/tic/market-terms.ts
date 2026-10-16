/**
 * Bitget market data must not be redistributed through developer products
 * unless Tidelight has confirmed a written license that permits it.
 */
export function isBitgetMarketRedistributionAllowed(value: string | undefined) {
  return value === "true";
}

export class MarketRedistributionNotAuthorizedError extends Error {
  constructor() {
    super("Bitget market-data redistribution permission has not been confirmed.");
    this.name = "MarketRedistributionNotAuthorizedError";
  }
}

export function requireBitgetMarketRedistributionAllowed(value: string | undefined) {
  if (!isBitgetMarketRedistributionAllowed(value)) {
    throw new MarketRedistributionNotAuthorizedError();
  }
}
