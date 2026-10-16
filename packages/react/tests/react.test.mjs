import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { TidelightProvider, TokenizedEquityGrid, useResearchJob, useStartCompanyResearch, useTokenizedEquities } from "../dist/index.js";

const instrument = {
  symbol: "RNVDAUSDT", instrument_type: "tokenized_equity_spot", underlying_ticker: "NVDA",
  issuer_name: "Reality Shares", quote_currency: "USDT", last_price: 100, change_24h: null,
  provider_timestamp: null, market_session_status: "available", source: "Bitget Reality spot",
};

test("instrument hook calls the injected client and preserves the real source-labeled response", async () => {
  const calls = [];
  const client = { listTokenizedEquities: async options => { calls.push(options); return { data: [instrument], next_cursor: null, generated_at: 7, request_id: "market-1" }; } };
  let value;
  function Probe() { value = useTokenizedEquities({ underlyingTicker: "NVDA", limit: 12 }); return React.createElement("output", null, value.data?.data[0]?.source ?? "loading"); }
  render(React.createElement(TidelightProvider, { client }, React.createElement(Probe)));
  assert.equal(await screen.findByText("Bitget Reality spot").then(Boolean), true);
  assert.equal(value.isLoading, false);
  assert.equal(value.data.data[0].symbol, "RNVDAUSDT");
  assert.equal(calls[0].underlyingTicker, "NVDA");
  assert.ok(calls[0].signal instanceof AbortSignal);
  cleanup();
});

test("research job polling is opt-in and stops after a terminal result", async () => {
  let reads = 0, value;
  const client = { getResearchJob: async (_id, options) => {
    reads++; assert.ok(options.signal instanceof AbortSignal);
    return { job_id: "job", ticker: "NVDA", status: reads === 1 ? "running" : "complete", attempts: 1, max_attempts: 3, result: null, error: null, created_at: "now", started_at: null, completed_at: null, retry_at: null, request_id: "r" };
  } };
  function Probe() { value = useResearchJob("job", { pollIntervalMs: 5 }); return React.createElement("output", null, value.data?.status ?? "loading"); }
  render(React.createElement(TidelightProvider, { client }, React.createElement(Probe)));
  await waitFor(() => assert.equal(value.data?.status, "complete"));
  assert.equal(reads, 2);
  cleanup();
});

test("research start generates an idempotency key and cancellation uses the returned job id", async () => {
  const calls = [];
  const client = {
    startCompanyResearch: async (...args) => { calls.push(["start", ...args]); return { job_id: "job-1", status: "queued", duplicate: false, request_id: "start-1" }; },
    cancelResearchJob: async (...args) => { calls.push(["cancel", ...args]); return { job_id: "job-1", status: "cancelled", request_id: "cancel-1" }; },
  };
  let value;
  function Probe() { value = useStartCompanyResearch(); return React.createElement("output", null, value.job?.status ?? "idle"); }
  render(React.createElement(TidelightProvider, { client }, React.createElement(Probe)));
  await act(async () => { await value.start("NVDA"); });
  assert.equal(calls[0][0], "start");
  assert.equal(calls[0][1], "NVDA");
  assert.match(calls[0][2], /^[0-9a-f-]{36}$/i);
  await act(async () => { await value.cancel(); });
  assert.deepEqual(calls[1], ["cancel", "job-1"]);
  assert.equal(value.job.status, "cancelled");
  cleanup();
});

test("instrument grid exposes accessible loading, error, empty, and source-backed data states", () => {
  const loading = render(React.createElement(TokenizedEquityGrid, { instruments: [], isLoading: true }));
  assert.equal(loading.container.querySelectorAll(".tidelight-react-card").length, 3);
  cleanup();
  render(React.createElement(TokenizedEquityGrid, { instruments: [] }));
  assert.equal(screen.getByRole("status").textContent.includes("No matching instruments"), true);
  cleanup();
  let retried = false;
  render(React.createElement(TokenizedEquityGrid, { instruments: [], error: "Request failed", onRetry: () => { retried = true; } }));
  assert.equal(screen.getByRole("alert").textContent.includes("Request failed"), true);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  assert.equal(retried, true);
  cleanup();
  render(React.createElement(TokenizedEquityGrid, { instruments: [instrument] }));
  assert.equal(screen.getByRole("heading", { name: "RNVDAUSDT" }).textContent, "RNVDAUSDT");
  assert.equal(screen.getByText("Bitget Reality spot").textContent, "Bitget Reality spot");
  cleanup();
});
