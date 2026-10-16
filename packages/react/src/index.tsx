import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { InstrumentPage, ResearchJob, TidelightClient, TokenizedEquityInstrument } from "@tidelight/sdk";

export type TidelightReactClient = Pick<TidelightClient, "listTokenizedEquities" | "startCompanyResearch" | "getResearchJob" | "cancelResearchJob">;
export type TokenizedEquityQuery = { limit?: number; cursor?: string; underlyingTicker?: string };
export type AsyncValue<T> = { data: T | null; isLoading: boolean; error: Error | null; refresh: () => void };
type AsyncResult<T> = { key: string; data: T | null; error: Error | null };

const TidelightContext = createContext<TidelightReactClient | null>(null);

export function TidelightProvider({ client, children }: { client: TidelightReactClient; children: ReactNode }) {
  return createElement(TidelightContext.Provider, { value: client }, children);
}

export function useTidelightClient(): TidelightReactClient {
  const client = useContext(TidelightContext);
  if (!client) throw new Error("useTidelightClient must be used inside TidelightProvider.");
  return client;
}

function asError(value: unknown) {
  return value instanceof Error ? value : new Error("Tidelight could not complete this request.");
}

export function useTokenizedEquities(query: TokenizedEquityQuery = {}): AsyncValue<InstrumentPage> {
  const client = useTidelightClient();
  const { limit, cursor, underlyingTicker } = query;
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [result, setResult] = useState<AsyncResult<InstrumentPage>>({ key: "", data: null, error: null });
  const refresh = useCallback(() => setRefreshIndex(index => index + 1), []);
  const requestKey = JSON.stringify([limit ?? 20, cursor ?? null, underlyingTicker?.toUpperCase() ?? null, refreshIndex]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    client.listTokenizedEquities({ limit, cursor, underlyingTicker, signal: controller.signal }).then(
      data => { if (active) setResult({ key: requestKey, data, error: null }); },
      error => { if (active && !controller.signal.aborted) setResult(previous => ({ key: requestKey, data: previous.data, error: asError(error) })); },
    );
    return () => { active = false; controller.abort(); };
  }, [client, limit, cursor, underlyingTicker, requestKey]);

  return { data: result.data, isLoading: result.key !== requestKey, error: result.key === requestKey ? result.error : null, refresh };
}

export function useResearchJob(jobId: string | null, options: { pollIntervalMs?: number } = {}): AsyncValue<ResearchJob> {
  const client = useTidelightClient();
  const pollIntervalMs = options.pollIntervalMs ?? 0;
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [result, setResult] = useState<AsyncResult<ResearchJob>>({ key: "", data: null, error: null });
  const refresh = useCallback(() => setRefreshIndex(index => index + 1), []);
  const validPollInterval = Number.isInteger(pollIntervalMs) && pollIntervalMs >= 0 && pollIntervalMs <= 30000;
  const requestKey = JSON.stringify([jobId, pollIntervalMs, refreshIndex]);

  useEffect(() => {
    if (!jobId || !validPollInterval) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const read = async () => {
      try {
        const data = await client.getResearchJob(jobId, { signal: controller.signal });
        if (!active) return;
        setResult({ key: requestKey, data, error: null });
        if (pollIntervalMs > 0 && !["complete", "failed", "cancelled"].includes(data.status)) timer = setTimeout(read, pollIntervalMs);
      } catch (error) {
        if (active && !controller.signal.aborted) setResult(previous => ({ key: requestKey, data: previous.data, error: asError(error) }));
      }
    };
    void read();
    return () => { active = false; controller.abort(); if (timer) clearTimeout(timer); };
  }, [client, jobId, pollIntervalMs, validPollInterval, requestKey]);
  const error = !validPollInterval ? new RangeError("pollIntervalMs must be between 0 and 30000.") : result.key === requestKey ? result.error : null;
  return { data: jobId && result.key === requestKey ? result.data : null, isLoading: Boolean(jobId && validPollInterval && result.key !== requestKey), error, refresh };
}

export function useStartCompanyResearch() {
  const client = useTidelightClient();
  const [job, setJob] = useState<{ job_id: string; status: string; duplicate: boolean; request_id: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const start = useCallback(async (ticker: string, idempotencyKey = globalThis.crypto.randomUUID()) => {
    setIsLoading(true); setError(null);
    try { const result = await client.startCompanyResearch(ticker, idempotencyKey); setJob(result); return result; }
    catch (value) { const failure = asError(value); setError(failure); throw failure; }
    finally { setIsLoading(false); }
  }, [client]);
  const cancel = useCallback(async () => {
    if (!job) return null;
    setIsLoading(true); setError(null);
    try { const result = await client.cancelResearchJob(job.job_id); setJob(current => current ? { ...current, status: result.status } : current); return result; }
    catch (value) { const failure = asError(value); setError(failure); throw failure; }
    finally { setIsLoading(false); }
  }, [client, job]);
  return { job, isLoading, error, start, cancel };
}

export function TokenizedEquityGrid({ instruments, isLoading = false, error, onRetry }: {
  instruments: readonly TokenizedEquityInstrument[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  if (isLoading) return <div className="tidelight-react-grid" aria-busy="true" aria-label="Loading tokenized equity instruments">
    {Array.from({ length: 3 }, (_, index) => <div className="tidelight-react-card is-loading" aria-hidden="true" key={index}/>)}</div>;
  if (error) return <div className="tidelight-react-state" role="alert"><strong>Instruments could not be loaded.</strong><span>{error}</span>{onRetry && <button type="button" onClick={onRetry}>Try again</button>}</div>;
  if (instruments.length === 0) return <div className="tidelight-react-state" role="status"><strong>No matching instruments</strong><span>Tidelight returned no supported instruments for this query.</span></div>;
  return <div className="tidelight-react-grid" aria-label="Tidelight tokenized equity instruments">{instruments.map(item => <article className="tidelight-react-card" key={item.symbol}>
    <div className="tidelight-react-card-top"><span>{item.underlying_ticker}</span><span>{item.market_session_status}</span></div>
    <h3>{item.symbol}</h3><p>{item.issuer_name}</p><footer><span>{item.instrument_type.replaceAll("_", " ")}</span><span>{item.source}</span></footer>
  </article>)}</div>;
}
