"""Source-checkout example for asynchronous company snapshot research."""
from __future__ import annotations
import json
import os
import sys
import uuid
from typing import Any
from tidelight import ApiError, Client, ResearchJob

def run_company_research(client: Client, ticker: str, idempotency_key: str, *, interval: float = 2, timeout: float = 120) -> tuple[dict[str, Any], ResearchJob]:
    accepted = client.start_company_research(ticker, idempotency_key)
    job = client.wait_for_research_job(accepted["job_id"], interval=interval, timeout=timeout)
    return accepted, job

def main() -> int:
    api_key = os.environ.get("TIDELIGHT_API_KEY")
    if not api_key:
        print("Set TIDELIGHT_API_KEY in this server-side shell.", file=sys.stderr)
        return 2
    ticker = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TIDELIGHT_TICKER", "NVDA")
    try:
        accepted, job = run_company_research(Client(api_key), ticker, str(uuid.uuid4()))
    except ApiError as error:
        print(json.dumps({"error": {"status": error.status, "code": error.code, "request_id": error.request_id}}), file=sys.stderr)
        return 1
    output: dict[str, Any] = {
        "accepted": {key: accepted[key] for key in ("job_id", "status", "duplicate", "request_id")},
        "job": {"job_id": job.job_id, "ticker": job.ticker, "status": job.status, "request_id": job.request_id},
    }
    if job.status == "complete":
        output["result"] = job.result
    if job.error:
        output["error"] = {"code": job.error.get("code")}
    print(json.dumps(output, indent=2))
    return 0 if job.status == "complete" else 1

if __name__ == "__main__":
    raise SystemExit(main())
