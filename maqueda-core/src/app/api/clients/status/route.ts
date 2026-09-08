/**
 * GET /api/clients/status?address=0x...
 * Lets the dApp ask whether a wallet is still allowed. Not wired into the dApp yet
 * (see docs/plans/2026-09-07-admin-rework-design.md, "kick" is on hold).
 */
import { getAddress, isAddress } from "viem";
import { prisma } from "@/lib/db";
import { corsJson, corsPreflight } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!isAddress(address)) return corsJson(req, { error: "Invalid address" }, { status: 400 });
  const client = await prisma.client.findUnique({ where: { walletAddress: getAddress(address) }, select: { isActive: true } });
  return corsJson(req, { known: client !== null, isActive: client?.isActive ?? false });
}
