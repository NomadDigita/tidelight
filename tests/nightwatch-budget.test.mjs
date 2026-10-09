import test from "node:test";
import assert from "node:assert/strict";
import { nightwatchAnalysisBudget, readBeforeNightwatchDeadline, NIGHTWATCH_RUN_BUDGET_MS, NIGHTWATCH_COMMIT_RESERVE_MS } from "../lib/nightwatch-budget.ts";

test("scheduled users share an absolute deadline and leave time for the guarded commit", () => {
  const startedAt = 100_000;
  const first = nightwatchAnalysisBudget(startedAt, startedAt);
  assert.equal(first.budgetMs, 5000);
  assert.equal(first.deadlineAt + NIGHTWATCH_COMMIT_RESERVE_MS, startedAt + NIGHTWATCH_RUN_BUDGET_MS);
  const late = nightwatchAnalysisBudget(startedAt, first.deadlineAt - 1500);
  assert.equal(late.deadlineAt, first.deadlineAt);
  assert.equal(late.budgetMs, 1500);
  assert.equal(nightwatchAnalysisBudget(startedAt, first.deadlineAt + 1).budgetMs, 0);
});

test("a stalled market read cannot hold the cron past its analysis deadline", async () => {
  await assert.rejects(readBeforeNightwatchDeadline(new Promise(() => {}), Date.now() + 20), /nightwatch-deadline/);
});

test("a successful or failed read retains its result before the deadline", async () => {
  assert.equal(await readBeforeNightwatchDeadline(Promise.resolve("market-data"), Date.now() + 1000), "market-data");
  await assert.rejects(readBeforeNightwatchDeadline(Promise.reject(new Error("market-down")), Date.now() + 1000), /market-down/);
});
