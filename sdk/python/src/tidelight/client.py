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


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, request_id: str | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.request_id = request_id


class Client:
    def __init__(self, api_key: str, *, base_url: str = "https://tidelight.app/api/v1", timeout: float = 10, max_retries: int = 2, opener: Callable[..., Any] = urlopen, sleeper: Callable[[float], None] = time.sleep):
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

    def _pause(self, attempt: int, retry_after: str | None) -> None:
        delay = min(2.0, 0.25 * 2**attempt)
        if retry_after and retry_after.isdigit():
            delay = min(5.0, float(retry_after))
        self._sleeper(delay)
