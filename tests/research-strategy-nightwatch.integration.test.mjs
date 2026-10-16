import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const researchId = "d475bd46-5035-4ae5-9f19-e2959a4f0734";
const user = { id: "synthetic-test-user" };
const sourceRows = [
  { title: "Synthetic issuer update one", url: "https://fixture.example/source-a", publisher: "Fixture Journal A", publishedAt: new Date().toISOString(), snippet: "Synthetic test fixture only." },
  { title: "Synthetic issuer update two", url: "https://fixture.example/source-b", publisher: "Fixture Journal B", publishedAt: new Date().toISOString(), snippet: "Synthetic test fixture only." },
];
const captures = { rpc: [], research: [], nightwatch: null, orders: [] };
const candle = (index) => ({ timestamp: Date.now() - (100 - index) * 4 * 60 * 60 * 1000, close: 100 + index / 100, open: 100, high: 101, low: 99, volume: 1000 });
const candles = Array.from({ length: 100 }, (_, index) => candle(index));

function queryFor(table) {
  const query = {
    columns: "",
    select(columns) { this.columns = columns ?? ""; return this; },
    insert(rows) { captures.research.push({ table, operation: "insert", rows }); return this; },
    upsert(rows) { captures.research.push({ table, operation: "upsert", rows }); return this; },
    update(values) { captures.research.push({ table, operation: "update", values }); return this; },
    eq() { return this; }, gte() { return this; }, limit() { return this; },
    single() { return Promise.resolve({ data: { id: researchId }, error: null }); },
    maybeSingle() { return Promise.resolve({ data: table === "research_runs" ? { id: researchId, question: "Synthetic NVDA evidence fixture", summary: { assets: [{ ticker: "NVDA", summary: "Synthetic fixture assessment." }] }, status: "complete" } : table === "nightwatch_preferences" ? { playbook_key: "sma_trend_v1", alert_on_signal: false, alert_on_fill: false } : null, error: null }); },
    then(resolve, reject) {
      const result = table === "research_runs" && this.columns === "id" ? { count: 0, error: null } : { data: [], error: null };
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return query;
}

globalThis.flowTest = {
  auth: { getUser: async () => ({ data: { user }, error: null }) },
  from: queryFor,
  rpc: async (...args) => globalThis.flowTest.admin.rpc(...args),
  asset: async (symbol) => ({ symbol, isReality: true, underlyingTicker: "NVDA", name: "Synthetic NVIDIA fixture", lastPrice: 100, providerTimestamp: Date.now() }),
  perp: async (symbol) => ({ symbol, name: "Synthetic NVDA perpetual fixture", lastPrice: 100, providerTimestamp: Date.now() }),
  candles: async () => candles,
  admin: {
    from: queryFor,
    rpc: async (name, args) => {
      captures.rpc.push({ name, args });
      if (name === "futures_paper_apply") {
        captures.orders.push(args.p_action);
        return { data: { id: "synthetic-paper-decision", action: args.p_action, outcome: "no_action" }, error: null };
      }
      return { data: { run_id: "synthetic-nightwatch-run", outcome: "no_action", reason: "Hold fixture" }, error: null };
    },
  },
};

const modules = {
  "next/server": "export const after=()=>{}; export const NextResponse=class extends Response { static json(data,init={}) { return Response.json(data,init); } };",
  "@/lib/supabase/server": "export const createClient=async()=>globalThis.flowTest;",
  "@/lib/supabase/admin": "export const createAdminClient=()=>globalThis.flowTest.admin;",
  "@/lib/ai-fallback": `export const configuredAiProviders=()=>["fixture"]; export const aiJsonWithFallback=async()=>({assets:[{ticker:"NVDA",summary:"Synthetic fixture: two current independent publishers agree on a directional scenario for test coverage only.",stance:"bullish",confidence:0.9,citedUrls:["${sourceRows[0].url}","${sourceRows[1].url}"],risks:["Synthetic fixture only"],nextCheck:"Remove the fixture after the isolated test."}]});`,
  "@/lib/bitget-market": "export const STOCK_PERP_UNIVERSE=[\"NVDAUSDT\"]; export const getBitgetAsset=(...args)=>globalThis.flowTest.asset(...args); export const getBitgetStockPerp=(...args)=>globalThis.flowTest.perp(...args); export const getBitgetCandles=(...args)=>globalThis.flowTest.candles(...args);",
  "@/lib/backtest": "export const prepareBacktestCandles=()=>Array.from({length:80},(_,i)=>({timestamp:Date.now()-(80-i)*14400000,close:100})); export const buildSignals=()=>Array.from({length:80},(_,i)=>i===79); export const ALPHA_STRATEGIES={sma_trend_v1:{label:\"Synthetic SMA fixture\"}};",
  "@/lib/agent-flow-sources": `export const gatherIssuerEvidence=async()=>${JSON.stringify(sourceRows)};`,
  "@/lib/agentkey-flow-sources": "export const agentKeyIssuerEvidence=async()=>[];",
  "@/lib/futures-paper-agent": "export const decideFuturesPaper=async input=>{globalThis.flowTest.strategyResearch=input.research;return{action:\"hold\",confidence:0.8,rationale:\"Synthetic Strategy fixture hold; no paper fill.\",evidence:[\"Synthetic completed candle\"],risks:[],invalidation:\"Fixture ends\"};};",
  "@/lib/futures-paper-policy": "export const normalizeFuturesProposal=()=>null;",
  "@/lib/nightwatch-signal": "export const evaluateSmaCrossover=()=>({fastSma:101,slowSma:100,previousFastSma:99,previousSlowSma:100});",
  "@/lib/nightwatch-agent": "export const decideNightwatch=async input=>{globalThis.flowTest.nightwatch=input;return{action:\"hold\",signal:\"hold\",confidence:0.9,rationale:\"Synthetic Nightwatch fixture held; no order.\",evidence:[\"Synthetic linked research fixture\"],risks:[],invalidation:\"Fixture ends\",horizon:\"test only\"};};",
  "@/lib/nightwatch-preferences": "export const normalizeNightwatchPreferences=value=>({playbook_key:value.playbook_key??\"sma_trend_v1\"});",
  "@/lib/email/nightwatch": "export const enqueueNightwatchEmail=async()=>{};",
  "@/lib/email/delivery": "export const drainEmailQueue=async()=>{};",
};

const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
  if (modules[specifier]) return { url: `data:text/javascript,${encodeURIComponent(modules[specifier])}`, shortCircuit: true };
  if (specifier.startsWith("@/lib/")) return { url: new URL(`../lib/${specifier.slice(6)}.ts`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const researchRoute = await import("../app/api/research/agent-flow/route.ts");
const strategyRoute = await import("../app/api/futures/paper/route.ts");
const nightwatchRoute = await import("../app/api/nightwatch/tick/route.ts");
hooks.deregister();

test("synthetic positive handoff preserves lineage through Research → paper Strategy → Nightwatch without live execution", async () => {
  const researchResponse = await researchRoute.POST(new Request("https://tidelight.app/api/research/agent-flow", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "Review NVDA using synthetic test fixture sources" }),
  }));
  assert.equal(researchResponse.status, 200);
  const researchEvents = (await researchResponse.text()).split("\n\n").filter(Boolean).map(frame => JSON.parse(frame.split("\ndata: ")[1]));
  const research = researchEvents.findLast(frame => frame.researchRunId);
  assert.ok(research, "research route emitted a saved result");
  assert.equal(research.researchRunId, researchId);
  assert.equal(research.tradeable, true);
  assert.equal(research.assets[0].handoff.destinations[0].mode, "paper_futures");
  assert.match(research.assets[0].handoff.destinations[0].href, new RegExp(`researchRunId=${researchId}`));

  const strategyResponse = await strategyRoute.POST(new Request("https://tidelight.app/api/futures/paper", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symbol: "NVDAUSDT", researchRunId: research.researchRunId, mode: "check" }),
  }));
  assert.equal(strategyResponse.status, 200);
  assert.deepEqual(globalThis.flowTest.strategyResearch, { question: "Synthetic NVDA evidence fixture", summary: { assets: [{ ticker: "NVDA", summary: "Synthetic fixture assessment." }] } });
  const strategyCommit = captures.rpc.find(call => call.name === "futures_paper_apply");
  assert.equal(strategyCommit.args.p_snapshot.researchRunId, researchId);
  assert.equal(strategyCommit.args.p_snapshot.paperOnly, true);
  assert.equal(strategyCommit.args.p_snapshot.marketCategory, "USDT-FUTURES");
  assert.deepEqual(captures.orders, ["hold"]);

  const nightwatchResponse = await nightwatchRoute.POST(new Request("https://tidelight.app/api/nightwatch/tick", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symbol: "RNVDAUSDT", researchRunId: researchId }),
  }));
  assert.equal(nightwatchResponse.status, 200);
  assert.equal(globalThis.flowTest.nightwatch.research.question, "Synthetic NVDA evidence fixture");
  const nightwatchCommit = captures.rpc.find(call => call.name === "nightwatch_tick");
  assert.equal(nightwatchCommit.args.p_snapshot.researchRunId, researchId);
  assert.equal(nightwatchCommit.args.p_signal, "hold");
  assert.deepEqual(captures.orders, ["hold"], "the fixture did not create a paper fill or any live order");
});
