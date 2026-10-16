import { randomUUID } from "node:crypto";
import { TidelightApiError, TidelightClient } from "../dist/index.js";
import { runCompanyResearch } from "./research-flow.mjs";

const apiKey = process.env.TIDELIGHT_API_KEY;
if (!apiKey) {
  console.error("Set TIDELIGHT_API_KEY in this server-side shell.");
  process.exit(2);
}
const ticker = process.argv[2] ?? process.env.TIDELIGHT_TICKER ?? "NVDA";
try {
  const { accepted, job } = await runCompanyResearch(new TidelightClient({ apiKey }), { ticker, idempotencyKey: randomUUID() });
  const output = {
    accepted: { job_id: accepted.job_id, status: accepted.status, duplicate: accepted.duplicate, request_id: accepted.request_id },
    job: { job_id: job.job_id, ticker: job.ticker, status: job.status, request_id: job.request_id },
    ...(job.status === "complete" ? { result: job.result } : {}),
    ...(job.error ? { error: { code: job.error.code } } : {}),
  };
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  if (job.status !== "complete") process.exitCode = 1;
} catch (error) {
  if (error instanceof TidelightApiError) {
    console.error(JSON.stringify({ error: { status: error.status, code: error.code, request_id: error.requestId } }));
  } else {
    console.error("Research request failed. Inspect the server's safe error telemetry.");
  }
  process.exitCode = 1;
}
