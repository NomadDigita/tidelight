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

## Current next items

1. Complete and verify the P0 cross-track handoff.
2. Define the real-event research benchmark and capture baseline results before changing prompts or source coverage.
3. Implement walk-forward strategy validation using archived, completed candles and session-aware assumptions.
4. Design the scheduled paper-check service and operational stop controls; run in paper mode only.
5. Rehearse the integrated product journey and publish exact observed metrics and limitations.
