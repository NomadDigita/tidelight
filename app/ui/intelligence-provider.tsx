"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { parseIntelligenceResult, type IntelligenceResult, type IntelligenceStage } from "@/lib/intelligence-ui";

type ActivityState = { busy: boolean; question: string; stages: IntelligenceStage[]; error: string; result: IntelligenceResult | null };
type IntelligenceContextValue = ActivityState & { start: (question: string, contextRunId?: string | null) => Promise<IntelligenceResult | null>; restore: (result: IntelligenceResult) => void; clear: () => void };
const empty: ActivityState = { busy: false, question: "", stages: [], error: "", result: null };
const IntelligenceContext = createContext<IntelligenceContextValue | null>(null);

function ActivityPanel({ state, onMinimize, onExpand, minimized }: { state: ActivityState; onMinimize: () => void; onExpand: () => void; minimized: boolean }) {
  if (!state.busy && state.stages.length === 0 && !state.error) return null;
  const status = state.busy ? "LIVE" : state.error ? "PAUSED" : "COMPLETE";
  return <aside className={`intelligence-activity${minimized ? " is-minimized" : ""}`} aria-label="Research agent activity" aria-live="polite">
    <button type="button" className="intelligence-activity-toggle" onClick={minimized ? onExpand : onMinimize} aria-expanded={!minimized}>
      <span className={`intelligence-activity-dot${state.busy ? " is-active" : ""}`} />
      <span className="intelligence-activity-label">{state.busy ? "Research in progress" : state.error ? "Research paused" : "Research complete"}</span>
      <span className="intelligence-activity-state">{status}</span><span aria-hidden="true" className="intelligence-activity-chevron">{minimized ? "⌃" : "⌄"}</span>
    </button>
    {!minimized ? <div className="intelligence-activity-body">
      <p className="intelligence-activity-question">{state.question}</p>
      <ol>{state.stages.slice(-6).map((stage) => <li key={stage.id} className={`activity-${stage.status}`}><span className="activity-step-mark">{stage.status === "complete" ? "✓" : stage.status === "blocked" ? "!" : "·"}</span><span><b>{stage.agent}{stage.asset ? ` · ${stage.asset}` : ""}</b><small>{stage.title}</small></span><details><summary>Details</summary><p>{stage.detail}</p></details></li>)}</ol>
      {state.busy ? <p className="intelligence-activity-note">Operational checkpoints only · No private model reasoning</p> : state.error ? <p className="intelligence-activity-error" role="status">{state.error}</p> : <p className="intelligence-activity-note">Evidence and gate details are available in the workspace result.</p>}
    </div> : null}
  </aside>;
}

export function IntelligenceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ActivityState>(empty);
  const [minimized, setMinimized] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const start = useCallback(async (question: string, contextRunId?: string | null) => {
    abortRef.current?.abort();
    const aborter = new AbortController();
    abortRef.current = aborter;
    setMinimized(false);
    setState({ busy: true, question, stages: [], error: "", result: null });
    try {
      const response = await fetch("/api/research/agent-flow", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify({ question, ...(contextRunId ? { contextRunId } : {}) }), signal: aborter.signal });
      if (!response.ok || !response.body) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.error || "The research flow could not start. Please try again.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed: IntelligenceResult | null = null;
      const receive = (block: string) => {
        const kind = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
        const payload = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (!kind || !payload) return;
        const data: unknown = JSON.parse(payload);
        if (kind === "stage") {
          const stage = data as IntelligenceStage;
          if (!stage?.id || !stage.title) return;
          setState((current) => ({ ...current, stages: current.stages.some((item) => item.id === stage.id) ? current.stages.map((item) => item.id === stage.id ? stage : item) : [...current.stages, stage] }));
        } else if (kind === "result") {
          completed = parseIntelligenceResult(data);
          if (!completed) throw new Error("The research result did not pass Tidelight’s interface checks.");
          setState((current) => ({ ...current, busy: false, result: completed, error: "" }));
        } else if (kind === "error") {
          const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "The research workflow stopped before completion.";
          throw new Error(message);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) { receive(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); boundary = buffer.indexOf("\n\n"); }
      }
      buffer += decoder.decode().replace(/\r\n/g, "\n");
      if (buffer.trim()) receive(buffer);
      if (!completed) throw new Error("The connection ended before the research was complete. Please retry.");
      return completed;
    } catch (cause) {
      if (aborter.signal.aborted) return null;
      const message = cause instanceof Error ? cause.message : "The research flow could not finish.";
      setState((current) => ({ ...current, busy: false, error: message }));
      return null;
    } finally {
      if (abortRef.current === aborter) abortRef.current = null;
    }
  }, []);

  const restore = useCallback((result: IntelligenceResult) => { setState({ busy: false, question: result.question, stages: result.trace, error: "", result }); setMinimized(false); }, []);
  const clear = useCallback(() => { abortRef.current?.abort(); setState(empty); }, []);
  const value = useMemo(() => ({ ...state, start, restore, clear }), [state, start, restore, clear]);
  return <IntelligenceContext.Provider value={value}>{children}<ActivityPanel state={state} minimized={minimized} onMinimize={() => setMinimized(true)} onExpand={() => setMinimized(false)} /></IntelligenceContext.Provider>;
}

export function useIntelligence() {
  const value = useContext(IntelligenceContext);
  if (!value) throw new Error("useIntelligence must be used inside IntelligenceProvider.");
  return value;
}
