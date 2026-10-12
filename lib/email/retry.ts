export const EMAIL_MAX_ATTEMPTS = 8;

export function nextEmailRetryAt(attempts: number, nowMs = Date.now()) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts >= EMAIL_MAX_ATTEMPTS) return null;
  const delayMs = Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** (attempts - 1)));
  return new Date(nowMs + delayMs).toISOString();
}
