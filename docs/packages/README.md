# Tidelight official package ecosystem

This document is the source-of-truth plan for developer packages. Package source belongs in the Tidelight mother repository (`TidelightOrg/tidelight`) and public mirrors are derived artifacts. Package names shown in the Developer Center do not imply registry publication.

## Current architecture and verified state (2026-10-16)

| Target | Canonical source | Intended public name | Current state | Registry |
|---|---|---|---|---|
| TypeScript / JavaScript SDK | `sdk/typescript` | `@tidelight/sdk` | Implemented source, tests and build; private manifest `0.1.0` | npm lookup returned 404; unpublished |
| Python SDK | `sdk/python` | `tidelight` | Implemented source and tests; project metadata currently says `tidelight-sdk` `0.1.0` | PyPI lookups for `tidelight` and `tidelight-sdk` found no distribution; unpublished. Align metadata only after name and mirror ownership are verified |
| MCP integration | `public/components/mcp/server` | `@tidelight/mcp` | MCP protocol core plus local stdio-to-remote bridge, tests, package metadata, and dry-run tarball; manifest stays private | npm lookup returned 404; unpublished |
| API contract | `public/components/api` and `docs/tic-openapi.yaml` | no npm package promised yet | Private contract validation package and OpenAPI document | No public package |
| React integration | `packages/react` | `@tidelight/react` | Typed client-context hooks and accessible tokenized-instrument component; private manifest `0.1.0` | npm lookup returned 404; unpublished |
| CLI | `packages/cli` | `@tidelight/cli` | Implemented source, SDK-backed commands, tests and private manifest `0.1.0`; not a public install | npm lookup returned 404; unpublished |

The Developer Center package index is `/developers/packages`; first-party detail pages are `/developers/packages/sdk`, `/developers/packages/mcp`, `/developers/packages/react`, `/developers/packages/cli`, and `/developers/packages/python`. The Python page documents the source metadata name mismatch, exact scopes, redirect protection, and unresolved provider terms gate. No npm or PyPI package is currently installable. Do not show npm or pip install commands as working instructions until verified registry releases exist.

Each package detail page includes an interactive, client-only walkthrough of a supported request lifecycle. These walkthroughs are illustrative, send no network requests, omit secret and result values, and show bounded research job states without promising a successful result. The React flow explicitly requires an application-owned authenticated backend; the package does not provide that backend. Market-data success is not used as a demo while redistribution terms remain unconfirmed.

## Package boundaries

- Shared HTTP/auth/error behavior should be built from the versioned API contract, without importing application routes, Supabase service-role code, provider secrets, or private server modules into packages.
- The SDK owns typed API transport, pagination, request IDs, bounded retries/timeouts, and job polling. Domain research remains on Tidelight services.
- MCP adapts supported service calls to the MCP protocol; it must not fork service logic or bypass API scopes.
- Python mirrors the stable supported REST surface. React may contain browser-safe UI/hooks only and must never accept privileged keys. CLI should call the same API contract and store credentials with OS-backed secure storage when available.
- Container images are appropriate for the deployable MCP server, not for client SDKs. Publish to GHCR only after image hardening, SBOM, signing, and operator documentation are ready.

## Compatibility and version policy

Use SemVer after first public release. While packages are pre-release, keep them unpublished and version manifests aligned to the API contract compatibility they actually test. API v1 additions should be backward-compatible; breaking API changes use a new API version. Document a support matrix (Node.js, Python, React peer versions, MCP protocol, and API versions) before first publication. Deprecation requires a dated notice, migration path, and minimum 90-day public window unless a security issue requires faster action.

## CI and release policy

Each package must pass lint/typecheck, unit and integration tests against the API/MCP contract, packaging validation, secret scanning, dependency review, and a clean install test. `scripts/check-npm-package-archive.mjs` creates a temporary npm tarball, compares actual tarball members with npm's pack manifest and the package's explicit `files` allowlist, checks declared entry points, rejects credential files and scans archived text for high-confidence secret patterns. This validates the unpublished archive without uploading it. The Python distribution is built from a temporary source copy as an isolated wheel in CI, so validation does not leave build files in the checkout. CI tests Python 3.10 and 3.12. The wheel check validates metadata against pyproject.toml, checks archive paths for unexpected or credential-like files, and imports the wheel in an isolated target directory. React consumes a server-provided client interface and must never put project keys in a browser bundle. The mother repository remains canonical; mirror sync is path-scoped and must not copy secrets or server-only internals. Release workflows are manual, validate canonical version and mirror SHA, and use OIDC trusted publishing/provenance where registry support and organization configuration permit. Public publication remains blocked until explicit owner approval, verified namespace ownership, registry credentials/OIDC configuration, package contents review, and a successful dry run.

`.github/workflows/release-sdk.yml` creates manual GitHub source releases in the TypeScript, Python, and MCP mirrors; it does not publish to npm or PyPI. Before tagging, it compares every tracked file in the selected canonical mapping with the mirror byte-for-byte, rejects missing, extra, or changed paths, validates npm tarballs and Python wheels in both workspaces, and targets the exact mirror commit that passed parity. Package install, test, and archive checks run before a write token is created; the token is available only in the final GitHub release step. Release notes record both the mother-repository commit and tested mirror commit. Do not describe this as a registry release pipeline.

## First-release gates

1. Confirm `TidelightOrg/tidelight` owns each registry namespace and publish access is correctly configured.
2. Decide whether the Python distribution should be named `tidelight` or retain `tidelight-sdk`; no silent rename.
3. Extend MCP interoperability tests to named external clients before certifying them; the local stdio proxy currently has official SDK protocol coverage only.
4. Before CLI release, replace the local SDK file dependency with the approved published SDK version, verify npm OIDC/provenance, and run a clean external install test. The CLI source is implemented, but remains private and unavailable from npm.
5. Add package-specific changelogs, security policy links, licenses, release compatibility matrices, SBOM and provenance checks.
6. Review redistribution and provider licensing limits against each example and package capability.
7. Obtain explicit approval before the first public registry publication.

## Verification performed for this milestone

Read-only registry checks on 2026-10-16: `npm view` returned 404 for `@tidelight/sdk`, `@tidelight/mcp`, `@tidelight/react`, and `@tidelight/cli`; `python -m pip index versions` found no distribution for `tidelight` or `tidelight-sdk`. These establish that the checked names are not presently installable, not that all other names are available. The UI uses source state rather than fabricated release dates or versions. MCP source verification: `npm test` passed 7 protocol/proxy/package-gate tests; its tarball contains only README, changelog, executable CLI wrapper, compiled code, and manifest, and local install plus missing-key CLI check passed. React source verification: 6 test cases passed in the latest pre-merge run; package tarball contains only README, changelog, compiled entry point, styles, and manifest; local install and server-rendered empty-state/CSS export checks passed; `npm audit --omit=dev` reported 0 vulnerabilities. CLI source verification: 9 tests passed, including credential-status wording and recovery of a queued research job when JSON polling times out, its dry-run tarball contains only README, changelog, compiled JavaScript/declarations and manifest, and its production dependency audit reported 0 vulnerabilities. The CLI delegates API transport to `@tidelight/sdk`; its local `file:` dependency intentionally limits this private source preview to the mother repository. The SDK now has a lockfile and builds on pack. SDK, React and CLI manifests remain private; MCP client certification remains limited to official SDK protocol tests.


Python SDK artifact gate (2026-10-16): `python scripts/check-python-package.py sdk/python` built `tidelight_sdk-0.1.0-py3-none-any.whl`, matched its metadata against the project, checked archive paths and isolated imports, and did not publish the artifact. Public mirror validation, sync, and manual source-release workflows run this check for canonical source and the Python mirror. Pull request validation also runs the Python suite and wheel check on Python 3.10 and 3.12.

Python SDK follow-up (2026-10-16): `PYTHONPATH=sdk/python/src python -m unittest discover -s sdk/python/tests -v` passed 11 tests, including a local HTTP redirect check that confirms the default transport stops at the first 302, API-host allowlisting, and a single-attempt `provider_terms_unconfirmed` response. This is source verification only; the Python package remains unpublished.
