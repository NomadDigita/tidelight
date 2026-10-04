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

export type CandleInterval = "1H" | "4H" | "1D";
export type MarketCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  turnover: number | null;
};

const API = "https://api.bitget.com/api/v3";
const companyDomains: Record<string, string> = {
  AAPL: "apple.com", MSFT: "microsoft.com", NVDA: "nvidia.com", AMZN: "amazon.com", GOOGL: "google.com",
  GOOG: "google.com", META: "meta.com", TSLA: "tesla.com", AMD: "amd.com", NFLX: "netflix.com",
  AVGO: "broadcom.com", ORCL: "oracle.com", INTC: "intel.com", JPM: "jpmorganchase.com", WMT: "walmart.com",
  DIS: "thewaltdisneycompany.com", COIN: "coinbase.com", PLTR: "palantir.com", MSTR: "strategy.com", XOM: "exxonmobil.com",
  COST: "costco.com", CRM: "salesforce.com", QCOM: "qualcomm.com", BA: "boeing.com", UBER: "uber.com",
  ABBV: "abbvie.com", ABT: "abbott.com", ACN: "accenture.com", ADBE: "adobe.com", ADI: "analog.com",
  ADP: "adp.com", AMAT: "appliedmaterials.com", AMGN: "amgen.com", AMT: "americantower.com", ARM: "arm.com",
  ASML: "asml.com", BAC: "bankofamerica.com", BABA: "alibabagroup.com", BKNG: "bookingholdings.com", BMY: "bms.com",
  C: "citigroup.com", CAT: "caterpillar.com", CHTR: "charter.com", CL: "colgatepalmolive.com", CMCSA: "comcast.com",
  COP: "conocophillips.com", CVS: "cvshealth.com", CVX: "chevron.com", DE: "deere.com", DELL: "dell.com",
  GE: "ge.com", GILD: "gilead.com", GS: "goldmansachs.com", HD: "homedepot.com", HON: "honeywell.com",
  IBM: "ibm.com", JNJ: "jnj.com", KO: "coca-cola.com", LIN: "linde.com", LLY: "lilly.com",
  LMT: "lockheedmartin.com", LOW: "lowes.com", MA: "mastercard.com", MCD: "mcdonalds.com", MDT: "medtronic.com",
  MRK: "merck.com", MS: "morganstanley.com", MU: "micron.com", NKE: "nike.com", NOW: "servicenow.com",
  PEP: "pepsico.com", PFE: "pfizer.com", PG: "pg.com", PM: "pmi.com", RTX: "rtx.com",
  SBUX: "starbucks.com", SCHW: "schwab.com", SIEGY: "siemens.com", SO: "southerncompany.com", T: "att.com",
  TMO: "thermofisher.com", TMUS: "t-mobile.com", TSM: "tsmc.com", V: "visa.com", VZ: "verizon.com",
  UPS: "ups.com", UNH: "unitedhealthgroup.com", WFC: "wellsfargo.com", WBD: "wbd.com",
  AXP: "americanexpress.com", BX: "blackstone.com", CEG: "constellationenergy.com", CRWD: "crowdstrike.com",
  PANW: "paloaltonetworks.com", SHOP: "shopify.com", SPOT: "spotify.com",
};

const issuerNames: Record<string, string> = {
  AAPL: "Apple Inc.", MSFT: "Microsoft Corporation", NVDA: "NVIDIA Corporation", AMZN: "Amazon.com, Inc.",
  GOOGL: "Alphabet Inc.", GOOG: "Alphabet Inc.", META: "Meta Platforms, Inc.", TSLA: "Tesla, Inc.",
  AMD: "Advanced Micro Devices, Inc.", NFLX: "Netflix, Inc.", AVGO: "Broadcom Inc.", ORCL: "Oracle Corporation",
  INTC: "Intel Corporation", JPM: "JPMorgan Chase & Co.", WMT: "Walmart Inc.", DIS: "The Walt Disney Company",
  COIN: "Coinbase Global, Inc.", PLTR: "Palantir Technologies Inc.", MSTR: "Strategy Inc.", XOM: "Exxon Mobil Corporation",
  COST: "Costco Wholesale Corporation", CRM: "Salesforce, Inc.", QCOM: "QUALCOMM Incorporated", BA: "The Boeing Company",
  UBER: "Uber Technologies, Inc.", ABBV: "AbbVie Inc.", ABT: "Abbott Laboratories", ACN: "Accenture plc",
  ADBE: "Adobe Inc.", ADI: "Analog Devices, Inc.", ADP: "Automatic Data Processing, Inc.", AMAT: "Applied Materials, Inc.",
  AMGN: "Amgen Inc.", AMT: "American Tower Corporation", ARM: "Arm Holdings plc", ASML: "ASML Holding N.V.",
  BAC: "Bank of America Corporation", BABA: "Alibaba Group Holding Limited", BKNG: "Booking Holdings Inc.", BMY: "Bristol Myers Squibb Company",
  C: "Citigroup Inc.", CAT: "Caterpillar Inc.", CL: "Colgate-Palmolive Company", CMCSA: "Comcast Corporation",
  COP: "ConocoPhillips", CVS: "CVS Health Corporation", CVX: "Chevron Corporation", DE: "Deere & Company",
  DELL: "Dell Technologies Inc.", GE: "GE Aerospace", GILD: "Gilead Sciences, Inc.", GS: "The Goldman Sachs Group, Inc.",
  HD: "The Home Depot, Inc.", HON: "Honeywell International Inc.", IBM: "International Business Machines Corporation",
  JNJ: "Johnson & Johnson", KO: "The Coca-Cola Company", LIN: "Linde plc", LLY: "Eli Lilly and Company",
  LMT: "Lockheed Martin Corporation", LOW: "Lowe's Companies, Inc.", MA: "Mastercard Incorporated", MCD: "McDonald's Corporation",
  MDT: "Medtronic plc", MRK: "Merck & Co., Inc.", MS: "Morgan Stanley", MU: "Micron Technology, Inc.",
  NKE: "NIKE, Inc.", NOW: "ServiceNow, Inc.", PEP: "PepsiCo, Inc.", PFE: "Pfizer Inc.", PG: "The Procter & Gamble Company",
  PM: "Philip Morris International Inc.", RTX: "RTX Corporation", SBUX: "Starbucks Corporation", SCHW: "The Charles Schwab Corporation",
  SO: "The Southern Company", T: "AT&T Inc.", TMO: "Thermo Fisher Scientific Inc.", TMUS: "T-Mobile US, Inc.",
  TSM: "Taiwan Semiconductor Manufacturing Company", V: "Visa Inc.", VZ: "Verizon Communications Inc.", UPS: "United Parcel Service, Inc.",
  UNH: "UnitedHealth Group Incorporated", WFC: "Wells Fargo & Company", WBD: "Warner Bros. Discovery, Inc.",
  AXP: "American Express Company", BX: "Blackstone Inc.", CEG: "Constellation Energy Corporation", CRWD: "CrowdStrike Holdings, Inc.",
  PANW: "Palo Alto Networks, Inc.", SHOP: "Shopify Inc.", SPOT: "Spotify Technology S.A.",
  HYG: "iShares iBoxx $ High Yield Corporate Bond ETF", LQD: "iShares iBoxx $ Investment Grade Corporate Bond ETF",
  IVV: "iShares Core S&P 500 ETF", MUB: "iShares National Muni Bond ETF", IDEV: "iShares Core MSCI International Developed Markets ETF",
  VTEB: "Vanguard Tax-Exempt Bond ETF", IEFA: "iShares Core MSCI EAFE ETF", EWZ: "iShares MSCI Brazil ETF",
  SOXL: "Direxion Daily Semiconductor Bull 3X Shares",
};

async function fetchBitget<T>(path: string, revalidate: number, timeoutMs = 9000): Promise<BitgetEnvelope<T>> {
  const response = await fetch(`${API}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(timeoutMs),
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

function getLogo(baseCoin: string, underlyingTicker: string | null, isReality: boolean): string | null {
  if (underlyingTicker && companyDomains[underlyingTicker]) {
    return `https://www.google.com/s2/favicons?domain=${companyDomains[underlyingTicker]}&sz=128`;
  }
  // Never guess an rToken's issuer logo using a crypto-symbol icon service.
  if (isReality) return null;
  const coin = baseCoin.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (coin && coin.length <= 16) return `https://assets.coincap.io/assets/icons/${coin}@2x.png`;
  return null;
}

function getAssetName(stock: RealityStockInfo | undefined, underlyingTicker: string | null, baseCoin: string): string {
  if (underlyingTicker && issuerNames[underlyingTicker]) return issuerNames[underlyingTicker];
  return stock?.name || baseCoin;
}

export async function getBitgetMarketUniverse() {
  const [instrumentsResult, tickersResult, stockInfoResult, sessionsResult] = await Promise.allSettled([
    fetchBitget<BitgetInstrument[]>("/market/instruments?category=SPOT", 1800),
    fetchBitget<BitgetTicker[]>("/market/tickers?category=SPOT", 12),
    fetchBitget<RealityStockInfo[]>("/reality/market/stock-info", 3600, 4500),
    fetchBitget<Array<{ market: string; daylightType?: string; stateList?: Array<{ state: string; timeZone: string; startTime: string; endTime: string }> }>>("/reality/market/states", 30, 2000),
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
        name: getAssetName(stock, underlyingTicker, instrument.baseCoin),
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
        logoUrl: getLogo(instrument.baseCoin, underlyingTicker, reality),
      }];
    })
    .sort((left, right) => Number(right.isReality) - Number(left.isReality) || (right.turnover24h ?? 0) - (left.turnover24h ?? 0));

  return {
    provider: "Bitget",
    source: `${API}/market/tickers?category=SPOT`,
    generatedAt: Date.now(),
    assets,
    session: session ? { market: session.market, daylightType: session.daylightType ?? null, schedule: session.stateList ?? [] } : null,
    marketSessionStatus: sessionsResult.status === "rejected" ? "unavailable" : session ? "available" : "empty",
    coverage: { total: assets.length, rTokens: assets.filter((asset) => asset.isReality).length, rwa: assets.filter((asset) => asset.isRwa).length, crypto: assets.filter((asset) => asset.kind === "crypto").length },
    staleAfterMs: 120_000,
    metadataStatus: stockInfoResult.status === "fulfilled" ? "available" : "partial",
  };
}

export async function getBitgetAsset(symbol: string): Promise<MarketAsset | null> {
  const instruments = await fetchBitget<BitgetInstrument[]>("/market/instruments?category=SPOT", 1800);
  const instrument = instruments.data.find((item) => item.symbol.toUpperCase() === symbol);
  if (!instrument) return null;
  const [tickers, stockInfo] = await Promise.all([
    fetchBitget<BitgetTicker[]>("/market/tickers?category=SPOT", 12),
    instrument.isReality?.toLowerCase() === "yes"
      ? fetchBitget<RealityStockInfo[]>("/reality/market/stock-info", 3600, 4500)
      : Promise.resolve(null),
  ]);
  const ticker = tickers.data.find((item) => item.symbol.toUpperCase() === symbol);
  if (!ticker) return null;
  const reality = instrument.isReality?.toLowerCase() === "yes";
  const rwa = instrument.isRwa?.toLowerCase() === "yes";
  const stock = stockInfo?.data.find((item) => item.symbol.toUpperCase() === symbol);
  const underlyingTicker = stock?.code?.toUpperCase() ?? null;
  const lastPrice = numberOrNull(ticker.lastPrice);
  if (lastPrice === null) return null;
  const sessions = Array.isArray(stock?.tradingPeriod) ? stock.tradingPeriod : stock?.tradingPeriod ? [stock.tradingPeriod] : [];
  return {
    symbol: instrument.symbol,
    baseCoin: instrument.baseCoin,
    quoteCoin: instrument.quoteCoin,
    name: getAssetName(stock, underlyingTicker, instrument.baseCoin),
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
    logoUrl: getLogo(instrument.baseCoin, underlyingTicker, reality),
  };
}

export async function getBitgetCandles(symbol: string, interval: CandleInterval, limit = 240): Promise<MarketCandle[]> {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  const query = new URLSearchParams({ category: "SPOT", symbol, interval, type: "market", limit: String(safeLimit) });
  const response = await fetchBitget<string[][]>(`/market/candles?${query.toString()}`, interval === "1H" ? 30 : 120);
  return response.data.flatMap((row): MarketCandle[] => {
    if (row.length < 5) return [];
    const [timestamp, open, high, low, close, volume, turnover] = row.map((value) => numberOrNull(value));
    if (timestamp === null || open === null || high === null || low === null || close === null) return [];
    return [{ timestamp, open, high, low, close, volume, turnover }];
  }).sort((left, right) => left.timestamp - right.timestamp);
}
