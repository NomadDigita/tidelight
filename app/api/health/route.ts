import { getSystemStatus } from "@/lib/tic/system-status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = await getSystemStatus();
  return Response.json(status, {
    status: status.status === "operational" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
