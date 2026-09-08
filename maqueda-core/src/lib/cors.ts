import { NextResponse } from "next/server";

/**
 * CORS for the public dApp endpoints under /api/clients.
 * Allowed origins come from DAPP_ORIGINS (comma separated). "*" allows everything (dev only).
 */
function allowedOrigin(requestOrigin: string | null): string | null {
  const configured = (process.env.DAPP_ORIGINS ?? "*").split(",").map((s) => s.trim()).filter(Boolean);
  if (configured.includes("*")) return "*";
  if (requestOrigin && configured.includes(requestOrigin)) return requestOrigin;
  return null;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = allowedOrigin(req.headers.get("origin"));
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    ...(origin !== "*" ? { Vary: "Origin" } : {}),
  };
}

export function corsJson(req: Request, data: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(data, init);
  for (const [k, v] of Object.entries(corsHeaders(req))) res.headers.set(k, v);
  return res;
}

export function corsPreflight(req: Request): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}
