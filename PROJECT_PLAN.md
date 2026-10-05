# Tidelight · Hackathon build plan

**Track coverage:** AI Trading Desk + Alpha Factory + Agentic Trading. Evidence-bounded research, a deterministic historical strategy baseline, and a paper-only Nightwatch control surface are implemented. The next build priority is continuity between those workflows, followed by stronger research and strategy validation. The product owner confirms security and sign-in proof as complete. See the sequenced [product evolution roadmap](docs/PRODUCT_EVOLUTION_ROADMAP.md) and detailed [hackathon product plan](docs/HACKATHON_PRODUCT_PLAN.md).

**Target user:** active retail traders who hold or follow tokenized US equities and want to review weekend or after-hours events before deciding whether to act. The human trader makes the decision; Tidelight supplies traceable evidence and scenarios.

**Thesis:** tokenized equities trade around the clock, while their most consequential stories arrive on uneven schedules. Tidelight turns an event into a decision-ready research note whose key claims can be traced back to sources.

**Tagline:** See the signal between sessions.

## Why this entry

Build for the AI Trading Desk track. The differentiated workflow is event-to-exposure research: identify what changed, separate sourced facts from inference, map the event to affected companies, show opposing scenarios and catalysts, then save the analysis. The product does not place orders or tell the user what to buy.

The judging story is a concrete before/after: a user asks what a new export restriction could mean for a tokenized semiconductor holding; Tidelight returns timestamped evidence, an exposure map, counterpoints, and conditions that would change the thesis. The source-bounded brief is implemented; broader primary-source discovery, independent publisher verification, and measured user-task outcomes remain open. The P0 roadmap item connects a validated exposure directly to strategy replay and paper review.

## User journey

1. Open a clear after-hours market desk and choose a tracked equity.
2. Ask an event question or choose a suggested prompt.
3. Collect official releases, filings, reputable reporting, and available read-only market context.
4. Extract claims with source URL, publisher, publication time, retrieval time, and supporting passage.
5. Use Qwen to synthesize only the captured evidence into event summary, company exposure, counter-evidence, scenarios, uncertainty, and next catalysts.
6. Save the brief to the user's Supabase workspace; let the user update their watchlist and risk context.
7. Demo the provenance trail by opening a claim and its original source.

## Architecture

- **Web:** Next.js App Router, TypeScript, Vercel.
- **Identity and storage:** Supabase Auth + Postgres. RLS scopes each saved run, source, evidence item, watchlist item, and exposure snapshot to the signed-in owner.
- **Research:** server-only provider adapters. Qwen keys stay on the server. Direct Bitget public market APIs power the verified instrument and candle views; Agent Hub integrations will be selected and bounded by use case. No account keys, trading tools, or order execution in the current product.
- **Evidence:** normalized sources and claim-to-source relationships in Postgres; every output distinguishes sourced fact from model inference.
- **Fallback:** if a provider is unavailable, show a clear unavailable state. Never present mock content or stale quotes as live data.

## Milestones

| Stage | Deliverable | State |
|---|---|---|
| 1 · Positioning and brand | Name, visual identity, focused judging narrative | Done |
| 2 · Database foundation | Free Supabase project, owner-scoped schema, RLS | Done |
| 3 · Product shell | Responsive research dashboard, brand assets, preview experience | Done |
| 4 · Identity and persistence | Email and provider sign-in, session refresh, save question action | Security and sign-in proof confirmed complete by the product owner; signed-in dashboard reads the account's own saved questions |
| 5 · Evidence workflow | source input/collection, normalization, claim provenance, Qwen synthesis | Mini now supports up to three concurrently fetched allowlisted pages and has issuer/SEC source starters. Pro supports up to five user-pasted passages. Claims remain quote-validated; publisher domain diversity, counterpoints, explicit future evidence checks, capture times, and provenance limits are displayed. The frozen human-review benchmark and broader discovery remain open. |
| 6 · Market integration | Verify actual Bitget tokenized-equity instruments and expose read-only data | Live Bitget universe and asset details deployed; public ticker/OHLCV feeds, Reality flags, company metadata, session eligibility and watchlist validation are wired. Market-state calendar remains honestly unavailable. |
| 7 · Alpha Factory baseline | Build deterministic strategy replay with costs, chronological holdout, trade log and exact data archive | Saved canonical runs now include three disjoint trailing windows where history permits, fee/slippage stress, exact candle fingerprint, provider freshness and linked research run ID. Short histories explain why walk-forward results are unavailable. Real long-window histories, issuer-session-aware fills, and independent validation remain open. Historical 2026-10-05 results are in [the dated report](docs/STRATEGY_VALIDATION_2026-10-05.md); all five tested runs underperformed buy-and-hold in that snapshot, so no alpha claim is made. |
| 8 · Nightwatch paper agent | Event/price triggers, deterministic constraints, paper fills, durable event log, pause/override UI | Manual completed-candle checks and a daily in-app summary remain. An opt-in daily scheduled path rechecks owner, Reality symbol, pause, freshness, duplicate, loss and fill controls in Postgres and carries research lineage. The owner reports the Supabase server-only key is configured in Vercel; confirm after deploy. Two-week supervised paper observation and live order execution remain pending or disabled. |
| 9 · Quality and demo | citation checks, representative scenarios, responsive/accessibility review, demo recording/script | Branded `/systems` and `/demo` pages document live feed freshness, configuration limits, workflow handoffs, architecture, and what remains unverified. The product owner confirms security and sign-in proof complete. Remaining: event benchmark labels, restore rehearsal, mobile/accessibility review, production deployment verification and an observed new-user demo. |
| 10 · Release and submission | Public GitHub repo, Vercel production deployment, compliant X post and form submission | Public repo and deployment live; required substantive X post must include `#BitgetHackathon`, `@Bitget_AI`, and the organizer's quoted post; form submission remains pending |

## Demo scorecard

- Every factual claim in the final brief links to a source and a supporting passage.
- Track claim citation coverage, unsupported-claim rate, contradictory-evidence coverage, and research completion time.
- Compare Qwen's brief to a fixed human-authored baseline on a small labeled event set.
- Report observed results only; until user testing exists, state a validation plan rather than inventing usage metrics.
- Show the data timestamp and distinguish live, delayed, cached, and illustrative data.
- Keep research and education framing; do not represent outputs as financial advice or trading signals.

## Release gates

- No source, claim, watchlist item, or saved run can cross user boundaries; verify with RLS.
- No AI key is sent to the browser or committed to Git.
- No unverified ticker is labeled a Bitget tokenized equity instrument.
- No sample quote, invented story, or generated output is labeled current fact.
- Submit before the organizer-confirmed deadline and attach the required X post link.
