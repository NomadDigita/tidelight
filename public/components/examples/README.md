# Tidelight API examples

These examples use the official Tidelight SDKs and real API responses. They require a developer project and an API key scoped for the requested operation. Store keys in environment variables; never paste them into source files or commit them.

## TypeScript

```ts
import { TidelightClient } from "@tidelight/sdk";

const client = new TidelightClient({ apiKey: process.env.TIDELIGHT_API_KEY! });
const page = await client.listTokenizedEquities({ limit: 10 });
console.log(page.data, page.request_id);
```

## Python

```python
import os
from tidelight import Client

client = Client(api_key=os.environ["TIDELIGHT_API_KEY"])
page = client.list_tokenized_equities(limit=10)
print(page.data, page.request_id)
```

Install the SDK from its repository while package publishing is being prepared. Read the [quickstart](https://dev.tidelight.app/api) for authentication, scopes, errors, and current endpoint support.

This repository is generated from `TidelightOrg/tidelight`; submit changes there.
