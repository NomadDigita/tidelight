import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const API_ROOT = "https://api.tidelight.app/v1";

export async function listTokenizedEquities(apiKey, fetchImpl = fetch) {
  if (!apiKey) throw new Error("Set TIDELIGHT_API_KEY in your environment.");
  const response = await fetchImpl(`${API_ROOT}/market/instruments?kind=rtoken&limit=10`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error ?? {};
    throw new Error(`Tidelight API ${response.status}: ${error.code ?? "request_failed"} (request ${error.request_id ?? response.headers.get("x-request-id") ?? "unavailable"})`);
  }
  if (!Array.isArray(body?.data)) throw new Error("Tidelight returned an invalid instrument response.");
  return body;
}

async function main() {
  const result = await listTokenizedEquities(process.env.TIDELIGHT_API_KEY);
  console.log(JSON.stringify({ request_id: result.request_id, instruments: result.data.map(({ symbol, instrument_type, underlying_ticker, issuer_name, quote_currency, provider_timestamp, source }) => ({ symbol, instrument_type, underlying_ticker, issuer_name, quote_currency, provider_timestamp, source })) }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
