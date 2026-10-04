# Tidelight

**See the signal between sessions.**

An after-hours research desk for tokenized US equities. Tidelight turns an event question into a source-linked research brief with market context, scenarios, exposure, and risks to watch.

## Current status

The public dashboard is live. Supabase Auth uses email magic links, and signed-in users can save and review their owner-scoped research. The evidence workflow accepts a source title, secure URL, and user-provided passage; a server-only Qwen adapter returns a structured brief, quote-checks every claim against the supplied passage, and saves the source and evidence under RLS. The Qwen key is not configured in the deployment yet, so generation stays unavailable until the key is added. Market prices and sample stories remain illustrative; no investment performance is claimed.

## Stack

- Next.js App Router + TypeScript
- Supabase Postgres and Auth (database schema and RLS policies are provisioned)
- Live site: [tidelight-two.vercel.app](https://tidelight-two.vercel.app/)
- Qwen synthesis uses Alibaba Model Studio's OpenAI-compatible endpoint; `QWEN_API_KEY` is server-only
- Bitget Agent Hub SDK is present, but its UTA market catalog does not expose verified tokenized-equity instruments; the app does not pass off unrelated crypto tickers as equity data

## Run locally

Run `npm ci`, copy `.env.example` to `.env.local`, then run `npm run dev`.
Fill `.env.local` with the Tidelight project's Supabase URL and publishable key before using Supabase features.

## Database

Schema changes are in `supabase/migrations`. Every public table has RLS enabled; authenticated users are scoped to their own records. Anonymous users receive no table grants. Research evidence is constrained to sources from the same research run.

The initial migrations were applied to Supabase project `plmdnzbmvgigkzfmfwov`. The Supabase CLI config uses the local project slug; link the Tidelight project before running `supabase db push`.

## Product plan

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the hackathon thesis, user journey, build milestones, and demo scorecard.

## Validation targets

Track source citation coverage, factual claim support, task completion, response time, and performance against a fixed research baseline. Label any simulated or estimated output clearly.
