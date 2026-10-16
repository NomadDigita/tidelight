"use client";

import { useState } from "react";

type Step = { title: string; detail: string; code: string; fields: string[] };
type Flow = { title: string; subtitle: string; steps: Step[]; footnote: string };

const flows: Record<string, Flow> = {
  sdk: {
    title: "Research job lifecycle",
    subtitle: "TypeScript SDK · server-side project key",
    footnote: "The walkthrough is illustrative and sends no request. Accepted jobs do not guarantee a completed report; result may be null.",
    steps: [
      { title: "Keep the credential on your server", detail: "Create the client in trusted server code. The SDK does not make an API key safe to expose in a browser bundle.", code: 'const client = new TidelightClient({ apiKey: process.env.TIDELIGHT_API_KEY! });', fields: ["server environment", "research:run"] },
      { title: "Submit an idempotent job", detail: "The SDK sends the ticker and caller-provided idempotency key. A repeated key can identify a duplicate submission.", code: 'const accepted = await client.startCompanyResearch("NVDA", crypto.randomUUID());', fields: ["job_id", "status", "duplicate", "request_id"] },
      { title: "Poll within caller bounds", detail: "Polling stops at a terminal job state or at the timeout supplied by the caller.", code: 'const job = await client.waitForResearchJob(accepted.job_id, { intervalMs: 2_000, timeoutMs: 120_000 });', fields: ["queued", "running", "retry_wait", "complete", "failed", "cancelled"] },
      { title: "Inspect the returned snapshot", detail: "Check the terminal status and nullable result. Preserve request_id when you need to diagnose a response.", code: 'if (job.status === "complete") {\n  console.log(job.result); // may be null\n}', fields: ["status", "result?", "request_id"] },
    ],
  },
  mcp: {
    title: "MCP tool lifecycle",
    subtitle: "Local stdio bridge · hosted Streamable HTTP service",
    footnote: "Illustrative protocol sequence only; no MCP request is sent. Tool visibility and execution depend on credential scopes and service availability.",
    steps: [
      { title: "Connect the client", detail: "A stdio-only client can use the local bridge, which keeps the project bearer credential in its server process while forwarding to the hosted MCP endpoint.", code: 'export TIDELIGHT_API_KEY="$YOUR_PROJECT_KEY"\nnode ./dist/cli.js', fields: ["stdio client", "local bridge", "mcp.tidelight.app/mcp"] },
      { title: "Discover allowed tools", detail: "The MCP service returns tools available to the authenticated project. Scope filtering is applied by the service.", code: '{ "method": "tools/list" }', fields: ["tools/list", "research:run", "scope-filtered"] },
      { title: "Start company research", detail: "Invoke the supported research tool with a ticker and stable idempotency key. A response acknowledges a job; it does not promise completion.", code: '{\n  "name": "tidelight_start_company_research",\n  "arguments": { "ticker": "NVDA", "idempotency_key": "<stable-key>" }\n}', fields: ["job_id", "status", "request_id"] },
      { title: "Read job status", detail: "Use the returned job identifier with the research status tool. Results are structured data, never private model reasoning.", code: '{\n  "name": "tidelight_get_research_job",\n  "arguments": { "job_id": "<job-id>" }\n}', fields: ["status", "result?", "request_id"] },
    ],
  },
  python: {
    title: "Research job lifecycle",
    subtitle: "Python SDK · trusted server process",
    footnote: "The walkthrough is illustrative and sends no request. Research may fail or finish without a result; inspect the returned status and nullable fields.",
    steps: [
      { title: "Load a server credential", detail: "Read the key from a protected environment variable in a trusted process. Do not put it in a notebook shared with untrusted users.", code: 'from tidelight import Client\n\nclient = Client(api_key=os.environ["TIDELIGHT_API_KEY"])', fields: ["environment", "server-side", "research:run"] },
      { title: "Submit a job with an idempotency key", detail: "The Python client submits the requested ticker and caller-provided key, then returns the accepted job metadata.", code: 'accepted = client.start_company_research("NVDA", str(uuid.uuid4()))', fields: ["job_id", "status", "request_id"] },
      { title: "Wait with a bounded timeout", detail: "The wait helper polls at the requested interval until a terminal status or timeout.", code: 'job = client.wait_for_research_job(\n    accepted["job_id"], interval=2, timeout=120\n)', fields: ["queued", "running", "retry_wait", "complete", "failed", "cancelled"] },
      { title: "Handle the outcome", detail: "Branch on status and handle result as optional data. A successful submission alone does not guarantee a completed research result.", code: 'if job.status == "complete" and job.result is not None:\n    inspect(job.result)', fields: ["status", "result?", "request_id"] },
    ],
  },
  react: {
    title: "Browser-safe research flow",
    subtitle: "React hooks · application-owned backend",
    footnote: "Illustrative integration shape; no request is sent. This package does not supply your authenticated backend route. Never pass a project API key to the browser.",
    steps: [
      { title: "Start from an authenticated UI", detail: "The browser uses your application’s authenticated same-origin backend route. It never receives the Tidelight project key.", code: 'await fetch("/api/research", {\n  method: "POST",\n  credentials: "same-origin",\n});', fields: ["user session", "same-origin BFF", "no browser key"] },
      { title: "Authorize on your backend", detail: "Your backend verifies the user and tenant, then calls the Tidelight SDK with a server-side key. You own this route and its authorization policy.", code: 'const client = new TidelightClient({\n  apiKey: process.env.TIDELIGHT_API_KEY!,\n});', fields: ["tenant check", "server SDK", "research:run"] },
      { title: "Use the research hook", detail: "The hook is backed by the SDK-shaped client supplied to TidelightProvider. It reports the accepted job metadata.", code: 'const start = useStartCompanyResearch();\nconst accepted = await start.start("NVDA");', fields: ["TidelightProvider", "accepted job", "job_id"] },
      { title: "Render changing job state", detail: "Poll through the hook and present loading, error, and terminal states. Result data is optional and must be checked.", code: 'const job = useResearchJob(accepted.job_id, {\n  pollIntervalMs: 2_000,\n});', fields: ["loading", "error", "status", "result?"] },
    ],
  },
  cli: {
    title: "Terminal research workflow",
    subtitle: "CLI · local credential store · bounded polling",
    footnote: "The walkthrough is illustrative and sends no request. The research job may remain accepted or end in a non-complete state when the wait limit is reached.",
    steps: [
      { title: "Store the key locally", detail: "The login prompt does not echo the secret and stores it in the host OS keychain when available. Process-scoped environment credentials are also supported.", code: 'tidelight auth login', fields: ["host OS keychain", "protected prompt", "local machine"] },
      { title: "Request a bounded research run", detail: "The command creates an idempotency key, submits the job, and waits only up to the supplied timeout.", code: 'tidelight research start NVDA --wait --timeout-ms 120000', fields: ["research:run", "idempotency key", "120 second bound"] },
      { title: "Track the job", detail: "The CLI checks job status while time remains. It can return accepted metadata if the wait limit expires before completion.", code: 'status: queued | running | retry_wait | complete | failed | cancelled', fields: ["job_id", "status", "timeout"] },
      { title: "Inspect structured output", detail: "Use the request identifier and status to diagnose the run. A completed research result is not guaranteed by the command itself.", code: 'tidelight research get <job-id>\n# Add --json for machine-readable output', fields: ["request_id", "result?", "JSON output"] },
    ],
  },
};

export function PackageLifecycleDemo({ packageName }: { packageName: keyof typeof flows }) {
  const flow = flows[packageName];
  const [active, setActive] = useState(0);
  const step = flow.steps[active];

  return <section className="tic-package-lifecycle" aria-labelledby={`lifecycle-${packageName}-title`}>
    <div className="tic-package-lifecycle-intro">
      <p className="tic-eyebrow">INTERACTIVE WALKTHROUGH · ILLUSTRATIVE ONLY</p>
      <h2 id={`lifecycle-${packageName}-title`}>{flow.title}</h2>
      <p>{flow.subtitle}</p>
    </div>
    <div className="tic-package-lifecycle-shell">
      <div className="tic-package-lifecycle-rail" role="group" aria-label="Walkthrough steps">
        {flow.steps.map((item, index) => <button key={item.title} type="button" className={index === active ? "is-active" : ""} aria-current={index === active ? "step" : undefined} onClick={() => setActive(index)}>
          <span>{String(index + 1).padStart(2, "0")}</span><span>{item.title}</span>
        </button>)}
      </div>
      <div className="tic-package-lifecycle-panel" aria-live="polite" aria-atomic="true">
        <div className="tic-package-lifecycle-copy">
          <span className="tic-package-lifecycle-count">STEP {String(active + 1).padStart(2, "0")} / {String(flow.steps.length).padStart(2, "0")}</span>
          <h3>{step.title}</h3><p>{step.detail}</p>
          <div className="tic-package-lifecycle-fields" aria-label="Relevant contract fields">{step.fields.map(field => <span key={field}>{field}</span>)}</div>
        </div>
        <div className="tic-package-lifecycle-code"><span>EXAMPLE SHAPE · VALUES OMITTED</span><pre tabIndex={0} aria-label={`${step.title} illustrative code or protocol shape`}><code>{step.code}</code></pre></div>
      </div>
      <div className="tic-package-lifecycle-controls"><button type="button" onClick={() => setActive(value => Math.max(0, value - 1))} disabled={active === 0}>← Previous</button><span aria-hidden="true">{active + 1} of {flow.steps.length}</span><button type="button" onClick={() => setActive(value => Math.min(flow.steps.length - 1, value + 1))} disabled={active === flow.steps.length - 1}>Next →</button></div>
    </div>
    <p className="tic-package-lifecycle-note"><span aria-hidden="true">i</span>{flow.footnote}</p>
    <noscript><ol className="tic-package-lifecycle-noscript">{flow.steps.map(item => <li key={item.title}><strong>{item.title}</strong><p>{item.detail}</p><pre>{item.code}</pre></li>)}</ol></noscript>
  </section>;
}
