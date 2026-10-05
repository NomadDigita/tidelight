export type ResearchExposure = {
  ticker: string;
  issuer: string;
  sector: string;
  realityPair: string;
  match: "ticker" | "company";
};

const catalog: Array<Omit<ResearchExposure, "match"> & { aliases: string[] }> = [
  { ticker: "NVDA", issuer: "NVIDIA Corporation", sector: "Semiconductors", realityPair: "RNVDAUSDT", aliases: ["nvda", "nvidia"] },
  { ticker: "TSLA", issuer: "Tesla, Inc.", sector: "Mobility", realityPair: "RTSLAUSDT", aliases: ["tsla", "tesla"] },
  { ticker: "MSFT", issuer: "Microsoft Corporation", sector: "Cloud & AI", realityPair: "RMSFTUSDT", aliases: ["msft", "microsoft"] },
  { ticker: "AAPL", issuer: "Apple Inc.", sector: "Consumer technology", realityPair: "RAAPLUSDT", aliases: ["aapl", "apple"] },
  { ticker: "AMZN", issuer: "Amazon.com, Inc.", sector: "Commerce & cloud", realityPair: "RAMZNUSDT", aliases: ["amzn", "amazon"] },
  { ticker: "META", issuer: "Meta Platforms, Inc.", sector: "Platforms & advertising", realityPair: "RMETAUSDT", aliases: ["meta", "facebook"] },
  { ticker: "AMD", issuer: "Advanced Micro Devices, Inc.", sector: "Semiconductors", realityPair: "RAMDUSDT", aliases: ["amd", "advanced micro devices"] },
  { ticker: "GOOGL", issuer: "Alphabet Inc.", sector: "Cloud & advertising", realityPair: "RGOOGLUSDT", aliases: ["googl", "alphabet", "google"] },
  { ticker: "JPM", issuer: "JPMorgan Chase & Co.", sector: "Financials", realityPair: "RJPMUSDT", aliases: ["jpm", "jpmorgan"] },
  { ticker: "WMT", issuer: "Walmart Inc.", sector: "Consumer staples", realityPair: "RWMTUSDT", aliases: ["wmt", "walmart"] },
  { ticker: "NFLX", issuer: "Netflix, Inc.", sector: "Streaming & media", realityPair: "RNFLXUSDT", aliases: ["nflx", "netflix"] },
  { ticker: "COIN", issuer: "Coinbase Global, Inc.", sector: "Digital assets", realityPair: "RCOINUSDT", aliases: ["coin", "coinbase"] },
];

export function mapResearchExposure(text: string): ResearchExposure[] {
  const normalized = text.toLocaleLowerCase();
  return catalog.flatMap(({ aliases, ...item }) => {
    const match = aliases.some((alias) => new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "i").test(normalized));
    return match ? [{ ...item, match: aliases[0] === item.ticker.toLocaleLowerCase() ? "ticker" as const : "company" as const }] : [];
  });
}
