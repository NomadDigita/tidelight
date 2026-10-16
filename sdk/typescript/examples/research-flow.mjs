export async function runCompanyResearch(client, { ticker, idempotencyKey, intervalMs = 2_000, timeoutMs = 120_000 }) {
  const accepted = await client.startCompanyResearch(ticker, idempotencyKey);
  const job = await client.waitForResearchJob(accepted.job_id, { intervalMs, timeoutMs });
  return { accepted, job };
}
