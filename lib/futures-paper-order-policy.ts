export type PaperTriggerType = "limit" | "conditional";
export type PaperOrderAction = "open_long" | "open_short";

export function isPaperOrderTriggered(type: PaperTriggerType, action: PaperOrderAction, currentPrice: number, orderPrice: number): boolean {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(orderPrice) || orderPrice <= 0) return false;
  if (type === "limit") return action === "open_long" ? currentPrice <= orderPrice : currentPrice >= orderPrice;
  return action === "open_long" ? currentPrice >= orderPrice : currentPrice <= orderPrice;
}

export function paperLimitReferencePrice(action: PaperOrderAction, currentPrice: number, limitPrice: number): number {
  if (action === "open_long") return Math.min(currentPrice, limitPrice / 1.0005);
  return Math.max(currentPrice, limitPrice / 0.9995);
}

export function isPaperLimitImmediatelyMarketable(action: PaperOrderAction, currentPrice: number, limitPrice: number): boolean {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || !Number.isFinite(limitPrice) || limitPrice <= 0) return false;
  return action === "open_long" ? limitPrice >= currentPrice : limitPrice <= currentPrice;
}
