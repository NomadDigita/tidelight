import io
import json
import unittest
from tidelight import Client
from examples.research import run_company_research
KEY = "tl_test_" + "a" * 43
JOB_ID = "01234567-89ab-4cde-8fab-0123456789ab"

class FakeResponse(io.BytesIO):
    def __init__(self, payload, status):
        super().__init__(json.dumps(payload).encode())
        self.status = status
        self.headers = {}
    def __enter__(self):
        return self
    def __exit__(self, *_args):
        self.close()

def snapshot(status, result=None, error=None):
    return {"job_id": JOB_ID, "ticker": "NVDA", "status": status, "attempts": 1, "max_attempts": 3,
            "result": result, "error": error, "created_at": "2026-10-16T00:00:00Z", "started_at": None,
            "completed_at": None, "retry_at": None, "request_id": "research-result"}

class ResearchExampleTests(unittest.TestCase):
    def test_example_uses_sdk_idempotent_flow_and_returns_completion(self):
        calls = []
        def opener(request, timeout):
            calls.append(request)
            if request.get_method() == "POST":
                return FakeResponse({"job_id": JOB_ID, "status": "queued", "duplicate": False, "request_id": "accepted"}, 202)
            return FakeResponse(snapshot("complete", {"source": "contract-shaped test fixture"}), 200)
        accepted, job = run_company_research(Client(KEY, opener=opener), "NVDA", "example-run-0001", interval=0.25, timeout=1)
        self.assertEqual(accepted["status"], "queued")
        self.assertEqual(job.status, "complete")
        self.assertEqual(job.result, {"source": "contract-shaped test fixture"})
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0].get_header("Idempotency-key"), "example-run-0001")
        self.assertEqual(calls[0].get_header("Authorization"), f"Bearer {KEY}")
        self.assertTrue(calls[0].full_url.endswith("/v1/research/jobs"))
        self.assertIn(JOB_ID, calls[1].full_url)

    def test_example_keeps_failure_state_and_null_result(self):
        def opener(request, timeout):
            if request.get_method() == "POST":
                return FakeResponse({"job_id": JOB_ID, "status": "queued", "duplicate": False, "request_id": "accepted"}, 202)
            return FakeResponse(snapshot("failed", None, {"code": "provider_unavailable", "message": "Unavailable"}), 200)
        _accepted, job = run_company_research(Client(KEY, opener=opener, sleeper=lambda _s: None), "NVDA", "example-run-0002", interval=0.25, timeout=1)
        self.assertEqual(job.status, "failed")
        self.assertIsNone(job.result)
        self.assertEqual(job.error["code"], "provider_unavailable")

if __name__ == "__main__":
    unittest.main()
