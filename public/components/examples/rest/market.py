"""List real, currently supported Tidelight tokenized-equity spot instruments."""

import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API_ROOT = "https://api.tidelight.app/v1"


def list_tokenized_equities(api_key, open_url=urlopen):
    if not api_key:
        raise ValueError("Set TIDELIGHT_API_KEY in your environment.")
    request = Request(
        f"{API_ROOT}/market/instruments?kind=rtoken&limit=10",
        headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
    )
    try:
        with open_url(request, timeout=15) as response:
            body = json.loads(response.read())
    except HTTPError as error:
        try:
            payload = json.loads(error.read())
        except (ValueError, OSError):
            payload = {}
        detail = payload.get("error", {})
        raise RuntimeError(
            f"Tidelight API {error.code}: {detail.get('code', 'request_failed')} "
            f"(request {detail.get('request_id', 'unavailable')})"
        ) from None
    except (URLError, TimeoutError) as error:
        raise RuntimeError(f"Tidelight API is unreachable: {type(error).__name__}") from None
    if not isinstance(body, dict) or not isinstance(body.get("data"), list):
        raise RuntimeError("Tidelight returned an invalid instrument response.")
    return body


def main():
    result = list_tokenized_equities(os.environ.get("TIDELIGHT_API_KEY"))
    fields = ("symbol", "instrument_type", "underlying_ticker", "issuer_name", "quote_currency", "provider_timestamp", "source")
    print(json.dumps({"request_id": result.get("request_id"), "instruments": [{key: row.get(key) for key in fields if key in row} for row in result["data"]]}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
