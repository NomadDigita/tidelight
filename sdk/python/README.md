# Tidelight Python SDK

Unpublished client for the implemented Tidelight Intelligence Cloud v1 market, asynchronous company snapshot, and research webhook endpoints. Market calls require `market:read`; research calls require `research:run`; webhook calls require `alerts:manage`. Market responses can be denied with `provider_terms_unconfirmed` until redistribution terms are confirmed. The client surfaces that gate without retrying it. The package will be released after package ownership and release integration are configured.

Install locally with `pip install ./sdk/python`. Keep the API key on your server.

```python
import os
from tidelight import Client

client = Client(os.environ["TIDELIGHT_API_KEY"])
page = client.list_tokenized_equities(limit=20, underlying_ticker="AAPL")
for instrument in page.data:
    print(instrument.symbol, instrument.underlying_ticker)

for instrument in client.tokenized_equities(limit=50):
    print(instrument.symbol)

import uuid
accepted = client.start_company_research("NVDA", str(uuid.uuid4()))
result = client.wait_for_research_job(accepted["job_id"], interval=2, timeout=120)
if result.status == "complete":
    print(result.result)

created = client.create_webhook(
    name="Research events",
    url="https://your-service.example/tidelight",
    events=["research.job.completed", "research.job.failed"],
)
signing_secret = created.get("signing_secret")
if not signing_secret:
    raise RuntimeError("The create response did not include its one-time signing secret")
# TODO: Persist signing_secret with your approved secrets manager before
# finishing setup. Do not print it. It cannot be recovered by listing the endpoint.
deliveries = client.list_webhook_deliveries()
```

Webhook mutations are not retried automatically because the API does not yet accept webhook idempotency keys; this avoids duplicate endpoint creation or secret rotation after an ambiguous timeout. Webhook destination reachability and DNS safety are checked by the API. A client-side HTTPS check is not an authorization to deliver to a destination.

The client retries network errors, 429, and transient 5xx statuses at most twice by default, except `provider_terms_unconfirmed`, which is returned immediately. It enforces a 10 second request timeout and raises `ApiError` with status, code, and request ID. The default transport does not follow redirects, and remote API URLs are restricted to `api.tidelight.app` so bearer credentials remain scoped to Tidelight.

## Run the asynchronous research example

From a mother-repository checkout:

```sh
python -m pip install ./sdk/python
PYTHONPATH=sdk/python/src python sdk/python/examples/research.py NVDA
```

The example calls the SDK company snapshot job flow and prints a result only after the API reports `complete`. It preserves job and request IDs and never prints the key. CI injects a mock transport and makes no network calls. A live run requires `research:run` and consumes project quota (10 jobs per rolling hour). This package is not available from PyPI; run from the repository source.
