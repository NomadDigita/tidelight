/** Official starting points; these links help discovery but are not evidence until captured. */
const cikByTicker: Record<string, string> = { AAPL: "320193", AMZN: "1018724", MSFT: "789019", NVDA: "1045810", TSLA: "1318605" };
const issuerNews: Record<string, { label: string; url: string }> = {
  AAPL: { label: "Apple Newsroom", url: "https://www.apple.com/newsroom/" },
  AMZN: { label: "About Amazon News", url: "https://www.aboutamazon.com/news" },
  MSFT: { label: "Microsoft News", url: "https://news.microsoft.com/" },
  NVDA: { label: "NVIDIA Newsroom", url: "https://nvidianews.nvidia.com/" },
  TSLA: { label: "Tesla Investor Relations", url: "https://ir.tesla.com/press" },
};

export function getSourceStarters(ticker: string) {
  const symbol = ticker.toUpperCase();
  const company = issuerNews[symbol];
  const cik = cikByTicker[symbol];
  return [
    ...(company ? [{ label: company.label, url: company.url, kind: "Issuer" }] : []),
    ...(cik ? [{ label: "SEC company filings", url: `https://www.sec.gov/edgar/browse/?CIK=${cik}&owner=exclude`, kind: "Primary filing" }] : []),
  ];
}
