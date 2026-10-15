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
