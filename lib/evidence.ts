export type EvidenceClaim = {
  claim: string;
  quote: string;
  stance: "supports" | "contradicts" | "context";
  confidence: number;
  sourceUrl?: string;
};

export type QwenBrief = {
  summary: string;
  upside: string;
  downside: string;
  catalysts: string[];
  what_would_change: string[];
  claims: EvidenceClaim[];
  citation_coverage: number;
};

type EvidenceSource = { url: string; excerpt: string };

function normalizeQuote(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

/** Keep only claims whose meaningful quote is present in the exact supplied passage. */
export function validateBrief(value: unknown, sources: EvidenceSource[]): QwenBrief | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const stringField = (key: string, max: number) => typeof candidate[key] === "string" && candidate[key].trim().length > 0 && candidate[key].length <= max;
  if (!stringField("summary", 1800) || !stringField("upside", 600) || !stringField("downside", 600) || !Array.isArray(candidate.catalysts) || !Array.isArray(candidate.claims)) return null;

  const claims = candidate.claims.flatMap((item): EvidenceClaim[] => {
    if (!item || typeof item !== "object") return [];
    const claim = item as Record<string, unknown>;
    if (typeof claim.claim !== "string" || claim.claim.trim().length < 10 || claim.claim.length > 500) return [];
    if (typeof claim.quote !== "string" || claim.quote.trim().length < 24 || claim.quote.length > 600) return [];
    const quote = normalizeQuote(claim.quote);
    const sourceUrl = typeof claim.source_url === "string" && sources.some((source) => source.url === claim.source_url) ? claim.source_url : undefined;
    const matchingSource = sources.find((source) => normalizeQuote(source.excerpt).includes(quote));
    if (!matchingSource || (sourceUrl && matchingSource.url !== sourceUrl)) return [];
    if (!(claim.stance === "supports" || claim.stance === "contradicts" || claim.stance === "context")) return [];
    const confidence = typeof claim.confidence === "number" && Number.isFinite(claim.confidence) ? Math.min(1, Math.max(0, claim.confidence)) : 0.5;
    return [{ claim: claim.claim.trim(), quote: claim.quote.trim(), stance: claim.stance, confidence, sourceUrl: sourceUrl ?? matchingSource.url }];
  }).slice(0, 8);
  if (!claims.length) return null;

  const catalysts = candidate.catalysts.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim().slice(0, 240)] : []).slice(0, 5);
  const whatWouldChange = Array.isArray(candidate.what_would_change)
    ? candidate.what_would_change.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim().slice(0, 240)] : []).slice(0, 4)
    : [];
  return {
    summary: (candidate.summary as string).trim(),
    upside: (candidate.upside as string).trim(),
    downside: (candidate.downside as string).trim(),
    catalysts,
    what_would_change: whatWouldChange.length ? whatWouldChange : ["A newer primary-source update that changes the reported facts.", "Independent reporting or an official filing that challenges the current interpretation."],
    claims,
    citation_coverage: Math.round((claims.length / Math.max(candidate.claims.length, 1)) * 100),
  };
}
