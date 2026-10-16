import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ThemeQuickSwitch } from "@/app/ui/theme-provider";
import { packageCatalog } from "./catalog.generated";
import "../tidelight-developers.css";
import "../platform-polish.css";
import "./packages.css";

export const metadata: Metadata = {
  title: { absolute: "Official packages — Tidelight Intelligence Cloud" },
  description: "Explore Tidelight's official developer packages, their current release status, and source-backed installation guidance.",
  alternates: { canonical: "https://tidelight.app/developers/packages" },
};



export default function DeveloperPackagesPage() {
  return <main className="tic tic-landing tic-packages-page">
    <nav className="tic-top"><Link href="/developers" className="tic-brand"><Image src="/tidelight-mark.svg" alt="" width={28} height={28}/><span className="tic-brand-name">Tidelight</span><span>Intelligence Cloud</span></Link><div><Link href="https://dev.tidelight.app">Docs</Link><ThemeQuickSwitch/><Link href="/developers/console" className="tic-button">Open console <span aria-hidden="true">→</span></Link></div></nav>
    <header className="tic-packages-hero">
      <div><p className="tic-eyebrow"><span className="tic-status-dot"/> OFFICIAL DEVELOPER PACKAGES</p><h1>One intelligence layer.<br/><em>Every developer workflow.</em></h1><p>Explore package source maintained in the Tidelight mother repository. Registry availability is not checked live here; each card clearly states the known publication status.</p>
        <div className="tic-package-hero-meta"><span><i>01</i> Mother repository: <code>TidelightOrg/tidelight</code></span><span><i>02</i> Public release: approval required</span></div><div className="tic-package-hero-actions"><Link className="tic-button tic-primary" href="#package-directory-title">Browse packages <span aria-hidden="true">↓</span></Link><Link className="tic-button" href="https://dev.tidelight.app#sdks">Read the developer quickstart <span aria-hidden="true">→</span></Link></div>
      </div>
      <div className="tic-package-constellation" role="img" aria-label="Diagram of Tidelight's shared API at the center connected to SDK, MCP, Python, React, and CLI packages. Source presence and registry release status are separate facts.">
        <div className="tic-package-orbit tic-orbit-one"/><div className="tic-package-orbit tic-orbit-two"/><div className="tic-package-core"><span>ONE CORE</span><strong>TIDELIGHT</strong><small>API · AUTH · CONTRACTS</small></div>
        <span className="tic-package-node node-sdk">SDK <small>source present</small></span><span className="tic-package-node node-mcp">MCP <small>source present</small></span><span className="tic-package-node node-python">PYTHON <small>source present</small></span><span className="tic-package-node node-react">REACT <small>source present</small></span><span className="tic-package-node node-cli">CLI <small>source present</small></span>
        <span className="tic-package-connector connector-a"/><span className="tic-package-connector connector-b"/><span className="tic-package-connector connector-c"/><span className="tic-package-connector connector-d"/><span className="tic-package-connector connector-e"/>
      </div>
    </header>
    <section className="tic-package-directory" aria-labelledby="package-directory-title">
      <div className="tic-package-section-head"><div><p className="tic-eyebrow">PACKAGE DIRECTORY / 05</p><h2 id="package-directory-title">Choose your entry point</h2><p>Source files, manifest metadata, and registry publication are separate facts. No package below is currently presented as published.</p></div><span className="tic-package-live-label"><i/> Registry status · not checked live</span></div>
      <div className="tic-package-grid">{packageCatalog.map((item, index) => <article className={`tic-package-card${item.source.present ? " is-source-present" : " is-planned"}`} key={item.id}>
        <div className="tic-package-card-top"><span className="tic-package-glyph" aria-hidden="true">{item.display.glyph}</span><span className="tic-package-number">0{index + 1} / {item.display.ecosystem}</span></div>
        <h3>{item.display.name}</h3><p>{item.display.summary}</p>
        <div className="tic-package-card-status"><span className="tic-package-status-mark is-source" aria-hidden="true">✓</span><span className="tic-package-source-label">Source files present · {item.display.stateLabel}</span><code>{item.display.versionLabel}</code></div>
        <Link className="tic-package-card-link" href={item.display.href}>Explore package <span aria-hidden="true">→</span></Link>
      </article>)}</div>
    </section>
    <section className="tic-package-policy"><div><p className="tic-eyebrow">TRUST BEFORE INSTALL</p><h2>Release status stays visible.</h2></div><p>Registry availability, repository source, and package maturity are separate facts. This directory labels each clearly, so an installation command never implies a release that has not happened.</p><Link href="https://dev.tidelight.app#sdks">Read the current SDK guidance <span aria-hidden="true">→</span></Link></section>
    <footer className="tic-footer"><Link href="/developers" className="tic-brand"><Image src="/tidelight-mark.svg" alt="" width={23} height={23}/><span className="tic-brand-name">Tidelight</span><span>Intelligence Cloud</span></Link><span>Source-aware intelligence infrastructure</span><div><Link href="https://dev.tidelight.app">Documentation</Link><Link href="/developers/console">Console</Link></div></footer>
  </main>;
}
