# Tidelight TypeScript SDK

Unpublished client for the implemented Tidelight Intelligence Cloud v1 market, asynchronous company snapshot, and research webhook endpoints. Research calls require `research:run`; webhook calls require `alerts:manage`. The package will be released after package ownership and release integration are configured.

Build locally with `npm run build` in this directory. Keep the API key on your server.

```ts
import { TidelightClient } from "@tidelight/sdk";

const client = new TidelightClient({ apiKey: process.env.TIDELIGHT_API_KEY! });
const page = await client.listTokenizedEquities({ limit: 20, underlyingTicker: "AAPL" });
for (const instrument of page.data) console.log(instrument.symbol, instrument.underlying_ticker);

for await (const instrument of client.tokenizedEquities({ limit: 50 })) {
  console.log(instrument.symbol);
}

const accepted = await client.startCompanyResearch("NVDA", crypto.randomUUID());
const result = await client.waitForResearchJob(accepted.job_id, { intervalMs: 2000, timeoutMs: 120000 });
if (result.status === "complete") console.log(result.result);

const created = await client.createWebhook({
  name: "Research events",
  url: "https://your-service.example/tidelight",
  events: ["research.job.completed", "research.job.failed"],
});
// Persist this securely; the server only returns a signing secret on create or rotation.
await saveSecret(created.signing_secret!);
const deliveries = await client.listWebhookDeliveries();
console.log(deliveries.deliveries);
```

Webhook mutations are not retried automatically because the API does not yet accept webhook idempotency keys; this avoids duplicate endpoint creation or secret rotation after an ambiguous timeout. Webhook destination reachability and DNS safety are checked by the API. A client-side HTTPS check is not an authorization to deliver to a destination.

The client retries network errors, 429, and transient 5xx statuses at most twice by default. It enforces a 10 second request timeout and returns `TidelightApiError` with status, code, and request ID.
