/**
 * POST /api/clients/connect
 * Called by the dApp (maqueda-deploy) when a wallet connects, changes chain, or sends a transaction.
 * Upserts the Client row and writes an audit entry. Public endpoint: validate everything.
 */
import { z } from "zod";
import { getAddress, isAddress } from "viem";
import { upsertClient } from "@/lib/client-tracking";
import { normalizeChainId } from "@/lib/chains";
import { corsJson, corsPreflight } from "@/lib/cors";
import { checkRateLimit } from "@/lib/security";

const bodySchema = z.object({
  walletAddress: z.string().refine((v) => isAddress(v), "Invalid wallet address"),
  network: z.union([z.string(), z.number()]).optional().nullable(),
  ipAddress: z.string().max(64).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  region: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  userAgent: z.string().max(512).optional().nullable(),
  browser: z.string().max(40).optional().nullable(),
  os: z.string().max(40).optional().nullable(),
  deviceType: z.enum(["mobile", "tablet", "desktop"]).optional().nullable(),
  screenInfo: z.string().max(80).optional().nullable(),
  lastTransactionHash: z.string().max(80).optional().nullable(), // accepted, not stored yet
});

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "").split(",")[0].trim() || null;
  const limit = await checkRateLimit(`connect:${ip ?? "unknown"}`, 30);
  if (!limit.allowed) return corsJson(req, { error: "Too many requests" }, { status: 429 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return corsJson(req, { error: "Invalid payload", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const { client, isNew } = await upsertClient({
      walletAddress: getAddress(d.walletAddress),
      network: d.network === undefined ? undefined : normalizeChainId(d.network),
      ipAddress: d.ipAddress ?? ip,
      country: d.country,
      region: d.region,
      city: d.city,
      latitude: d.latitude,
      longitude: d.longitude,
      userAgent: d.userAgent ?? req.headers.get("user-agent"),
      browser: d.browser,
      os: d.os,
      deviceType: d.deviceType,
      screenInfo: d.screenInfo,
    });
    return corsJson(req, { success: true, clientId: client.id, isActive: client.isActive, isNew });
  } catch (error) {
    console.error("[api/clients/connect]", error);
    return corsJson(req, { error: "Internal server error" }, { status: 500 });
  }
}
