export const MAX_ORDER_NOTIONAL_USDT = 250;
export const MAX_ORDER_ATTEMPTS_PER_HOUR = 5;

export function estimateOrderNotional(input: {
  side: "buy" | "sell"; orderType: "market" | "limit"; quantity: number; referencePrice: number; limitPrice?: number;
}): number | null {
  const { side, orderType, quantity, referencePrice, limitPrice } = input;
  if (![quantity, referencePrice].every(Number.isFinite) || quantity <= 0 || referencePrice <= 0) return null;
  if (orderType === "market" && side === "buy") return quantity;
  const executionPrice = orderType === "limit" ? limitPrice : referencePrice;
  if (!Number.isFinite(executionPrice) || Number(executionPrice) <= 0) return null;
  return quantity * Number(executionPrice);
}
export function isLimitPriceWithinBand(limitPrice: number, referencePrice: number, maxDeviation = 0.05) {
  return Number.isFinite(limitPrice) && Number.isFinite(referencePrice) && referencePrice > 0
    && Math.abs(limitPrice / referencePrice - 1) <= maxDeviation + 1e-10;
}
