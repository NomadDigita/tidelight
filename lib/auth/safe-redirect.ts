export function safeInternalRedirect(candidate: string | null | undefined, origin: string) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\") || /[\u0000-\u001f]/.test(candidate)) return null;
  try {
    const target = new URL(candidate, origin);
    return target.origin === new URL(origin).origin ? `${target.pathname}${target.search}${target.hash}` : null;
  } catch { return null; }
}
