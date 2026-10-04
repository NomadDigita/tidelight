export type BitgetEnvelope<T> = { code: string; msg?: string; requestTime?: number; data: T };

export type BitgetInstrument = {
  symbol: string;
  category: string;
  baseCoin: string;
  quoteCoin: string;
  status?: string;
  isRwa?: string;
  isReality?: string;
  symbolType?: string;
  pricePrecision?: string;
  quantityPrecision?: string;
};

export type BitgetTicker = {
  symbol: string;
  category: string;
  lastPrice: string;
  openPrice24h?: string;
  highPrice24h?: string;
  lowPrice24h?: string;
  price24hPcnt?: string;
  volume24h?: string;
  turnover24h?: string;
  platformTurnover24h?: string;
  ts?: string;
};

export type RealityStockInfo = {
  symbol: string;
  code: string;
  name: string;
  tradingPeriod?: string[] | string;
  weekendTradable?: string;
};

export type MarketAsset = {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  name: string;
  underlyingTicker: string | null;
  kind: "rtoken" | "rwa" | "crypto";
  isReality: boolean;
  isRwa: boolean;
  weekendTradable: boolean | null;
  tradingSessions: string[];
  lastPrice: number;
  change24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  turnover24h: number | null;
  providerTimestamp: number | null;
  logoUrl: string | null;
};

const API = "https://api.bitget.com/api/v3";
const companyDomains: Record<string, string> = {
  AAPL: "apple.com", MSFT: "microsoft.com", NVDA: "nvidia.com", AMZN: "amazon.com", GOOGL: "google.com",
  GOOG: "google.com", META: "meta.com", TSLA: "tesla.com", AMD: "amd.com", NFLX: "netflix.com",
  AVGO: "broadcom.com", ORCL: "oracle.com", INTC: "intel.com", JPM: "jpmorganchase.com", WMT: "walmart.com",
  DIS: "thewaltdisneycompany.com", COIN: "coinbase.com", PLTR: "palantir.com", MSTR: "strategy.com", XOM: "exxonmobil.com",
  COST: "costco.com", CRM: "salesforce.com", QCOM: "qualcomm.com", BA: "boeing.com", UBER: "uber.com",
};

async function fetchBitget<T>(path: string, revalidate: number): Promise<BitgetEnvelope<T>> {
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Bitget returned HTTP ${response.status}`);
  const body = (await response.json()) as BitgetEnvelope<T>;
  if (body.code !== "00000" || !Array.isArray(body.data)) throw new Error(`Bitget market response ${body.code ?? "invalid"}`);
  return body;
}

function numberOrNull(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getLogo(baseCoin: string, underlyingTicker: string | null): string | null {
  if (underlyingTicker && companyDomains[underlyingTicker]) {
    return `https://www.google.com/s2/favicons?domain=${companyDomains[underlyingTicker]}&sz=128`;
  }
  const coin = baseCoin.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (coin && coin.length <= 16) return `https://assets.coincap.io/assets/icons/${coin}@2x.png`;
  return null;
}

export async function getBitgetMarketUniverse() {
  const [instrumentsResult, tickersResult, stockInfoResult, sessionsResult] = await Promise.allSettled([
    fetchBitget<BitgetInstrument[]>("/market/instruments?category=SPOT", 1800),
    fetchBitget<BitgetTicker[]>("/market/tickers?category=SPOT", 12),
    fetchBitget<RealityStockInfo[]>("/reality/market/stock-info", 3600),
    fetchBitget<Array<{ market: string; daylightType?: string; stateList?: Array<{ state: string; timeZone: string; startTime: string; endTime: string }> }>>("/reality/market/states", 30),
  ]);
  if (instrumentsResult.status === "rejected") throw instrumentsResult.reason;
  if (tickersResult.status === "rejected") throw tickersResult.reason;
  const instruments = instrumentsResult.value.data;
  const tickers = tickersResult.value.data;
  const stocks = stockInfoResult.status === "fulfilled" ? stockInfoResult.value.data : [];
  const session = sessionsResult.status === "fulfilled" ? sessionsResult.value.data.find((item) => item.market === "US") ?? null : null;
  const stockByPair = new Map(stocks.map((stock) => [stock.symbol.toUpperCase(), stock]));
  const tickerByPair = new Map(tickers.map((ticker) => [ticker.symbol.toUpperCase(), ticker]));
  const assets = instruments
    .filter((instrument) => instrument.category === "SPOT" && instrument.quoteCoin === "USDT" && (!instrument.status || instrument.status === "online"))
    .flatMap((instrument): MarketAsset[] => {
      const ticker = tickerByPair.get(instrument.symbol.toUpperCase());
      if (!ticker) return [];
      const reality = instrument.isReality?.toLowerCase() === "yes";
      const rwa = instrument.isRwa?.toLowerCase() === "yes";
      const stock = reality ? stockByPair.get(instrument.symbol.toUpperCase()) : undefined;
      const underlyingTicker = stock?.code?.toUpperCase() ?? null;
      const lastPrice = numberOrNull(ticker.lastPrice);
      if (lastPrice === null) return [];
      const sessions = Array.isArray(stock?.tradingPeriod) ? stock.tradingPeriod : stock?.tradingPeriod ? [stock.tradingPeriod] : [];
      return [{
        symbol: instrument.symbol,
        baseCoin: instrument.baseCoin,
        quoteCoin: instrument.quoteCoin,
        name: stock?.name ?? instrument.baseCoin,
        underlyingTicker,
        kind: reality ? "rtoken" : rwa ? "rwa" : "crypto",
        isReality: reality,
        isRwa: rwa,
        weekendTradable: stock ? stock.weekendTradable?.toLowerCase() === "yes" : null,
        tradingSessions: sessions,
        lastPrice,
        change24h: numberOrNull(ticker.price24hPcnt),
        high24h: numberOrNull(ticker.highPrice24h),
        low24h: numberOrNull(ticker.lowPrice24h),
        volume24h: numberOrNull(ticker.volume24h),
        turnover24h: numberOrNull(ticker.turnover24h),
        providerTimestamp: numberOrNull(ticker.ts),
        logoUrl: getLogo(instrument.baseCoin, underlyingTicker),
      }];
    })
    .sort((left, right) => Number(right.isReality) - Number(left.isReality) || (right.turnover24h ?? 0) - (left.turnover24h ?? 0));

  return {
    provider: "Bitget",
    source: `${API}/market/tickers?category=SPOT`,
    generatedAt: Date.now(),
    assets,
    session: session ? { market: session.market, daylightType: session.daylightType ?? null, schedule: session.stateList ?? [] } : null,
    coverage: { total: assets.length, rTokens: assets.filter((asset) => asset.isReality).length, rwa: assets.filter((asset) => asset.isRwa).length, crypto: assets.filter((asset) => asset.kind === "crypto").length },
    staleAfterMs: 120_000,
    metadataStatus: stockInfoResult.status === "fulfilled" ? "available" : "partial",
  };
}
