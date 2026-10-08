import AgentFlowDesk from "@/app/ui/agent-flow-desk";
import "./flow.css";

export const metadata = {
  title: "Research flow · Tidelight",
  description: "Ask about tokenized US equities and follow the evidence, exposure, and paper or exchange review gates.",
};

export default async function FlowPage({ searchParams }: { searchParams: Promise<{ q?: string; question?: string }> }) {
  const { q, question } = await searchParams;
  const initialQuestion = question || q || "";
  return <AgentFlowDesk initialQuestion={initialQuestion.slice(0, 280)} />;
}
