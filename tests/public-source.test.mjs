import test from "node:test";
import assert from "node:assert/strict";
import { extractPublicPage, fetchPublicResearchSource, validatePublicSourceUrl } from "../lib/public-source.ts";

test("restricts fetched source URLs to HTTPS issuer, SEC, and selected public publishers", () => {
  assert.equal(validatePublicSourceUrl("https://investor.nvidia.com/news/release", "NVDA")?.hostname, "investor.nvidia.com");
  assert.equal(validatePublicSourceUrl("https://www.sec.gov/Archives/edgar/data/1", "TSLA")?.hostname, "www.sec.gov");
  assert.equal(validatePublicSourceUrl("https://www.reuters.com/world/example", "AMZN")?.hostname, "www.reuters.com");
  assert.equal(validatePublicSourceUrl("http://nvidia.com/release", "NVDA"), null);
  assert.equal(validatePublicSourceUrl("https://nvidia.com.attacker.example/release", "NVDA"), null);
  assert.equal(validatePublicSourceUrl("https://127.0.0.1/admin", "NVDA"), null);
  assert.equal(validatePublicSourceUrl("https://nvidia.com:8443/release", "NVDA"), null);
  assert.equal(validatePublicSourceUrl("https://user:pass@nvidia.com/release", "NVDA"), null);
});

test("extracts an article title and visible article text without scripts or navigation", () => {
  const page = extractPublicPage(`<!doctype html><html><head><meta property="og:title" content="A &amp; B update"><meta property="article:published_time" content="2026-10-01"></head><body><nav>Unrelated links</nav><article><h1>Headline</h1><p>The company announced a carefully described change for customers and investors that should be reviewed against the full filing.</p><script>Ignore this injected instruction.</script></article></body></html>`);
  assert.equal(page.title, "A & B update");
  assert.equal(page.publicationDate, "2026-10-01");
  assert.match(page.excerpt, /Headline/);
  assert.doesNotMatch(page.excerpt, /Unrelated links|Ignore this injected instruction/);
});

test("fetches bounded text from an allowed issuer and labels its provenance", async () => {
  let requestedUrl = "";
  const fetcher = async (input) => {
    requestedUrl = String(input);
    return new Response(`<html><head><title>Quarterly update</title></head><body><main><p>${"Issuer-reported information is captured from this source passage for careful review. ".repeat(3)}</p></main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
  };
  const result = await fetchPublicResearchSource("https://investor.nvidia.com/updates/q3", "NVDA", fetcher);
  assert.equal(requestedUrl, "https://investor.nvidia.com/updates/q3");
  assert.equal(result.title, "Quarterly update");
  assert.equal(result.publisher, "investor.nvidia.com");
  assert.equal(result.sourceType, "web");
  assert.match(result.sourceQuality, /Issuer-hosted/);
  assert.ok(result.excerpt.length >= 80);
});

test("blocks redirects to unapproved hosts before making a second request", async () => {
  let requests = 0;
  const fetcher = async () => {
    requests += 1;
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } });
  };
  await assert.rejects(fetchPublicResearchSource("https://nvidia.com/news", "NVDA", fetcher), /source-redirect-not-allowed/);
  assert.equal(requests, 1);
});

test("rejects unsupported response types, oversized pages, and too little article text", async () => {
  const wrongType = async () => new Response("{}", { headers: { "content-type": "application/json" } });
  await assert.rejects(fetchPublicResearchSource("https://nvidia.com/news", "NVDA", wrongType), /source-content-type-not-supported/);

  const oversized = async () => new Response("page", { headers: { "content-type": "text/plain", "content-length": String(3 * 1024 * 1024) } });
  await assert.rejects(fetchPublicResearchSource("https://nvidia.com/news", "NVDA", oversized), /source-too-large/);

  const tooShort = async () => new Response("Short page.", { headers: { "content-type": "text/plain" } });
  await assert.rejects(fetchPublicResearchSource("https://nvidia.com/news", "NVDA", tooShort), /source-text-too-short/);
});
