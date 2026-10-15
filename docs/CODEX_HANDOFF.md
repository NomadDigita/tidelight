# Tidelight Codex handoff

**Prepared:** 15 October 2026  
**Repository:** [`TidelightOrg/tidelight`](https://github.com/TidelightOrg/tidelight)  
**Verified baseline:** `main` at `9d5d5f9`, merged PR #147
**Purpose:** let a fresh Codex session continue from verified state without redoing completed work.

This is the short operational index for the project. The detailed implementation evidence remains in [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md); the product roadmap is [`PRODUCT_EVOLUTION_ROADMAP.md`](PRODUCT_EVOLUTION_ROADMAP.md); operating procedures are in [`OPERATIONS_RUNBOOK.md`](OPERATIONS_RUNBOOK.md). Read those source documents when working in their area. Update this handoff when milestones, production configuration, or the next action changes.

## Next session: exact continuation point

Start by checking out the current `TidelightOrg/tidelight` `main`, reading this file, `AGENTS.md`, and the detailed records linked above. Confirm the current branch and clean/dirty state before changing anything. The repository is now in the new organization; the historical source remote was `NomadDigita/tidelight`. Do not create a parallel project or reimplement milestones already listed as complete.

### First actions, in order

1. **Current baseline reverified after PR #147.** `npm test` passed 142 tests; `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:public-mirrors` passed. `git diff --check` passed. Re-run after material code changes, not just to repeat the same baseline.
2. **Analytics production inspection is complete.** The authenticated Usage page was inspected at desktop and mobile sizes; the account had no developer projects, so its honest production state was zero activity and empty chart/request states. The page had no overflow or browser errors, and the selected mobile nav item was confirmed visible. Populated buckets and latency remain covered by database fixture tests. See [`TIC_IMPLEMENTATION.md`](TIC_IMPLEMENTATION.md#milestone-10--request-usage-analytics).
3. **Continue TIC milestone 11: third-party MCP interoperability.** MCP Inspector CLI `2.11.0` completed one production OAuth test against `https://mcp.tidelight.app/mcp`: dynamic client registration, S256 PKCE, consent for `market:read`, strict discovery of two read-only tools, a real market-data call, refresh-token rotation, and server-side revocation. A post-revocation Inspector request returned `auth_required` (exit 3). The temporary client, project, key, and grant were removed and their rows verified absent. This is a successful test run, not yet repeatable certification; repeat it and test other named clients individually before advertising support. Do not store the one-time secret or test credentials.
4. **Resolve deployment source alignment before the next app-code release.** Vercel project `tidelight` still reports its latest production deployment from the historical `NomadDigita/tidelight` GitHub connection at PR #141 (`5cc3b9d`). The live custom domains respond, but PR #147 on `TidelightOrg/tidelight` is not the latest Vercel deployment. Reconnect the existing Vercel project to `TidelightOrg/tidelight` while preserving its environment, domains, build configuration, and protection settings; then verify a production deployment built from the new canonical repository. Do not claim a `TidelightOrg` deployment until Vercel reports its commit SHA and READY status.
5. **After the API/MCP verification gate and deployment source alignment, continue product roadmap P0 proof.** Verify the existing Research → Strategy Lab → Nightwatch symbol and research-run lineage in a fresh production browser session, then verify one opted-in scheduled paper run under [`OPERATIONS_RUNBOOK.md`](OPERATIONS_RUNBOOK.md). This is production evidence for already implemented behavior, not a request to rebuild it.

Keep these platform checks separate: the TIC roadmap's next engineering item is MCP client interoperability; the broader product roadmap's remaining near-term work is production proof of existing workflow continuity, followed by the P1 research benchmark.

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

At PR #147 / commit `9d5d5f9`, `npm test` passed 142 tests; typecheck, lint, production build, and all public mirror checks passed. Production routes were smoke-tested. Vercel API inspection on 15 October 2026 showed the existing `tidelight` project and all configured custom domains, with latest deployment `READY` at PR #141 / `5cc3b9d` from the historical `NomadDigita/tidelight` connection; it has not yet deployed the new canonical `TidelightOrg/tidelight` head. Live `tidelight.app`, `dev.tidelight.app`, `api.tidelight.app`, and `status.tidelight.app` returned HTTP 200 during this session. MCP OAuth discovery and protected-resource metadata returned 200, anonymous MCP transport returned 401 with the expected challenge, and the revoked Inspector credential was rejected. Authenticated Usage was inspected at 390 px and 1440 px before this session. MCP Inspector OAuth was visually checked at the production consent screen and in the authenticated MCP connections view. After cleanup, authenticated project/key/MCP-connection APIs showed empty lists; no test project, API key, OAuth client, or session remains. Production anonymous API requests return 401 as designed. Do not treat that response as an outage.

## Prioritized full roadmap

The list merges TIC dependencies with the broader product roadmap. Complete proof/gates before starting dependent commercial or agent work. Keep a milestone small, testable, and reversible; update this handoff and the detailed implementation record with evidence after each merge.

### P0 — Fresh-session verification and platform interoperability

1. Re-run baseline app checks; inspect authenticated usage analytics in production at desktop/mobile.
2. Continue MCP interoperability: MCP Inspector CLI 2.11.0 has one successful production OAuth/PKCE run with `market:read`, strict tool discovery, a real market call, token refresh/rotation, and revocation rejection. Repeat the full test and then test other named clients one at a time; advertise only clients that pass repeatable end-to-end tests.
3. Verify in production the existing Research → Strategy → Nightwatch lineage and one scheduled paper run; confirm controls, request/run IDs, and no live order execution.
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
