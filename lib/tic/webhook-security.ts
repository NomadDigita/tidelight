import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

const SECRET_PREFIX = "whsec_";
const MAX_RESPONSE_BYTES = 2048;

function encryptionKey() {
  const encoded = process.env.TIC_WEBHOOK_ENCRYPTION_KEY;
  if (!encoded) throw new Error("webhook_encryption_unconfigured");
  const key = Buffer.from(encoded, "base64url");
  if (key.length !== 32) throw new Error("webhook_encryption_unconfigured");
  return key;
}

export function createWebhookSecret() {
  const secret = `${SECRET_PREFIX}${randomBytes(32).toString("base64url")}`;
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { secret, encryptedSecret: [nonce, tag, ciphertext].map(part => part.toString("base64url")).join(".") };
}

export function decryptWebhookSecret(encrypted: string) {
  const [noncePart, tagPart, ciphertextPart, ...extra] = encrypted.split(".");
  if (!noncePart || !tagPart || !ciphertextPart || extra.length) throw new Error("webhook_secret_corrupt");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(noncePart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextPart, "base64url")), decipher.final()]).toString("utf8");
}

function ipv4IsPublic(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 168 || (b === 0 && c <= 2) || (b === 88 && c === 99))) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function ipv6IsPublic(address: string) {
  const value = address.toLowerCase().split("%", 1)[0];
  const firstGroup = Number.parseInt(value.split(":", 1)[0] || "0", 16);
  if (firstGroup < 0x2000 || firstGroup > 0x3fff) return false;
  const secondGroup = Number.parseInt(value.split(":")[1] || "0", 16);
  if ((firstGroup === 0x2001 && secondGroup <= 0x01ff) || firstGroup === 0x2002) return false;
  if (value === "::" || value === "::1" || value.startsWith("::ffff:")) return false;
  if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb") || value.startsWith("ff")) return false;
  if (value.startsWith("2001:db8:")) return false;
  return true;
}

export function isPublicWebhookAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return ipv4IsPublic(address);
  if (family === 6) return ipv6IsPublic(address);
  return false;
}

export function validateWebhookUrl(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("invalid_webhook_url"); }
  const hostname = url.hostname.startsWith("[") && url.hostname.endsWith("]") ? url.hostname.slice(1, -1) : url.hostname;
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search || (url.port && url.port !== "443") || hostname.endsWith(".")) throw new Error("invalid_webhook_url");
  if (hostname.toLowerCase() === "localhost" || hostname.toLowerCase().endsWith(".localhost") || hostname.toLowerCase().endsWith(".local")) throw new Error("unsafe_webhook_destination");
  if (isIP(hostname) && !isPublicWebhookAddress(hostname)) throw new Error("unsafe_webhook_destination");
  url.port = "";
  return url;
}

export function signWebhookPayload(secret: string, payload: string, timestamp: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

async function publicAddresses(hostname: string) {
  const normalizedHostname = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  const addresses = isIP(normalizedHostname) ? [{ address: normalizedHostname, family: isIP(normalizedHostname) as 4 | 6 }] : await lookup(normalizedHostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(item => !isPublicWebhookAddress(item.address))) throw new Error("unsafe_webhook_destination");
  return addresses;
}

export async function assertPublicWebhookDestination(input: string) {
  const url = validateWebhookUrl(input);
  await publicAddresses(url.hostname);
  return url;
}

export async function sendSignedWebhook(input: { url: string; encryptedSecret: string; eventId: string; eventType: string; payload: unknown; timeoutMs?: number }) {
  const url = validateWebhookUrl(input.url);
  const hostname = url.hostname.startsWith("[") && url.hostname.endsWith("]") ? url.hostname.slice(1, -1) : url.hostname;
  const addresses = await publicAddresses(hostname);
  const target = addresses[0];
  const body = JSON.stringify(input.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signWebhookPayload(decryptWebhookSecret(input.encryptedSecret), body, timestamp);
  const timeoutMs = Math.min(10000, Math.max(1000, input.timeoutMs ?? 8000));
  return await new Promise<{ status: number; durationMs: number }>((resolve, reject) => {
    const startedAt = Date.now();
    let abortRequest = () => {};
    const timer = setTimeout(() => abortRequest(), timeoutMs);
    const req = request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "Tidelight-Webhooks/1.0",
        "Tidelight-Event-Id": input.eventId,
        "Tidelight-Event": input.eventType,
        "Tidelight-Signature": `t=${timestamp},v1=${signature}`,
      },
      lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
    }, response => {
      let received = 0;
      response.on("data", chunk => { received += Buffer.byteLength(chunk); if (received > MAX_RESPONSE_BYTES) req.destroy(new Error("webhook_response_too_large")); });
      response.on("end", () => { clearTimeout(timer); resolve({ status: response.statusCode ?? 0, durationMs: Date.now() - startedAt }); });
    });
    abortRequest = () => req.destroy(new Error("webhook_timeout"));
    req.on("error", error => { clearTimeout(timer); reject(error); });
    req.end(body);
  });
}
