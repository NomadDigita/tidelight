"""Read-only Tidelight API client; requires Python 3.10 or later."""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Any, Callable, Iterator
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class Instrument:
    symbol: str
    instrument_type: str
    underlying_ticker: str
    issuer_name: str
    quote_currency: str
    last_price: float
    change_24h: float | None
    provider_timestamp: int | None
    market_session_status: str
    source: str


@dataclass(frozen=True)
class InstrumentPage:
    data: list[Instrument]
    next_cursor: str | None
    generated_at: int
    request_id: str


@dataclass(frozen=True)
class ResearchJob:
    job_id: str
    ticker: str
    status: str
    attempts: int
    max_attempts: int
    result: dict[str, Any] | None
    error: dict[str, str] | None
    created_at: str
    started_at: str | None
    completed_at: str | None
    retry_at: str | None
    request_id: str


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, request_id: str | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.request_id = request_id


class Client:
    def __init__(self, api_key: str, *, base_url: str = "https://api.tidelight.app/v1", timeout: float = 10, max_retries: int = 2, opener: Callable[..., Any] = urlopen, sleeper: Callable[[float], None] = time.sleep):
        if not re.fullmatch(r"tl_(test|live)_[A-Za-z0-9_-]{43}", api_key):
            raise ValueError("A valid Tidelight API key is required.")
        parsed = urlparse(base_url)
        if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}):
            raise ValueError("The API URL must use HTTPS.")
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("The API URL cannot contain credentials, query, or fragment.")
        if not 0.1 <= timeout <= 120:
            raise ValueError("timeout must be 0.1 to 120 seconds.")
        if not isinstance(max_retries, int) or not 0 <= max_retries <= 5:
            raise ValueError("max_retries must be 0 to 5.")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._max_retries = max_retries
        self._opener = opener
        self._sleeper = sleeper

    def list_tokenized_equities(self, *, limit: int = 20, cursor: str | None = None) -> InstrumentPage:
        if not isinstance(limit, int) or not 1 <= limit <= 100:
            raise ValueError("limit must be 1 to 100.")
        if cursor is not None and not re.fullmatch(r"[A-Z0-9]{2,32}", cursor):
            raise ValueError("Invalid instrument cursor.")
        params = {"kind": "rtoken", "limit": str(limit)}
        if cursor is not None:
            params["cursor"] = cursor
        url = f"{self._base_url}/market/instruments?{urlencode(params)}"
        request = Request(url, headers={"Authorization": f"Bearer {self._api_key}", "Accept": "application/json"})
        for attempt in range(self._max_retries + 1):
            try:
                with self._opener(request, timeout=self._timeout) as response:
                    payload = json.load(response)
                    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
                        raise ApiError(response.status, "invalid_response", "The Tidelight API returned an invalid response.", response.headers.get("X-Request-Id"))
                    return InstrumentPage(
                        data=[Instrument(**item) for item in payload["data"]],
                        next_cursor=payload.get("next_cursor"),
                        generated_at=payload["generated_at"],
                        request_id=payload["request_id"],
                    )
            except HTTPError as error:
                try:
                    details = json.load(error).get("error", {})
                except (ValueError, AttributeError):
                    details = {}
                if error.code in {429, 502, 503, 504} and attempt < self._max_retries:
                    self._pause(attempt, error.headers.get("Retry-After"))
                    continue
                raise ApiError(error.code, details.get("code", "api_error"), details.get("message", "Tidelight API request failed."), details.get("request_id") or error.headers.get("X-Request-Id")) from None
            except (URLError, TimeoutError, OSError):
                if attempt >= self._max_retries:
                    raise ApiError(0, "network_error", "The Tidelight API could not be reached.") from None
                self._pause(attempt, None)
        raise RuntimeError("Unreachable retry state")

    def tokenized_equities(self, *, limit: int = 20) -> Iterator[Instrument]:
        cursor = None
        while True:
            page = self.list_tokenized_equities(limit=limit, cursor=cursor)
            yield from page.data
            if page.next_cursor is None:
                return
            if page.next_cursor == cursor:
                raise ApiError(0, "invalid_response", "The API returned a repeated pagination cursor.", page.request_id)
            cursor = page.next_cursor

    def start_company_research(self, ticker: str, idempotency_key: str) -> dict[str, Any]:
        if not isinstance(ticker, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9.]{0,9}", ticker):
            raise ValueError("ticker must be a supported stock symbol.")
        if not isinstance(idempotency_key, str) or not re.fullmatch(r"[A-Za-z0-9._:-]{8,128}", idempotency_key):
            raise ValueError("idempotency_key must be 8 to 128 valid characters.")
        return self._job_request("/research/jobs", "POST", {"ticker": ticker}, idempotency_key)

    def get_research_job(self, job_id: str) -> ResearchJob:
        if not isinstance(job_id, str) or not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", job_id, re.I):
            raise ValueError("Invalid research job ID.")
        return ResearchJob(**self._job_request(f"/research/jobs/{job_id}", "GET"))

    def cancel_research_job(self, job_id: str) -> dict[str, Any]:
        if not isinstance(job_id, str) or not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", job_id, re.I):
            raise ValueError("Invalid research job ID.")
        return self._job_request(f"/research/jobs/{job_id}", "DELETE")

    def wait_for_research_job(self, job_id: str, *, interval: float = 2, timeout: float = 120) -> ResearchJob:
        if not 0.25 <= interval <= 30 or not interval <= timeout <= 600:
            raise ValueError("Polling interval or timeout is out of range.")
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            job = self.get_research_job(job_id)
            if job.status in {"complete", "failed", "cancelled"}:
                return job
            self._sleeper(min(interval, max(0, deadline - time.monotonic())))
        raise ApiError(0, "poll_timeout", "The research job did not finish before the polling timeout.")

    def list_webhooks(self) -> dict[str, Any]:
        return self._job_request("/webhooks", "GET")

    def create_webhook(self, *, name: str, url: str, events: list[str]) -> dict[str, Any]:
        self._validate_webhook_input(name, url, events)
        return self._job_request("/webhooks", "POST", {"name": name, "url": url, "events": events}, retry_safe=False)

    def update_webhook(self, endpoint_id: str, **changes: Any) -> dict[str, Any]:
        self._validate_webhook_id(endpoint_id)
        allowed = {"name", "url", "events", "enabled", "rotate_secret"}
        if not changes or set(changes) - allowed:
            raise ValueError("Provide at least one supported webhook change.")
        if "name" in changes and (not isinstance(changes["name"], str) or not 2 <= len(changes["name"].strip()) <= 80):
            raise ValueError("Webhook name must be 2 to 80 characters.")
        if "url" in changes:
            self._validate_webhook_url(changes["url"])
        if "events" in changes:
            self._validate_webhook_events(changes["events"])
        if "enabled" in changes and not isinstance(changes["enabled"], bool):
            raise ValueError("enabled must be a boolean.")
        if "rotate_secret" in changes and changes["rotate_secret"] is not True:
            raise ValueError("rotate_secret can only be true.")
        return self._job_request(f"/webhooks/{endpoint_id}", "PATCH", changes, retry_safe=False)

    def disable_webhook(self, endpoint_id: str) -> dict[str, Any]:
        self._validate_webhook_id(endpoint_id)
        return self._job_request(f"/webhooks/{endpoint_id}", "DELETE", retry_safe=False)

    def list_webhook_deliveries(self) -> dict[str, Any]:
        return self._job_request("/webhooks/deliveries", "GET")

    @staticmethod
    def _validate_webhook_id(endpoint_id: str) -> None:
        if not isinstance(endpoint_id, str) or not re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", endpoint_id, re.I):
            raise ValueError("Invalid webhook endpoint ID.")

    @staticmethod
    def _validate_webhook_url(url: str) -> None:
        if not isinstance(url, str) or len(url) > 2048:
            raise ValueError("Webhook URL must be a valid public HTTPS URL.")
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.port not in (None, 443) or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("Webhook URL must use public HTTPS on port 443 without credentials, query, or fragment.")

    @staticmethod
    def _validate_webhook_events(events: list[str]) -> None:
        allowed = {"research.job.completed", "research.job.failed"}
        if not isinstance(events, list) or not 1 <= len(events) <= 2 or any(not isinstance(event, str) or event not in allowed for event in events) or len(set(events)) != len(events):
            raise ValueError("Choose one or more supported webhook events.")

    @classmethod
    def _validate_webhook_input(cls, name: str, url: str, events: list[str]) -> None:
        if not isinstance(name, str) or not 2 <= len(name.strip()) <= 80:
            raise ValueError("Webhook name must be 2 to 80 characters.")
        cls._validate_webhook_url(url)
        cls._validate_webhook_events(events)

    def _job_request(self, path: str, method: str, body: dict[str, Any] | None = None, idempotency_key: str | None = None, *, retry_safe: bool = True) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self._api_key}", "Accept": "application/json"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        url = f"{self._base_url}{path}"
        retry_limit = self._max_retries if retry_safe else 0
        for attempt in range(retry_limit + 1):
            request = Request(url, data=data, headers=headers, method=method)
            try:
                with self._opener(request, timeout=self._timeout) as response:
                    payload = json.load(response)
                    if not isinstance(payload, dict):
                        raise ApiError(response.status, "invalid_response", "The Tidelight API returned an invalid response.", response.headers.get("X-Request-Id"))
                    return payload
            except HTTPError as error:
                try:
                    details = json.load(error).get("error", {})
                except (ValueError, AttributeError):
                    details = {}
                if error.code in {429, 502, 503, 504} and attempt < retry_limit:
                    self._pause(attempt, error.headers.get("Retry-After")); continue
                raise ApiError(error.code, details.get("code", "api_error"), details.get("message", "Tidelight API request failed."), details.get("request_id") or error.headers.get("X-Request-Id")) from None
            except (URLError, TimeoutError, OSError):
                if attempt >= self._max_retries:
                    raise ApiError(0, "network_error", "The Tidelight API could not be reached.") from None
                self._pause(attempt, None)
        raise RuntimeError("Unreachable retry state")

    def _pause(self, attempt: int, retry_after: str | None) -> None:
        delay = min(2.0, 0.25 * 2**attempt)
        if retry_after and retry_after.isdigit():
            delay = min(5.0, float(retry_after))
        self._sleeper(delay)
