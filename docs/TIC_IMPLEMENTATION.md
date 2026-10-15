# Tidelight Intelligence Cloud implementation record

## Repository audit (15 October 2026)

Tidelight is a single Next.js 16 application on Vercel with Supabase Auth and Postgres. Existing market adapters live in `lib/bitget-market.ts`; SEC company facts, evidence collection, Agent Flow, strategy backtests, token pulse, and Nightwatch each have existing modules and routes. The current Agent Flow request has a 60 second Vercel duration and streams directly from the web request. Existing research data is owned by `user_id` and protected by RLS. The UI has Tidelight theme variables, branding assets, a workspace shell, and mobile styles.

Current capabilities are uneven. Bitget Reality spot rTokens and stock perpetuals are distinguished in the market adapter. Some research is durable in `research_runs`, but execution itself is not queue backed and cannot yet support a public asynchronous job contract. There is no organization model, commercial billing, OAuth server, SDK release pipeline, or webhook dispatcher. No public developer credentials existed before this milestone. Existing live trading routes must remain outside developer scopes.

## Architecture boundary

The first public API capability reuses `getBitgetMarketUniverse()` rather than a second provider implementation. `app/api/v1` owns the versioned external contract. `lib/tic` owns credential handling. `app/api/developers` owns cookie authenticated console operations. The developer UI is under `app/developers`. This grouping can be extracted into separate services and repositories later without moving core market logic into the UI.

The API checks a high entropy Bearer key through a service role only RPC. The RPC holds a key row lock while checking per-minute and monthly quotas and reserving a request record, so concurrent calls cannot bypass the limit. Project ownership is checked with the authenticated Supabase user before key issuance. Client roles have no direct grants or RLS policies on the new credential tables. A full secret is returned only on creation. The request log contains metadata, never headers or bodies.

The contract currently uses `tidelight.app/api/v1` so it can be deployed with the existing application. `api.tidelight.app`, `mcp.tidelight.app`, and `docs.tidelight.app` need routing and DNS review before they can be advertised. The landing page and docs inherit current Tidelight theme tokens and the developer routes bypass the trading workspace chrome.

## Milestone 1 — developer foundation

Acceptance: a signed in user creates a project, issues a test or production key, receives the secret once, lists and revokes keys, calls a versioned real provider backed read only endpoint, and sees the request in usage. Calls with no key, a revoked key, malformed inputs, or exceeded limits receive structured errors. The public response separates a tokenized equity spot instrument from its underlying stock and provides source and provider timestamp.

Files: `supabase/migrations/20261014235754_intelligence_cloud_foundation.sql`, `lib/tic/credentials.ts`, `app/api/developers`, `app/api/v1/market/instruments`, and `app/developers`.

Verification: 110 existing tests, lint, TypeScript, and production build passed. A fresh local PostgreSQL 17 instance accepted the migration. A database smoke test confirmed that `anon` and `authenticated` cannot read key records or call the quota RPC; the first service request was reserved; the next hit the minute quota; an unrelated scope was denied; and revocation invalidated the key. Browser checks covered the public landing, docs, signed out console, and local empty console state at 1440 px and 390 px with no document overflow. The authenticated journey and provider response need a deployed environment with the database migration and server secret.

The subsequent client milestone adds unpublished `sdk/typescript` and `sdk/python` packages for this endpoint. TypeScript and Python tests cover Bearer authorization, cursor paging, transient retries, invalid inputs, and structured errors. The combined JavaScript suite now passes 113 tests, Python passes 3 tests, and TypeScript compilation, lint, and production build pass. Browser checks of the existing landing at 1440 px and 390 px confirm the new Developers links without document overflow.

Deployment prerequisites: apply the migration to the matching Supabase project and ensure the Vercel server has `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. The production Vercel project has a `SUPABASE_SERVICE_ROLE_KEY` setting; preview does not. The publishable key remains in browser use; the secret must never be prefixed `NEXT_PUBLIC_`. Provider licensing and permitted API redistribution need confirmation before production activation.

## Remaining milestones in dependency order

1. Add a durable queue and worker, then move research execution behind a typed service boundary. Implement job leases, retries, cancellation, idempotency, source validation, cost budgets, and provider outage behavior. Only then expose research and agent API routes.
2. Expand project membership into organizations with audited role changes, tenant RLS tests, and account recovery. Add key rotation, custom scopes when actual capabilities exist, security logs, and stronger abuse controls.
3. Extend the existing OpenAPI contract and the in-repository TypeScript and Python clients as endpoints become real. Add live integration tests once an authorized deployment is available. Publish only after package ownership and release credentials are established.
4. Build a remote Streamable HTTP MCP server on the same intelligence services with scoped authentication and tested client connections. Return evidence and concise execution events; keep private model reasoning private.
5. Implement a credential safe API explorer, richer searchable documentation, webhook delivery infrastructure with SSRF protection and signatures, and monitoring controls only for supported event sources.
6. Measure provider and compute costs, define entitlements and credit budgets, then select a Nigerian merchant compatible payment provider and configure approved pricing. Billing UI must show actual records only.
7. Run cross theme and mobile UI review, accessibility checks, database RLS and auth tests, MCP interoperability, SDK integration, abuse tests, staging smoke tests, then controlled production verification for each capability.

## External configuration still needed

Separate `api` and `mcp` hosts require DNS and Vercel domain configuration. Durable workers require a selected execution host and its credentials. MCP OAuth requires issuer, client registration, consent, and token lifecycle infrastructure. SDK publishing requires package ownership and publishing credentials. Commercial billing needs pricing approval, payment provider eligibility and account configuration. Provider licensing must be confirmed before broad redistribution of market data.
