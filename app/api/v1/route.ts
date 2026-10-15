export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json({
    name: "Tidelight Intelligence Cloud API",
    version: "v1",
    documentation: "https://tidelight.app/developers/docs",
    openapi: "https://github.com/NomadDigita/tidelight/blob/main/docs/tic-openapi.yaml",
    endpoints: {
      tokenized_equity_instruments: `${origin}/v1/market/instruments`,
      research_jobs: `${origin}/v1/research/jobs`,
      webhooks: `${origin}/v1/webhooks`,
    },
    authentication: "Bearer Tidelight developer API key",
  }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
