import test from "node:test";
import assert from "node:assert/strict";
import { validateBrief } from "../lib/evidence.ts";

const sourceOne = {
  url: "https://www.sec.gov/news/example",
  excerpt: "The company said it would invest $4 billion in a new research facility over the next five years.",
};
const sourceTwo = {
  url: "https://investor.example.com/release",
  excerpt: "Management expects the new facility to begin operations in 2028, subject to regulatory approvals.",
};
const base = {
  summary: "The planned facility may expand long-term research capacity.",
  upside: "The investment could improve future research capacity.",
  downside: "The opening date depends on approvals.",
  catalysts: ["Regulatory approvals"],
};

test("matches meaningful quotes across whitespace and attributes them to the right source", () => {
  const result = validateBrief({ ...base, claims: [
    { claim: "The company announced a multiyear investment.", quote: "The company said it would invest $4 billion\nin a new research facility over the next five years.", source_url: sourceOne.url, stance: "supports", confidence: 0.92 },
    { claim: "Operations are expected to begin in 2028.", quote: "Management expects the new facility to begin operations in 2028, subject to regulatory approvals.", source_url: sourceTwo.url, stance: "context", confidence: 0.81 },
  ] }, [sourceOne, sourceTwo]);

  assert.ok(result);
  assert.equal(result.claims.length, 2);
  assert.equal(result.claims[0].sourceUrl, sourceOne.url);
  assert.equal(result.claims[1].sourceUrl, sourceTwo.url);
  assert.equal(result.citation_coverage, 100);
});

test("rejects short, altered, misattributed, and ungrounded quotes", () => {
  const result = validateBrief({ ...base, claims: [
    { claim: "A very short fragment is not adequate evidence.", quote: "invest $4 billion", stance: "supports" },
    { claim: "An altered quote is not accepted.", quote: "The company plans to invest $4 billion in a new facility.", stance: "supports" },
    { claim: "A quote cannot be pinned to the wrong source.", quote: "The company said it would invest $4 billion in a new research facility over the next five years.", source_url: sourceTwo.url, stance: "supports" },
  ] }, [sourceOne, sourceTwo]);
  assert.equal(result, null);
});

test("reports coverage against all model claims when unsupported claims are dropped", () => {
  const result = validateBrief({ ...base, claims: [
    { claim: "The company announced a multiyear investment.", quote: "The company said it would invest $4 billion in a new research facility over the next five years.", source_url: sourceOne.url, stance: "supports", confidence: 1.4 },
    { claim: "The unsupported inference is excluded from the saved brief.", quote: "The facility will double profits next year, according to executives.", stance: "supports" },
  ] }, [sourceOne]);

  assert.ok(result);
  assert.equal(result.claims.length, 1);
  assert.equal(result.citation_coverage, 50);
  assert.equal(result.claims[0].confidence, 1);
});
