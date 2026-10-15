# Tidelight Python SDK

Unpublished client for the implemented Tidelight Intelligence Cloud v1 market endpoint. The package will be released after API activation, package ownership, and integration testing.

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
```

The client retries network errors, 429, and transient 5xx statuses at most twice by default. It enforces a 10 second request timeout and raises `ApiError` with status, code, and request ID.
