export type FuturesPaperAction = "open_long" | "open_short" | "close" | "hold";
export type FuturesPaperDecision = {
  proposedAction: FuturesPaperAction;
  action: FuturesPaperAction;
  confidence: number;
  rationale: string;
  evidence: string[];
  risks: string[];
  invalidation: string;
};

export function normalizeFuturesProposal(value: Record<string, unknown>, position: "long" | "short" | null, currentCandidate: boolean, previousCandidate: boolean): FuturesPaperDecision | null {
  const proposedAction = value.action;
  const confidence = Number(value.confidence);
  const rationale = typeof value.rationale === "string" ? value.rationale.trim() : "";
  const list = (input: unknown) => Array.isArray(input) ? input.filter((item): item is string => typeof item === "string").slice(0, 4).map(item => item.trim().slice(0, 220)).filter(Boolean) : [];
  if (proposedAction !== "open_long" && proposedAction !== "open_short" && proposedAction !== "close" && proposedAction !== "hold") return null;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1 || rationale.length < 12 || rationale.length > 500) return null;
  const evidence = list(value.evidence);
  if (!evidence.length) return null;
  const permitted = confidence >= 0.7 && (
    (proposedAction === "open_long" && !position && currentCandidate && !previousCandidate)
    || (proposedAction === "open_short" && !position && !currentCandidate && previousCandidate)
    || (proposedAction === "close" && Boolean(position))
  );
  return {
    proposedAction,
    action: permitted ? proposedAction : "hold",
    confidence,
    rationale,
    evidence,
    risks: list(value.risks),
    invalidation: typeof value.invalidation === "string" ? value.invalidation.trim().slice(0, 250) : "Reassess at the next completed candle.",
  };
}
