# Intelligent Overview

## How it works

The Overview keeps its server-rendered shell and loads the signed-in user’s watchlist and latest Agent Flow records through the existing Supabase server client. Those records remain protected by the existing owner RLS policies on `research_runs` and `watchlist_items`; this change adds no tables or migration.

An interactive question is sent to the existing authenticated `POST /api/research/agent-flow` route. That coordinator retrieves attributable public coverage, Bitget stock-perpetual and rToken references, completed 4-hour candles, a source-bound AI assessment when a configured provider returns a valid response, and the existing deterministic Alpha Factory and trading review gates. Its SSE checkpoints feed a small activity panel mounted in the persistent workspace shell, so navigation does not discard a running stream. Client cancellation still aborts the active request.

Completed results are saved by the existing coordinator in `research_runs.summary`. `lib/intelligence-ui.ts` validates both streamed and restored JSON before it is rendered. `composeIntelligenceBlocks` selects only the Tidelight-owned component registry; response data cannot choose component names, HTML, or executable code. Follow-up submissions may reference a prior run, which is reloaded server-side only when it belongs to the signed-in user and completed successfully. The previous read is passed to the analyst as continuity context, not as evidence for current claims.

Mini and Pro use the same coordinator and saved result. Mini shows a shorter source list and plain-language labels; Pro exposes the fuller retrieved evidence and operational trace. Both preserve the underlying evidence, uncertainty, quote timestamps, and trade gates.

## Available UI blocks

- Agent activity and completed operational checkpoints
- Single-issuer read or multi-issuer comparison
- Bitget close-price plots from completed 4-hour candles, when available
- Retrieved public source links and publisher/date attribution
- Source-bound summary, returned risks, and the next evidence check
- Existing deterministic gate status and reasons
- Contextual links to Strategy Lab, Nightwatch, paper futures, and the existing Bitget review controls

## Current limits

The workflow currently supports the US stock underlyings in `STOCK_PERP_UNIVERSE` and analyzes at most three per run. The current provider contract does not return a structured event/catalyst timeline, validated alternative bullish and bearish scenario set, portfolio exposure snapshot, or a Strategy Lab backtest result inside the research response, so Overview does not fabricate those panels. Strategy Lab, Nightwatch, and trade desks are linked with the saved research run ID so each existing tool can perform its own checks.

Market plots are run-time snapshots, not continuously updating charts. A qualified gate opens an existing review desk only; Overview never submits orders, bypasses the account/risk controls, or switches an account to live mode. AI synthesis can be unavailable: in that state the workflow retains source/market context and keeps the directional trading handoff closed.

## Verification

The UI schema tests exercise validated registry composition, malformed provider/persisted JSON, link protocol checks, finite market data, and confidence bounds. See the pull request for the current lint, typecheck, build, test, and responsive screenshot results.

Screenshots were captured locally at 1440 px desktop, 768 px tablet, and 390 px mobile widths. They show the signed-out/disconnected-feed state because no authenticated test account was provisioned in this environment:

- [Desktop](screenshots/intelligent-overview/desktop-1440.png)
- [Tablet](screenshots/intelligent-overview/tablet-768.png)
- [Mobile](screenshots/intelligent-overview/mobile-390.png)
