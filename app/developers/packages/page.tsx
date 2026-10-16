import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ThemeQuickSwitch } from "@/app/ui/theme-provider";
import "../tidelight-developers.css";
import "../platform-polish.css";
import "./packages.css";

export const metadata: Metadata = {
  title: { absolute: "Official packages — Tidelight Intelligence Cloud" },
  description: "Explore Tidelight's official developer packages, their current release status, and source-backed installation guidance.",
  alternates: { canonical: "https://tidelight.app/developers/packages" },
};

const packages = [
  { name: "@tidelight/sdk", type: "TypeScript · JavaScript", summary: "Typed client for supported Tidelight API v1 endpoints, async research jobs, and webhooks.", state: "Source exists · unpublished", version: "0.1.0 private", href: "/developers/packages/sdk", glyph: "TS", available: true },
  { name: "@tidelight/mcp", type: "Node.js · MCP stdio", summary: "Bridge stdio-only MCP clients to Tidelight's hosted, scope-filtered Streamable HTTP service.", state: "Source ready · unpublished", version: "0.1.0 private", href: "/developers/packages/mcp", glyph: "M", available: true },
  { name: "tidelight", type: "Python", summary: "Python client source for supported market, research, and webhook workflows.", state: "Source exists · metadata says tidelight-sdk", version: "0.1.0 manifest", href: null, glyph: "Py", available: true },
  { name: "@tidelight/react", type: "React · hooks & UI", summary: "Typed hooks and accessible market components backed by the official SDK contract.", state: "Source ready · unpublished", version: "0.1.0 private", href: "/developers/packages/react", glyph: "R", available: true },
  { name: "@tidelight/cli", type: "Command line", summary: "A secure terminal workflow for Tidelight authentication, requests, and local development.", state: "Not started", version: "—", href: null, glyph: "$", available: false },
];

export default function DeveloperPackagesPage() {
  return <main className="tic tic-landing tic-packages-page">
    <nav className="tic-top"><Link href="/developers" className="tic-brand"><Image src="/tidelight-mark.svg" alt="" width={28} height={28}/><span className="tic-brand-name">Tidelight</span><span>Intelligence Cloud</span></Link><div><Link href="https://dev.tidelight.app">Docs</Link><ThemeQuickSwitch/><Link href="/developers/console" className="tic-button">Open console <span aria-hidden="true">→</span></Link></div></nav>
    <header className="tic-packages-hero">
      <div><p className="tic-eyebrow"><span className="tic-status-dot"/> OFFICIAL DEVELOPER PACKAGES</p><h1>One intelligence layer.<br/><em>Every developer workflow.</em></h1><p>Explore the planned package ecosystem and inspect the source that is ready today. Each status reflects verified repository and registry state.</p>
        <div className="tic-package-hero-meta"><span><i>01</i> Mother repository: <code>TidelightOrg/tidelight</code></span><span><i>02</i> Public release: approval required</span></div>
      </div>
      <div className="tic-package-constellation" role="img" aria-label="Diagram of Tidelight's shared API at the center connected to SDK, MCP, Python, React, and CLI packages. Package availability varies.">
        <div className="tic-package-orbit tic-orbit-one"/><div className="tic-package-orbit tic-orbit-two"/><div className="tic-package-core"><span>ONE CORE</span><strong>TIDELIGHT</strong><small>API · AUTH · CONTRACTS</small></div>
        <span className="tic-package-node node-sdk">SDK <small>source ready</small></span><span className="tic-package-node node-mcp">MCP <small>source ready</small></span><span className="tic-package-node node-python">PYTHON <small>source ready</small></span><span className="tic-package-node node-react">REACT <small>source ready</small></span><span className="tic-package-node node-cli">CLI <small>planned</small></span>
        <span className="tic-package-connector connector-a"/><span className="tic-package-connector connector-b"/><span className="tic-package-connector connector-c"/><span className="tic-package-connector connector-d"/><span className="tic-package-connector connector-e"/>
      </div>
    </header>
    <section className="tic-package-directory" aria-labelledby="package-directory-title">
      <div className="tic-package-section-head"><div><p className="tic-eyebrow">PACKAGE DIRECTORY / 05</p><h2 id="package-directory-title">Choose your entry point</h2><p>Package publication is intentionally separate from source readiness. No package below is currently presented as published.</p></div><span className="tic-package-live-label"><i/> Registry checked · 16 Oct 2026</span></div>
      <div className="tic-package-grid">{packages.map((item, index) => <article className={`tic-package-card${item.available ? " is-source-ready" : " is-planned"}`} key={item.name}>
        <div className="tic-package-card-top"><span className="tic-package-glyph" aria-hidden="true">{item.glyph}</span><span className="tic-package-number">0{index + 1} / {item.type}</span></div>
        <h3>{item.name}</h3><p>{item.summary}</p>
        <div className="tic-package-card-status"><span className={`tic-package-status-mark${item.available ? "" : " is-pending"}`} aria-hidden="true">{item.available ? "✓" : "·"}</span><span>{item.state}</span><code>{item.version}</code></div>
        {item.href ? <Link className="tic-package-card-link" href={item.href}>Explore package <span aria-hidden="true">→</span></Link> : <span className="tic-package-card-link is-disabled" aria-label={`${item.name}: documentation will be added when package source is ready`}>Details will follow source readiness <span aria-hidden="true">→</span></span>}
      </article>)}</div>
    </section>
    <section className="tic-package-policy"><div><p className="tic-eyebrow">TRUST BEFORE INSTALL</p><h2>Release status stays visible.</h2></div><p>Registry availability, repository source, and package maturity are separate facts. This directory labels each clearly, so an installation command never implies a release that has not happened.</p><Link href="https://dev.tidelight.app#sdks">Read the current SDK guidance <span aria-hidden="true">→</span></Link></section>
    <footer className="tic-footer"><Link href="/developers" className="tic-brand"><Image src="/tidelight-mark.svg" alt="" width={23} height={23}/><span className="tic-brand-name">Tidelight</span><span>Intelligence Cloud</span></Link><span>Source-aware intelligence infrastructure</span><div><Link href="https://dev.tidelight.app">Documentation</Link><Link href="/developers/console">Console</Link></div></footer>
  </main>;
}
