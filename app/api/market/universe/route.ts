import { getBitgetMarketUniverse } from "@/lib/bitget-market";

export async function GET() {
  try {
    const market = await getBitgetMarketUniverse();
    return Response.json(market, {
      headers: { "Cache-Control": "public, s-maxage=12, stale-while-revalidate=24" },
    });
  } catch (error) {
    console.error("Bitget market universe unavailable", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Bitget market data is temporarily unavailable. Try again shortly." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
