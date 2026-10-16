"use client";

import { useState } from "react";
import { PackageLifecycleDemo } from "./package-lifecycle-demo";
import { PackageSourceBadges } from "./package-source-badges";

const snippets = {
  source: `cd sdk/typescript && npm ci && npm test
cd ../../packages/cli
npm ci && npm test
node dist/bin.js --help`,
  research: `tidelight auth login
tidelight research start NVDA --wait --timeout-ms 120000
tidelight research get <job-id> --json
tidelight research cancel <job-id>`,
  webhooks: `tidelight webhooks create \\
  --name "Research alerts" \\
  --url https://example.com/tidelight \\
  --events research.job.completed

# Copy the one-time signing secret into your secret manager.`,
};
type Snippet = keyof typeof snippets;
const labels: Record<Snippet, string> = { source: "Build from source", research: "Research jobs", webhooks: "Webhooks" };

export function CliPackageDetail() {
  const [selected, setSelected] = useState<Snippet>("research");
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(snippets[selected]); setCopyStatus("copied"); window.setTimeout(() => setCopyStatus(null), 1800); }
    catch { setCopyStatus("failed"); window.setTimeout(() => setCopyStatus(null), 2600); }
  }
  return <>
    <header className="tic-package-detail-hero">
      <div className="tic-package-detail-copy"><p className="tic-eyebrow">OFFICIAL PACKAGE / TERMINAL WORKFLOWS</p><div className="tic-package-detail-title"><span className="tic-package-glyph" aria-hidden="true">$</span><h1>@tidelight/cli</h1></div><p>A focused command-line interface for supported Tidelight API workflows. Use your project’s scopes from the terminal, keep credentials in your OS keychain, and inspect structured job results.</p><PackageSourceBadges packageId="cli" /><div className="tic-package-detail-actions"><a className="tic-button tic-primary" href="#quickstart">Explore commands <span aria-hidden="true">↓</span></a><a className="tic-button" href="https://github.com/TidelightOrg/tidelight/tree/main/packages/cli" target="_blank" rel="noreferrer">View source <span aria-hidden="true">→</span></a></div><p className="tic-package-publication-note">The package is private and not published to npm. <code>npm install -g @tidelight/cli</code> is not available yet.</p></div>
      <div className="tic-package-flow tic-cli-flow" role="img" aria-label="Illustrative CLI workflow: a terminal reads credentials from an operating-system keychain, sends a scoped API request through the official SDK, and prints the returned Tidelight response."><span className="tic-package-flow-label">LOCAL CREDENTIAL · SERVER AUTHORITY</span><div className="tic-cli-terminal-head"><i/><i/><i/><span>tidelight · API v1</span></div><div className="tic-cli-terminal-body"><p className="tic-cli-command"><span>$</span> tidelight research start NVDA <span className="tic-cli-nowrap">--wait</span></p><div className="tic-cli-terminal-meta"><span>credential</span><strong>OS keychain</strong><span>scope</span><strong>research:run</strong></div><div className="tic-cli-terminal-rule"/><div className="tic-cli-terminal-result"><small>ILLUSTRATIVE JOB STATUS</small><strong>completed</strong><small>REQUEST ID</small><code>req_········</code></div></div><div className="tic-cli-caption">Example fields only. Actual output comes from the API response.</div></div>
    </header>
    <PackageLifecycleDemo packageName="cli" />
    <div className="tic-package-detail-layout">
      <nav className="tic-package-detail-nav" aria-label="Package sections"><span>ON THIS PAGE</span><a href="#overview">Overview</a><a href="#quickstart">Quickstart</a><a href="#commands">Commands</a><a href="#security">Security</a><a href="#examples">Examples</a><a href="#releases">Releases</a></nav>
      <article className="tic-package-detail-content">
        <section id="overview"><p className="tic-eyebrow">01 / OVERVIEW</p><h2>Only commands backed by the current API contract.</h2><p>The CLI calls the official TypeScript SDK. It currently supports Reality tokenized-equity spot listings, asynchronous company research jobs, and research-job webhooks. Service-side authorization, tenant ownership, quota checks, and provider terms remain authoritative.</p><p>It does not expose account or key management, strategy or trading operations, generic REST passthrough, or MCP internals.</p></section>
        <section id="quickstart" className="tic-package-code-section"><p className="tic-eyebrow">02 / QUICKSTART</p><h2>Build the source and authenticate.</h2><p>Until an approved npm release exists, clone the mother repository and build the CLI package from source. The local workflow uses the checked-in SDK source and CI validation.</p><div className="tic-package-snippet"><div className="tic-package-snippet-head"><div role="group" aria-label="CLI examples">{(Object.keys(snippets) as Snippet[]).map(key => <button type="button" aria-pressed={selected === key} key={key} onClick={() => { setSelected(key); setCopyStatus(null); }}>{labels[key]}</button>)}</div><button className="tic-package-copy" type="button" onClick={copy} aria-live="polite">{copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy unavailable" : "Copy"}</button></div><pre tabIndex={0} aria-label={`${labels[selected]} command example`}><code>{snippets[selected]}</code></pre></div><div className="tic-package-callout"><span aria-hidden="true">i</span><p><strong>Credential storage uses the operating-system keychain.</strong> Linux requires Secret Service. If no supported keychain is available, provide <code>TIDELIGHT_API_KEY</code> to the current process; the CLI never saves a plaintext config file.</p></div></section>
        <section id="commands"><p className="tic-eyebrow">03 / COMMANDS</p><h2>Supported market, research, and webhook workflows.</h2><div className="tic-package-api-list"><div><code>market instruments</code><span>Paginated list of supported tokenized-equity spot instruments; source labels are preserved and provider terms errors are surfaced.</span></div><div><code>research start / get / wait / cancel</code><span>Create an idempotent company research job, retrieve a result, poll to a bounded terminal state, or explicitly request cancellation.</span></div><div><code>webhooks list / create / update / disable / deliveries</code><span>Manage supported research-job webhook events through the official SDK; signing secrets are returned once.</span></div><div><code>--json</code><span>Write the API response shape to stdout for scripts and automation.</span></div></div></section>
        <section id="security"><p className="tic-eyebrow">04 / SECURITY &amp; TRUST</p><h2>Credential handling belongs to trusted local storage.</h2><ul className="tic-package-security-list"><li>Interactive key input does not echo the key; saved credentials go to the OS keychain.</li><li><code>TIDELIGHT_API_KEY</code> is process-scoped and takes precedence over keychain data.</li><li>Only supported command arguments are accepted; arbitrary URL or HTTP passthrough is not implemented.</li><li>Webhook signing secrets are shown once with an explicit warning and are never stored by the CLI.</li><li>API errors show the request ID and bounded service message without returning raw provider response bodies.</li></ul><p>Use project keys with the narrowest required scopes. Market data can be unavailable when redistribution terms are not configured; the CLI does not substitute another data source.</p></section>
        <section id="examples"><p className="tic-eyebrow">05 / EXAMPLES</p><h2>Honest automation output.</h2><p>Market commands display only API-returned instruments with their underlying ticker, instrument kind, last price, provider source, pagination cursor, and request ID. Research job status and outputs remain limited by current service behavior and the caller’s credential scopes.</p></section>
        <section id="releases"><p className="tic-eyebrow">06 / RELEASES</p><h2>Tested source, held from publication.</h2><p>The CLI is versioned <code>0.1.0</code> with local tests, package metadata, and a changelog. Its manifest remains <code>private</code>; no npm release exists.</p><div className="tic-package-release-row"><span className="tic-package-status-mark is-pending">·</span><div><strong>First npm release</strong><small>Pending SDK registry availability, namespace and license confirmation, keychain/platform validation, trusted publishing/provenance, security policy, and explicit approval.</small></div><span>Not released</span></div><p><a href="https://github.com/TidelightOrg/tidelight/blob/main/packages/cli/CHANGELOG.md" target="_blank" rel="noreferrer">View source changelog →</a></p></section>
      </article>
    </div>
  </>;
}
