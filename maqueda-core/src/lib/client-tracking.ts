import { prisma } from '@/lib/db';

interface ClientData {
  walletAddress: string;
  network?: string;
  ipAddress?: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  userAgent?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  screenInfo?: string;
}

export async function upsertClient(clientData: ClientData) {
  // Create or update client record
  const client = await prisma.client.upsert({
    where: { walletAddress: clientData.walletAddress },
    update: {
      network: clientData.network,
      ipAddress: clientData.ipAddress,
      country: clientData.country,
      region: clientData.region,
      city: clientData.city,
      latitude: clientData.latitude,
      longitude: clientData.longitude,
      userAgent: clientData.userAgent,
      browser: clientData.browser,
      os: clientData.os,
      deviceType: clientData.deviceType,
      screenInfo: clientData.screenInfo,
      lastSeen: new Date(),
      isActive: true,
    },
    create: {
      walletAddress: clientData.walletAddress,
      network: clientData.network,
      ipAddress: clientData.ipAddress,
      country: clientData.country,
      region: clientData.region,
      city: clientData.city,
      latitude: clientData.latitude,
      longitude: clientData.longitude,
      userAgent: clientData.userAgent,
      browser: clientData.browser,
      os: clientData.os,
      deviceType: clientData.deviceType,
      screenInfo: clientData.screenInfo,
    },
  });

  return client;
}

export async function createAuditLog(clientId: string | null, action: string, details?: any, ipAddress?: string, userAgent?: string) {
  // Create audit log entry
  const auditLog = await prisma.auditLog.create({
    data: {
      clientId,
      action,
      details: details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent,
    },
  });

  return auditLog;
}

export async function logClientDisconnect(clientId: string, ipAddress?: string, userAgent?: string) {
  return createAuditLog(clientId, 'DISCONNECT', null, ipAddress, userAgent);
}

export async function logClientUpdate(clientId: string, updates: any, ipAddress?: string, userAgent?: string) {
  return createAuditLog(clientId, 'UPDATE', updates, ipAddress, userAgent);
}