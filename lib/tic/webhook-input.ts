export class WebhookInputError extends Error {
  readonly code: "invalid_json" | "too_large";

  constructor(code: "invalid_json" | "too_large") {
    super(code);
    this.code = code;
  }
}

export async function readBoundedWebhookJson(request: Request, maxBytes = 8192): Promise<unknown> {
  const advertised = Number(request.headers.get("content-length") ?? 0);
  if (advertised > maxBytes) throw new WebhookInputError("too_large");
  if (!request.body) throw new WebhookInputError("invalid_json");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new WebhookInputError("too_large"); }
      chunks.push(value);
    }
  } catch (cause) {
    if (cause instanceof WebhookInputError) throw cause;
    throw new WebhookInputError("invalid_json");
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new WebhookInputError("invalid_json"); }
}
