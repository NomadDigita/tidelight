import "server-only";

export type SecFact = { val: number; end: string; filed: string; form: string; fy?: number; fp?: string; start?: string };
type CompanyFacts = { cik: number; entityName: string; facts: { [taxonomy: string]: Record<string, { label?: string; units?: Record<string, SecFact[]> }> } };
type Submissions = { name: string; sic?: string; sicDescription?: string; exchanges?: string[]; addresses?: { business?: Record<string, string> }; formerNames?: Array<{ name: string; from: string; to: string }> };
type TickerIndex = Record<string, { cik_str: number; ticker: string; title: string }>;

const SEC = "https://data.sec.gov";
const SEC_WEB = "https://www.sec.gov";
const identity = process.env.SEC_USER_AGENT || "Tidelight contact research@tidelight.app";
const requestHeaders = { "User-Agent": identity, Accept: "application/json" };

export class SecIssuerNotFoundError extends Error {
  constructor(ticker: string) {
    super(`No SEC registrant was found for ${ticker}.`);
    this.name = "SecIssuerNotFoundError";
  }
}

async function secJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: requestHeaders, next: { revalidate: 21600 }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`SEC returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export type CompanyResearch = {
  ticker: string;
  cik: string;
  companyName: string;
  industry: string | null;
  exchange: string | null;
  headquarters: string | null;
  website: string | null;
  employeeCount: number | null;
  source: "SEC EDGAR";
  sourceUrl: string;
  retrievedAt: string;
  financials: {
    quarterly: { period: string; periodEnd: string; filed: string; form: string; revenue: number | null; netIncome: number | null; totalAssets: number | null; totalLiabilities: number | null; operatingCashFlow: number | null; capitalExpenditure: number | null }[];
    annual: { period: string; periodEnd: string; filed: string; form: string; revenue: number | null; netIncome: number | null; totalAssets: number | null; totalLiabilities: number | null; operatingCashFlow: number | null; capitalExpenditure: number | null }[];
  };
  dividends: { periodEnd: string; filed: string; amountPerShare: number; unit: string }[];
  analystTargets: { status: "available"; high: number | null; low: number | null; mean: number | null; median: number | null; updatedAt: string; source: "Finnhub" } | { status: "not_configured" } | { status: "unavailable" };
};

async function analystTargets(ticker: string): Promise<CompanyResearch["analystTargets"]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return { status: "not_configured" };
  try {
    const response = await fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(token)}`, { headers: { Accept: "application/json" }, next: { revalidate: 21600 }, signal: AbortSignal.timeout(4500) });
    if (!response.ok) {
      console.warn("finnhub-price-target-http-unavailable", { ticker, status: response.status });
      return { status: "unavailable" };
    }
    const data = await response.json() as { targetHigh?: number; targetLow?: number; targetMean?: number; targetMedian?: number; lastUpdated?: string };
    const values = [data.targetHigh, data.targetLow, data.targetMean, data.targetMedian];
    if (!values.some((value) => typeof value === "number" && Number.isFinite(value) && value > 0)) {
      console.warn("finnhub-price-target-empty", { ticker, fields: Object.keys(data) });
      return { status: "unavailable" };
    }
    return { status: "available", high: data.targetHigh ?? null, low: data.targetLow ?? null, mean: data.targetMean ?? null, median: data.targetMedian ?? null, updatedAt: data.lastUpdated ?? new Date().toISOString(), source: "Finnhub" };
  } catch (error) {
    console.warn("finnhub-price-target-request-failed", { ticker, reason: error instanceof Error ? error.name : "unknown" });
    return { status: "unavailable" };
  }
}

function latestFact(facts: CompanyFacts, tags: string[], unit = "USD"): SecFact[] {
  const gaap = facts.facts["us-gaap"] ?? {};
  for (const tag of tags) {
    const values = gaap[tag]?.units?.[unit];
    if (values?.length) return values;
  }
  return [];
}

function periodValues(facts: CompanyFacts, tags: string[], form: "10-Q" | "10-K", duration: "quarter" | "annual"): Map<string, SecFact> {
  const valid = latestFact(facts, tags).filter((item) => item.form === form && item.start && item.end && item.filed);
  const lengthDays = (item: SecFact) => (Date.parse(`${item.end}T00:00:00Z`) - Date.parse(`${item.start}T00:00:00Z`)) / 86400000;
  const filtered = valid.filter((item) => duration === "quarter" ? lengthDays(item) >= 60 && lengthDays(item) <= 115 : lengthDays(item) >= 300 && lengthDays(item) <= 400);
  const byEnd = new Map<string, SecFact>();
  for (const item of filtered.sort((a, b) => a.filed.localeCompare(b.filed))) byEnd.set(item.end, item);
  return byEnd;
}

function instantValue(facts: CompanyFacts, tags: string[], end: string, form: "10-Q" | "10-K"): SecFact | undefined {
  return latestFact(facts, tags).filter((item) => item.end === end && item.form === form && !item.start).sort((a, b) => b.filed.localeCompare(a.filed))[0];
}

function quarterLabel(end: string) {
  const date = new Date(`${end}T00:00:00Z`);
  return `Q${Math.ceil((date.getUTCMonth() + 1) / 3)} ${date.getUTCFullYear()}`;
}

function buildPeriods(facts: CompanyFacts, duration: "quarter" | "annual") {
  const form = duration === "quarter" ? "10-Q" : "10-K";
  const revenues = periodValues(facts, ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"], form, duration);
  const income = periodValues(facts, ["NetIncomeLoss"], form, duration);
  const cash = periodValues(facts, ["NetCashProvidedByUsedInOperatingActivities"], form, duration);
  const capex = periodValues(facts, ["PaymentsToAcquirePropertyPlantAndEquipment"], form, duration);
  const ends = [...new Set([...revenues.keys(), ...income.keys(), ...cash.keys(), ...capex.keys()])].sort().reverse().slice(0, duration === "quarter" ? 16 : 10);
  return ends.map((end) => {
    const basis = revenues.get(end) ?? income.get(end) ?? cash.get(end) ?? capex.get(end);
    const formForInstant: "10-Q" | "10-K" = basis?.form === "10-K" ? "10-K" : basis?.form === "10-Q" ? "10-Q" : form;
    return {
      period: duration === "quarter" ? quarterLabel(end) : `FY ${new Date(`${end}T00:00:00Z`).getUTCFullYear()}`,
      periodEnd: end,
      filed: basis?.filed ?? "",
      form: formForInstant,
      revenue: revenues.get(end)?.val ?? null,
      netIncome: income.get(end)?.val ?? null,
      totalAssets: instantValue(facts, ["Assets"], end, formForInstant)?.val ?? null,
      totalLiabilities: instantValue(facts, ["Liabilities"], end, formForInstant)?.val ?? null,
      operatingCashFlow: cash.get(end)?.val ?? null,
      capitalExpenditure: capex.get(end)?.val ?? null,
    };
  });
}

export async function getSecCompanyResearch(ticker: string, website: string | null): Promise<CompanyResearch> {
  const normalized = ticker.toUpperCase();
  const index = await secJson<TickerIndex>(`${SEC_WEB}/files/company_tickers.json`);
  const match = Object.values(index).find((item) => item.ticker.toUpperCase() === normalized);
  if (!match) throw new SecIssuerNotFoundError(normalized);
  const cik = String(match.cik_str).padStart(10, "0");
  const [submissions, companyfacts] = await Promise.all([
    secJson<Submissions>(`${SEC}/submissions/CIK${cik}.json`),
    secJson<CompanyFacts>(`${SEC}/api/xbrl/companyfacts/CIK${cik}.json`),
  ]);
  const address = submissions.addresses?.business;
  const headquarters = address ? [address.street1, address.street2, [address.city, address.stateOrCountry, address.zipCode].filter(Boolean).join(" ")].filter(Boolean).join(", ") : null;
  const facts = companyfacts.facts["dei"]?.EntityNumberOfEmployees?.units?.pure ?? [];
  const employeeCount = facts.sort((a, b) => b.end.localeCompare(a.end))[0]?.val ?? null;
  const dividends = latestFact(companyfacts, ["CommonStockDividendsPerShareCashPaid", "CommonStockDividendsPerShareDeclared"], "USD / shares")
    .filter((item) => ["10-Q", "10-K"].includes(item.form) && item.end && item.filed)
    .sort((a, b) => b.end.localeCompare(a.end)).slice(0, 12)
    .map((item) => ({ periodEnd: item.end, filed: item.filed, amountPerShare: item.val, unit: "USD per share as reported" }));
  const targetData = await analystTargets(normalized);
  return {
    ticker: normalized, cik, companyName: submissions.name || companyfacts.entityName,
    industry: submissions.sicDescription ?? null, exchange: submissions.exchanges?.[0] ?? null,
    headquarters, website, employeeCount, source: "SEC EDGAR",
    sourceUrl: `https://www.sec.gov/edgar/browse/?CIK=${Number(cik)}`,
    retrievedAt: new Date().toISOString(),
    financials: { quarterly: buildPeriods(companyfacts, "quarter"), annual: buildPeriods(companyfacts, "annual") },
    dividends,
    analystTargets: targetData,
  };
}
