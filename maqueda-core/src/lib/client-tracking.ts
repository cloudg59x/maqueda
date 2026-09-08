import { prisma } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";

export interface ClientData {
  walletAddress: string; // checksummed
  network?: string | null;
  ipAddress?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  userAgent?: string | null;
  browser?: string | null;
  os?: string | null;
  deviceType?: string | null;
  screenInfo?: string | null;
}

/** Upsert a wallet seen by the dApp. Only overwrites fields the dApp actually sent. */
export async function upsertClient(data: ClientData) {
  const { walletAddress, ...rest } = data;
  const provided = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  const existing = await prisma.client.findUnique({ where: { walletAddress }, select: { id: true } });

  const client = await prisma.client.upsert({
    where: { walletAddress },
    update: { ...provided, lastSeen: new Date() },
    create: { walletAddress, ...provided },
  });

  await audit({
    actor: "dapp",
    action: existing ? AuditAction.CLIENT_UPDATED : AuditAction.CLIENT_CONNECTED,
    clientId: client.id,
    details: { network: data.network ?? null, fields: Object.keys(provided) },
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
  });

  return { client, isNew: !existing };
}
