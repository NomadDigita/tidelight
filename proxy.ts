import { NextResponse, type NextRequest } from "next/server";
import { resolveServiceHostRoute } from "@/lib/tic/service-host-routing";

function notFound() {
  return NextResponse.json({ error: { code: "not_found", message: "This service path is not available." } }, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}

export function proxy(request: NextRequest) {
  const route = resolveServiceHostRoute(request.nextUrl.hostname, request.nextUrl.pathname);
  if (!route) return NextResponse.next();
  if (route.kind === "not-found") return notFound();
  const destination = request.nextUrl.clone();
  destination.pathname = route.pathname;
  return NextResponse.rewrite(destination);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
