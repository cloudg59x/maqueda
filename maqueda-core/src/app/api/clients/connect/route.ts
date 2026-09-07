import { NextResponse } from 'next/server';
import { upsertClient, createAuditLog } from '@/lib/client-tracking';
import { withCORS, withCORSJson, handleCORSOptions } from '@/lib/cors';

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return handleCORSOptions();
}

export async function POST(req: Request) {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return OPTIONS();
    }

    const data = await req.json();
    const { walletAddress, network, ipAddress, country, region, city, latitude, longitude, userAgent, browser, os, deviceType, screenInfo } = data;

    // Validate required fields
    if (!walletAddress) {
      return withCORSJson(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Get client's IP address from request if not provided
    const clientIp = ipAddress || (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim();

    // Create or update client record
    const client = await upsertClient({
      walletAddress,
      network,
      ipAddress: clientIp,
      country,
      region,
      city,
      latitude,
      longitude,
      userAgent,
      browser,
      os,
      deviceType,
      screenInfo,
    });

    // Create audit log entry
    await createAuditLog(client.id, 'CONNECT', { network }, clientIp, userAgent);

    return withCORSJson({ success: true, clientId: client.id });
  } catch (error) {
    console.error('Client connection error:', error);
    return withCORSJson(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}