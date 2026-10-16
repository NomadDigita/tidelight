import { randomUUID } from "node:crypto";
import { TidelightApiError, TidelightClient } from "@tidelight/sdk";
import type { CredentialStore } from "./credential-store.js";

const API_KEY_PATTERN = /^tl_(test|live)_[A-Za-z0-9_-]{43}$/;
const HELP = `Tidelight CLI — supported API workflows

Usage:
  tidelight auth login | status | logout
  tidelight market instruments [--ticker SYMBOL] [--limit 1..100] [--cursor CURSOR] [--json]
  tidelight research start SYMBOL [--idempotency-key KEY] [--wait] [--interval-ms N] [--timeout-ms N] [--json]
  tidelight research get JOB_ID [--json]
  tidelight research wait JOB_ID [--interval-ms N] [--timeout-ms N] [--json]
  tidelight research cancel JOB_ID [--json]
  tidelight webhooks list [--json]
  tidelight webhooks create --name NAME --url HTTPS_URL --events EVENT[,EVENT] [--json]
  tidelight webhooks update ENDPOINT_ID [--name NAME] [--url HTTPS_URL] [--events EVENT[,EVENT]] [--enabled true|false] [--rotate-secret] [--json]
  tidelight webhooks disable ENDPOINT_ID [--json]
  tidelight webhooks deliveries [--json]

Credentials are read from TIDELIGHT_API_KEY or an OS keychain entry. API keys are never written to a plaintext config file.
`;

type JsonValue = Record<string, unknown>;
type Client = Pick<TidelightClient,
  "listTokenizedEquities" | "startCompanyResearch" | "getResearchJob" | "waitForResearchJob" | "cancelResearchJob" |
  "listWebhooks" | "createWebhook" | "updateWebhook" | "disableWebhook" | "listWebhookDeliveries">;
type CliDependencies = {
  stdout: { write(value: string): unknown };
  stderr: { write(value: string): unknown };
  env: Record<string, string | undefined>;
  credentialStore: CredentialStore;
  promptSecret: (label: string) => Promise<string>;
  createClient: (apiKey: string) => Client;
  signal?: AbortSignal;
};

class ResearchPollingError extends Error {
  constructor(readonly accepted: unknown, readonly cause: unknown) {
    super(safeError(cause));
    this.name = "ResearchPollingError";
  }
}

function options(tokens: string[], booleanFlags: string[] = []): { positionals: string[]; flags: Record<string, string | boolean> } {
  const positionals: string[] = [], flags: Record<string, string | boolean> = {};
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token.startsWith("--")) { positionals.push(token); continue; }
    const name = token.slice(2);
    if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`Invalid option: ${token}`);
    if (name in flags) throw new Error(`Option repeated: ${token}`);
    if (booleanFlags.includes(name)) { flags[name] = true; continue; }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Option ${token} needs a value.`);
    flags[name] = value;
    index++;
  }
  return { positionals, flags };
}

function knownFlags(flags: Record<string, string | boolean>, allowed: string[]) {
  for (const name of Object.keys(flags)) if (!allowed.includes(name)) throw new Error(`Unknown option: --${name}`);
}

function integerFlag(flags: Record<string, string | boolean>, key: string, fallback: number, min: number, max: number) {
  const raw = flags[key];
  if (raw === undefined) return fallback;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) throw new Error(`--${key} must be an integer from ${min} to ${max}.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`--${key} must be an integer from ${min} to ${max}.`);
  return value;
}

function print(value: unknown, deps: CliDependencies, json: boolean) {
  if (json) { deps.stdout.write(`${JSON.stringify(value, null, 2)}\n`); return; }
  if (value && typeof value === "object" && "data" in value && Array.isArray(value.data)) {
    const items = value.data as Array<Record<string, unknown>>;
    if (items.length === 0) deps.stdout.write("No instruments returned.\n");
    else {
      deps.stdout.write("SYMBOL       UNDERLYING   TYPE                  LAST PRICE   SOURCE\n");
      for (const item of items) deps.stdout.write(`${String(item.symbol ?? "—").padEnd(12)} ${String(item.underlying_ticker ?? "—").padEnd(12)} ${String(item.instrument_type ?? "—").padEnd(21)} ${String(item.last_price ?? "—").padEnd(12)} ${String(item.source ?? "—")}\n`);
    }
    const page = value as Record<string, unknown>;
    if ("next_cursor" in page) deps.stdout.write(`Next cursor: ${String(page.next_cursor ?? "none")} · request: ${String(page.request_id ?? "unknown")}\n`);
    return;
  }
  if (value && typeof value === "object" && "endpoints" in value && Array.isArray(value.endpoints)) {
    const endpoints = value.endpoints as Array<Record<string, unknown>>;
    if (!endpoints.length) deps.stdout.write("No webhook endpoints configured.\n");
    for (const endpoint of endpoints) deps.stdout.write(`${String(endpoint.id)} · ${String(endpoint.name)} · ${endpoint.enabled ? "enabled" : "disabled"} · ${(Array.isArray(endpoint.events) ? endpoint.events : []).join(", ")}\n`);
    return;
  }
  if (value && typeof value === "object" && "deliveries" in value && Array.isArray(value.deliveries)) {
    const deliveries = value.deliveries as Array<Record<string, unknown>>;
    if (!deliveries.length) deps.stdout.write("No webhook deliveries found.\n");
    for (const delivery of deliveries) deps.stdout.write(`${String(delivery.id)} · ${String(delivery.event_type)} · ${String(delivery.status)} · attempts ${String(delivery.attempt_count)}\n`);
    return;
  }
  const record = value && typeof value === "object" ? value as Record<string, unknown> : { result: value };
  for (const [key, item] of Object.entries(record)) deps.stdout.write(`${key}: ${item && typeof item === "object" ? JSON.stringify(item) : String(item)}\n`);
}

function parseEvents(value: string | boolean | undefined): Array<"research.job.completed" | "research.job.failed"> {
  if (typeof value !== "string") throw new Error("--events must list supported research job events.");
  const values = value.split(",").map(item => item.trim());
  if (values.length < 1 || values.length > 2 || values.some(item => item !== "research.job.completed" && item !== "research.job.failed") || new Set(values).size !== values.length) {
    throw new Error("--events accepts research.job.completed and/or research.job.failed.");
  }
  return values as Array<"research.job.completed" | "research.job.failed">;
}

async function keyFrom(deps: CliDependencies) {
  const key = deps.env.TIDELIGHT_API_KEY ?? deps.credentialStore.get();
  if (!key) throw new Error("No API key is configured. Run `tidelight auth login` or set TIDELIGHT_API_KEY for this process.");
  if (!API_KEY_PATTERN.test(key)) throw new Error("The configured API key has an invalid format. Rotate it in the Tidelight console and update your credential.");
  return key;
}

async function runAuthenticated(tokens: string[], deps: CliDependencies): Promise<void> {
  const [area, action, ...rest] = tokens;
  if (area === "market" && action === "instruments") {
    const { positionals, flags } = options(rest, ["json"]); knownFlags(flags, ["ticker", "limit", "cursor", "json"]);
    if (positionals.length) throw new Error("market instruments does not accept positional arguments.");
    const limit = integerFlag(flags, "limit", 20, 1, 100);
    const result = await deps.createClient(await keyFrom(deps)).listTokenizedEquities({
      limit,
      ...(typeof flags.ticker === "string" ? { underlyingTicker: flags.ticker } : {}),
      ...(typeof flags.cursor === "string" ? { cursor: flags.cursor } : {}),
      signal: deps.signal,
    });
    print(result, deps, flags.json === true);
    return;
  }
  if (area === "research" && action === "start") {
    const { positionals, flags } = options(rest, ["json", "wait"]); knownFlags(flags, ["idempotency-key", "interval-ms", "timeout-ms", "json", "wait"]);
    const [ticker] = positionals;
    if (!ticker || positionals.length !== 1) throw new Error("research start requires exactly one ticker symbol.");
    const intervalMs = flags.wait === true ? integerFlag(flags, "interval-ms", 2000, 250, 30000) : 2000;
    const timeoutMs = flags.wait === true ? integerFlag(flags, "timeout-ms", 120000, intervalMs, 600000) : 120000;
    const client = deps.createClient(await keyFrom(deps));
    const started = await client.startCompanyResearch(ticker, typeof flags["idempotency-key"] === "string" ? flags["idempotency-key"] : randomUUID(), { signal: deps.signal });
    if (flags.wait !== true) { print(started, deps, flags.json === true); return; }
    if (flags.json !== true) deps.stdout.write(`Research job ${started.job_id} ${started.status}; waiting for a terminal result…\n`);
    let result: unknown;
    try {
      result = await client.waitForResearchJob(started.job_id, { intervalMs, timeoutMs, signal: deps.signal });
    } catch (error) {
      throw new ResearchPollingError(started, error);
    }
    print(result, deps, flags.json === true);
    return;
  }
  if (area === "research" && ["get", "wait", "cancel"].includes(action ?? "")) {
    const { positionals, flags } = options(rest, ["json"]); knownFlags(flags, action === "wait" ? ["interval-ms", "timeout-ms", "json"] : ["json"]);
    const [jobId] = positionals;
    if (!jobId || positionals.length !== 1) throw new Error(`research ${action} requires exactly one job ID.`);
    const client = deps.createClient(await keyFrom(deps));
    if (action === "get") print(await client.getResearchJob(jobId, { signal: deps.signal }), deps, flags.json === true);
    else if (action === "cancel") print(await client.cancelResearchJob(jobId, { signal: deps.signal }), deps, flags.json === true);
    else {
      const intervalMs = integerFlag(flags, "interval-ms", 2000, 250, 30000);
      const timeoutMs = integerFlag(flags, "timeout-ms", 120000, intervalMs, 600000);
      print(await client.waitForResearchJob(jobId, { intervalMs, timeoutMs, signal: deps.signal }), deps, flags.json === true);
    }
    return;
  }
  if (area === "webhooks") {
    const { positionals, flags } = options(rest, ["json", "rotate-secret"]);
    const client = deps.createClient(await keyFrom(deps));
    let result: unknown;
    if (action === "list" || action === "deliveries") {
      knownFlags(flags, ["json"]);
      if (positionals.length) throw new Error(`webhooks ${action} does not accept positional arguments.`);
      result = action === "list" ? await client.listWebhooks({ signal: deps.signal }) : await client.listWebhookDeliveries({ signal: deps.signal });
    } else if (action === "create") {
      knownFlags(flags, ["name", "url", "events", "json"]);
      if (positionals.length || typeof flags.name !== "string" || typeof flags.url !== "string") throw new Error("webhooks create requires --name, --url, and --events.");
      result = await client.createWebhook({ name: flags.name, url: flags.url, events: parseEvents(flags.events) }, { signal: deps.signal });
    } else if (action === "update") {
      knownFlags(flags, ["name", "url", "events", "enabled", "rotate-secret", "json"]);
      const [id] = positionals;
      if (!id || positionals.length !== 1) throw new Error("webhooks update requires exactly one endpoint ID.");
      const input: JsonValue = {};
      if (typeof flags.name === "string") input.name = flags.name;
      if (typeof flags.url === "string") input.url = flags.url;
      if (flags.events !== undefined) input.events = parseEvents(flags.events);
      if (flags.enabled !== undefined) {
        if (flags.enabled !== "true" && flags.enabled !== "false") throw new Error("--enabled must be true or false.");
        input.enabled = flags.enabled === "true";
      }
      if (flags["rotate-secret"] === true) input.rotate_secret = true;
      if (Object.keys(input).length === 0) throw new Error("Provide at least one change to update.");
      result = await client.updateWebhook(id, input, { signal: deps.signal });
    } else if (action === "disable") {
      knownFlags(flags, ["json"]);
      const [id] = positionals;
      if (!id || positionals.length !== 1) throw new Error("webhooks disable requires exactly one endpoint ID.");
      result = await client.disableWebhook(id, { signal: deps.signal });
    } else throw new Error("Unknown webhook command.");
    if (result && typeof result === "object" && "signing_secret" in result && typeof result.signing_secret === "string") {
      deps.stderr.write("Warning: this webhook signing secret is shown once. Copy it to your secret manager now; Tidelight will not show it again.\n");
    }
    print(result, deps, flags.json === true);
    return;
  }
  throw new Error("Unknown command. Run `tidelight --help` for supported commands.");
}

function safeError(error: unknown): string {
  if (error instanceof TidelightApiError) {
    const details = [`${error.status} ${error.code}: ${error.message}`];
    if (error.requestId) details.push(`request ${error.requestId}`);
    if (error.code === "provider_terms_unconfirmed") details.push("Market data is unavailable until provider redistribution terms are confirmed.");
    return details.join(" · ");
  }
  if (error instanceof Error) return error.message;
  return "The command failed.";
}

export async function runCli(argv: string[], deps: CliDependencies): Promise<number> {
  try {
    if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") { deps.stdout.write(HELP); return 0; }
    if (argv[0] === "--version") { deps.stdout.write("0.1.0 (source; unpublished)\n"); return 0; }
    if (argv[0] === "auth") {
      const action = argv[1];
      if (argv.length !== 2) throw new Error("auth takes exactly one action: login, status, or logout.");
      if (action === "login") {
        const key = await deps.promptSecret("Tidelight API key:");
        if (!API_KEY_PATTERN.test(key)) throw new Error("That key does not match a Tidelight test or production key format.");
        deps.credentialStore.set(key);
        deps.stdout.write(deps.env.TIDELIGHT_API_KEY ? "Credential saved in the operating-system keychain. TIDELIGHT_API_KEY still takes precedence for this process.\n" : "Credential saved in the operating-system keychain.\n");
        return 0;
      }
      if (action === "status") {
        if (deps.env.TIDELIGHT_API_KEY) deps.stdout.write("Credential configured via TIDELIGHT_API_KEY for this process. Its validity has not been checked.\n");
        else if (deps.credentialStore.get()) deps.stdout.write("Credential configured in the operating-system keychain. Its validity has not been checked.\n");
        else deps.stdout.write("No credential configured. Run `tidelight auth login` or set TIDELIGHT_API_KEY for this process.\n");
        return 0;
      }
      if (action === "logout") {
        deps.credentialStore.delete();
        deps.stdout.write(deps.env.TIDELIGHT_API_KEY ? "Keychain credential removed. TIDELIGHT_API_KEY remains set for this process.\n" : "Keychain credential removed.\n");
        return 0;
      }
      throw new Error("Unknown auth action. Use login, status, or logout.");
    }
    await runAuthenticated(argv, deps);
    return 0;
  } catch (error) {
    if (error instanceof ResearchPollingError) {
      const accepted = error.accepted as Record<string, unknown>;
      deps.stdout.write(`${JSON.stringify({ accepted, polling_error: { job_id: accepted.job_id, message: safeError(error.cause) } })}\n`);
      deps.stderr.write(`tidelight: research job ${String(accepted.job_id)} was accepted, but polling stopped: ${safeError(error.cause)}\n`);
      return 1;
    }
    deps.stderr.write(`tidelight: ${safeError(error)}\n`);
    return error instanceof TidelightApiError ? 1 : 2;
  }
}

export { HELP as CLI_HELP };
