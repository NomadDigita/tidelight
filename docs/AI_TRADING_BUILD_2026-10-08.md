# Tidelight AI trading build

## Product boundary

The Bitget handbook defines Alpha Factory as verifiable US stock strategy code with at least 60 days of history and 30 days of chronological out-of-sample evidence. Agentic Trading requires an LLM decision-maker, runnable event → decision → execution demonstration, risk controls, and an actual dated paper record. These are distinct from a research page that advises a human.

Tidelight currently has two separate market paths:

| Market | Alpha Factory | Agentic execution | Exchange execution |
| --- | --- | --- | --- |
| Reality rToken spot (`RNVDAUSDT`) | Completed Bitget candles, deterministic rule, costs, holdout, rolling windows, hash and trade log | Nightwatch evaluates the selected playbook and research, logs a decision, then the database atomically applies paper risk gates | Human-reviewed Reality spot orders only through a verified per-user Bitget connection |
| US stock perpetual (`NVDAUSDT`) | Verified online Bitget USDT-FUTURES instrument, completed candles, the same fixed-rule historical validation and training-only basket selection | Not connected to Nightwatch's spot ledger | No futures order path |

The futures replay models unlevered price changes with fee and slippage assumptions. It does **not** model funding, margin, liquidation, contract sizing, session-specific liquidity or order-book impact. Its return is not futures account P&L. The current basket comparison selects a single training leader, then reports that market's separate holdout. It is not a continuously rotating portfolio and is not evidence of alpha by itself.

## Playbook research

The public GetAgent Studio leaderboard and strategy pages were reviewed on October 8. The user's **US Stock Relative Strength Pullback** is a long-only eight-stock USDT perpetual playbook: it ranks medium-term strength, waits for a cooled EMA/RSI pullback, and exits using ATR levels. The public **Tech Semiconductor Rotation** covers an eight-market semiconductor universe with explicit paper trades, drawdown, win rate and code provenance. Its reported paper return is a historical observation, not a result reproduced in Tidelight. The stock-perpetual universe and semiconductor basket in this build draw on the *market and validation concepts*, not a copy of that source code. The user's **Wide Alt Sweep** is a crypto playbook and is deliberately outside this US-equities strategy experiment.

## MCP and account architecture

The handbook describes two different MCP services. The HTTP `https://agent.bitget.com/mcp` endpoint is **read-only US stock/ETF data** and does not need a Bitget account key. Bitget Agent Hub's `@bitget-ai/bitget-agent-mcp` is the **trading/account** service, a local stdio server with Agentic Account OAuth or a dedicated key; it is not a serverless Vercel secret to share among users. The existing web app calls Bitget's documented public UTA REST endpoints for instrument verification and candles, and its per-user order route uses encrypted per-user credentials. Neither MCP has been silently added to the deployed web runtime.

## Next acceptance gates

1. **Evidence fidelity:** Retrieve a real stock perpetual's 4H history; save a ≥60-day replay with ≥30-day untouched holdout, full raw candle hash, dated trade log, fees and slippage. Reject too-short histories and suspended contracts. Verify all figures from exported data.
2. **Cross-market strategy:** Build a true timestamp-aligned, no-lookahead selection and rebalance simulator. Model idle cash, turnover, funding, contract tick/size, and stress liquidity. Compare to fixed-symbol and buy-and-hold baselines, then test independent periods. Do not relabel the current basket comparison as rotation.
3. **Agentic paper futures:** Add a separate futures paper ledger and position/risk model. The LLM proposes a structured decision citing fresh US-equity evidence; deterministic gates independently enforce sizing, leverage cap, daily loss, liquidation buffer, staleness and duplicate-bar lock. Log HOLD, rejection, intervention, and fill outcomes. No automatic live futures path yet.
4. **Provider data:** Integrate the read-only Bitget US-stock MCP via a server-side MCP client after discovering its actual tool schemas and verifying end-to-end availability. Reconcile issuer/earnings data with Bitget contract identity; keep provenance and timestamps visible. The current REST feed remains the price authority for executable market symbols.
5. **Isolated execution:** Evaluate Agentic Account OAuth and its scoped, no-withdrawal sub-account with Bitget's official flow. Demo futures orders require a separate demo key and `paptrading: 1`. Reconcile exchange orders and fills, use idempotent client IDs and a kill switch, and verify before enabling any opt-in live futures control. Never substitute a shared platform key for per-user authorization.
6. **Paper record and review:** Run a continuously dated paper period, show decision consistency, risk violation rate, drawdown, Sharpe and comparison to a fixed rule. Export auditable evidence. A two-week paper record cannot be manufactured retrospectively.

## Sources

- [Bitget S2 handbook](https://bitget-ai.gitbook.io/bitgetai_hackathons2)
- [Bitget UTA market data](https://www.bitget.com/docs/catalog/market/market-data)
- [Bitget Agentic Account guide](https://www.bitget.com/support/articles/12560603894122)
- [GetAgent Studio leaderboard](https://getagent.studio/)
