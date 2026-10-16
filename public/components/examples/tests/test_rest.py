import json
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from unittest.mock import patch

from rest.market import list_tokenized_equities
from rest.research import run_company_research


class FakeResponse:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.payload


class RestExampleTests(unittest.TestCase):
    def test_market_uses_bearer_key_and_returns_provider_payload(self):
        captured = {}

        def open_url(request, timeout):
            captured["authorization"] = request.get_header("Authorization")
            captured["timeout"] = timeout
            return FakeResponse({"request_id": "req-example", "data": [{"source": "Bitget Reality spot"}]})

        result = list_tokenized_equities("tl_test_example", open_url)
        self.assertEqual(captured, {"authorization": "Bearer tl_test_example", "timeout": 15})
        self.assertEqual(result["data"][0]["source"], "Bitget Reality spot")

    def test_research_uses_idempotency_and_waits_for_terminal_status(self):
        calls = []

        def open_url(request, timeout):
            calls.append(request)
            if request.method == "POST":
                self.assertTrue(request.get_header("Idempotency-key").startswith("example-"))
                self.assertEqual(json.loads(request.data), {"ticker": "NVDA"})
                return FakeResponse({"job_id": "3d7fbd5c-a03c-4ba1-ae77-8ecf44dbdb5e", "status": "queued"})
            return FakeResponse({"job_id": "3d7fbd5c-a03c-4ba1-ae77-8ecf44dbdb5e", "status": "complete"})

        result = run_company_research("tl_test_example", "nvda", pause=lambda _seconds: None, open_url=open_url)
        self.assertEqual(result["status"], "complete")
        self.assertEqual(len(calls), 2)

    def test_invalid_ticker_fails_before_network(self):
        called = False

        def open_url(*_args, **_kwargs):
            nonlocal called
            called = True

        with self.assertRaisesRegex(ValueError, "supported stock ticker"):
            run_company_research("tl_test_example", "NVDA;DROP", open_url=open_url)
        self.assertFalse(called)

    def test_python_transport_rejects_redirect_before_forwarding_credentials(self):
        requests = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                requests.append((self.path, self.headers.get("Authorization")))
                self.send_response(302)
                self.send_header("Location", "/credential-capture")
                self.end_headers()

            def log_message(self, *_args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with patch("rest.market.API_ROOT", f"http://127.0.0.1:{server.server_port}/v1"):
                with self.assertRaisesRegex(RuntimeError, "302"):
                    list_tokenized_equities("tl_test_example")
            self.assertEqual(requests, [("/v1/market/instruments?kind=rtoken&limit=10", "Bearer tl_test_example")])
        finally:
            server.shutdown()
            thread.join(timeout=2)
            server.server_close()

    def test_research_poll_limit_is_bounded_before_network(self):
        called = False

        def open_url(*_args, **_kwargs):
            nonlocal called
            called = True

        with self.assertRaisesRegex(ValueError, "poll_limit must be an integer from 1 to 300"):
            run_company_research("tl_test_example", "NVDA", poll_limit=0, open_url=open_url)
        self.assertFalse(called)


if __name__ == "__main__":
    unittest.main()
