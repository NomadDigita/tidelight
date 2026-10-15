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
const DEFAULT_URL = "https://tidelight.app/api/v1";

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

  private async jobRequest<T>(path: string, method: "GET" | "POST" | "DELETE", body?: unknown, idempotencyKey?: string, signal?: AbortSignal): Promise<T> {
    const url = `${this.baseUrl}${path}`;
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
        if (attempt >= this.maxRetries) throw new TidelightApiError(0, "network_error", "The Tidelight API could not be reached.", null);
        await this.pause(attempt, undefined, signal); continue;
      } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
      if (response.ok && payload && typeof payload === "object") return payload as T;
      const detail = payload && typeof payload === "object" && "error" in payload && payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : {};
      if ([429, 502, 503, 504].includes(response.status) && attempt < this.maxRetries) { await this.pause(attempt, response.headers.get("retry-after"), signal); continue; }
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
