import io
import json
import unittest
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse

from tidelight import ApiError, Client

KEY = "tl_test_" + "a" * 43
INSTRUMENT = {"symbol": "RNVDAUSDT", "instrument_type": "tokenized_equity_spot", "underlying_ticker": "NVDA", "issuer_name": "NVIDIA", "quote_currency": "USDT", "last_price": 1.0, "change_24h": None, "provider_timestamp": None, "market_session_status": "available", "source": "Bitget Reality spot"}


class FakeResponse(io.BytesIO):
    def __init__(self, data):
        super().__init__(json.dumps(data).encode())
        self.status = 200
        self.headers = {}


class ClientTests(unittest.TestCase):
    def test_research_job_creation_status_and_cancellation(self):
        job_id = "01234567-89ab-4cde-8fab-0123456789ab"
        calls = []

        def opener(request, timeout):
            calls.append((request.get_method(), request.full_url, request.get_header("Idempotency-key")))
            if request.get_method() == "POST":
                return FakeResponse({"job_id": job_id, "status": "queued", "duplicate": False, "request_id": "r1"})
            if request.get_method() == "GET":
                return FakeResponse({"job_id": job_id, "ticker": "NVDA", "status": "complete", "attempts": 1, "max_attempts": 3, "result": {"type": "company_snapshot"}, "error": None, "created_at": "2026-01-01T00:00:00Z", "started_at": None, "completed_at": "2026-01-01T00:01:00Z", "retry_at": None, "request_id": "r2"})
            return FakeResponse({"job_id": job_id, "status": "cancelled", "request_id": "r3"})

        client = Client(KEY, opener=opener)
        started = client.start_company_research("NVDA", "request-0001")
        self.assertEqual(started["status"], "queued")
        self.assertEqual(calls[0][2], "request-0001")
        job = client.get_research_job(job_id)
        self.assertEqual(job.status, "complete")
        self.assertEqual(job.result["type"], "company_snapshot")
        self.assertEqual(client.cancel_research_job(job_id)["status"], "cancelled")

    def test_research_job_validates_before_network(self):
        client = Client(KEY, opener=lambda *_args, **_kwargs: self.fail("transport called"))
        with self.assertRaises(ValueError):
            client.start_company_research("NVDA?", "request-0001")
        with self.assertRaises(ValueError):
            client.start_company_research("NVDA", "short")

    def test_pagination_and_bearer_header(self):
        calls = []

        def opener(request, timeout):
            self.assertEqual(request.get_header("Authorization"), "Bearer " + KEY)
            calls.append(parse_qs(urlparse(request.full_url).query))
            return FakeResponse({"data": [INSTRUMENT], "next_cursor": "RNVDAUSDT" if len(calls) == 1 else None, "generated_at": 1, "request_id": "test"})

        client = Client(KEY, opener=opener)
        self.assertEqual(len(list(client.tokenized_equities())), 2)
        self.assertEqual(calls[1]["cursor"], ["RNVDAUSDT"])

    def test_transient_retry_and_structured_error(self):
        calls = []

        def opener(request, timeout):
            calls.append(1)
            if len(calls) == 1:
                raise HTTPError(request.full_url, 503, "Unavailable", {"Retry-After": "0"}, io.BytesIO(b'{"error":{"code":"provider_unavailable","message":"Retry"}}'))
            return FakeResponse({"data": [], "next_cursor": None, "generated_at": 1, "request_id": "success"})

        client = Client(KEY, opener=opener, sleeper=lambda _: None, max_retries=1)
        self.assertEqual(client.list_tokenized_equities().request_id, "success")
        self.assertEqual(len(calls), 2)

        def denied(request, timeout):
            raise HTTPError(request.full_url, 401, "Denied", {"X-Request-Id": "denied"}, io.BytesIO(b'{"error":{"code":"unauthorized","message":"Invalid key"}}'))

        with self.assertRaises(ApiError) as caught:
            Client(KEY, opener=denied).list_tokenized_equities()
        self.assertEqual(caught.exception.request_id, "denied")
        self.assertNotIn(KEY, str(caught.exception))

    def test_input_validation(self):
        with self.assertRaises(ValueError):
            Client(KEY, base_url="http://example.com/api/v1")
        client = Client(KEY, opener=lambda *_args, **_kwargs: self.fail("transport called"))
        with self.assertRaises(ValueError):
            client.list_tokenized_equities(limit=101)
        with self.assertRaises(ValueError):
            client.list_tokenized_equities(cursor="../../etc")

    def test_webhook_management_and_delivery_history(self):
        endpoint_id = "01234567-89ab-4cde-8fab-0123456789ab"
        calls = []

        def opener(request, timeout):
            calls.append((request.get_method(), request.full_url, request.get_header("Authorization"), request.data))
            if request.get_method() == "GET" and request.full_url.endswith("/deliveries"):
                return FakeResponse({"deliveries": [], "request_id": "r5"})
            if request.get_method() == "GET":
                return FakeResponse({"endpoints": [{"id": endpoint_id}], "request_id": "r1"})
            if request.get_method() == "DELETE":
                return FakeResponse({"disabled": True, "request_id": "r4"})
            return FakeResponse({"endpoint": {"id": endpoint_id}, "signing_secret": "shown-once", "request_id": "r2"})

        client = Client(KEY, opener=opener)
        self.assertEqual(client.list_webhooks()["endpoints"][0]["id"], endpoint_id)
        self.assertEqual(client.create_webhook(name="Research", url="https://example.com/hook", events=["research.job.completed"])["signing_secret"], "shown-once")
        self.assertEqual(client.update_webhook(endpoint_id, rotate_secret=True)["signing_secret"], "shown-once")
        self.assertTrue(client.disable_webhook(endpoint_id)["disabled"])
        self.assertEqual(client.list_webhook_deliveries()["deliveries"], [])
        self.assertEqual([call[0] for call in calls], ["GET", "POST", "PATCH", "DELETE", "GET"])
        self.assertTrue(all(call[2] == "Bearer " + KEY for call in calls))

    def test_webhook_input_validation_prevents_requests(self):
        client = Client(KEY, opener=lambda *_args, **_kwargs: self.fail("network should not run"))
        with self.assertRaises(ValueError):
            client.create_webhook(name="x", url="http://example.com/hook", events=["research.job.completed"])
        with self.assertRaises(ValueError):
            client.create_webhook(name="Valid", url="https://example.com/hook", events=["unknown.event"])
        with self.assertRaises(ValueError):
            client.update_webhook("../invalid", enabled=False)
        with self.assertRaises(ValueError):
            client.update_webhook("01234567-89ab-4cde-8fab-0123456789ab", rotate_secret=False)

    def test_webhook_mutation_does_not_retry_without_idempotency_support(self):
        calls = []

        def unavailable(request, timeout):
            calls.append(1)
            raise HTTPError(request.full_url, 503, "Unavailable", {}, io.BytesIO(b'{"error":{"code":"service_unavailable","message":"Try later"}}'))

        client = Client(KEY, opener=unavailable, max_retries=3)
        with self.assertRaises(ApiError) as caught:
            client.create_webhook(name="Research", url="https://example.com/hook", events=["research.job.completed"])
        self.assertEqual(caught.exception.code, "service_unavailable")
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
