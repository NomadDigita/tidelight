# Bitget S2 track map and Tidelight delivery gaps

Source: [official S2 handbook](https://bitget-ai.gitbook.io/bitgetai_hackathons2/), chapters IV–V, checked 10 October 2026. This is a product map; a feature listed as future work is not a claim of competition eligibility. The published handbook contains conflicting timeline dates in different sections, so confirm any event deadline with the organizer before relying on it.

## Common proof

The handbook asks Alpha Factory for strategy code and a backtest of at least 60 calendar days with at least 30 days out of sample. Agentic Trading asks for a runnable event→decision→execution demo and a competition-period paper log, recommending at least two weeks. AI Trading Desk asks for an accessible question→actionable insight task. Its five named directions are not separate requirements to enter one theme; the project can support several product workflows. Each entry is evaluated under one selected sub-theme, and a team may submit at most two **independent** projects/themes, each separately.

| Track / named direction | Current Tidelight proof | Most important next gap |
| --- | --- | --- |
| **Alpha Factory — arbitrage** | rToken and perpetual market lists, single-market replay | Validated same-underlying cross-venue/reference prices, fees, synchronization, mint/redeem constraints; never label a difference executable without depth and settlement data. |
| After-hours information pricing | `weekend_drift_v1`, rToken session metadata, market freshness gates | Timestamped event→price study across the US market close, matched controls, latency and liquidity conditions. |
| Cross-market correlation | Independent multi-market validation matrix | Synchronized stock/reference and rToken time series, lag analysis, corporate-action adjustment, hedge execution model. |
| rToken factor strategies | Six fixed deterministic rule families and Qwen hypothesis drafting; completed candle replay, cost sensitivity and training/holdout split | Factor discovery with a preregistered search budget and multiple-testing discipline. Report turnover and rolling 30-day Sharpe, not just return and drawdown. |
| Cross-asset allocation / rotation | rToken/stock-perp validation sets and a training-only leader view | A single jointly simulated portfolio with cash and allocation weights, aligned marks, rebalancing costs and sector/concentration risk. Basket averages are currently **not** portfolio returns. |
| **Agentic Trading — event-driven** | Agent Flow source checkpoints, confidence/freshness gates and Nightwatch paper decisions | Durable multi-day unattended paper evaluation, event→decision→fill attribution and operator intervention metrics. |
| Market sentiment | Public news sources and evidence summaries | Timestamped, permitted social/forum feeds, duplicate and manipulation defenses, evaluated incremental signal value. |
| Earnings-driven | Headline/source research and issuer mapping | Primary filing/call ingestion, estimates-vs-actual surprise, guidance parsing and event-aligned paper study. |
| Cross-asset execution | Stock exposure mapping and crypto/stock market catalog | Joint risk book and explicit hedges across rToken and crypto; separate order models for spot and derivatives. |
| Factor discovery | Qwen Alpha hypothesis mapped to one of six implemented rules | Closed-loop candidate registry, research budget, frozen holdout, rejection records and promotion gates; AI suggestions are not novel factors until tested. |
| **AI Trading Desk — extraction & signal** | Cited source-bound briefs and Agent Flow | Primary earnings/call extraction with quote provenance and expectation gap. |
| Review & self-evolution | Saved research, backtests, paper decision timeline | Link forecast→outcome→reason for error and versioned review checklist. |
| Decision stress testing | Exposure upside/downside/invalidation and backtest execution-cost stress | Conditional scenario distributions over comparable past events and proposed portfolio changes. |
| Personalized research workbench | Mini/Pro research, watchlist, asset details and connected evidence workflow | User-defined thesis templates and preferences persisted with private ownership. |
| Execution assistance | Explicit user order review and Bitget demo/live gates | Nontrivial limit-order plan based on verified order-book depth, spread, participation, estimated slippage and human confirmation; no unsupported smart-routing claim. |

## Provider roles

- [`bitget-mcp-server`](https://agent.bitget.com/mcp) is the handbook's read-only US stock/ETF quotes and fundamentals source, independent of a Bitget account. Evaluate supported endpoint schemas, freshness and rights before adding it to server-side research. It is **not** `bitget-signal`, whose five Skills cover crypto macro, sentiment, technical and news.
- [Agent Hub](https://github.com/BitgetLimited/agent_hub) provides CLI/MCP trading tools and an Agentic sub-account OAuth path. Tidelight currently has its own server-side Bitget connection and explicit trading controls. A future OAuth integration needs isolated per-user authorization, scopes, token revocation and a dry-run/paper gate; do not replace one with a broad shared key.
- [GetAgent Playbook/Studio](https://getagent.studio) is the handbook's hosted strategy authoring, backtest and continuous paper log path. Tidelight's Strategy Lab and Nightwatch are separate product workflows; their logs cannot be presented as GetAgent Studio logs.
- [Chainbase AgentKey](https://agentkey.app) is an **optional external partner** data layer for market, on-chain, news and social data, not a Bitget trading API. Add it as a server-side, source-provenance-aware connector only after authenticating and documenting specific tools, permissions, freshness, failure behavior and terms. Keep credentials off the browser and trading agent's execution authority.

## Priority sequence

1. **Reliable evidence:** add the read-only US data endpoint and optional AgentKey as distinct adapters, record source/time/license and fail closed for stale quote-based decisions.
2. **Measurable strategy quality:** expose the handbook's in-sample→holdout Sharpe decay alert (implemented in the Strategy Lab), add rolling 30-day stability/turnover when complete data are available, and prohibit portfolio language for independent single-market runs.
3. **Paper agent evaluation:** retain a continuous paper decision log with fill attribution, drawdown, violation and human-takeover metrics. Preserve no-trade decisions and provider failures.
4. **Desk depth:** primary earnings and fundamentals, then historical stress analogues and portfolio impact; show citations and uncertainty before any order review.
5. **Execution maturity:** isolated account authorization, strict scopes, spread/depth checks, dry-run and explicit user confirmation. Demonstrate with demo orders before proposing live automation.
