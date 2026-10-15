import type { Metadata } from "next";
import { getSystemStatus } from "@/lib/tic/system-status";
import "./status.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "System status · Tidelight",
  description: "Live availability checks for Tidelight developer services.",
};

export default async function StatusPage() {
  const status = await getSystemStatus();
  const label = status.status === "operational" ? "Core services operational" : "Service disruption detected";
  return <main className="tic-status-page">
    <header className="tic-status-brand"><a href="https://tidelight.app" aria-label="Tidelight home">tide<span>light</span></a><span>STATUS</span></header>
    <section className="tic-status-content" aria-labelledby="status-title">
      <p className="tic-status-eyebrow">TIDELIGHT INTELLIGENCE CLOUD</p>
      <h1 id="status-title">{label}</h1>
      <p className="tic-status-lede">Live checks from the Tidelight application and developer data store.</p>
      <div className="tic-status-components" aria-label="Service components">
        {Object.entries(status.components).map(([name, state]) => <div className="tic-status-row" key={name}><span>{name}</span><span className={`tic-status-state ${state}`}><i aria-hidden="true" />{state}</span></div>)}
      </div>
      <p className="tic-status-updated">Checked {new Date(status.checkedAt).toLocaleString("en", { timeZone: "UTC", timeZoneName: "short" })} · Refresh this page to run a new check.</p>
    </section>
    <footer className="tic-status-footer"><span>Source-backed service availability</span><a href="https://tidelight.app/developers">Developer platform →</a></footer>
  </main>;
}
