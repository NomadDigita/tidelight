# Tidelight Codex handoff

**Prepared:** 16 October 2026
**Repository:** [`TidelightOrg/tidelight`](https://github.com/TidelightOrg/tidelight)
**Verified baseline:** `main` at `b58fad0`, merged PR #161; last READY production application build is still PR #157 (`fd52a8a`) because later main changes were docs/tests only
**Purpose:** let a fresh Codex session continue from verified state without redoing completed work.

This is the short operational index for the project. The detailed implementation evidence remains in [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md); the product roadmap is [`PRODUCT_EVOLUTION_ROADMAP.md`](PRODUCT_EVOLUTION_ROADMAP.md); operating procedures are in [`OPERATIONS_RUNBOOK.md`](OPERATIONS_RUNBOOK.md). Read those source documents when working in their area. Update this handoff when milestones, production configuration, or the next action changes.

## Next session: exact continuation point

Start by checking out the current `TidelightOrg/tidelight` `main`, reading this file, `AGENTS.md`, and the detailed records linked above. Confirm the current branch and clean/dirty state before changing anything. The repository is now in the new organization; the historical source remote was `NomadDigita/tidelight`. Do not create a parallel project or reimplement milestones already listed as complete.

### First actions, in order

1. **OAuth refresh replay protection is merged, live, and production-verified (PR #152).** `npm test` passed 145 tests; typecheck, lint, production build, and PostgreSQL 17 OAuth integration passed. In a signed-in production MCP Inspector OAuth/PKCE journey, authorization-code exchange, scoped tool discovery, a real five-instrument result, refresh rotation, and use of the rotated token all succeeded. Replaying the consumed refresh token returned `invalid_grant`; the rotated access token was then denied by MCP, confirming grant revocation. Temporary project, API keys, OAuth clients, sessions, flows, request rows, and key-audit rows were removed; final Supabase counts were zero. See [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md#oauth-refresh-replay-hardening--pr-152-production-deployed).
2. **Developer console mobile navigation fix is live (PR #156).** The signed-in production console was inspected at 390 px and 1440 px. All ten navigation controls were selected in turn; each became the sole `aria-pressed="true"` section and its button stayed inside the mobile navigation viewport. The 390 px page had no horizontal overflow or browser errors. The tab was restored to Request usage, where the account has no developer projects and displays honest zero totals and empty states. See [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md#developer-console-mobile-navigation--pr-156-production-verified).
3. **Analytics production inspection is complete.** The authenticated Usage page was inspected at desktop and mobile sizes; the account had no developer projects, so its honest production state was zero activity and empty chart/request states. Populated buckets and latency remain covered by database fixture tests. See [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md#milestone-10--request-usage-analytics).
4. **Scheduled Nightwatch database safeguards now have PostgreSQL integration coverage (PR #160).** The production lineage migration is applied in an isolated PostgreSQL 17 CI job. Service-role-only access, manual/pause/symbol/research-link skips, foreign research ownership rejection, owner claim propagation, and lineage metadata are covered. Local and GitHub CI passed. This added tests only; production behavior did not change. See [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md#scheduled-nightwatch-database-guard-tests--pr-160).
5. **Custom Nightwatch schedules are implemented in this working branch; production schema is already applied.** The feature supports ten schedule slots per account, per-slot Reality symbol/playbook/research lineage, local timezone wall-clock times with seconds, retry leases, execution history, and paper-only ledger commits. Existing opt-ins were preserved as 09:00 UTC schedules (three rows exist in production). PostgreSQL tests pass. Supabase hosted Cron is minute-granularity, so UI/API preserve selected seconds but dispatch may start up to about one minute afterward. See [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md#nightwatch-custom-schedules--implementation-in-progress).
6. **Next Nightwatch action: merge, deploy, then enable the dispatcher.** The custom dispatcher is intentionally not active yet. Production Vault has both required worker entries; cron readiness remains false. After Vercel shows this worker route deployed, verify `POST /api/cron/nightwatch-schedules` returns 401 without the bearer credential, then run [`ops/activate-nightwatch-schedule-cron.sql`](../ops/activate-nightwatch-schedule-cron.sql). Confirm `nightwatch_schedule_readiness()` becomes true and observe the first normal due schedule. Never invoke the global worker manually while unrelated opt-ins could be due. Keep paper-only controls and review ledger lineage, pause, revisions, limits, and retries.
7. **Research → Strategy → Nightwatch continuity remains the next end-to-end proof.** A previous Research result was held by the existing evidence gate because it lacked two distinct recent publishers and a directional scenario. Do not bypass that gate. A held run should offer no handoff. For a qualifying run, verify the originating run ID and Reality symbol stay linked into Strategy Lab and Nightwatch, then verify owner-scoped research lineage on any schedule.
8. **MCP interoperability.** Production dynamic registration, S256 PKCE authorization, `market:read` consent, MCP Inspector tool discovery and real market invocation, refresh rotation, and refresh-token replay revocation succeeded earlier. This turn also verified live Protected Resource and Authorization Server metadata and that FastMCP 2.14.5 receives HTTP 401 for an invalid bearer. No authenticated FastMCP tool invocation has been tested; do not claim support for that client yet.
9. **Developer platform UI polish remains queued after backend proof.** Design and inspect the landing page, authenticated console, API explorer, and docs with Tidelight branding, existing themes, responsiveness, accessibility, and Supabase-level developer usability. Keep this priority visible after schedule deployment and research workflow verification.
10. **Production baseline.** Health returned operational; portal and developer API host smoke checks returned 200; MCP metadata returned 200 and unauthenticated MCP access returned 401. The latest READY production build remains PR #157 (`dpl_2gsqMCQXLRDPZ5tU6JnmYvm3F5L3`). Confirm new deployment status after merge; do not bypass Vercel quotas.

Keep platform checks separate: deploy/activate custom Nightwatch dispatch, verify one normal due run, complete a gate-approved Research → Strategy → Nightwatch journey, and continue authenticated MCP client interoperability. The broader product roadmap still requires the P1 research benchmark. The premium developer-platform UI pass follows these backend proofs and must remain visible in planning.

## Verified project baseline

### What Tidelight is

Tidelight is a branded, evidence-first research desk for tokenized US equities. Existing tracks include AI Trading Desk, Alpha Factory / Strategy Lab, and Nightwatch paper decisions. Research is source bounded; market observations, source-backed claims, model inference, and user decisions must remain distinct. The user remains responsible for investment decisions. Current product policy is **paper only**: do not enable live order execution or describe the product as audited alpha or institutional-ready without its explicit independent evidence gates.

### Runtime architecture and boundaries

- One Next.js 16 TypeScript application on Vercel; Supabase Auth and PostgreSQL provide identity, application persistence, RLS, service-only functions, and scheduled dispatch.
- Tidelight Intelligence Cloud (TIC) is organized to be extractable later: `app/api/v1` is the versioned public API, `app/api/developers` is the authenticated console backend, `app/developers` is the portal, and `lib/tic` contains shared credential/platform services. Existing market and research providers are reused; do not duplicate core research logic per interface.
- The REST API uses `api.tidelight.app/v1`. The Streamable HTTP MCP server is `mcp.tidelight.app/mcp`. The branded developer portal is `tidelight.app/developers`; docs are `dev.tidelight.app`; status is `status.tidelight.app`. `docs.tidelight.app` belongs to Tidelight Research/GitBook and must not be repointed.
- Existing domains route to the current Vercel project. Production Supabase project reference is `plmdnzbmvgigkzfmfwov` (PostgreSQL 17). The handoff is not a credential store; obtain secrets only through authorized secret management.
- API keys are high entropy, shown once, stored as hashes, scoped, revocable/rotatable, quota checked, and audited. Public REST calls go through service-only authorization/quota functions. API logs retain request metadata, not request bodies or authorization headers. OAuth tokens are for MCP only; they must not become REST bearer credentials.
- Durable research is a bounded asynchronous job flow, dispatched through Vault-backed Supabase scheduling to authenticated Vercel worker routes. Webhooks enforce destination checks, HTTPS, signatures, bounded retry, and durable delivery records.
- Current usable MCP tools cover supported market/instrument search, tokenized-equity lookup, company research start, and job status/cancellation, depending on granted scopes. It reuses existing service handlers and API quotas. Prompts/resources/trading tools were deliberately not implemented.
- `sdk/typescript` and `sdk/python` are in the repository and tested but are **unpublished**. Do not publish until package ownership, release credentials, versioning, and explicit release readiness are established.

### Product and brand constraints

Preserve existing Tidelight design tokens, typography, assets, theme modes, workspace shell, and responsive behavior. The TIC portal/docs use the same brand, with a restrained developer-product hierarchy; do not transplant Supabase branding. Every interactive UI control must call a real supported capability or be clearly unavailable. Never fabricate quotes, API use, service health, costs, credits, transactions, or successful integrations. Clearly distinguish actual Bitget Reality spot rTokens from underlying equities and stock perpetuals. Market values need provider timestamps and honest freshness/unavailable states.

## Completed work and evidence

The ordered TIC milestones below are complete in code. Their full file lists, migration records, test evidence, production journeys, and cleanup details are in [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md). “Complete” does not imply every future client, commercial, recovery, or accessibility gate has passed.

| Milestone | Delivered | Evidence / boundary |
|---|---|---|
| 1. Developer foundation | Projects, test/production credentials, one-time secret display, scopes, real read-only market endpoint, API explorer, quotas, usage records, branded portal/docs | Production market/API-key lifecycle journey and revoke check completed. Production market access is enabled at the owner's instruction. Written provider redistribution terms have not been recorded; resolve licensing before expanding distribution or marketing claims. |
| 2. Research snapshots | Durable idempotent jobs, status/result/cancel API, worker, provenance-labeled snapshot, console and SDK job helpers | Production worker dispatch and complete/cancel journeys verified; cleanup counts checked. |
| 3. Organization tenancy | Personal/org workspaces, roles, shared projects/history, owner-scoped management and audit | Production owner/member/reader, isolation, key revocation and cleanup verified. Invites depend on transactional email and Auth template setup; members must currently have Tidelight accounts. |
| 4. Remote MCP | Official TS MCP SDK, Streamable HTTP, scoped tools, key authorization/quota reuse, protocol coverage | Protocol and production live market/research lifecycle tested. PRs #124–#125 fixed/deployed the service and a successful-null result edge case. MCP Inspector CLI 2.11.0 completed one production OAuth/PKCE flow with only `market:read`, discovered two permitted tools, made a real market-data request, refreshed/rotated tokens, and was rejected after grant revocation. Temporary project/key/client/grant cleanup was verified. Repeat the test before calling the client certified; other clients remain untested. |
| 5. Webhooks | Owner-scoped endpoints, encrypted one-time secrets, signatures, supported research events, SSRF protections, retries/delivery history | Production event delivery eventually succeeded on retry; unsafe destination rejected; migrations applied and access denial verified. |
| 6. API-key rotation | Atomic replacement, preserved scope/quota/expiry policy, one-time response | Production old-key 401 / replacement 200 verified; rollback and grants tested. PR #130 merged/deployed. |
| 7. Security audit log | Atomic create/rotate/revoke audit, actor attribution, active-key cap, filtered console view | Production lifecycle events and mobile/desktop console inspected; cleanup verified. PR #131 merged/deployed. |
| 8. SDK and OpenAPI coverage | TS/Python webhook APIs, validation, OpenAPI 3.1 route/model coverage tests | SDK and app suites, TypeScript/lint and contract checks passed. SDK releases remain blocked on package ownership/credentials. |
| 9. MCP OAuth | OAuth 2.1 public client flow, PKCE S256, consent, scoped/project-bound grants, refresh rotation, revocation, protected-resource metadata | Migration applied; production Inspector consent → PKCE → scoped tool discovery/call → refresh rotation → grant revocation → rejected request verified. Exact temporary client/project/key/session rows were removed and confirmed absent; the signed-in account was retained. App tests enforce OAuth-to-MCP-only. Valid OAuth use against REST was not re-tested in this client run. |
| 10. Request analytics | Exact rolling 30-day response buckets, UTC zero-filled daily chart/table, latency hover, latest 100 rows; service-only invoker RPC | PostgreSQL 17 transaction tests covered exact counts/latency, validation, grants and rollback; 139 JS tests, typecheck, lint and build passed. Migration `20261015115230_tic_usage_analytics` was applied and production host smoke tests passed. Authenticated production view inspected at 390 px and 1440 px; the account has no projects, so the honest empty state appears. Anonymous access returns 401, with no page errors or horizontal overflow. Cost/credit data is intentionally absent pending measured rates. |
| Service host routing | API, MCP, developer docs and status host routing through the current Vercel app | Production deployment ready and public routes smoke tested. `dev.tidelight.app` CNAME uses Vercel; preserve `docs.tidelight.app`. |

### Last known build and visual checks

At PR #152 merge, `npm test` passed 145 tests; typecheck, lint, production build, the PostgreSQL 17 OAuth integration test, and Public mirror validation passed. Production deployment `dpl_B3zcpgHLcNZnY73Bg8Vu2eajwqoY` is READY from `TidelightOrg/tidelight` main commit `4c93d9f9bb581dd72fe99f9a3d32cbc529b1d2e7`, source `git`, target `production`. Health reported application/database/Bitget operational. Landing `/developers`, API indexes on both app and API hosts, `dev`, status health, OAuth authorization metadata, and MCP protected-resource metadata returned 200. Anonymous `api.tidelight.app/v1/market/instruments?kind=rtoken` and `mcp.tidelight.app/mcp` returned 401. Production OAuth migration `tic_oauth_refresh_reuse_detection` is recorded; RLS is enabled, anon/authenticated cannot read refresh history, service role can, and the refresh rotation RPC is executable only by service role. The API, MCP, SDK, Python, and examples mirrors remain synchronized at their last mapped source commits; PR #152 changed no mapped public component, and private OAuth code remains excluded.

The public mirrors are populated and synchronized. Workflow run [#5](https://github.com/TidelightOrg/tidelight/actions/runs/38767685852) succeeded for API/MCP/examples at source commit `9d5d5f9daa47c199097a4bc6d366f3a883fa7ae6`; workflow run [#4](https://github.com/TidelightOrg/tidelight/actions/runs/38762725753) succeeded for TypeScript/Python at source commit `b8c56d53802846b99f20dee8db8bf3d3ed1b1bff`. These match the latest commits affecting their mapped paths. Verified target heads: API `6cc3b4c`, MCP `1772d99`, TypeScript `a1bca48`, Python `0cc090f`, and examples `45b8bb9`. Representative source files were confirmed present on each target's default branch. PR #150 did not change mapped files, so no further mirror update was required.

## Prioritized full roadmap

The list merges TIC dependencies with the broader product roadmap. Complete proof/gates before starting dependent commercial or agent work. Keep a milestone small, testable, and reversible; update this handoff and the detailed implementation record with evidence after each merge.

### P0 — Fresh-session verification and platform interoperability

1. Baseline checks pass: 145 application tests, typecheck, lint, and production build; authenticated Usage was inspected at 390 px and 1440 px.
2. Continue MCP interoperability: MCP Inspector CLI 2.11.0 has one successful production OAuth/PKCE run with `market:read`, strict tool discovery, a real market call, token refresh/rotation, and revocation rejection. Repeat the full test and then test other named clients one at a time; advertise only clients that pass repeatable end-to-end tests.
3. Continue production Research → Strategy → Nightwatch proof with a research result that clears the UI's evidence gates. A recent signed-in run correctly stopped at NO TRADE HANDOFF because publisher diversity and directional evidence were insufficient. Then verify one opted-in scheduled paper run; confirm controls, request/run IDs, and no live order execution. The test record remains in the owner's private research history; do not copy its identifier or private result into this public repository.
4. Check signed-in REST behavior with an API key separately from OAuth; verify OAuth is rejected on REST even when otherwise valid, per tests and policy.

### P1 — Research quality evidence

Run the frozen real-event human-review benchmark defined in [`RESEARCH_EVALUATION_PROTOCOL.md`](RESEARCH_EVALUATION_PROTOCOL.md) before modifying prompts. Record citation coverage, unsupported-claim rate, counter-evidence coverage, source diversity, task completion time, and reviewer outcomes. Validate issuer/SEC source attribution and publisher identity separately from quote matching. Expand source discovery only with measured quality and clear provenance.

### P2 — Commercial readiness (blocked on real inputs)

1. Measure actual provider and compute costs without inventing unit prices; define entitlement and quota policies against measurements.
2. Get owner-approved pricing and confirm a Nigerian merchant/payment provider supports the business and intended payment methods; configure a real account before enabling billing.
3. Only then connect idempotently verified billing events, actual invoices/transactions, and credit/usage views. Until then, no pricing claims, payment buttons presented as working, or fictional cost/credit values.
4. Confirm Bitget Reality market-data redistribution terms for the intended public API. Preserve the currently enabled read-only market path at the owner's explicit direction; do not silently broaden access or represent terms as verified. Document source/provenance and licensing limits.
5. Configure a verified transactional email sender and Supabase Auth templates before enabling organization email invitations.

### P3 — Security, recovery, accessibility, and reliability

Complete account recovery and stronger abuse controls; cross-theme accessibility and responsive review; SDK-to-live-API integration checks; malformed-input, wrong-scope, expiry, quota-exhaustion, provider-outage, webhook SSRF/replay, and failed-job tests. Run staging smoke tests before new production capabilities. Reconcile security-advisor findings against current code/config instead of suppressing them. Rehearse Supabase backup restoration only in an isolated environment, record restore time and recovery point, and inspect real provider/job telemetry. Keep secrets out of browser code and logs.

### P4 — Strategy credibility and supervised paper agent

Extend rolling walk-forward tests over disjoint assets/regimes; validate session-aware Reality fills, stale/missing candles, sensitivity, costs and benchmarks; archive exact data fingerprints/assumptions. Maintain opt-in, idempotent scheduled paper checks with pause, stale-feed rejection, daily loss and exposure caps, duplicate suppression, human review and append-only records. Complete a representative supervised paper observation period with zero guardrail violations. No live execution without a separately approved product/security/legal/operational review; current roadmap says live trading is disabled.

### P5 — Product operations and customer proof

Implement correlated run IDs, measured provider health/latency and actionable failure classes; complete isolated recovery rehearsal and support path; perform a blocking-defect-free accessibility/mobile/performance review. Observe a new-user walkthrough, capture a truthful guided demo and architecture/data-flow map, and publish measured outcomes and limitations. Keep Tidelight's premium identity across all screens and themes.

### P6 — Optional package releases and service extraction

Publish Python/TypeScript SDK packages only after their owners, credentials, CI/release process, compatibility policy and authorization are confirmed. Extract TIC into separate repos/services only when operational boundaries, database ownership, auth, deployment, observability, and release ownership are explicitly designed; current module boundaries are intentionally separable but remain a single deployable application.

## External dependencies and state that must not be misrepresented

- **Provider redistribution terms:** outstanding. Public Bitget-backed market route is currently enabled per owner direction; licensing review is still needed before expanding or claiming broad redistribution rights.
- **Third-party MCP client support:** none certified yet. Protocol-level implementation and OAuth production journey have passed.
- **Billing and credits:** not enabled; pricing approval, actual provider/compute rates, merchant eligibility/account, and payment configuration are missing.
- **SDK publishing:** not done; both SDKs are repository packages only.
- **Organization invitations:** accounts already registered can be added; verified sender and Auth templates are needed for email invites.
- **Backup restore rehearsal:** not performed. Never test by overwriting production.
- **Live trading:** disabled / outside TIC scopes. Nightwatch is paper-only.
- **Production visual inspection:** authenticated analytics view completed for an account with no projects; populated analytics are validated by database fixtures. Do not store OTP or ask a user to paste secrets in the repo.

## Repository map and source of truth

- `AGENTS.md` — instructions and pointer to this handoff.
- `PROJECT_PLAN.md` — product intent, architecture, guardrails, and legacy build milestones.
- `docs/TIC_IMPLEMENTATION.md` — detailed TIC audit, ordered feature work, migration/application/test and production evidence.
- `docs/NEXT_BUILD_MILESTONES.md` — original build program.
- `docs/PRODUCT_EVOLUTION_ROADMAP.md` — current product priorities and acceptance evidence.
- `docs/MILESTONE_EXECUTION.md` — product workflow and release constraints.
- `docs/OPERATIONS_RUNBOOK.md` — health, Nightwatch scheduler, incident response and recovery procedure.
- `docs/RESEARCH_EVALUATION_PROTOCOL.md` — benchmark definition.
- `docs/tic-openapi.yaml` — API contract; keep route implementation and SDKs aligned.
- `lib/tic`, `app/api/v1`, `app/api/developers`, `app/developers` — TIC service/platform boundaries.
- `sdk/typescript`, `sdk/python` — in-repo SDKs, currently unpublished.
- `supabase/migrations` — schema/function history. Never edit an applied migration; add a new forward migration and check grants/RLS and compatibility.

The implementation record and production evidence are authoritative over assumptions in older plans. When documents conflict, inspect current code, applied migration history, and actual deployment state, then correct both the handoff and the relevant record. Never imply production success solely from a local build or a plan.

## Delivery and verification rules

Work through small PRs with explicit acceptance criteria. For each backend/database change, test least privilege, tenant isolation, migrations, and rollback/recovery behavior. For each frontend milestone, inspect desktop/mobile, all supported themes, loading/empty/error/success states, accessibility and overflow. Run relevant tests, typecheck, lint, production build, contract checks, and staging/production smoke tests as appropriate. Report what was verified and what remains blocked. Preserve existing users/data and Tidelight branding. Never expose exchange, Supabase service-role, OAuth, API-key, or mail secrets in client code, screenshots, commits, or logs.
