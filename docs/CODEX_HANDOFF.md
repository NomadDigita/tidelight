# Tidelight Codex handoff

**Prepared:** 16 October 2026
**Repository:** [`TidelightOrg/tidelight`](https://github.com/TidelightOrg/tidelight)
**Latest verified application baseline:** PR #176 main commit `c81dce5c5ed4fabbec846894f22486fb1b18818d`; production deployment `dpl_98SkhXN3NHu46kh6FqaDok1e24Ko` is READY and aliases all five TIC hosts. PR #176 fixes developer-platform accessibility findings. Verification record: [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md#follow-up-verification-after-pr-176--16-october-2026).
**Purpose:** let a fresh Codex session continue from verified state without redoing completed work.

This is the short operational index for the project. The detailed implementation evidence remains in [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md); the product roadmap is [`PRODUCT_EVOLUTION_ROADMAP.md`](PRODUCT_EVOLUTION_ROADMAP.md); operating procedures are in [`OPERATIONS_RUNBOOK.md`](OPERATIONS_RUNBOOK.md). Read those source documents when working in their area. Update this handoff when milestones, production configuration, or the next action changes.

## Next session: exact continuation point

Start by checking out the current `TidelightOrg/tidelight` `main`, reading this file, `AGENTS.md`, and the detailed records linked above. Confirm the current branch and clean/dirty state before changing anything. The repository is now in the new organization; the historical source remote was `NomadDigita/tidelight`. Do not create a parallel project or reimplement milestones already listed as complete.

### Current verified state and next actions

1. **PR #165 is merged and live.** The shared market service now applies `underlying_ticker` filtering before cursor pagination. The versioned API, OpenAPI contract, explorer, TypeScript/Python SDKs, and both MCP market tools expose the filter. GitHub application and public-mirror workflows passed; local checks passed with 156 app tests, 7 TypeScript SDK tests, 9 Python SDK tests, lint, typecheck, and production build. Production deployment `dpl_4QhFXLqJ3nfLaVapuUgrwKtBmPSy` is READY from main commit `8b8e01c2fc176b8c362acfc351502478f5d28d06`.
2. **Authenticated production MCP filtering is verified.** Using a one-day `market:read` test credential, Streamable HTTP initialize, notification, and tool discovery succeeded. The market-only credential exposed exactly the two market tools; ticker searches for NVDA and AAPL each returned a matching Reality spot instrument with Bitget Reality source provenance. The developer console recorded the successful market requests and the security log recorded key creation/revocation. The credential is revoked and its next MCP request returned 401 with `WWW-Authenticate`. The user-owned verification project remains; no test key is active. Details: [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md#market-ticker-filter-before-pagination--pr-165-production-verified).
3. **Research → Strategy → Nightwatch remains evidence-gated and incomplete as a positive handoff.** Two signed-in production assessments, including a fresh AAPL assessment, stopped because publisher diversity and directional evidence did not clear the existing gate. The UI showed `NO TRADE HANDOFF` with no Strategy/Nightwatch action links. No downstream strategy or Nightwatch action, schedule, or position was created or changed. Do not bypass the gate; continue only when a real run qualifies. See [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md#production-research-gate-and-mcp-regression-retest--16-october-2026).
4. **Nightwatch schedule observation remains next.** Custom owner schedules and the every-minute scheduler were previously verified, but a normal due execution and its paper-ledger reconciliation are not confirmed in this pass. First read the current account-scoped schedule state and its next due time, then inspect only that owner's correlated run after the ordinary scheduled window. Do not invoke the global worker to force a test. Verify research lineage, pause/revision behavior, quota, and unchanged paper balances/positions.
5. **Continue authenticated MCP interoperability with other named clients one at a time.** MCP Inspector OAuth/PKCE and the API-key Streamable HTTP flow are verified. FastMCP previously received 401 for an invalid bearer; authenticated FastMCP invocation and other third-party clients are not certified. Do not advertise clients that have not completed a repeatable authenticated test.
6. **Developer-console state visual pass (PRs #171 and #172 merged, production READY).** Shared branded loading, empty, and error states now cover workspace loading failures, projects, credentials, research, MCP, usage, security history, and webhooks. Failed webhook mutations preserve already loaded endpoint and delivery data. `npm test` passed 156 tests; typecheck, lint, build, and diff checks passed. Desktop and 390 px local fixtures were visually inspected in all three themes with no mobile overflow. Production deployment `dpl_2ZQDA6shCpNshkzduoVva8aueXUA` is READY. Production was smoke checked signed out; private authenticated empty/error data states have not been re-opened in a production session.
7. **Dedicated Intelligence Cloud URL mapping verified 16 October 2026.** The five requested destinations and exact paths are recorded in [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md#canonical-intelligence-cloud-pages-and-service-hosts-verified-16-october-2026). Vercel confirms their production domains are attached and verified. Live checks confirmed portal/console HTTP 200, API index 200 with unauthenticated data correctly returning 401, MCP protected-resource metadata 200 with unauthenticated MCP correctly returning 401, developer docs 200, and status/health 200. Unrelated API and console paths return 404 on their dedicated service hosts. `docs.tidelight.app` remains Tidelight Research's GitBook domain.
8. **PR #174 and full verification pass (16 October 2026).** PR #174 merged and its exact main commit is deployed READY to `tidelight.app`, `api.tidelight.app`, `mcp.tidelight.app`, `dev.tidelight.app`, and `status.tidelight.app`. Local application tests (156), TS SDK (7), Python SDK (9), mirror/API/MCP/examples suite, typecheck, lint, and production build passed. Live host smoke checks confirmed docs assets are 200, anonymous protected routes return 401, disallowed docs paths are 404, and status health is 200. The docs illustration and status overlay were visually checked at desktop/mobile; details and unresolved DB/auth/account-specific gates are in the implementation record.
9. **Production accessibility, auth affordance, and recovery checks (PR #176).** PR #176 fixes the contrast, accessible-name, and keyboard-scroll findings. Production axe WCAG 2.1 A/AA and best-practice checks now pass with zero violations on portal/docs/signed-out console/status at 1440 px and 390 px; all three developer themes were checked on production at 390 px. Portal/docs/status screenshots were visually inspected. The login page exposes Google OAuth and password recovery; Google correctly redirects to Google sign-in, but this runtime has no signed-in Google account, so no account was selected and no Tidelight user was created. Recovery form and route render, but no reset email/session was available to complete the password-change step.
10. **Recovery drill and other verification limits.** An isolated local synthetic PostgreSQL dump/restore test passed, with the temporary database and dump removed. This does not verify a production Supabase backup; no safe backup export/restore control is available here and production restore would overwrite live data. Python MCP SDK received the expected 401 without credentials; authenticated third-party client calls still require an active Tidelight session/key. As of 07:25 UTC, the scheduled Nightwatch poller succeeded 373/373 times over 24 hours, with three enabled schedules, none due and zero execution rows; next due was 09:00 UTC. Wait for a natural execution and reconcile it read-only. See the detailed follow-up for current provider terms and Supabase advisor/migration findings.

Historical milestones (OAuth replay protection, mobile navigation, analytics, Nightwatch database guards, and configurable schedules) are recorded below and in [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md). The broader product roadmap still includes the P1 research benchmark, provider-cost measurement, licensing review, recovery, accessibility, and reliability work.

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
| 10. Request analytics | Exact rolling 30-day response buckets, UTC zero-filled daily chart/table, latency hover, latest 100 rows; service-only invoker RPC | PostgreSQL 17 transaction tests covered exact counts/latency, validation, grants and rollback; 139 JS tests, typecheck, lint and build passed. Migration `20261015115230_tic_usage_analytics` was applied and production host smoke tests passed. At that earlier inspection, the account had no projects and correctly showed an empty state. Anonymous access returns 401, with no page errors or horizontal overflow. Cost/credit data is intentionally absent pending measured rates. Current production account state is recorded below. |
| Service host routing | API, MCP, developer docs and status host routing through the current Vercel app | Production deployment ready and public routes smoke tested. `dev.tidelight.app` CNAME uses Vercel; preserve `docs.tidelight.app`. |

### Historical build and visual checks (PR #152)

At PR #152 merge, `npm test` passed 145 tests; typecheck, lint, production build, the PostgreSQL 17 OAuth integration test, and Public mirror validation passed. Production deployment `dpl_B3zcpgHLcNZnY73Bg8Vu2eajwqoY` is READY from `TidelightOrg/tidelight` main commit `4c93d9f9bb581dd72fe99f9a3d32cbc529b1d2e7`, source `git`, target `production`. Health reported application/database/Bitget operational. Landing `/developers`, API indexes on both app and API hosts, `dev`, status health, OAuth authorization metadata, and MCP protected-resource metadata returned 200. Anonymous `api.tidelight.app/v1/market/instruments?kind=rtoken` and `mcp.tidelight.app/mcp` returned 401. Production OAuth migration `tic_oauth_refresh_reuse_detection` is recorded; RLS is enabled, anon/authenticated cannot read refresh history, service role can, and the refresh rotation RPC is executable only by service role. The API, MCP, SDK, Python, and examples mirrors remain synchronized at their last mapped source commits; PR #152 changed no mapped public component, and private OAuth code remains excluded.

The public mirrors are populated and synchronized. Workflow run [#5](https://github.com/TidelightOrg/tidelight/actions/runs/38767685852) succeeded for API/MCP/examples at source commit `9d5d5f9daa47c199097a4bc6d366f3a883fa7ae6`; workflow run [#4](https://github.com/TidelightOrg/tidelight/actions/runs/38762725753) succeeded for TypeScript/Python at source commit `b8c56d53802846b99f20dee8db8bf3d3ed1b1bff`. These match the latest commits affecting their mapped paths. Verified target heads: API `6cc3b4c`, MCP `1772d99`, TypeScript `a1bca48`, Python `0cc090f`, and examples `45b8bb9`. Representative source files were confirmed present on each target's default branch. PR #150 did not change mapped files, so no further mirror update was required.

## Prioritized full roadmap

The list merges TIC dependencies with the broader product roadmap. Complete proof/gates before starting dependent commercial or agent work. Keep a milestone small, testable, and reversible; update this handoff and the detailed implementation record with evidence after each merge.

### P0 — Fresh-session verification and platform interoperability

1. The latest application baseline is PR #165: 156 app tests, 7 TypeScript SDK tests, 9 Python SDK tests, lint, typecheck, production build, and both GitHub workflows passed. Production is READY from main commit `8b8e01c`.
2. MCP is verified at two layers: prior MCP Inspector OAuth/PKCE and this pass's authenticated API-key Streamable HTTP request. The market-only key discovered two tools, returned real ticker-filtered NVDA/AAPL instruments, appeared in Usage and Security logs, and was revoked. Other named client integrations remain uncertified.
3. Research evidence gates were exercised with two live signed-in assessments. Both correctly stopped at `NO TRADE HANDOFF` because source diversity and directional evidence were insufficient. Continue the full Research → Strategy → Nightwatch proof only when an actual run qualifies; then verify run/symbol lineage and a normal owner-scoped paper schedule. Do not record private run IDs or report contents here.
4. Observe the next normal Nightwatch due execution and reconcile only the owner's run lineage, pause/revision behavior, quota, and paper balances/positions. Read the current schedule first; do not call the global worker to force a test.
5. Continue the REST/OAuth permission-boundary checks already covered by integration tests, then complete the premium developer-platform UI pass and remaining P1–P6 roadmap work.

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
- **Production visual inspection:** prior analytics empty-state review occurred before the verification project was created. Current signed-in account state is one verification project, zero active test keys, and three successful market-request rows; no billing costs are available. Do not store OTP or ask a user to paste secrets in the repo.

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
