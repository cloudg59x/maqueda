'use server';

import { verifySession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { PrismaClient } from '@prisma/client';

// Create a new Prisma client instance for server actions
const prisma = new PrismaClient();

// Get all clients
export async function getClients() {
  const { isAuth } = await verifySession();
  if (!isAuth) {
    throw new Error('Unauthorized');
  }

  try {
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        walletAddress: true,
        network: true,
        ipAddress: true,
        country: true,
        region: true,
        city: true,
        userAgent: true,
        browser: true,
        os: true,
        deviceType: true,
        firstSeen: true,
        lastSeen: true,
        isActive: true,
      },
      orderBy: {
        lastSeen: 'desc',
      },
    });

    return { success: true, data: clients };
  } catch (error) {
    console.error('Error fetching clients:', error);
    return { success: false, error: 'Failed to fetch clients' };
  }
}

// Get client by ID
export async function getClientById(id: string) {
  const { isAuth } = await verifySession();
  if (!isAuth) {
    throw new Error('Unauthorized');
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        auditLogs: {
          orderBy: {
            timestamp: 'desc',
          },
        },
      },
    });

    return { success: true, data: client };
  } catch (error) {
    console.error('Error fetching client:', error);
    return { success: false, error: 'Failed to fetch client' };
  }
}

// Get audit logs for a client
export async function getClientAuditLogs(clientId: string) {
  const { isAuth } = await verifySession();
  if (!isAuth) {
    throw new Error('Unauthorized');
  }

  try {
    const auditLogs = await prisma.auditLog.findMany({
      where: { clientId },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return { success: true, data: auditLogs };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return { success: false, error: 'Failed to fetch audit logs' };
  }
}

// Deactivate client
export async function deactivateClient(id: string) {
  const { isAuth } = await verifySession();
  if (!isAuth) {
    throw new Error('Unauthorized');
  }

  try {
    const client = await prisma.client.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    revalidatePath('/admin/clients');
    return { success: true, data: client };
  } catch (error) {
    console.error('Error deactivating client:', error);
    return { success: false, error: 'Failed to deactivate client' };
  }
}

// Activate client
export async function activateClient(id: string) {
  const { isAuth } = await verifySession();
  if (!isAuth) {
    throw new Error('Unauthorized');
  }

  try {
    const client = await prisma.client.update({
      where: { id },
      data: {
        isActive: true,
      },
    });

    revalidatePath('/admin/clients');
    return { success: true, data: client };
  } catch (error) {
    console.error('Error activating client:', error);
    return { success: false, error: 'Failed to activate client' };
  }
}

// Delete client
export async function deleteClient(id: string) {
  const { isAuth } = await verifySession();
  if (!isAuth) {
    throw new Error('Unauthorized');
  }

  try {
    await prisma.client.delete({
      where: { id },
    });

    revalidatePath('/admin/clients');
    return { success: true };
  } catch (error) {
    console.error('Error deleting client:', error);
    return { success: false, error: 'Failed to delete client' };
  }
}