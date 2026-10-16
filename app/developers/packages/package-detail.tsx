"use client";

import { useState } from "react";
import { PackageLifecycleDemo } from "./package-lifecycle-demo";
import { PackageSectionNav } from "./package-section-nav";
import { PackageSourceBadges } from "./package-source-badges";

const snippets = {
  typescript: `import { TidelightClient } from "@tidelight/sdk";\n\nconst client = new TidelightClient({\n  apiKey: process.env.TIDELIGHT_API_KEY!,\n});\n\nconst page = await client.listTokenizedEquities({\n  limit: 20,\n  underlyingTicker: "AAPL",\n});\n\nfor (const instrument of page.data) {\n  console.log(instrument.symbol, instrument.underlying_ticker);\n}`,
  research: `const accepted = await client.startCompanyResearch(\n  "NVDA",\n  crypto.randomUUID(),\n);\n\nconst result = await client.waitForResearchJob(\n  accepted.job_id,\n  { intervalMs: 2_000, timeoutMs: 120_000 },\n);\n\nif (result.status === "complete") {\n  console.log(result.result);\n}`,
  webhook: `import { TidelightClient } from "@tidelight/sdk";

const apiKey = process.env.TIDELIGHT_API_KEY;
if (!apiKey) throw new Error("Set TIDELIGHT_API_KEY in your server environment.");
const client = new TidelightClient({ apiKey });

const created = await client.createWebhook({
  name: "Research events",
  url: "https://your-service.example/tidelight",
  events: ["research.job.completed", "research.job.failed"],
});

if (!created.signing_secret) {
  throw new Error("The one-time signing secret was not returned.");
}
// TODO: Save the secret with your approved secrets manager before finishing setup.
// Do not print it; it cannot be recovered by listing the endpoint.`,
  local: `git clone https://github.com/TidelightOrg/tidelight.git\ncd tidelight/sdk/typescript\nnpm install --ignore-scripts --no-audit --no-fund\nnpm test\nnpm run build`,
};
type Snippet = keyof typeof snippets;
const labels: Record<Snippet, string> = { typescript: "After npm release", research: "Research job", webhook: "Webhook secret", local: "Build from source" };

export function PackageDetail() {
  const [selected, setSelected] = useState<Snippet>("typescript");
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(snippets[selected]); setCopyStatus("copied"); window.setTimeout(() => setCopyStatus(null), 1800); }
    catch { setCopyStatus("failed"); window.setTimeout(() => setCopyStatus(null), 2600); }
  }
  return <>
    <header className="tic-package-detail-hero">
      <div className="tic-package-detail-copy"><p className="tic-eyebrow">OFFICIAL PACKAGE / TYPESCRIPT · JAVASCRIPT</p><div className="tic-package-detail-title"><span className="tic-package-glyph" aria-hidden="true">TS</span><h1>@tidelight/sdk</h1></div><p>A typed client for Tidelight’s supported Intelligence Cloud API v1 workflows. Built for secure server-side use with pagination, bounded retries, explicit timeouts, research job tracking, and webhook management.</p><PackageSourceBadges packageId="sdk" /><div className="tic-package-detail-actions"><a className="tic-button tic-primary" href="#quickstart">Read quickstart <span aria-hidden="true">↓</span></a><a className="tic-button" href="https://github.com/TidelightOrg/tidelight/tree/main/sdk/typescript" target="_blank" rel="noreferrer">View source <span aria-hidden="true">→</span></a></div><p className="tic-package-publication-note">This package is not published to npm. The install command <code>npm install @tidelight/sdk</code> is not available yet.</p></div>
      <div className="tic-package-flow" role="img" aria-label="SDK architecture: your server application calls the Tidelight SDK, which sends scoped requests to the Tidelight API and receives a structured response.">
        <span className="tic-package-flow-label">REQUEST PATH / SERVER SIDE</span><div className="tic-flow-line"><div className="tic-flow-node"><span>01</span><strong>Your service</strong><small>API key stays server-side</small></div><i aria-hidden="true">→</i><div className="tic-flow-node flow-active"><span>02</span><strong>Tidelight SDK</strong><small>Types · retries · timeout</small></div><i aria-hidden="true">→</i><div className="tic-flow-node"><span>03</span><strong>API v1</strong><small>Scope and quota enforced</small></div></div><div className="tic-flow-response"><span>STRUCTURED RESPONSE</span><b>data</b><b>request_id</b><b>provenance</b></div>
      </div>
    </header>
    <PackageLifecycleDemo packageName="sdk" />
    <div className="tic-package-detail-layout">
      <PackageSectionNav sections={[{ id: "overview", label: "Overview" }, { id: "quickstart", label: "Quickstart" }, { id: "api", label: "API surface" }, { id: "compatibility", label: "Compatibility" }, { id: "security", label: "Security" }, { id: "releases", label: "Releases" }]} />
      <article className="tic-package-detail-content">
        <section id="overview"><p className="tic-eyebrow">01 / OVERVIEW</p><h2>Designed around the real API contract.</h2><p>The SDK source lives at <code>sdk/typescript</code> in the Tidelight mother repository. It currently supports tokenized equity instrument listing and pagination, company research jobs (start, status, cancellation, bounded polling), and project webhook management and delivery history.</p><p>Use it from trusted server environments that can protect an API key. The API applies the same project authorization, scopes, quotas, and request accounting as direct REST calls.</p></section>
        <section id="quickstart" className="tic-package-code-section"><p className="tic-eyebrow">02 / QUICKSTART</p><h2>Try the source version locally.</h2><p>Until the first npm release is approved and published, clone the mother repository and run the SDK tests. The TypeScript usage example is for the published package after release.</p><div className="tic-package-snippet"><div className="tic-package-snippet-head"><div role="group" aria-label="Quickstart examples">{(Object.keys(snippets) as Snippet[]).map(key => <button type="button" aria-pressed={selected === key} key={key} onClick={() => { setSelected(key); setCopyStatus(null); }}>{labels[key]}</button>)}</div><button className="tic-package-copy" type="button" onClick={copy} aria-live="polite">{copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy unavailable" : "Copy"}</button></div><pre tabIndex={0} aria-label={`${labels[selected]} code example`}><code>{snippets[selected]}</code></pre></div>
          <div className="tic-package-callout"><span aria-hidden="true">i</span><p><strong>Authentication stays on your server.</strong> Set <code>TIDELIGHT_API_KEY</code> in your server environment. Never expose it in browser bundles, public examples, or client-side React components.</p></div>
        </section>
        <section id="api"><p className="tic-eyebrow">03 / API SURFACE</p><h2>Supported operations</h2><div className="tic-package-api-list"><div><code>listTokenizedEquities(options?)</code><span>Returns a typed page of supported rToken instruments.</span></div><div><code>tokenizedEquities(options?)</code><span>Iterates through pages with a typed async iterator.</span></div><div><code>startCompanyResearch(ticker, idempotencyKey)</code><span>Starts an asynchronous company research snapshot.</span></div><div><code>getResearchJob(id) · cancelResearchJob(id)</code><span>Checks job status or requests cancellation.</span></div><div><code>waitForResearchJob(id, options?)</code><span>Polls with a caller-bounded interval and timeout.</span></div><div><code>createWebhook · listWebhookDeliveries</code><span>Manages supported research event subscriptions.</span></div></div><p>For exact field schemas and endpoint behavior, use the current <a href="https://dev.tidelight.app#reference">API reference</a> and <a href="https://github.com/TidelightOrg/tidelight/blob/main/docs/tic-openapi.yaml" target="_blank" rel="noreferrer">OpenAPI contract</a>.</p></section>
        <section id="compatibility"><p className="tic-eyebrow">04 / COMPATIBILITY</p><h2>Source compatibility</h2><div className="tic-package-facts"><div><span>Runtime in CI</span><strong>Node.js 22</strong></div><div><span>Language</span><strong>TypeScript / JavaScript ESM</strong></div><div><span>API contract</span><strong>REST API v1</strong></div><div><span>Distribution</span><strong>Mother repository only</strong></div></div><p>Node.js 22 is the runtime used by the current package CI. There is no public package release or semver support window yet. Browser compatibility and a wider runtime support policy must be established and tested before publishing.</p></section>
        <section id="security"><p className="tic-eyebrow">05 / SECURITY &amp; TRUST</p><h2>Bounded behavior, protected credentials.</h2><ul className="tic-package-security-list"><li>API keys are supplied by the caller and must remain in trusted server code.</li><li>Network errors, 429, and transient 5xx responses receive at most two bounded retries by default.</li><li>Requests have a 10-second default timeout.</li><li>Webhook mutations are not automatically retried because the API does not accept webhook idempotency keys.</li><li>Errors include the HTTP status, API error code, and request ID for diagnosis.</li></ul><p>A package-level security policy must be published before first registry release.</p></section>
        <section id="releases"><p className="tic-eyebrow">06 / RELEASES</p><h2>No public releases yet.</h2><p>The repository source is versioned <code>0.1.0</code> and marked private. No npm release or changelog entry exists. The release workflow currently validates and creates source releases in the synchronized GitHub mirror; registry publishing is not configured.</p><div className="tic-package-release-row"><span className="tic-package-status-mark is-pending">·</span><div><strong>First npm release</strong><small>Pending package readiness, ownership validation, and explicit publication approval.</small></div><span>Not released</span></div></section>
      </article>
    </div>
  </>;
}
