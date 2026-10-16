# Tidelight Intelligence Cloud API

The live, versioned REST API is at `https://api.tidelight.app/v1`. The OpenAPI 3.1 contract is published at [`openapi/tidelight.yaml`](openapi/tidelight.yaml).

## Supported operations

| Operation | Scope | Purpose |
| --- | --- | --- |
| `GET /market/instruments` | `market:read` | List supported Reality tokenized-equity spot instruments; optionally filter by `underlying_ticker` before pagination |
| `POST /research/jobs` | `research:run` | Start an asynchronous, idempotent company snapshot |
| `GET /research/jobs/{job_id}` | `research:run` | Read status/result within the key's project |
| `DELETE /research/jobs/{job_id}` | `research:run` | Cancel queued work or request cancellation |
| `GET, POST /webhooks` | `alerts:manage` | List or create research event subscriptions |
| `PATCH, DELETE /webhooks/{endpoint_id}` | `alerts:manage` | Update, rotate or disable a project endpoint |
| `GET /webhooks/deliveries` | `alerts:manage` | Read delivery attempts and safe failure details |

## First request

Create a developer project and a test key with `market:read`. Put the key in a local shell environment; do not commit it, send it to an untrusted service, or put it in browser code.

```sh
export TIDELIGHT_API_KEY='tl_test_…'
curl --fail-with-body \
  -H "Authorization: Bearer $TIDELIGHT_API_KEY" \
  -H 'Accept: application/json' \
  'https://api.tidelight.app/v1/market/instruments?kind=rtoken&underlying_ticker=AAPL&limit=10'
```

Responses include a request ID and market provenance, including the provider source and timestamp. rToken spot instruments are tokenized products; they are not underlying shares or stock perpetual contracts. An unavailable provider returns a safe service error instead of fabricated values. Bitget-backed market responses fail closed with `503 provider_terms_unconfirmed` until written redistribution permission is confirmed and configured. Async research responses include a job ID; reuse the same `Idempotency-Key` when retrying a start request.

Errors use a stable code, safe message, and request ID. Respect `429` quotas and only retry safe operations or idempotent requests. All request and response schemas, status codes, limits, and OAuth-free API-key requirements are defined by the OpenAPI contract.

## Server boundary

This repository publishes the API contract, client guidance, and validation workflow. The deployed server handlers, credential authorization, tenant isolation, quotas, database functions, provider integrations, and workers are maintained in the mother repository; this contract repository cannot be deployed as the API service. The live service is served by Tidelight's existing application deployment.

Create scoped credentials in the [developer console](https://tidelight.app/developers). Read the full [developer guide](https://dev.tidelight.app/api). Run `npm ci && npm test` to validate the contract assertions and follow them with the workflow's pinned OpenAPI lint. This repository is generated from `TidelightOrg/tidelight`; propose source changes there.
