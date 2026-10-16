import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import DeveloperConsole from "./ui";
import { ThemeQuickSwitch } from "@/app/ui/theme-provider";
import "../tidelight-developers.css";
import "../platform-polish.css";

export const metadata: Metadata = {
  title: { absolute: "Tidelight Developer Console" },
  description: "Manage Tidelight developer projects, scoped credentials, API activity, research jobs, and MCP connections.",
};

export default async function ConsolePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="tic tic-console tic-console-entry">
    <header className="tic-console-header">
      <Link href="/developers" className="tic-brand">
        <Image src="/tidelight-mark.svg" alt="" width={28} height={28} priority />
        <strong>Tidelight</strong><span>Intelligence Cloud</span>
      </Link>
      <div className="tic-console-header-actions">
        <Link href="https://dev.tidelight.app">Developer docs <span aria-hidden="true">→</span></Link>
        <ThemeQuickSwitch />
      </div>
    </header>
    <div className="tic-signin-layout">
      <section className="tic-signin" aria-labelledby="tic-signin-title">
        <p className="tic-eyebrow">DEVELOPER CONSOLE / PRIVATE WORKSPACE</p>
        <h1 id="tic-signin-title">Your Tidelight workspace, ready to build.</h1>
        <p className="tic-signin-description">Create projects, issue scoped credentials, run authorized requests, and inspect research jobs and API usage from one place.</p>
        <div className="tic-signin-actions">
          <Link href="/login?next=%2Fdevelopers%2Fconsole" className="tic-button tic-primary">Sign in to your workspace <span aria-hidden="true">→</span></Link>
          <Link href="https://dev.tidelight.app/#reference" className="tic-signin-doc-link">Browse the API reference <span aria-hidden="true">→</span></Link>
        </div>
        <p className="tic-signin-privacy"><span aria-hidden="true">●</span> Projects and credentials stay private to your account.</p>
      </section>
      <aside className="tic-signin-preview" aria-labelledby="tic-signin-preview-title">
        <div className="tic-signin-preview-heading"><p className="tic-eyebrow">A CLEAR PATH TO YOUR FIRST REQUEST</p><h2 id="tic-signin-preview-title">Build with control at every step.</h2></div>
        <ol>
          <li><span className="tic-signin-step">01</span><div><strong>Create a project</strong><p>Keep each application’s access and request history together.</p></div><span className="tic-signin-step-mark" aria-hidden="true">→</span></li>
          <li><span className="tic-signin-step">02</span><div><strong>Choose the access it needs</strong><p>Issue a key with only the scopes your integration requires.</p></div><span className="tic-signin-step-mark" aria-hidden="true">•</span></li>
          <li><span className="tic-signin-step">03</span><div><strong>Inspect every request</strong><p>Review actual responses, request IDs, and usage in your console.</p></div><span className="tic-signin-step-mark" aria-hidden="true">✓</span></li>
        </ol>
        <div className="tic-signin-preview-foot"><span>REST API</span><span>MCP</span><span>Research jobs</span></div>
      </aside>
    </div>
  </main>;
  return <DeveloperConsole userId={user.id} />;
}
