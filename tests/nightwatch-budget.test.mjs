import test from "node:test";
import assert from "node:assert/strict";
import { nightwatchAnalysisBudget, readBeforeNightwatchDeadline, rotateNightwatchSchedules, NIGHTWATCH_RUN_BUDGET_MS, NIGHTWATCH_COMMIT_RESERVE_MS } from "../lib/nightwatch-budget.ts";

test("every stable schedule leads once across successive UTC days without duplicates", () => {
  const schedules = ["user-a", "user-b", "user-c", "user-d", "user-e"];
  const start = Date.UTC(2026, 9, 9);
  const leaders = new Set();
  for (let day = 0; day < schedules.length; day++) {
    const rotated = rotateNightwatchSchedules(schedules, start + day * 86_400_000);
    leaders.add(rotated[0]);
    assert.deepEqual([...rotated].sort(), schedules);
    assert.equal(new Set(rotated).size, schedules.length);
    assert.deepEqual(rotateNightwatchSchedules(schedules, start + day * 86_400_000 + 43_200_000), rotated);
  }
  assert.equal(leaders.size, schedules.length);
  assert.deepEqual(schedules, ["user-a", "user-b", "user-c", "user-d", "user-e"]);
});

test("empty and single-user scheduling rotations are unchanged", () => {
  assert.deepEqual(rotateNightwatchSchedules([], 0), []);
  assert.deepEqual(rotateNightwatchSchedules(["only-user"], Date.UTC(2026, 9, 10)), ["only-user"]);
});

test("revisited batches rotate every user to the front even when sizes share a divisor", () => {
  const schedules = Array.from({ length: 100 }, (_, index) => `user-${index}`);
  for (const batchCount of [2, 4, 5]) {
    for (let batch = 0; batch < batchCount; batch++) {
      const leaders = new Set();
      for (let visit = 0; visit < schedules.length; visit++) {
        const day = visit * batchCount + batch;
        const rotated = rotateNightwatchSchedules(schedules, day * 86_400_000, batchCount);
        leaders.add(rotated[0]);
        assert.equal(new Set(rotated).size, schedules.length);
      }
      assert.equal(leaders.size, schedules.length);
    }
  }
});

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
