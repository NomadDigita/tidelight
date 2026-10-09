import "server-only";

type Message = { role: string; content: string };
type Provider = { label: "qwen" | "gemini"; endpoint: string; model: string; key: string };

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

export async function aiJsonWithFallback(messages: Message[], valid: (value: Record<string, unknown>) => boolean) {
  const providers = configuredAiProviders();
  if (!providers.length) throw new Error("ai-not-configured");
  const failures: string[] = [];
  for (const provider of providers) {
    // The first provider is given a bounded window so the second still has time
    // within a 60-second serverless request after source discovery.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const nativeGemini = provider.label === "gemini";
        const response = await fetch(provider.endpoint, {
          method: "POST",
          headers: nativeGemini
            ? { "x-goog-api-key": provider.key, "x-goog-api-client": "tidelight-research/1.0", "Content-Type": "application/json" }
            : { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
          // Gemini's native structured response may need longer than the
          // compatibility gateway. Keep the combined provider budget under
          // the 60-second research function limit, including source lookup.
          signal: AbortSignal.timeout(attempt === 0 ? (nativeGemini ? 22000 : 12000) : (nativeGemini ? 10000 : 9000)),
          body: JSON.stringify(nativeGemini ? {
            systemInstruction: { parts: messages.filter(message => message.role === "system").map(message => ({ text: message.content })) },
            contents: messages.filter(message => message.role !== "system").map(message => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
            generationConfig: { temperature: 0.15, responseMimeType: "application/json" },
          } : { model: provider.model, temperature: 0.15, response_format: { type: "json_object" }, messages }),
        });
        if (!response.ok) {
          failures.push(`${provider.label}-http-${response.status}`);
          if (attempt === 0 && [429, 500, 502, 503, 504].includes(response.status)) continue;
          break;
        }
        const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }>; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const raw = nativeGemini ? (payload.candidates?.[0]?.content?.parts ?? []).map(part => part.text ?? "").join("") : payload.choices?.[0]?.message?.content ?? "";
        const parsed = jsonObject(raw);
        if (parsed && valid(parsed)) return parsed;
        failures.push(`${provider.label}-invalid-response`);
        break;
      } catch (error) {
        failures.push(`${provider.label}-${error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network-error"}`);
        // A timed-out provider should yield to the next provider immediately.
        break;
      }
    }
  }
  throw new Error(failures.join(",") || "ai-unavailable");
}
