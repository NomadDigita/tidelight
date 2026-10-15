# Tidelight Python SDK

Unpublished client for the implemented Tidelight Intelligence Cloud v1 market and asynchronous company snapshot endpoints. Research calls require a key with `research:run` scope. The package will be released after package ownership and release integration are configured.

Install locally with `pip install ./sdk/python`. Keep the API key on your server.

```python
import os
from tidelight import Client

client = Client(os.environ["TIDELIGHT_API_KEY"])
page = client.list_tokenized_equities(limit=20)
for instrument in page.data:
    print(instrument.symbol, instrument.underlying_ticker)

for instrument in client.tokenized_equities(limit=50):
    print(instrument.symbol)

import uuid
accepted = client.start_company_research("NVDA", str(uuid.uuid4()))
result = client.wait_for_research_job(accepted["job_id"], interval=2, timeout=120)
if result.status == "complete":
    print(result.result)
```

The client retries network errors, 429, and transient 5xx statuses at most twice by default. It enforces a 10 second request timeout and raises `ApiError` with status, code, and request ID.
