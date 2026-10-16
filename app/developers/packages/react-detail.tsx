"use client";

import { useState } from "react";

const snippets = {
  source: `cd sdk/typescript && npm test
cd ../../packages/react
npm ci
npm test
npm run build`,
  hook: `import { TidelightProvider, useTokenizedEquities, TokenizedEquityGrid } from "@tidelight/react";
import "@tidelight/react/styles.css";

function MarketPanel() {
  const result = useTokenizedEquities({ underlyingTicker: "NVDA", limit: 20 });
  return <TokenizedEquityGrid
    instruments={result.data?.data ?? []}
    isLoading={result.isLoading}
    error={result.error?.message}
    onRetry={result.refresh}
  />;
}`,
  secure: `// Browser component calls your authenticated same-origin application route.
<TidelightProvider client={applicationServerClient}>
  <MarketPanel />
</TidelightProvider>

// applicationServerClient forwards requests from your own backend.
// Store the Tidelight project key only in server-side configuration.`,
};
type Snippet = keyof typeof snippets;
const labels: Record<Snippet, string> = { source: "Build from source", hook: "Market hook", secure: "Secure boundary" };

export function ReactPackageDetail() {
  const [selected, setSelected] = useState<Snippet>("hook");
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(null);
  async function copy() {
    try { await navigator.clipboard.writeText(snippets[selected]); setCopyStatus("copied"); window.setTimeout(() => setCopyStatus(null), 1800); }
    catch { setCopyStatus("failed"); window.setTimeout(() => setCopyStatus(null), 2600); }
  }
  return <>
    <header className="tic-package-detail-hero">
      <div className="tic-package-detail-copy"><p className="tic-eyebrow">OFFICIAL PACKAGE / REACT INTEGRATIONS</p><div className="tic-package-detail-title"><span className="tic-package-glyph" aria-hidden="true">R</span><h1>@tidelight/react</h1></div><p>Typed hooks and accessible components for market and research experiences. Connect your UI to an authenticated application backend while keeping Tidelight credentials server-side.</p><div className="tic-package-detail-badges"><span className="tic-package-state-pill"><i/> Source ready · unpublished</span><span>Version 0.1.0 private</span><span>React 18 &amp; 19</span></div><div className="tic-package-detail-actions"><a className="tic-button tic-primary" href="#quickstart">Explore the hooks <span aria-hidden="true">↓</span></a><a className="tic-button" href="https://github.com/TidelightOrg/tidelight/tree/main/packages/react" target="_blank" rel="noreferrer">View source <span aria-hidden="true">→</span></a></div><p className="tic-package-publication-note">This package is private and not published to npm. <code>npm install @tidelight/react</code> is not available yet.</p></div>
      <div className="tic-package-flow tic-react-flow" role="img" aria-label="Secure React flow: Tidelight UI hooks call an application backend, where the official SDK uses a server-side project key to call the Tidelight API and returns authorized structured data."><span className="tic-package-flow-label">BROWSER SAFE · SERVER AUTHORITY</span><div className="tic-flow-line"><div className="tic-flow-node"><span>01</span><strong>React UI</strong><small>hooks &amp; states</small></div><i aria-hidden="true">→</i><div className="tic-flow-node flow-active"><span>02</span><strong>App backend</strong><small>server-side SDK</small></div><i aria-hidden="true">→</i><div className="tic-flow-node"><span>03</span><strong>Tidelight API</strong><small>scope checks</small></div></div><div className="tic-flow-response"><span>CONTROLLED DATA</span><b>tenant auth</b><b>scoped results</b><b>source context</b></div></div>
    </header>
    <div className="tic-package-detail-layout">
      <nav className="tic-package-detail-nav" aria-label="Package sections"><span>ON THIS PAGE</span><a href="#overview">Overview</a><a href="#quickstart">Quickstart</a><a href="#hooks">Hooks</a><a href="#components">Components</a><a href="#examples">Examples</a><a href="#security">Security</a><a href="#releases">Releases</a></nav>
      <article className="tic-package-detail-content">
        <section id="overview"><p className="tic-eyebrow">01 / OVERVIEW</p><h2>React interfaces on top of real Tidelight contracts.</h2><p>The package source lives in <code>packages/react</code> in the mother repository. It wraps the existing TypeScript SDK method shapes and adds loading, error, cancellation, and refresh behavior without duplicating API transport or research logic.</p><p>Supply a client that forwards through your authenticated application backend. This keeps project credentials and tenant authorization on your server while your browser receives only responses that your application has authorized.</p></section>
        <section id="quickstart" className="tic-package-code-section"><p className="tic-eyebrow">02 / QUICKSTART</p><h2>Build and use the source today.</h2><p>The package cannot yet be installed from npm. Build the canonical source or copy the hook example into an application with the package linked locally.</p><div className="tic-package-snippet"><div className="tic-package-snippet-head"><div role="group" aria-label="React package examples">{(Object.keys(snippets) as Snippet[]).map(key => <button type="button" aria-pressed={selected === key} key={key} onClick={() => { setSelected(key); setCopyStatus(null); }}>{labels[key]}</button>)}</div><button className="tic-package-copy" type="button" onClick={copy} aria-live="polite">{copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy unavailable" : "Copy"}</button></div><pre tabIndex={0} aria-label={`${labels[selected]} code example`}><code>{snippets[selected]}</code></pre></div><div className="tic-package-callout"><span aria-hidden="true">i</span><p><strong>Do not place API keys in client-side React code.</strong> The provider takes an interface, not a credential. Put official SDK calls behind your application’s authenticated server route or server action.</p></div></section>
        <section id="hooks"><p className="tic-eyebrow">03 / HOOKS</p><h2>Small, explicit state surfaces.</h2><div className="tic-package-api-list"><div><code>useTokenizedEquities(query)</code><span>Load supported instruments with an abort signal, stale-request cancellation, error details, and refresh action.</span></div><div><code>useResearchJob(jobId, options)</code><span>Read research job state; polling is opt-in and ends on a terminal state.</span></div><div><code>useStartCompanyResearch()</code><span>Start a durable research job with a generated or caller-supplied idempotency key, then cancel the returned job.</span></div><div><code>useTidelightClient()</code><span>Access the provider’s typed client and receive a clear error when used outside the provider.</span></div></div></section>
        <section id="components"><p className="tic-eyebrow">04 / UI COMPONENTS</p><h2>Honest states, source-backed cards.</h2><p><code>TokenizedEquityGrid</code> renders returned instrument metadata, an accessible busy state, an actionable error state, and a real empty result. It does not generate sample prices or imply that tokenized equity spot products are direct stock shares.</p><div className="tic-package-facts"><div><span>Loading</span><strong>Accessible skeletons</strong></div><div><span>Errors</span><strong>Alert with retry option</strong></div><div><span>Empty</span><strong>Returned zero results</strong></div><div><span>Styling</span><strong>Optional CSS custom properties</strong></div></div></section>
        <section id="examples"><p className="tic-eyebrow">05 / EXAMPLES</p><h2>Connect through your own backend.</h2><p>The <code>applicationServerClient</code> in the example is your application’s implementation of the small client interface. It should authenticate the signed-in user, call the official SDK from server-only code, enforce project and tenant access, and return contract-shaped responses. The package test suite verifies the hooks against injected client methods, not against fabricated live market results.</p></section>
        <section id="security"><p className="tic-eyebrow">06 / SECURITY &amp; TRUST</p><h2>Keys never belong in a browser bundle.</h2><ul className="tic-package-security-list"><li>The provider receives callable methods and has no API key prop.</li><li>Use the official API key only in trusted server-side configuration.</li><li>Authorize the user and tenant before forwarding a request to Tidelight.</li><li>Keep network limits, errors, scopes, and provider data rules at the server boundary.</li><li>The UI displays server-returned source labels and never invents data.</li></ul><p>The package does not implement user authentication or replace Tidelight’s server-side project authorization.</p></section>
        <section id="releases"><p className="tic-eyebrow">07 / RELEASES</p><h2>Prepared, tested, and held from publication.</h2><p>The <code>@tidelight/react</code> source package is versioned <code>0.1.0</code> with tests, package metadata, optional styles, and a changelog. The manifest remains <code>private</code>; no npm release exists.</p><div className="tic-package-release-row"><span className="tic-package-status-mark is-pending">·</span><div><strong>First npm release</strong><small>Pending namespace confirmation, license and security policy, trusted-publishing setup, final review, and explicit approval.</small></div><span>Not released</span></div><p><a href="https://github.com/TidelightOrg/tidelight/blob/main/packages/react/CHANGELOG.md" target="_blank" rel="noreferrer">View source changelog →</a></p></section>
      </article>
    </div>
  </>;
}
