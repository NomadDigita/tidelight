# Tidelight API examples

Runnable examples for the live Tidelight Intelligence Cloud REST API. They use actual responses; the repository includes no API keys or fabricated market data.

| File | Scope | What it demonstrates |
| --- | --- | --- |
| [`rest/market.mjs`](rest/market.mjs) | `market:read` | Native Node `fetch` and provenance-aware response handling |
| [`rest/market.py`](rest/market.py) | `market:read` | Python standard library request handling |
| [`rest/research.mjs`](rest/research.mjs) | `research:run` | Idempotent async job start and bounded polling |
| [`rest/research.py`](rest/research.py) | `research:run` | Python job start, polling, and terminal-state handling |
| [`rest/market.sh`](rest/market.sh) | `market:read` | Minimal `curl` request |

Set credentials in the shell. Do not place them in source files, web pages, command-line arguments, shared logs, or committed `.env` files.

```sh
export TIDELIGHT_API_KEY='tl_test_…'
node rest/market.mjs
python rest/market.py
./rest/market.sh
```

Research examples can start provider-backed jobs and consume quota. Use a test project/key when evaluating them. The scripts print API status and request IDs. They distinguish a `tokenized_equity_spot` from a direct equity or perpetual and display only fields returned by the service.

Market data is returned only when the API's provider terms gate allows it. Until redistribution authorization is configured, the expected response is HTTP 503 with `provider_terms_unconfirmed`; the examples surface that real error and do not substitute cached or invented values. The Python REST examples reject redirects so a bearer key cannot be forwarded to another host.

## SDK availability

The TypeScript and Python SDK source repositories are available, but packages are not published to registries. These examples intentionally use direct REST calls so the quickstart works today without pretending an install command exists. SDK publication remains gated on package ownership, release credentials, and release authorization.

## Test the examples locally

```sh
npm ci
npm test
npm run test:python
```

The tests use mocked HTTP responses and verify request authentication, bounded polling, error handling, redirect rejection before credentials can be forwarded, and that secrets are not printed. They do not call production or represent mock responses as market data.

The API contract and service boundary are documented in [`TidelightOrg/tidelight-api`](https://github.com/TidelightOrg/tidelight-api); the remote MCP connection and protocol core are in [`TidelightOrg/tidelight-mcp`](https://github.com/TidelightOrg/tidelight-mcp). Submit source changes to the mother repository, `TidelightOrg/tidelight`.
