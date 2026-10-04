# Tidelight

**See the signal between sessions.**

An after-hours research desk for tokenized US equities. Tidelight turns an event question into a source-linked research brief with market context, scenarios, exposure, and risks to watch.

## Current status

The dashboard and branded research workspace are implemented. Supabase Auth uses email magic links; verified sessions refresh through Next.js proxy, and a server action saves research questions as owner-scoped queued runs. The research preview still has illustrative content: live evidence gathering, Qwen synthesis, and live market data are not yet connected. No investment performance is claimed.

## Stack

- Next.js App Router + TypeScript
- Supabase Postgres and Auth (database schema and RLS policies are provisioned)
- Live site: [tidelight-two.vercel.app](https://tidelight-two.vercel.app/)
- Qwen event extraction and synthesis planned (server-side API key required)
- Bitget Agent Hub SDK installed in read-only mode; public API reachability and tokenized-equity symbols need validation in the hosted runtime

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
