# Mother repository and public distributions

`TidelightOrg/tidelight` is the canonical source of truth for the Tidelight platform. The application, research engines, private service boundaries, database migrations, and Vercel/Supabase configuration remain together here. Public GitHub repositories are generated distributions for developer-facing contracts and SDKs; they are not independent source repositories.

## Component map

| Public repository | Canonical source | Published contents |
| --- | --- | --- |
| `tidelight-api` | `public/components/api`, `docs/tic-openapi.yaml` | Public API guide, first-call example, and OpenAPI contract |
| `tidelight-mcp` | `public/components/mcp` | Public connection guide and host-agnostic MCP protocol core, schemas, and tests |
| `tidelight-sdk` | `sdk/typescript` | TypeScript SDK source, tests, and package metadata |
| `tidelight-python` | `sdk/python` | Python SDK source, tests, and package metadata |
| `tidelight-examples` | `public/components/examples` | Runnable credential-safe REST quickstarts in Node.js, Python, and curl |

The allowlist in `.github/tidelight-mirrors.json` is the only source-to-target mapping. The MCP host in `app/api/mcp`, shared authorization and tenant services in `lib/tic`, API route handlers, Supabase migrations, and deployment configuration are intentionally excluded. The public MCP tool/schema component is maintained at `public/components/mcp/server` and imported by the production host so its protocol behavior cannot drift. The host must enforce identity, project scope, quota, and provider policy before calling it. No secrets or environment configuration are mirrored. The mirror checker rejects secret-like paths and known private-key/service-role markers before synchronization.

Each target repository is a generated snapshot: its root is owned by the mapped canonical paths. Make changes in this repository and let the sync workflow open a target PR. Do not develop independent code in a mirror. If a target change is needed, propose it here and then let automation publish it.

## Synchronization and trust boundaries

`.github/workflows/sync-public-mirrors.yml` runs after relevant changes reach `main`, or by manual dispatch. It computes changed components from the push range, validates the allowlist, runs the SDK test suites, then opens one synchronization PR per changed non-empty mirror. It serializes sync runs to avoid competing branches. The copier materializes only Git-tracked source files, so ignored build and interpreter cache artifacts created by validation are not published. PRs in the mother repository run the mirror validation workflow, SDK tests, and the existing application checks configured for the repository.

The five targets are initialized. Changes to mapped paths create synchronization branches and PRs; the workflow does not directly push over an initialized target default branch. The first-run empty-repository bootstrap path remains restricted to genuinely empty targets for future repositories. If a target has already been initialized, the script does not silently fall back to a direct push when a clone or permission check fails.

The workflow requires an organization-owned GitHub App installed on the mother and five target repositories. Configure these mother-repository Actions secrets:

- `TIDELIGHT_SYNC_APP_ID`
- `TIDELIGHT_SYNC_APP_PRIVATE_KEY`

Grant that App only `Contents: read/write` and `Pull requests: read/write` for these six repositories. The workflow exchanges the private key for a short-lived installation token scoped to the five mirrors; the token is not persisted by checkout or printed by the workflow. Do not use a personal access token or expose this key to fork-originated pull requests. The App must be configured to allow its commits to trigger downstream workflows where target CI is required.

Until the App and secrets are configured, path validation and SDK tests can still pass, but cross-repository synchronization cannot run. A failed sync must remain visible and be retried after configuration; it must never be reported as a successful mirror update.

## Versioning and releases

TypeScript and Python versions are owned by `sdk/typescript/package.json` and `sdk/python/pyproject.toml`. Keep them aligned for compatible SDK releases. The manual `GitHub SDK release` workflow accepts only the exact version already present in the canonical SDK metadata, reruns the appropriate tests, and creates a GitHub source release/tag in the synchronized SDK mirror. Run it only after that mirror contains the versioned source.

This workflow does not publish to npm or PyPI. Both package registries remain disabled until package ownership, credentials, package metadata/license, and release authorization are resolved. API and MCP contract changes are versioned by the OpenAPI/API compatibility policy and the deployed `/v1` route; do not make a breaking `/v1` change without a migration plan.

## Validation and operational procedure

Run locally before merging changes to a published component:

```sh
node scripts/check-public-mirrors.mjs
npm test --prefix sdk/typescript
PYTHONPATH=sdk/python/src python -m unittest discover -s sdk/python/tests -v
npm ci --prefix public/components/mcp/server && npm test --prefix public/components/mcp/server
npm test --prefix public/components/examples && npm run test:python --prefix public/components/examples
```

For a mapping-only or security-boundary change, also run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. Inspect the generated target diff in every sync PR, verify it contains only the intended public distribution, and merge through the target repository's required checks. Never put private provider credentials, service-role keys, API secrets, internal worker URLs, server implementation files, or user data in a public mirror.

The live API and MCP service remain deployed from the mother repository's existing Vercel project. These GitHub source mirrors do not alter Vercel roots, Supabase integration, production routing, or service authorization.
