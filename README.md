# Tidelight

**See the signal between sessions.**

An after-hours research desk for tokenized US equities. Tidelight turns an event question into a source-linked research brief with market context, scenarios, exposure, and risks to watch.

## Current status

The public product has a live, read-only Bitget USDT spot map with explicit Reality/rToken flags, quote timestamps, and asset details. Per-pair detail routes add public Bitget OHLCV history and session eligibility. Supabase Auth uses email magic links; signed-in users can save owner-scoped research and Bitget markets. The evidence workflow accepts a source title, secure URL, and user-provided passage; a server-only Bitget Qwen adapter returns a structured brief, quote-checks every claim against the supplied passage, and saves the source and evidence under RLS. The Strategy Lab runs a deterministic 20/50 SMA baseline using up to 1,000 public Bitget candles, rejects windows shorter than 60 days / 30-day holdout, models estimated costs, and archives exact candles, parameters, run metrics and a SHA-256 fingerprint in Supabase. It is a research replay, not a performance claim or investment signal.

## Stack

- Next.js App Router + TypeScript
- Supabase Postgres and Auth (database schema and RLS policies are provisioned)
- Live site: [tidelight-two.vercel.app](https://tidelight-two.vercel.app/)
- Strategy Lab: [/strategies](https://tidelight-two.vercel.app/strategies) — signed-in users can save private, chronological out-of-sample replays
- Qwen synthesis uses Bitget's hackathon gateway (`https://hackathon.bitgetops.com/v1`) with `qwen3.8-max`; `BITGET_QWEN_API_KEY` is server-only
- Bitget public market APIs provide spot instruments, tickers, Reality metadata, and candles; account credentials are not required for these read-only routes

## Run locally

Run `npm ci`, copy `.env.example` to `.env.local`, then run `npm run dev`.
Fill `.env.local` with the Tidelight project's Supabase URL and publishable key before using Supabase features.

## Database

Schema changes are in `supabase/migrations`. Every public table has RLS enabled; authenticated users are scoped to their own records. Anonymous users receive no table grants. Research evidence is constrained to sources from the same research run. Strategy backtests archive the exact candles and owner-scoped result metrics for repeatable inspection.

The initial migrations were applied to Supabase project `plmdnzbmvgigkzfmfwov`. The Supabase CLI config uses the local project slug; link the Tidelight project before running `supabase db push`.

## Product plan

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) and [docs/HACKATHON_PRODUCT_PLAN.md](./docs/HACKATHON_PRODUCT_PLAN.md) for the hackathon thesis, all-track architecture, credential inventory, build sequence, safety model, and demo scorecard.

## Validation targets

Track source citation coverage, factual claim support, task completion, response time, and performance against a fixed research baseline. Label any simulated or estimated output clearly.
