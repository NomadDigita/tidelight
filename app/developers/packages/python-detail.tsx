"use client";

import { useState } from "react";
import { PackageLifecycleDemo } from "./package-lifecycle-demo";
import { PackageSourceBadges } from "./package-source-badges";

const snippets = {
  install: `git clone https://github.com/TidelightOrg/tidelight.git
cd tidelight
python -m venv .venv
. .venv/bin/activate
pip install -e ./sdk/python
PYTHONPATH=sdk/python/src python -m unittest discover -s sdk/python/tests -v`,
  market: `import os
from tidelight import Client

client = Client(os.environ["TIDELIGHT_API_KEY"])
page = client.list_tokenized_equities(
    limit=20,
    underlying_ticker="AAPL",
)

for instrument in page.data:
    print(instrument.symbol, instrument.underlying_ticker, instrument.source)`,
  research: `import os
import uuid
from tidelight import Client

client = Client(os.environ["TIDELIGHT_API_KEY"])
accepted = client.start_company_research("NVDA", str(uuid.uuid4()))
job = client.wait_for_research_job(
    accepted["job_id"], interval=2, timeout=120,
)
if job.status == "complete":
    print(job.result)`,
  webhook: `import os
from tidelight import Client

client = Client(os.environ["TIDELIGHT_API_KEY"])
created = client.create_webhook(
    name="Research events",
    url="https://your-service.example/tidelight",
    events=["research.job.completed", "research.job.failed"],
)
signing_secret = created.get("signing_secret")
if not signing_secret:
    raise RuntimeError("The one-time signing secret was not returned")
# TODO: Save it with your approved secrets manager before finishing setup.
# Do not print it; it cannot be recovered by listing the endpoint.`,
};
type Snippet = keyof typeof snippets;
const labels: Record<Snippet, string> = { install: "Build from source", market: "Market instruments", research: "Research job", webhook: "Webhook secret" };

export function PythonPackageDetail() {
  const [selected, setSelected] = useState<Snippet>("install");
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(snippets[selected]); setCopyStatus("copied"); window.setTimeout(() => setCopyStatus(null), 1800); }
    catch { setCopyStatus("failed"); window.setTimeout(() => setCopyStatus(null), 2600); }
  }
  return <>
    <header className="tic-package-detail-hero">
      <div className="tic-package-detail-copy"><p className="tic-eyebrow">OFFICIAL PACKAGE / PYTHON SDK</p><div className="tic-package-detail-title"><span className="tic-package-glyph" aria-hidden="true">Py</span><h1>Python SDK</h1></div><p>A small Python client for supported Tidelight API v1 market, asynchronous research, and webhook workflows. Keep project credentials on trusted servers and work with typed response objects.</p><PackageSourceBadges packageId="python" /><div className="tic-package-detail-actions"><a className="tic-button tic-primary" href="#quickstart">Build from source <span aria-hidden="true">↓</span></a><a className="tic-button" href="https://github.com/TidelightOrg/tidelight/tree/main/sdk/python" target="_blank" rel="noreferrer">View source <span aria-hidden="true">→</span></a></div><p className="tic-package-publication-note">No PyPI release is available. Intended distribution name: <code>tidelight</code>; current project metadata says <code>tidelight-sdk</code>. Do not use a registry install command until that name is resolved and published.</p></div>
      <div className="tic-package-flow" role="img" aria-label="Python SDK workflow: a trusted Python service uses the Tidelight client, which sends a scoped request to API v1 and returns structured market or research data."><span className="tic-package-flow-label">PYTHON CLIENT / SERVER SIDE</span><div className="tic-flow-line"><div className="tic-flow-node"><span>01</span><strong>Your service</strong><small>Credential from environment</small></div><i aria-hidden="true">→</i><div className="tic-flow-node flow-active"><span>02</span><strong>Python SDK</strong><small>Typed results · bounded retries</small></div><i aria-hidden="true">→</i><div className="tic-flow-node"><span>03</span><strong>API v1</strong><small>Scope and quota enforced</small></div></div><div className="tic-flow-response"><span>RETURNED DATA</span><b>instruments</b><b>research job</b><b>request_id</b></div></div>
    </header>
    <PackageLifecycleDemo packageName="python" />
    <div className="tic-package-detail-layout">
      <nav className="tic-package-detail-nav" aria-label="Package sections"><span>ON THIS PAGE</span><a href="#overview">Overview</a><a href="#quickstart">Quickstart</a><a href="#api">API surface</a><a href="#compatibility">Compatibility</a><a href="#security">Security</a><a href="#releases">Releases</a></nav>
      <article className="tic-package-detail-content">
        <section id="overview"><p className="tic-eyebrow">01 / OVERVIEW</p><h2>Python access to the supported API surface.</h2><p>The client source lives at <code>sdk/python</code> in the Tidelight mother repository. It supports tokenized-equity instrument listing and pagination, asynchronous company research jobs, and research-job webhook management and delivery history.</p><p>It does not expose strategies, scenarios, trading, account administration, or a generic HTTP passthrough. API authorization and provider availability are enforced by Tidelight services.</p></section>
        <section id="quickstart" className="tic-package-code-section"><p className="tic-eyebrow">02 / QUICKSTART</p><h2>Use the canonical source today.</h2><p>The Python distribution is unpublished. This source setup installs from the mother repository; the market and research examples use the current client methods.</p><div className="tic-package-snippet"><div className="tic-package-snippet-head"><div role="group" aria-label="Python examples">{(Object.keys(snippets) as Snippet[]).map(key => <button type="button" aria-pressed={selected === key} key={key} onClick={() => { setSelected(key); setCopyStatus(null); }}>{labels[key]}</button>)}</div><button className="tic-package-copy" type="button" onClick={copy} aria-live="polite">{copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy unavailable" : "Copy"}</button></div><pre tabIndex={0} aria-label={`${labels[selected]} Python example`}><code>{snippets[selected]}</code></pre></div><div className="tic-package-callout"><span aria-hidden="true">i</span><p><strong>Keep credentials in a trusted server environment.</strong> Set <code>TIDELIGHT_API_KEY</code> outside source control and never include it in notebooks, public logs, or client-side applications.</p></div></section>
        <section id="api"><p className="tic-eyebrow">03 / API SURFACE</p><h2>Supported operations</h2><div className="tic-package-api-list"><div><code>list_tokenized_equities(...)</code><span>Returns paginated typed instrument results with source and underlying mapping; requires <code>market:read</code>.</span></div><div><code>tokenized_equities(...)</code><span>Iterates through the supported instrument pages.</span></div><div><code>start_company_research(ticker, key)</code><span>Creates a research job with a caller-provided idempotency key; requires <code>research:run</code>.</span></div><div><code>get_research_job(id) · cancel_research_job(id)</code><span>Reads status or requests cancellation for a supported job.</span></div><div><code>wait_for_research_job(id, ...)</code><span>Polls at a bounded interval and timeout.</span></div><div><code>create_webhook · update_webhook · list_webhook_deliveries</code><span>Manages supported research event subscriptions with <code>alerts:manage</code>; signing secrets are returned once.</span></div></div><p>For the exact request and response schema, see the <a href="https://dev.tidelight.app#reference">API reference</a> and <a href="https://github.com/TidelightOrg/tidelight/blob/main/docs/tic-openapi.yaml" target="_blank" rel="noreferrer">OpenAPI contract</a>.</p></section>
        <section id="compatibility"><p className="tic-eyebrow">04 / COMPATIBILITY</p><h2>Source compatibility, stated precisely.</h2><div className="tic-package-facts"><div><span>Minimum Python</span><strong>3.10</strong></div><div><span>Python CI tested</span><strong>3.10 · 3.12</strong></div><div><span>API contract</span><strong>REST API v1</strong></div><div><span>Distribution name</span><strong>tidelight-sdk (metadata)</strong></div></div><p>The manifest declares Python <code>&gt;=3.10</code>, and CI tests Python <code>3.10</code> and <code>3.12</code>. The intended public name <code>tidelight</code> differs from current package metadata, so registry name availability remains unconfirmed. No public compatibility or support window has been announced.</p></section>
        <section id="security"><p className="tic-eyebrow">05 / SECURITY &amp; TRUST</p><h2>Server-side use with bounded transport.</h2><ul className="tic-package-security-list"><li>Keys are caller-supplied and kept in process memory; the SDK does not persist credentials.</li><li>Remote HTTPS requests are limited to <code>api.tidelight.app</code>; redirects are not followed. HTTP is allowed only for local development hosts.</li><li>Network errors, 429, and transient 5xx responses receive at most two retries by default, except <code>provider_terms_unconfirmed</code>, which is returned immediately.</li><li>Requests have a 10-second default timeout; polling is bounded to 10 minutes.</li><li>Webhook mutations are not retried without server idempotency support; signing secrets must be stored securely by the caller.</li></ul><p>Provider redistribution terms are not confirmed. Market calls may return <code>provider_terms_unconfirmed</code>; there is no fallback source. Project scopes, tenant ownership, and quotas remain authoritative at the API boundary.</p></section>
        <section id="releases"><p className="tic-eyebrow">06 / RELEASES</p><h2>No public PyPI release yet.</h2><p>The source manifest is <code>tidelight-sdk</code> version <code>0.1.0</code>, and the package remains unpublished. Confirm the final name, ownership, license, trusted publishing, and provenance before the first release.</p><div className="tic-package-release-row"><span className="tic-package-status-mark is-pending">·</span><div><strong>First PyPI release</strong><small>Pending distribution-name decision, namespace confirmation, security and provenance setup, and explicit publication approval.</small></div><span>Not released</span></div></section>
      </article>
    </div>
  </>;
}
