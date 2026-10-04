import { getBitgetAsset } from "@/lib/bitget-market";

const symbolPattern = /^[A-Z0-9]{2,32}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  if (!symbolPattern.test(symbol)) return Response.json({ error: "Invalid market symbol." }, { status: 400 });
  try {
    const asset = await getBitgetAsset(symbol);
    if (!asset) return Response.json({ error: "This Bitget market pair is not available." }, { status: 404 });
    return Response.json({ asset }, { headers: { "Cache-Control": "public, s-maxage=12, stale-while-revalidate=24" } });
  } catch {
    return Response.json({ error: "Bitget asset details are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
