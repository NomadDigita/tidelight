# Tidelight operations runbook

## Service status

- `/systems` is the branded operator view.
- `GET /api/system/health` returns a request ID, deploy SHA, response time, Bitget snapshot age and coverage, and provider configuration flags. “Configured” does not claim an upstream health probe, cron execution, or SLA.
- Bitget market endpoints show stale or unavailable states rather than replacing failed live data with sample values.
- Vercel runtime logs should be searched by route and time. Correlate a user-visible research or strategy artifact with its returned run ID; Nightwatch persists the run ID on every decision.

## Nightwatch scheduled paper checks

The scheduled path is configured for 09:00 UTC once daily and is opt-in per signed-in account and one Reality pair. Hobby timing precision is per-hour, so the invocation may begin from 09:00 through 09:59 UTC. Every run fetches the latest completed four-hour Bitget candle, then Postgres rechecks the current opt-in, selected symbol, pause state, owner link, duplicate key, feed freshness, loss cap, position cap, and daily fill limit. It uses the existing paper ledger. No exchange order API is called.

Required production environment:

| Variable | Where to get it | Vercel target |
|---|---|---|
| `CRON_SECRET` | Already present on the Tidelight Vercel project | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Tidelight project → Project Settings → API Keys → Legacy anon, service_role API keys → copy `service_role` | Sensitive, Production only |

Never prefix the Supabase service-role key with `NEXT_PUBLIC_`, commit it, paste it into a browser client, or send it to a third-party provider. The product owner reports that this key has been added to Vercel. After the next production deployment, confirm `/api/system/health` reports the scheduler configured. Then opt in on Nightwatch. The schedule remains disabled in the UI until both server secrets are present.

The Vercel Hobby-compatible schedule is once per day at 09:00 UTC, with per-hour timing precision (the run may begin from 09:00 to 09:59 UTC). This lowers automated observation cadence; users can still run manual checks at any time. Vercel Cron invokes production deployments only. See [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) and [securing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Backup and recovery

No production restore has been performed. Before calling recovery rehearsed, use an isolated staging project or branch, restore a recent backup there, check migrations and owner-scoped reads, and record restore time and data-loss point. Do not restore over production as a test. The Supabase project owner must confirm available backup retention and restore options in the project dashboard because they depend on the current plan.

## Incident response

1. Pause the user's Nightwatch paper agent from its control surface; no live execution path exists.
2. Check `/systems` for stale providers and note the request ID and deploy SHA.
3. Check Vercel function logs for the relevant route; never include API keys or authorization headers in logs.
4. If a market source is stale or unavailable, stop manual checks until current completed candles return.
5. Preserve the research run, candle fingerprint, Nightwatch decision and operator action IDs before changing configuration.
6. For account isolation or unexpected paper-ledger writes, disable the scheduled secret in Vercel and inspect the corresponding Supabase audit records before resuming.
