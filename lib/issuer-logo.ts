const issuerDomains: Record<string, string> = {
  AAPL: "apple.com", MSFT: "microsoft.com", NVDA: "nvidia.com", AMZN: "amazon.com", GOOGL: "google.com", GOOG: "google.com",
  META: "meta.com", TSLA: "tesla.com", AMD: "amd.com", NFLX: "netflix.com", AVGO: "broadcom.com", ORCL: "oracle.com",
  INTC: "intel.com", JPM: "jpmorganchase.com", WMT: "walmart.com", DIS: "thewaltdisneycompany.com", COIN: "coinbase.com",
  PLTR: "palantir.com", MSTR: "strategy.com", COST: "costco.com", CRM: "salesforce.com", QCOM: "qualcomm.com", BA: "boeing.com",
  UBER: "uber.com", HYG: "ishares.com", LQD: "ishares.com", IVV: "ishares.com", MUB: "ishares.com", IDEV: "ishares.com",
  VTEB: "vanguard.com", IEFA: "ishares.com", EWZ: "ishares.com", SOXL: "direxion.com",
  QRVO: "qorvo.com", SPY: "ssga.com",
};

function normalize(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function realityPairTicker(value: string) {
  const normalized = normalize(value);
  if (normalized.endsWith("USDT")) return normalized.slice(0, -4).replace(/^R(?=[A-Z])/, "");
  return normalized.replace(/^R(?=[A-Z])/, "");
}

export function issuerLogoUrl(values: { symbol?: string; baseCoin?: string; name?: string; underlyingTicker?: string | null }) {
  const candidates = [values.underlyingTicker ?? "", values.symbol ?? "", values.baseCoin ?? ""];
  const ticker = candidates.flatMap((value) => [normalize(value), realityPairTicker(value)]).find((value) => issuerDomains[value]) ??
    (values.name?.toLowerCase().includes("ishares") ? "HYG" : values.name?.toLowerCase().includes("vanguard") ? "VTEB" : null);
  const domain = ticker ? issuerDomains[ticker] : null;
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
}
