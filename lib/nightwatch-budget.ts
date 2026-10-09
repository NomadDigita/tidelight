// Leave eight seconds for the guarded tick/alerts and five for the HTTP response.
export const NIGHTWATCH_RUN_BUDGET_MS = 55_000;
export const NIGHTWATCH_COMMIT_RESERVE_MS = 8_000;
export const NIGHTWATCH_AI_BUDGET_MS = 5_000;

export function nightwatchAnalysisBudget(startedAt: number, now = Date.now()) {
  const deadlineAt = startedAt + NIGHTWATCH_RUN_BUDGET_MS - NIGHTWATCH_COMMIT_RESERVE_MS;
  return { deadlineAt, budgetMs: Math.max(0, Math.min(NIGHTWATCH_AI_BUDGET_MS, deadlineAt - now)) };
}

// Only use for reads. A mutation must be awaited so it is never reported as
// deferred while the database may still be committing it.
export async function readBeforeNightwatchDeadline<T>(read: PromiseLike<T>, deadlineAt: number): Promise<T> {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) throw new Error("nightwatch-deadline");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(read),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("nightwatch-deadline")), remaining); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
