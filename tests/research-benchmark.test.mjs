import test from "node:test";
import assert from "node:assert/strict";
import { scoreBenchmark } from "../scripts/score-research-benchmark.mjs";

function event(index, options = {}) {
  const sourceUrl = `https://issuer${index % 3}.example/news/${index}`;
  const sources = [
    { url: sourceUrl, sourceClass: "primary", accessible: true, capturedText: "Full captured source text", publicationAt: null, capturedAt: "2026-10-05T09:00:00Z" },
    { url: `https://publisher${index % 2}.example/story/${index}`, sourceClass: "independent_reporting", accessible: false, capturedText: "", publicationAt: null, capturedAt: "2026-10-05T09:00:00Z" },
  ];
  return {
    id: `event-${index}`,
    category: ["issuer", "sector", "macro"][index % 3],
    question: `What changed in public event ${index}?`,
    askedAt: "2026-10-05T09:00:00Z",
    taskTimeSeconds: 40 + index,
    sources,
    claims: [{
      text: `A factual claim for event ${index}`,
      kind: "factual",
      quote: "The matched source passage",
      sourceUrl,
      reviewers: [
        { reviewerId: "a", quoteMatch: "exact", entailment: "supported", sourceFit: "primary", interpretationBoundary: "sourced_fact" },
        { reviewerId: "b", quoteMatch: "exact", entailment: "supported", sourceFit: "primary", interpretationBoundary: "sourced_fact" },
      ],
      resolution: { quoteMatch: "exact", entailment: "supported", sourceFit: "primary", interpretationBoundary: "sourced_fact", adjudicatorId: "a" },
    }],
    review: { counterEvidenceInCapturedSources: index === 0 },
    brief: { counterEvidencePresent: index === 0 && options.counterEvidenceCaptured === true },
    ...options.overrides,
  };
}

function completeBenchmark() {
  return { schemaVersion: 1, metadata: { promptVersion: "baseline" }, events: Array.from({ length: 10 }, (_, index) => event(index)) };
}

test("scores rates with raw counts and leaves empty counter-evidence denominator unmeasured", () => {
  const result = scoreBenchmark(completeBenchmark());
  assert.equal(result.complete, true);
  assert.deepEqual(result.metrics.citationCoverage, { status: "measured", numerator: 10, denominator: 10, ratePct: 100 });
  assert.deepEqual(result.metrics.counterEvidenceCoverage, { status: "measured", numerator: 0, denominator: 1, ratePct: 0 });
  assert.equal(result.metrics.sourceDiversity.meanDistinctDomainsPerEvent, 2);
  assert.equal(result.metrics.taskTimeSeconds.count, 10);
});

test("does not turn an empty evidence denominator into a zero-percent score", () => {
  const benchmark = completeBenchmark();
  benchmark.events.forEach((item) => { item.review.counterEvidenceInCapturedSources = false; });
  const result = scoreBenchmark(benchmark);
  assert.equal(result.metrics.counterEvidenceCoverage.status, "not_measured");
  assert.equal(result.metrics.counterEvidenceCoverage.ratePct, null);
  assert.equal(result.metrics.counterEvidenceCoverage.denominator, 0);
});

test("blocks completion when event, category, or independent review requirements are missing", () => {
  const benchmark = completeBenchmark();
  benchmark.events = benchmark.events.slice(0, 9);
  benchmark.events.forEach((item) => { item.category = "issuer"; });
  benchmark.events[0].claims[0].reviewers = [benchmark.events[0].claims[0].reviewers[0]];
  const result = scoreBenchmark(benchmark);
  assert.equal(result.complete, false);
  assert.equal(result.metrics, null);
  assert.ok(result.errors.some((error) => error.includes("At least 10 events")));
  assert.ok(result.errors.some((error) => error.includes("three event categories")));
  assert.ok(result.errors.some((error) => error.includes("two reviewers")));
});

test("counts unsupported factual assertions from adjudicated labels", () => {
  const benchmark = completeBenchmark();
  benchmark.events[0].claims[0].resolution.entailment = "not_established";
  benchmark.events[0].claims[0].resolution.quoteMatch = "unsupported";
  const result = scoreBenchmark(benchmark);
  assert.deepEqual(result.metrics.unsupportedClaimRate, { status: "measured", numerator: 1, denominator: 10, ratePct: 10 });
});
