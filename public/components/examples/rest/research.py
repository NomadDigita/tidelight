"""Start a real Tidelight research snapshot and poll its durable job."""

import json
import os
import re
import sys
import time
import uuid
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API_ROOT = "https://api.tidelight.app/v1"
TERMINAL = {"complete", "failed", "cancelled"}


def request_json(api_key, path, method="GET", body=None, idempotency_key=None, open_url=urlopen):
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    request = Request(f"{API_ROOT}{path}", data=data, headers=headers, method=method)
    try:
        with open_url(request, timeout=15) as response:
            return json.loads(response.read())
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


def run_company_research(api_key, ticker, poll_limit=60, pause=time.sleep, open_url=urlopen):
    if not api_key:
        raise ValueError("Set TIDELIGHT_API_KEY in your environment.")
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9.]{0,9}", ticker):
        raise ValueError("Provide a supported stock ticker.")
    started = request_json(
        api_key,
        "/research/jobs",
        method="POST",
        body={"ticker": ticker.upper()},
        idempotency_key=f"example-{uuid.uuid4()}",
        open_url=open_url,
    )
    job_id = started.get("job_id")
    if not isinstance(job_id, str):
        raise RuntimeError("Tidelight returned an invalid research job response.")
    for attempt in range(poll_limit):
        job = request_json(api_key, f"/research/jobs/{job_id}", open_url=open_url)
        if job.get("status") in TERMINAL:
            return job
        if attempt + 1 < poll_limit:
            pause(2)
    raise TimeoutError(f"Research remains available in the console; job {job_id} is still running.")


def main():
    if len(sys.argv) != 2:
        raise ValueError("Usage: python rest/research.py <TICKER>")
    job = run_company_research(os.environ.get("TIDELIGHT_API_KEY"), sys.argv[1])
    print(json.dumps({key: job.get(key) for key in ("job_id", "ticker", "status", "request_id", "result", "error")}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, TimeoutError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
