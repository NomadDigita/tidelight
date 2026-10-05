# Tidelight — S2 product plan

**Product:** Tidelight, an after-hours intelligence terminal for tokenized US equities and digital assets.  
**Core promise:** one verified asset universe; three ways to act on its data—research with a human, test an alpha strategy, or run a guarded paper-trading agent.  
**North-star use case:** a retail trader wakes to an overnight macro or company event, sees which Bitget rTokens are affected, inspects cited evidence and a counter-case, then chooses whether to paper-test an action. Nothing routes a live order without a later explicit opt-in and deterministic checks.

## Hackathon fit

Tidelight will be one coherent product spanning the three Bitget tracks, with separate, judge-ready demonstrations and evidence for each:

| Track | Tidelight mode | Judging proof we must produce |
|---|---|---|
| **AI Trading Desk** | Source-led Event Desk: question → captured sources → verified claims → affected assets → scenarios, uncertainty and next catalysts | Public runnable demo completing one real research task; evidence-to-claim links; task time and support/contradiction coverage |
| **Alpha Factory** | After-hours Strategy Lab: transparent, deterministic signals over Bitget rToken candles; execution costs and market-session-aware risk | Runnable strategy code; reproducible **≥60-day** backtest with **≥30-day** out-of-sample period; raw trades, equity curve, fees/slippage, drawdown, Sharpe/Sortino and win rate |
| **Agentic Trading** | Nightwatch: a user-triggered completed-candle watcher proposes a bounded paper action; a rules engine checks it; the simulator logs every decision and fill | Runnable candle → decision → risk-check → paper execution path; dated audit log; competition-period paper run (target two weeks); rejection and pause/resume tests |

The app must label each mode clearly and maintain separate metrics and artifacts. The project will not describe the same generic chat screen as three different products. An entry to multiple hackathon themes requires separate entries and independent projects, per the handbook; we should submit **one strongest entry** unless the organizer confirms a second genuinely independent deliverable is appropriate.

**Initial submission recommendation:** keep the product built for all tracks; target **Agentic Trading → after-hours/event-driven paper agent** as the lead entry once its end-to-end runner and auditable paper log exist. Keep the AI Trading Desk as the public product’s strongest human-facing workflow, and only enter Alpha Factory after its out-of-sample record is reproducible. A polished surface without validation is not a winning claim.

## Data contract and coverage

### Bitget sources

- `GET /api/v3/market/instruments?category=SPOT`: symbols, trading status, `isRwa`, and `isReality` classification.
- `GET /api/v3/market/tickers?category=SPOT`: last, high/low, 24h change, volume/turnover, and provider timestamp.
- `GET /api/v3/reality/market/stock-info`: underlying ticker, issuer/company name, allowed trading sessions, weekend tradability.
- `GET /api/v3/reality/market/states`: US equity session schedule and DST context.
- Spot candles and public WebSocket ticker/candlestick channels for strategy history and later streaming. Respect rToken-specific intervals and volume caveats.

The market UI is read-only. It uses provider timestamps, shows stale or unavailable state, and never fills a feed outage with invented values. Instrument flags are the source of truth for identifying an rToken; symbol prefixes alone are not proof. Logo URLs are presentation metadata and never treated as issuer, listing, or backing evidence. A verified issuer-domain map supplies company favicons where known; unsupported rTokens use a ticker mark rather than a guessed crypto logo. Full long-tail profile/logo coverage is a separately cached metadata integration.

Bitget’s current Reality guide says tickers, instruments, candlesticks, and stock-reference data are public; Reality order book and platform fills have separate whitelist requirements. We should request the Reality data whitelist only if those surfaces materially improve the demo. The initial product does not need account credentials to display market data.

### Persistent data boundaries

- **Supabase** remains system of record for users, preferences, watchlists, research runs, evidence, paper accounts/orders, strategy definitions and backtest runs.
- Market quotes are provider snapshots, not personal records. Normalize with `provider`, `symbol`, `category`, `as_of`, and `received_at`; retain enough raw provenance to reproduce a backtest. Avoid a public write endpoint for quotes.
- Public reference/catalog data is read-only to guests. User portfolios, watchlists, agent preferences, research and paper ledgers are protected by `auth.uid()` RLS. No `service_role` key in browser variables or public tables.
- Do not store real exchange credentials inside user metadata, normal Postgres rows, GitHub, or browser local storage. If account connection becomes necessary, use a dedicated secret vault and narrowly permissioned keys.

## System architecture

1. **Next.js / Vercel:** product routes, authenticated server actions, public read-only Bitget proxy, server-only Qwen adapter, health/version surfaces. Supabase `pg_cron` handles the database-only daily in-app summary; scheduled market checks remain a separate release gate.
2. **Bitget adapter:** typed REST/WebSocket boundary; validates envelopes and decimal values; instrument cache separate from ticker cadence; explicit timeout, retry/backoff, schema validation, and circuit-breaker/unavailable states.
3. **Supabase Postgres + Auth:** owner-scoped product data and reproducible experiment records. Every exposed table has RLS and explicit role grants. Use service credentials only from trusted workers.
4. **Research engine:** source capture → normalization/deduplication → claim extraction → Qwen synthesis constrained to captured evidence → claim/evidence validation → saved brief. Inference is visibly separated from sourced facts.
5. **Strategy engine:** deterministic TypeScript/Python-independent core with versioned strategy config, candle normalization, fee/slippage model, train/test split, reproducible seed, trade-level output, and no future-data leakage.
6. **Agent runner:** market/event trigger → context snapshot → strategy/Qwen proposal → deterministic risk gate → paper fill simulator → audit event. Qwen can propose and explain; it cannot bypass hard limits.
7. **Observability:** provider health, last successful update, feed age, run IDs, model/version, error classes, cost/latency and decision rationale. Never log secret values or raw credentials.

## Agent safety and paper execution rules

- Default mode is paper-only; no account connection and no live order routes in the public demo.
- Position, daily-loss, per-symbol exposure, stale-feed, max-spread, price-band, duplicate-order and market-session rules are deterministic and enforced after AI output.
- Every proposal includes the market snapshot, source/evidence IDs, model and strategy versions, risk checks, proposed action, rejection reasons, simulated price/fees/slippage, and user override.
- Reject all actions on stale or misclassified instruments. Reject execution when price is missing or inconsistent. Expose the reason; do not retry into a live action.
- A live-order feature is a future gated milestone. It requires separate user authorization, restricted API key, no withdrawal permission, IP allowlist, small caps, confirmation per order, and kill switch. Do not request Bitget trading secrets for the present read-only milestone.

## Delivery roadmap

| Phase | Build and evidence | Exit gate |
|---|---|---|
| 0 · Data trust (completed) | Live Bitget USDT spot universe and ticker adapter; 3,321 instruments currently observed, including 2,809 marked `isReality`; Reality/RWA flags; provider timestamps; honest feed states; verified mapped logos and ticker fallbacks | Verified deployed rToken snapshot; no sample prices; no market-data key required |
| 1 · Asset workbench (in progress) | Per-pair detail route; Bitget OHLCV chart (1H/4H/1D); validated API routes; issuer/session facts; market-map links; saved market-pair support | Test rToken, RWA and crypto routes; verify chart intervals; resolve/label unavailable session-state endpoint; mobile/accessibility and RLS review |
| 2 · Research Desk | Mini single-link capture from selected issuer sites, SEC.gov, and selected publishers; Pro up to five user-provided passages; claim graph, counter-evidence, Qwen citation-constrained brief, source replay | Captured pages are capped at 2 MB, redirects are restricted to approved HTTPS hosts, quotes are matched to stored text, and research generation is limited to 10 runs per signed-in user per hour. Broad source discovery and independent publisher verification remain to be completed |
| 3 · Strategy Lab (baseline implemented) | Versioned 20/50 SMA replay over up to 1,000 public Bitget candles; chronological 66/34 split; fee/slippage model; at least 30 evaluated training days after warm-up and a 30-day holdout; return, drawdown, Sharpe/Sortino, win rate, equity path and trade log; persist exact completed candles and SHA-256 fingerprint under RLS | Five live 4H probes confirm sufficient completed history for Apple, NVIDIA, Tesla, BTC and ETH. A dated report records the exact data-window hashes and observed holdout results; all five underperformed buy-and-hold in this snapshot. Preserve the negative results, then verify owner-authenticated saved runs and add session-aware fill modeling before making track-grade performance claims |
| 4 · Nightwatch paper agent (manual runner implemented) | User-triggered Bitget Reality 4H SMA20/50 crossover; atomic paper fills with $500 cap, 0.10% fee, 0.05% slippage, $200 UTC-day loss stop, five-fill cap, stale-candle gate, pause/resume, idempotent candle key; owner-scoped append-only decision and fill log; Supabase Cron creates daily in-app summaries without a service-role key | Verify cross-user isolation and rejection edges; add scheduled market/event triggers; run continuously in paper mode and collect at least two weeks of timestamped records before claiming sustained agent performance |
| 5 · Product finish | Three separate track journeys, responsive screens, docs, privacy/security review, demo fixture sourced from real data, product analytics opt-in | Fresh browser/guest run plus signed-in owner-boundary check; Vercel preview/prod smoke; no critical errors |
| 6 · Submission kit | Code, demo, strategy report, paper log, Qwen disclosure, project description, materials index, required X post and quote, form | All fields and artifacts accessible; organizer-confirmed deadline captured; submission done by account owner |

Work is ordered by dependencies: real data before strategy claims; persistent run logs before agent claims; only then choose the strongest theme and write the project description. The organizer-provided deadline extension is the operative assumption for scheduling; record the official confirmation in the release checklist before form submission. Bitget's `/reality/market/states` currently reports unavailable from this deployment; until it is verified, the app exposes that clearly and uses each asset's returned session eligibility without inferring whether the US market is open. Nightwatch market checks still require explicit user action; daily summaries are scheduled, but no continuous market watcher or event ingestion is active yet.

## API keys and access needed

### Required now

**No new API key is needed for Bitget public spot tickers, public instrument/RWA/Reality flags, or Reality stock/session reference.** These are read-only public endpoints. The Qwen key already configured on Vercel as `BITGET_QWEN_API_KEY` remains server-side for AI research.

### Optional keys only if we choose these integrations

| Key | Purpose | Need now? | Destination when approved |
|---|---|---:|---|
| `POLYGON_API_KEY` (or a currently supported Massive equivalent) | Native US-equity reference candles for rToken-vs-underlying comparisons and another market-data fallback | No; Bitget rToken candles cover initial strategy work | Vercel encrypted server environment only |
| `FINNHUB_API_KEY` | Broader news/company-event enrichment and issuer profile/logo metadata for the long tail of 2,800+ Reality listings | Optional for initial release; Bitget already supplies price, Reality classification, stock ticker/name, sessions and weekend flag | Vercel encrypted server environment only; cached, server-side requests |
| `BITGET_API_KEY`, `BITGET_API_SECRET`, `BITGET_API_PASSPHRASE` | Authenticated account data or real exchange orders; not public prices or paper trading | **Do not provide yet** | Dedicated server-side secret storage only; separate restricted key, IP allowlist, no withdrawal permission, explicit live-trading authorization first |
| Supabase service/secret key | Trusted scheduled sync or backend service operations that bypass user RLS | Not required for public feed route; current Supabase auth connection is already configured | Server/Edge Function secret only; never `NEXT_PUBLIC_*` |

Do not paste a key into Tidelight’s public UI, an issue, a commit, or an ordinary settings field. When an optional integration becomes necessary, name the specific key, permission scope, and encrypted server destination before requesting it. Never transmit a secret to a provider unless that integration is needed and the user has authorized the destination.

## Validation scorecard

- **Market integrity:** instrument match rate, quote freshness p50/p95, API error rate, rToken classification checks, missing-logo rate.
- **Desk quality:** time-to-insight, citation coverage, unsupported-claim rate, contradiction coverage, source diversity.
- **Quant:** total/OOS return, Sharpe, Sortino, max drawdown, win rate, turnover, fees, slippage, tail-loss days, market-session breakdown.
- **Agent:** proposals, accepted/rejected actions, risk-rule violation rate (target 0), rejected stale-feed count, human takeover rate, paper P&L after costs, baseline delta.
- Report sample size, period, data source, model/version and whether each result is observed, simulated, estimated or targeted. Never invent adoption or performance numbers.

## Submission requirements checklist

- Six-part project description: thesis; specific target user/value; validation data and metrics; completed/incomplete progress; deliverables; optional AI-trading take.
- Role of LLM describes exactly what Qwen does and how it is bounded; mention Qwen subsidy only if used.
- Materials link includes live demo, public code, strategy/report (if entering Alpha), dated paper log (if entering Agentic), and short walkthrough video.
- X promotional post includes `#BitgetHackathon`, `@Bitget_AI`, an interactive product/agent/strategy explanation, and quotes the organizer’s required post.
- Complete organizer form and verify every link as a logged-out judge.
