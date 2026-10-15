# Tidelight TypeScript SDK

Unpublished client for the implemented Tidelight Intelligence Cloud v1 market endpoint. The package will be released after API activation, package ownership, and integration testing.

Build locally with `npm run build` in this directory. Keep the API key on your server.

```ts
import { TidelightClient } from "@tidelight/sdk";

const client = new TidelightClient({ apiKey: process.env.TIDELIGHT_API_KEY! });
const page = await client.listTokenizedEquities({ limit: 20 });
for (const instrument of page.data) console.log(instrument.symbol, instrument.underlying_ticker);

for await (const instrument of client.tokenizedEquities({ limit: 50 })) {
  console.log(instrument.symbol);
}
```

The client retries network errors, 429, and transient 5xx statuses at most twice by default. It enforces a 10 second request timeout and returns `TidelightApiError` with status, code, and request ID.
