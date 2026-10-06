import Link from "next/link";
import ResearchWorkspace from "@/app/ui/research-workspace";
import TokenPulse from "@/app/ui/token-pulse";

export const maxDuration = 60;

const workflow = [
  { number: "01", label: "Frame the event", detail: "Ask a specific, decision-relevant question." },
  { number: "02", label: "Bring a source", detail: "Paste an excerpt and its original link." },
  { number: "03", label: "Inspect the evidence", detail: "Review claims beside the quotes that support them." },
];

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams;
  const cleanSymbol = symbol?.toUpperCase().match(/^[A-Z0-9]{2,32}$/)?.[0];
  const initialQuestion = cleanSymbol ? `What source-backed events and risks could affect ${cleanSymbol} on Bitget Spot?` : "";
  return <div className="content-wrap inner-page research-page">
    <section className="page-heading research-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> TIDELIGHT / RESEARCH DESK</div><h1>Stay curious.<br /><span>Stay grounded.</span></h1><p>Turn a market question into a clear, source-bounded research note. You provide the evidence; Tidelight helps you read it.</p></div><div className="heading-note"><span className="note-star">✳</span><b>Evidence before conviction.</b><small>Every generated claim must match a quote from the passage you supply.</small></div></section>
    <TokenPulse />
    <ResearchWorkspace key={cleanSymbol ?? "general"} qwenAvailable={Boolean(process.env.BITGET_QWEN_API_KEY)} initialQuestion={initialQuestion} />
    <section className="workflow-strip" aria-label="Research workflow">{workflow.map((step) => <article key={step.number}><span>{step.number}</span><div><b>{step.label}</b><small>{step.detail}</small></div></article>)}</section>
    <div className="route-footnote"><span>i</span> Source briefs use passages you supply; live Bitget prices are displayed separately in market views. No buy or sell recommendations. <Link href="/markets">See current data coverage ↗</Link></div>
  </div>;
}
