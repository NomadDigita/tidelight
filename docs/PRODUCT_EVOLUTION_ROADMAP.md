# Tidelight product evolution roadmap

**Purpose:** turn Tidelight from a strong hackathon prototype into a coherent, dependable product spanning AI Trading Desk, Alpha Factory, and Agentic Trading.

**Product thesis:** one decision record follows a market event from sourced evidence, through mapped exposure and explicit scenarios, into reproducible strategy analysis and a guarded paper decision. The human remains accountable for investment decisions. Tidelight does not place live orders.

**Current baseline:** live Bitget spot and Reality market data; source-bounded Qwen research briefs with quote validation and exposure mapping; deterministic SMA backtests with costs, holdout metrics, and archived candles; and manual, user-triggered Nightwatch paper checks with deterministic account controls.

**Security and sign-in:** confirmed complete by the product owner. Treat account isolation, authentication, and passkey checks as accepted release evidence; revisit only if a regression or new feature changes those boundaries.

## Product principles

1. Preserve one coherent journey across the three tracks; each track must still have a distinct task, result, and evidence artifact.
2. Keep sourced facts, model inference, market observations, and user decisions visibly separate.
3. Label every market value with its provider time and freshness. Fail clearly when sources are unavailable.
4. Never turn a research narrative or model output directly into an order. Deterministic controls own paper execution.
5. Show negative and inconclusive results with the same prominence as positive results. Do not optimize to a single backtest window.
6. Keep live exchange execution disabled. A later live-trading proposal requires a separate product, security, legal, and operational review.

## Work in sequence

| Priority | Workstream | Build | Exit evidence |
|---|---|---|---|
| **P0 · Decision continuity** | Connect Research Desk → Strategy Lab → Nightwatch | Carry a validated Reality pair from an evidence brief into a strategy replay or Nightwatch review, retaining clear user control at each handoff. | A fresh browser session completes one symbol-specific journey end to end; invalid or unsupported pairs cannot enter Nightwatch. |
| **P1 · Evidence quality** | Strengthen the research desk | Support useful primary-source discovery and multi-source capture; deduplicate sources; identify disagreement and missing evidence; add issuer/event context and explicit “what would change this view” prompts. Keep publisher verification distinct from quote matching. | A small labeled benchmark of real events reports citation coverage, unsupported-claim rate, counter-evidence coverage, source diversity, and task completion time. Human review confirms each displayed claim. |
| **P2 · Quant credibility** | Make the Strategy Lab decision-grade | Add rolling walk-forward windows across varied regimes, session-aware fills, stale/missing candle checks, sensitivity analysis, and benchmarks; retain exact candle hashes and assumptions. Include rTokens and explain limitations against the underlying equity. | Reproducible runs over multiple disjoint windows and assets; all metrics and costs export with data fingerprints; no strategy claim rests on one holdout. |
| **P3 · Guarded agent** | Evolve Nightwatch from a manual runner to a paper agent | Add scheduled, idempotent market checks first; then bounded event triggers and a human review queue. Keep explicit pause, loss/exposure caps, stale-feed rejection, duplicate suppression, and append-only decision logs. | A supervised paper run records proposals, rejections, fills, costs, and operator actions across a representative observation period; zero guardrail violations. No live orders. |
| **P4 · Product operations** | Reliability and supportability | Add correlated run IDs across research/strategy/agent; provider health and latency; actionable error classes; backup/restore rehearsal; dependency and data freshness monitoring; accessible responsive states and a support path. | Recovery rehearsal succeeds; critical flows have observable outcomes; no secrets or raw credentials enter logs; accessibility review has no blocking defects. |
| **P5 · Judge / customer proof** | Make outcomes legible | Produce a short guided demo, one-page architecture/data-flow map, track-specific results, limitations, and a complete materials index. Keep one lead story while showing how the other modes extend it. | A new user completes the main task without coaching; all demo links work in a logged-out browser; observed metrics and limitations match the live product. |

## First implementation slice

Research exposure cards will link to the matching Bitget Reality symbol in Strategy Lab and Nightwatch. Strategy Lab will initialize its symbol from that link. Nightwatch will accept the requested symbol only if it is present in the current Bitget Reality universe and will load candle history for that same asset. These are navigation and review handoffs only; they do not run a backtest, paper check, or order automatically.

## Product posture

“Institutional grade” is a target, not a current claim. Tidelight can become a professional research and paper-decision tool with strong provenance and controls while remaining paper-only. Do not claim institutional readiness, audited alpha, autonomous execution, or production trading until the corresponding evidence gates above have passed and the relevant independent reviews are complete.

## Delivery status · 2026-10-05

| Priority | Shipped in code | Remaining proof or dependency |
|---|---|---|
| P0 | Research exposure handoffs preserve the Bitget Reality pair and the owner-scoped research run ID into Strategy Lab and Nightwatch. Strategy run parameters and Nightwatch snapshots keep that lineage. | Verify the linked journey against the current production deployment after this change is published. |
| P1 | Mini can capture up to three allowlisted public sources; Pro accepts up to five excerpts. Official issuer and SEC filing starters are available. Quote-validated claims, observed publisher domains, counterpoints, and “what would change this view” checks appear in the branded brief. | Complete the real-event reviewer benchmark in `RESEARCH_EVALUATION_PROTOCOL.md`; broader discovery and independent publisher verification are not claimed. |
| P2 | Strategy runs return three disjoint trailing evaluation windows when sufficient history exists, a three-level fee/slippage stress, market freshness metadata, and a saved fingerprint. Short histories keep the base holdout but state why rolling windows are unavailable. | Validate real production histories over longer periods. Session-aware rToken fills and issuer-specific execution/liquidity are still not modeled. |
| P3 | An opt-in daily schedule, protected Vercel Cron route, Supabase server-secret-only wrapper, symbol and research-note owner checks, pause recheck, duplicate protection, and paper guardrails are implemented. Migrations are applied. | The owner reports adding the Supabase server key to Vercel. After deployment, verify scheduler health and a daily run. A representative supervised paper observation period remains. |
| P4 | Branded `/systems` dashboard and no-store health endpoint show request IDs, deploy SHA, Bitget freshness, provider configuration, and whether scheduler prerequisites are present. Operations and recovery steps are documented. | Perform a backup restore rehearsal in an isolated environment and inspect real deployment logs during a representative run. |
| P5 | A branded `/demo` walkthrough now links all three tracks, includes the architecture/data-flow story, and makes limitations explicit. | Observe a new-user walkthrough, record the demo, and publish actual benchmark and strategy outcomes after measurement. |

## Current next items

1. Use a daily 09:00 UTC Vercel Cron schedule, compatible with Hobby's once-per-day limit. The owner reports that the Supabase server-only key is already in Vercel; keep it sensitive and Production-only. The existing `CRON_SECRET` is already configured.
2. Deploy, then verify the health view, Mini multi-source research capture, Research → Strategy → Nightwatch lineage, and one scheduled paper run with an opted-in test account.
4. Capture and review the frozen event benchmark before making further research prompt changes.
5. Rehearse recovery against an isolated backup/branch, then run the judge/customer walkthrough and report measured results with limitations.
