# `@tidelight/cli`

The official Tidelight command-line client for supported API v1 workflows. This is a private source package at `0.1.0`; it is **not published to npm**, and `npm install -g @tidelight/cli` is not available.

## Local source setup

The source CLI calls the canonical TypeScript SDK and does not reimplement its HTTP transport. Build the SDK first so its package exports are available, then build the CLI. CI also tests a temporary release-candidate manifest pinned to the exact SDK version by installing both packed archives in a clean consumer project. That local rehearsal does not make this private package installable from npm:

```sh
cd sdk/typescript && npm ci && npm test
cd ../../packages/cli
npm ci
npm test
node dist/bin.js --help
```

Node.js 22 or newer is required. Use a Tidelight project API key with only the scopes needed by the command. API keys are created and revoked in the Developer Center.

## Authentication

`tidelight auth login` reads the key without echoing it and stores it in the operating-system credential store (macOS Keychain, Windows Credential Manager, or Linux Secret Service). Linux requires an unlocked Secret Service provider such as GNOME Keyring or KWallet. If the credential store is unavailable, set `TIDELIGHT_API_KEY` for the current process or shell instead; the CLI never writes a plaintext credential file. Environment credentials take precedence over the keychain. `auth status` shows only the source, never the credential; `auth logout` deletes the keychain value but does not modify the shell environment.

## Supported commands

```sh
tidelight market instruments --ticker NVDA --limit 20
tidelight market instruments --json

tidelight research start NVDA
tidelight research start NVDA --wait --timeout-ms 120000
tidelight research get 00000000-0000-4000-8000-000000000000 --json
tidelight research cancel 00000000-0000-4000-8000-000000000000

tidelight webhooks list
tidelight webhooks create --name "Research alerts" --url https://example.com/tidelight --events research.job.completed
tidelight webhooks update 00000000-0000-4000-8000-000000000000 --rotate-secret
tidelight webhooks disable 00000000-0000-4000-8000-000000000000
tidelight webhooks deliveries --json
```

These commands map to the existing SDK and OpenAPI contract only: supported Reality tokenized-equity spot instruments, asynchronous company research jobs, and research-job webhooks. The CLI does not create a full research report, strategy, scenario, live order, or account/project/key. Service-side scopes, tenant ownership, quotas, and provider terms remain authoritative.

Research calls generate a UUID idempotency key by default. Use `--idempotency-key` when a caller needs a stable key across a retry. `--wait` polls until a terminal state or bounded timeout; Ctrl-C stops local polling, while `research cancel` explicitly requests server cancellation.

Market results carry server-returned provenance and tokenized-instrument type. A `provider_terms_unconfirmed` error means the service cannot currently return this feed; the CLI surfaces that service decision and does not substitute another provider. It does not imply direct stock shares or perpetual-contract prices.

Webhook signing secrets are shown only in the successful create/rotation response. The CLI emits a warning on stderr and never saves or retries mutations; copy the secret to a secret manager immediately. Do not pipe secret-bearing output into logs.

## Errors and compatibility

HTTP status, stable API error code, and request ID are shown when the API provides them. Credential values and raw provider bodies are never included in CLI error output. Transient retry behavior comes from the shared SDK. Node.js 22+, `@tidelight/sdk` API contract 0.1.x, and the Tidelight versioned API v1 are the source-preview compatibility targets.

## Release state and security

The CLI is not installable from npm. The package remains `private` until the official SDK is published, package ownership and license are confirmed, trusted publishing/provenance is configured, security policy and disclosure contact are present, package contents are reviewed, and first-publication approval is recorded. See the parent repository’s [package ecosystem plan](../../docs/packages/README.md) and [changelog](./CHANGELOG.md).


The clean consumer test is `npm run test:package-consumers` from the mother repository. It packs a temporary CLI copy with an exact SDK semver dependency, checks installed `--help`, then confirms an unauthenticated research command exits before making a network request. It does not publish either archive.
