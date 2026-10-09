import "server-only";

type Message = { role: string; content: string };
export type Provider = { label: "qwen" | "gemini"; endpoint: string; model: string; key: string };

export function configuredAiProviders(): Provider[] {
  const providers: Provider[] = [];
  const qwenKey = (process.env.BITGET_QWEN_API_KEY ?? "").trim().replace(/^Bearer\s+/i, "");
  const qwenModel = (process.env.BITGET_QWEN_MODEL ?? "").trim();
  const rawBase = process.env.BITGET_QWEN_BASE_URL?.trim() || "https://hackathon.bitgetops.com/v1";
  try {
    const base = new URL(rawBase);
    if (qwenKey && /^[a-zA-Z0-9._:-]{1,80}$/.test(qwenModel) && base.protocol === "https:" && base.hostname === "hackathon.bitgetops.com" && !base.username && !base.password && !base.search && !base.hash && base.pathname.replace(/\/+$/, "") === "/v1") {
      providers.push({ label: "qwen", endpoint: base.origin + "/v1/chat/completions", model: qwenModel, key: qwenKey });
    }
  } catch { /* An invalid endpoint cannot be contacted. */ }
  const geminiKey = (process.env.GEMINI_API_KEY ?? "").trim().replace(/^Bearer\s+/i, "");
  const geminiModel = (process.env.GEMINI_MODEL ?? "").trim();
  if (geminiKey && /^[a-zA-Z0-9._:-]{1,80}$/.test(geminiModel)) {
    providers.push({ label: "gemini", endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`, model: geminiModel, key: geminiKey });
  }
  return providers;
}

function jsonObject(raw: string): Record<string, unknown> | null {
  try {
    const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(clean);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}

export type AiRequestOptions = {
  /** Total time across all providers and retries, including response bodies. */
  budgetMs?: number;
  /** Absolute route deadline, so work done before AI also consumes the budget. */
  deadlineAt?: number;
  provider?: Provider["label"];
  onSuccess?: (provider: { label: Provider["label"]; model: string }) => void;
};

type AiPayload = {
  choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }>;
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  promptFeedback?: { blockReason?: string };
};

function responseText(payload: AiPayload, nativeGemini: boolean): string {
  if (nativeGemini) {
    // Thought summaries are not the final JSON answer. Blocked candidates must
    // not become trading assessments, even if they contain plausible JSON.
    if (payload.promptFeedback?.blockReason && payload.promptFeedback.blockReason !== "BLOCK_REASON_UNSPECIFIED") return "";
    const candidate = payload.candidates?.[0];
    if (candidate?.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) return "";
    return (candidate?.content?.parts ?? []).filter(part => !part.thought && typeof part.text === "string").map(part => part.text).join("");
  }
  const choice = payload.choices?.[0];
  if (choice?.finish_reason && !["stop", "length"].includes(choice.finish_reason)) return "";
  return typeof choice?.message?.content === "string" ? choice.message.content : "";
}

export async function aiJsonWithFallback(messages: Message[], valid: (value: Record<string, unknown>) => boolean, options: AiRequestOptions = {}) {
  const providers = configuredAiProviders().filter(provider => !options.provider || provider.label === options.provider);
  if (!providers.length) throw new Error("ai-not-configured");
  const budgetMs = Number.isFinite(options.budgetMs) ? Math.max(0, Math.min(options.budgetMs!, 45000)) : 20000;
  const deadlineAt = Math.min(Date.now() + budgetMs, Number.isFinite(options.deadlineAt) ? options.deadlineAt! : Infinity);
  const failures: string[] = [];
  for (const [index, provider] of providers.entries()) {
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) break;
    // Reserve most of the remaining budget for native Gemini when Qwen is the
    // first provider. Retries consume this same window rather than extending it.
    const providerDeadline = index < providers.length - 1
      ? Math.min(deadlineAt, Date.now() + Math.min(12000, Math.floor(remaining / 3)))
      : deadlineAt;
    for (let attempt = 0; attempt < 2; attempt++) {
      const nativeGemini = provider.label === "gemini";
      const timeoutMs = Math.min(providerDeadline - Date.now(), attempt === 0 ? (nativeGemini ? 22000 : 12000) : 9000);
      if (timeoutMs <= 0) break;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        // Race the whole operation, not just headers: a stalled JSON body must
        // yield to the fallback before the route's absolute deadline.
        const timedOut = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            const error = new DOMException("AI request timed out", "TimeoutError");
            controller.abort(error);
            reject(error);
          }, timeoutMs);
        });
        const request = async () => {
          const response = await fetch(provider.endpoint, {
            method: "POST",
            headers: nativeGemini
              ? { "x-goog-api-key": provider.key, "x-goog-api-client": "tidelight-research/1.0", "Content-Type": "application/json" }
              : { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify(nativeGemini ? {
              systemInstruction: { parts: messages.filter(message => message.role === "system").map(message => ({ text: message.content })) },
              contents: messages.filter(message => message.role !== "system").map(message => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
              generationConfig: { temperature: 0.15, responseMimeType: "application/json", ...(provider.model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "LOW" } } : {}) },
            } : { model: provider.model, temperature: 0.15, enable_thinking: false, response_format: { type: "json_object" }, messages }),
          });
          if (!response.ok) {
            const detail = await response.text();
            console.warn("ai-provider-http", { provider: provider.label, model: provider.model, status: response.status, detail: safeProviderError(detail, provider.key) });
            return { response, payload: null };
          }
          return { response, payload: await response.json() as AiPayload };
        };
        const { response, payload } = await Promise.race([request(), timedOut]);
        if (Date.now() >= providerDeadline) throw new DOMException("AI request timed out", "TimeoutError");
        if (!response.ok) {
          failures.push(`${provider.label}-http-${response.status}`);
          if (attempt === 0 && [429, 500, 502, 503, 504].includes(response.status)) continue;
          break;
        }
        const parsed = jsonObject(payload ? responseText(payload, nativeGemini) : "");
        if (parsed && valid(parsed)) { options.onSuccess?.({ label: provider.label, model: provider.model }); return parsed; }
        failures.push(`${provider.label}-invalid-response`);
        break;
      } catch (error) {
        failures.push(`${provider.label}-${error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network-error"}`);
        // A timed-out provider should yield to the next provider immediately.
        break;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  if (Date.now() >= deadlineAt) failures.push("ai-budget-exhausted");
  throw new Error(failures.join(",") || "ai-unavailable");
}

/** Only bounded provider error fields are retained; credentials and URLs are redacted. */
export function safeProviderError(raw: string, key: string): string {
  let value = "Provider returned a non-JSON error.";
  try {
    const body = JSON.parse(raw);
    const error = body?.error;
    if (error && typeof error === "object") {
      value = [error.status, error.code, error.type, error.message].filter(item => typeof item === "string" || typeof item === "number").join(": ");
    } else if (typeof error === "string") value = error;
  } catch { /* HTML gateway errors are not retained. */ }
  return value.split(key).join("[redacted]").replace(/https?:\/\/\S+/gi, "[url]").replace(/(?:Bearer\s+|AIza|sk-)[A-Za-z0-9._-]+/gi, "[redacted]").slice(0, 400);
}
