export type TokenizedEquityInstrument = {
  symbol: string;
  instrument_type: "tokenized_equity_spot";
  underlying_ticker: string;
  issuer_name: string;
  quote_currency: string;
  last_price: number;
  change_24h: number | null;
  provider_timestamp: number | null;
  market_session_status: "available" | "unavailable";
  source: "Bitget Reality spot";
};

export type InstrumentPage = {
  data: TokenizedEquityInstrument[];
  next_cursor: string | null;
  generated_at: number;
  request_id: string;
};

export type ResearchJobStatus = "queued" | "running" | "retry_wait" | "complete" | "failed" | "cancelled";
export type ResearchJob = {
  job_id: string;
  ticker: string;
  status: ResearchJobStatus;
  attempts: number;
  max_attempts: number;
  result: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  retry_at: string | null;
  request_id: string;
};

export type WebhookEvent = "research.job.completed" | "research.job.failed";
export type WebhookEndpoint = { id: string; project_id: string; organization_id: string; name: string; url: string; events: WebhookEvent[]; enabled: boolean; created_at: string; updated_at: string };
export type WebhookDelivery = { id: string; endpoint_id: string; project_id: string; event_id: string; event_type: WebhookEvent; payload: Record<string, unknown>; status: "pending" | "sending" | "retry_wait" | "succeeded" | "failed" | "cancelled"; attempt_count: number; last_status_code: number | null; last_error_code: string | null; last_duration_ms: number | null; created_at: string; completed_at: string | null; endpoint_name: string; tic_webhook_delivery_attempts: Array<{ attempt_number: number; status_code: number | null; duration_ms: number | null; error_code: string | null; created_at: string }> };
export type WebhookMutationResponse = { endpoint: WebhookEndpoint; signing_secret?: string; request_id: string };
export type WebhookEndpointInput = { name: string; url: string; events: WebhookEvent[] };
export type WebhookEndpointUpdate = { name?: string; url?: string; events?: WebhookEvent[]; enabled?: boolean; rotate_secret?: true };

export class TidelightApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  constructor(status: number, code: string, message: string, requestId: string | null) {
    super(message);
    this.name = "TidelightApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

type Fetch = typeof fetch;
export type TidelightClientOptions = { apiKey: string; baseUrl?: string; timeoutMs?: number; maxRetries?: number; fetch?: Fetch };
const DEFAULT_URL = "https://api.tidelight.app/v1";

export class TidelightClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly transport: Fetch;

  constructor(options: TidelightClientOptions) {
    if (!/^tl_(test|live)_[A-Za-z0-9_-]{43}$/.test(options.apiKey)) throw new TypeError("A valid Tidelight API key is required.");
    const base = new URL(options.baseUrl ?? DEFAULT_URL);
    if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) throw new TypeError("The API URL must use HTTPS.");
    if (base.username || base.password || base.search || base.hash) throw new TypeError("The API URL cannot contain credentials, query, or fragment.");
    if (!Number.isInteger(options.timeoutMs ?? 10000) || (options.timeoutMs ?? 10000) < 100 || (options.timeoutMs ?? 10000) > 120000) throw new TypeError("timeoutMs must be 100 to 120000.");
    if (!Number.isInteger(options.maxRetries ?? 2) || (options.maxRetries ?? 2) < 0 || (options.maxRetries ?? 2) > 5) throw new TypeError("maxRetries must be 0 to 5.");
    this.apiKey = options.apiKey;
    this.baseUrl = base.toString().replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.maxRetries = options.maxRetries ?? 2;
    this.transport = options.fetch ?? fetch;
  }

  async listTokenizedEquities(options: { limit?: number; cursor?: string; signal?: AbortSignal } = {}): Promise<InstrumentPage> {
    const limit = options.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError("limit must be 1 to 100.");
    if (options.cursor !== undefined && !/^[A-Z0-9]{2,32}$/.test(options.cursor)) throw new TypeError("Invalid instrument cursor.");
    const url = new URL(`${this.baseUrl}/market/instruments`);
    url.searchParams.set("kind", "rtoken");
    url.searchParams.set("limit", String(limit));
    if (options.cursor) url.searchParams.set("cursor", options.cursor);
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      options.signal?.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let response: Response;
      let payload: unknown = null;
      try {
        response = await this.transport(url, { headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" }, signal: controller.signal });
        try { payload = await response.json(); } catch { payload = null; }
      } catch (error) {
        if (options.signal?.aborted) throw error;
        if (attempt >= this.maxRetries) throw new TidelightApiError(0, "network_error", "The Tidelight API could not be reached.", null);
        await this.pause(attempt, undefined, options.signal);
        continue;
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
      }
      if (response.ok) {
        if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) throw new TidelightApiError(response.status, "invalid_response", "The Tidelight API returned an invalid response.", response.headers.get("x-request-id"));
        return payload as InstrumentPage;
      }
      const detail = payload && typeof payload === "object" && "error" in payload && payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : {};
      if ([429, 502, 503, 504].includes(response.status) && attempt < this.maxRetries) {
        await this.pause(attempt, response.headers.get("retry-after"), options.signal);
        continue;
      }
      throw new TidelightApiError(response.status, typeof detail.code === "string" ? detail.code : "api_error", typeof detail.message === "string" ? detail.message : "Tidelight API request failed.", typeof detail.request_id === "string" ? detail.request_id : response.headers.get("x-request-id"));
    }
  }

  async startCompanyResearch(ticker: string, idempotencyKey: string, options: { signal?: AbortSignal } = {}) {
    if (!/^[A-Za-z][A-Za-z0-9.]{0,9}$/.test(ticker)) throw new TypeError("ticker must be a supported stock symbol.");
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) throw new TypeError("idempotencyKey must be 8 to 128 valid characters.");
    return this.jobRequest<{ job_id: string; status: ResearchJobStatus; duplicate: boolean; request_id: string }>("/research/jobs", "POST", { ticker }, idempotencyKey, options.signal);
  }

  async getResearchJob(jobId: string, options: { signal?: AbortSignal } = {}): Promise<ResearchJob> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) throw new TypeError("Invalid research job ID.");
    return this.jobRequest<ResearchJob>(`/research/jobs/${jobId}`, "GET", undefined, undefined, options.signal);
  }

  async cancelResearchJob(jobId: string, options: { signal?: AbortSignal } = {}) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) throw new TypeError("Invalid research job ID.");
    return this.jobRequest<{ job_id: string; status: string; request_id: string }>(`/research/jobs/${jobId}`, "DELETE", undefined, undefined, options.signal);
  }

  async waitForResearchJob(jobId: string, options: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<ResearchJob> {
    const intervalMs = options.intervalMs ?? 2000, timeoutMs = options.timeoutMs ?? 120000;
    if (!Number.isInteger(intervalMs) || intervalMs < 250 || intervalMs > 30000 || !Number.isInteger(timeoutMs) || timeoutMs < intervalMs || timeoutMs > 600000) throw new RangeError("Polling interval or timeout is out of range.");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const job = await this.getResearchJob(jobId, options);
      if (["complete", "failed", "cancelled"].includes(job.status)) return job;
      await new Promise<void>((resolve, reject) => {
        const done = () => { options.signal?.removeEventListener("abort", abort); resolve(); };
        const timer = setTimeout(done, Math.min(intervalMs, deadline - Date.now()));
        const abort = () => { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); reject(options.signal?.reason); };
        if (options.signal?.aborted) abort(); else options.signal?.addEventListener("abort", abort, { once: true });
      });
    }
    throw new TidelightApiError(0, "poll_timeout", "The research job did not finish before the polling timeout.", null);
  }

  async listWebhooks(options: { signal?: AbortSignal } = {}) {
    return this.jobRequest<{ endpoints: WebhookEndpoint[]; request_id: string }>("/webhooks", "GET", undefined, undefined, options.signal);
  }

  async createWebhook(input: WebhookEndpointInput, options: { signal?: AbortSignal } = {}) {
    this.validateWebhookInput(input);
    return this.jobRequest<WebhookMutationResponse>("/webhooks", "POST", input, undefined, options.signal, false);
  }

  async updateWebhook(endpointId: string, input: WebhookEndpointUpdate, options: { signal?: AbortSignal } = {}) {
    this.validateWebhookId(endpointId);
    this.validateWebhookUpdate(input);
    return this.jobRequest<WebhookMutationResponse>("/webhooks/" + endpointId, "PATCH", input, undefined, options.signal, false);
  }

  async disableWebhook(endpointId: string, options: { signal?: AbortSignal } = {}) {
    this.validateWebhookId(endpointId);
    return this.jobRequest<{ disabled: true; request_id: string }>("/webhooks/" + endpointId, "DELETE", undefined, undefined, options.signal, false);
  }

  async listWebhookDeliveries(options: { signal?: AbortSignal } = {}) {
    return this.jobRequest<{ deliveries: WebhookDelivery[]; request_id: string }>("/webhooks/deliveries", "GET", undefined, undefined, options.signal);
  }

  private validateWebhookId(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new TypeError("Invalid webhook endpoint ID.");
  }

  private validateWebhookUrl(value: string) {
    let url: URL;
    try { url = new URL(value); } catch { throw new TypeError("Webhook URL must be a valid public HTTPS URL."); }
    if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password || url.search || url.hash || value.length > 2048) throw new TypeError("Webhook URL must use public HTTPS on port 443 without credentials, query, or fragment.");
  }

  private validateWebhookEvents(events: WebhookEvent[]) {
    if (!Array.isArray(events) || events.length < 1 || events.length > 2 || new Set(events).size !== events.length || events.some(event => !["research.job.completed", "research.job.failed"].includes(event))) throw new TypeError("Choose one or more supported webhook events.");
  }

  private validateWebhookInput(input: WebhookEndpointInput) {
    if (!input || typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 80) throw new TypeError("Webhook name must be 2 to 80 characters.");
    this.validateWebhookUrl(input.url);
    this.validateWebhookEvents(input.events);
  }

  private validateWebhookUpdate(input: WebhookEndpointUpdate) {
    if (!input || typeof input !== "object" || Object.keys(input).length === 0 || Object.keys(input).some(key => !["name", "url", "events", "enabled", "rotate_secret"].includes(key))) throw new TypeError("Provide at least one supported webhook change.");
    if (input.name !== undefined && (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 80)) throw new TypeError("Webhook name must be 2 to 80 characters.");
    if (input.url !== undefined) this.validateWebhookUrl(input.url);
    if (input.events !== undefined) this.validateWebhookEvents(input.events);
    if (input.enabled !== undefined && typeof input.enabled !== "boolean") throw new TypeError("enabled must be a boolean.");
    if (input.rotate_secret !== undefined && input.rotate_secret !== true) throw new TypeError("rotate_secret can only be true.");
  }

  private async jobRequest<T>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown, idempotencyKey?: string, signal?: AbortSignal, retrySafe = true): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const retryLimit = retrySafe ? this.maxRetries : 0;
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController(); const abort = () => controller.abort(signal?.reason);
      const timer = setTimeout(() => controller.abort(), this.timeoutMs); signal?.addEventListener("abort", abort, { once: true });
      let response: Response; let payload: unknown;
      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" };
        if (body) headers["Content-Type"] = "application/json";
        if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
        response = await this.transport(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
        try { payload = await response.json(); } catch { payload = null; }
      } catch (error) {
        if (signal?.aborted) throw error;
        if (attempt >= retryLimit) throw new TidelightApiError(0, "network_error", "The Tidelight API could not be reached.", null);
        await this.pause(attempt, undefined, signal); continue;
      } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
      if (response.ok && payload && typeof payload === "object") return payload as T;
      const detail = payload && typeof payload === "object" && "error" in payload && payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : {};
      if ([429, 502, 503, 504].includes(response.status) && attempt < retryLimit) { await this.pause(attempt, response.headers.get("retry-after"), signal); continue; }
      if (response.ok) throw new TidelightApiError(response.status, "invalid_response", "The Tidelight API returned an invalid response.", response.headers.get("x-request-id"));
      throw new TidelightApiError(response.status, typeof detail.code === "string" ? detail.code : "api_error", typeof detail.message === "string" ? detail.message : "Tidelight API request failed.", typeof detail.request_id === "string" ? detail.request_id : response.headers.get("x-request-id"));
    }
  }

  async *tokenizedEquities(options: { limit?: number; signal?: AbortSignal } = {}): AsyncGenerator<TokenizedEquityInstrument> {
    let cursor: string | undefined;
    do {
      const page = await this.listTokenizedEquities({ ...options, cursor });
      yield* page.data;
      if (page.next_cursor === cursor) throw new TidelightApiError(0, "invalid_response", "The API returned a repeated pagination cursor.", page.request_id);
      cursor = page.next_cursor ?? undefined;
    } while (cursor);
  }

  private async pause(attempt: number, retryAfter: string | undefined | null, signal?: AbortSignal) {
    const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null;
    const delay = seconds === null ? Math.min(2000, 250 * 2 ** attempt) : Math.min(5000, seconds * 1000);
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) { reject(signal.reason); return; }
      const timer = setTimeout(done, delay);
      function done() { signal?.removeEventListener("abort", abort); resolve(); }
      function abort() { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(signal?.reason); }
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
}
