import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const API_ROOT = "https://api.tidelight.app/v1";
const TERMINAL = new Set(["complete", "failed", "cancelled"]);

async function request(apiKey, path, init = {}, fetchImpl = fetch) {
  const response = await fetchImpl(`${API_ROOT}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error ?? {};
    throw new Error(`Tidelight API ${response.status}: ${error.code ?? "request_failed"} (request ${error.request_id ?? response.headers.get("x-request-id") ?? "unavailable"})`);
  }
  return body;
}

export async function runCompanyResearch(apiKey, ticker, { fetchImpl = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), maxPolls = 60 } = {}) {
  if (!apiKey) throw new Error("Set TIDELIGHT_API_KEY in your environment.");
  if (!/^[A-Za-z][A-Za-z0-9.]{0,9}$/.test(ticker)) throw new Error("Provide a supported stock ticker.");
  if (!Number.isInteger(maxPolls) || maxPolls < 1 || maxPolls > 300) throw new RangeError("maxPolls must be an integer from 1 to 300.");
  const started = await request(apiKey, "/research/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": `example-${crypto.randomUUID()}` },
    body: JSON.stringify({ ticker: ticker.toUpperCase() }),
  }, fetchImpl);
  for (let attempt = 0; attempt < maxPolls; attempt++) {
    const job = await request(apiKey, `/research/jobs/${encodeURIComponent(started.job_id)}`, {}, fetchImpl);
    if (TERMINAL.has(job.status)) return job;
    if (attempt + 1 < maxPolls) await pause(2_000);
  }
  throw new Error(`Research is still running after bounded polling; job ${started.job_id} remains available in the developer console.`);
}

async function main() {
  const ticker = process.argv[2];
  if (!ticker) throw new Error("Usage: node rest/research.mjs <TICKER>");
  const job = await runCompanyResearch(process.env.TIDELIGHT_API_KEY, ticker);
  console.log(JSON.stringify({ job_id: job.job_id, ticker: job.ticker, status: job.status, request_id: job.request_id, result: job.result, error: job.error }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
