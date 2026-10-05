# Tidelight research evaluation protocol

## Purpose

Measure whether Tidelight helps a reviewer move from a question to a defensible, source-grounded note. This is a measurement plan, not a result report. No benchmark scores are claimed until reviewers complete the labels below.

## Benchmark set

Start with 10–20 dated, public events covering at least three issuer or macro categories. For each event, preserve:

- the original question and the timestamp at which it is asked;
- one official source or filing and one independently edited publisher source when available;
- a relevant supporting passage and any counter-evidence passage;
- the expected affected issuer or market and a short human-authored reference note;
- the source publication time, capture time, URL, and whether the page was fully accessible.

Use events with a clear public record. Exclude rumors, paywalled claims that cannot be independently checked, and examples chosen only because they make the model look good. Freeze the event set before scoring a prompt revision.

## Reviewer labels

Two reviewers label each displayed claim independently:

1. **Quote match:** exact, substantially exact, or unsupported.
2. **Claim entailment:** supported, contradicted, context only, or not established by the quote.
3. **Source fit:** primary, independent reporting, other known publisher, or user-supplied / unverified.
4. **Counter-evidence:** present, absent from the captured set, or not applicable.
5. **Interpretation boundary:** sourced fact, analyst inference, or unsupported assertion.

Resolve disagreements before calculating the event score. Record both initial labels and the resolution so a prompt change cannot erase reviewer disagreement.

## Metrics

| Metric | Definition |
|---|---|
| Citation coverage | Displayed factual claims with a valid source and quote ÷ all displayed factual claims. |
| Unsupported-claim rate | Claims labeled unsupported or not established ÷ all displayed factual claims. |
| Quote fidelity | Claims whose quoted passage matches captured source text ÷ all displayed factual claims. |
| Counter-evidence coverage | Events where captured opposing or qualifying evidence appears in the brief ÷ events where reviewers found such evidence in the captured sources. |
| Source diversity | Number of distinct publisher domains and source classes per event. Domain count is not proof of editorial independence. |
| Task time | Time from opening the question to saving a reviewed note, reported as median and range. |

Report raw numerator and denominator with every rate. Segment official, publisher, and user-pasted evidence. A blank counter-evidence denominator is “not measured,” not 0% or 100%.

## Operating procedure

1. Capture a baseline from the current production prompt and supported sources.
2. Review claims against the exact stored source passages, not model summaries.
3. Freeze the labels and baseline report.
4. Change one source or prompt behavior at a time and rerun the same cases.
5. Publish aggregate metrics alongside known limitations and at least one failure case.

Current implementation supports up to three fetched public sources in Mini and up to five user-pasted passages in Pro. Fetching is restricted to the selected issuer, SEC.gov, and a curated publisher allowlist. Domain identity is not independent verification; richer source discovery and source-level benchmark outcomes remain future work.

## Reproducible scoring

Copy `docs/benchmarks/research-benchmark-template.json`, replace the example with the frozen event set, and preserve two independent reviewer labels plus the resolved adjudication for every claim. Include exact captured passages when a source was accessible. The scorer rejects incomplete review sets and does not convert an empty denominator into a 0% score.

Run it with:

```sh
node scripts/score-research-benchmark.mjs path/to/research-benchmark.json
```

The JSON report includes raw counts, rates, source-class totals, distinct-domain/source-class averages, task-time median and range, and a completion gate. A complete score requires at least 10 events from three categories, valid source capture metadata, and two reviewers plus adjudication for each displayed claim. Keep the benchmark input private if it contains unpublished review notes; publish only the resolved report and methodology.
