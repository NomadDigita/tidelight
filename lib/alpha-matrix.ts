/** A basket comparison is causal only when all markets share one holdout window. */
export function hasAlignedHoldout(runs: Array<{
  train: { equityCurve: Array<{ timestamp: number }> };
  test: { equityCurve: Array<{ timestamp: number }> };
}>): boolean {
  if (runs.length < 2) return false;
  const first = runs[0].test.equityCurve;
  if (!first.length) return false;
  const start = first[0].timestamp;
  return runs.every((run) => {
    const trainEnd = run.train.equityCurve.at(-1)?.timestamp;
    const test = run.test.equityCurve;
    return trainEnd != null && trainEnd < start && test.length === first.length
      && test.every((point, index) => point.timestamp === first[index].timestamp);
  });
}
