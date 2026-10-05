# Tidelight · Hackathon build plan

**Track coverage:** AI Trading Desk + Alpha Factory + Agentic Trading. The evidence-to-exposure brief, historical strategy baseline, and paper-only Nightwatch control surface are implemented. Current emphasis: ship and verify the production passkey rollout, validate representative long-window histories, and rehearse the full judging story. Detailed scope: [docs/HACKATHON_PRODUCT_PLAN.md](docs/HACKATHON_PRODUCT_PLAN.md).

**Target user:** active retail traders who hold or follow tokenized US equities and want to review weekend or after-hours events before deciding whether to act. The human trader makes the decision; Tidelight supplies traceable evidence and scenarios.

**Thesis:** tokenized equities trade around the clock, while their most consequential stories arrive on uneven schedules. Tidelight turns an event into a decision-ready research note whose key claims can be traced back to sources.

**Tagline:** See the signal between sessions.

## Why this entry

Build for the AI Trading Desk track. The differentiated workflow is event-to-exposure research: identify what changed, separate sourced facts from inference, map the event to affected companies, show opposing scenarios and catalysts, then save the analysis. The product does not place orders or tell the user what to buy.

The judging story is a concrete before/after: a user asks what a new export restriction could mean for a tokenized semiconductor holding; Tidelight returns timestamped evidence, an exposure map, counterpoints, and conditions that would change the thesis. Citation coverage and factual support are measurable, not decorative. The hackathon handbook requires an accessible demo completing a research task from question to actionable insight; the current interface shell and saved-question loop are live, but that evidence-to-insight workflow is still a release gate.

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
| 4 · Identity and persistence | Email-link sign-in, session refresh, save question action | Done; production callback allowlist configured; signed-in dashboard reads own saved questions |
| 5 · Evidence workflow | source input/collection, normalization, claim provenance, Qwen synthesis | Mini can fetch one supported public HTTPS page from the selected issuer, SEC.gov, or a selected publisher; redirects stay within the same allowlist, bodies are capped at 2 MB, and displayed quotes must match meaningful captured passages. Pro supports up to five unique HTTPS links with user-provided excerpts. Server-side Qwen synthesis, support/counterpoint/context stances, honest coverage, capture times, provenance caveats, exposure mapping, per-user hourly generation limits, and owner-scoped persistence are implemented. Broad source discovery and independent publisher verification remain open. |
| 6 · Market integration | Verify actual Bitget tokenized-equity instruments and expose read-only data | Live Bitget universe and asset details deployed; public ticker/OHLCV feeds, Reality flags, company metadata, session eligibility and watchlist validation are wired. Market-state calendar remains honestly unavailable. |
| 7 · Alpha Factory baseline | Build deterministic strategy replay with costs, chronological holdout, trade log and exact data archive | Strategy Lab, fee/slippage assumptions, holdout checks, trade log, exact candle archive, fingerprint, and private run history implemented. The live 4H feed exposes about 90 days across sampled rTokens and BTC/ETH. A 66/34 split yields at least 30 evaluated training days after warm-up and a 30-day holdout. Five completed-candle validation runs are recorded in [the dated report](docs/STRATEGY_VALIDATION_2026-10-05.md); all five underperformed buy-and-hold in this snapshot, so no alpha claim is made. Authenticated owner-saved run history remains to be verified. |
| 8 · Nightwatch paper agent | Event/price triggers, deterministic constraints, paper fills, durable event log, pause/override UI | User-triggered completed-4H-candle checks, Reality eligibility, database-enforced limits, simulated entries/exits, private alert/decision ledgers, pause/resume, MFA step-up, and a Supabase-cron daily in-app summary are implemented. Scheduled market checks, two-week paper observation, and live order execution remain pending or disabled. |
| 9 · Quality and demo | citation checks, representative scenarios, responsive/accessibility review, demo recording/script | Mini/Pro research experiences, mobile navigation, source audit details, private security activity, and provider-gated passkey flows implemented. Supabase passkeys are enabled with display name `Tidelight`, RP ID `tidelight-two.vercel.app`, and origin `https://tidelight-two.vercel.app`; the production Vercel feature flag is configured. Production deployment `27174c4` is READY, and the Nightwatch mobile layout now fits a 500 px viewport. Remaining verification: register a passkey on a signed-in Tidelight account, verify signed-in data isolation, validate representative long-window Bitget runs, and complete demo rehearsal. |
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
