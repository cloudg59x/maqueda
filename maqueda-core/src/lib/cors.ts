import { NextResponse } from 'next/server';

// CORS headers configuration
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper function to create a CORS-enabled response
export function withCORS(response: Response) {
  const headers = new Headers(response.headers);
  
  // Add CORS headers
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Helper function to create a CORS-enabled JSON response
export function withCORSJson(data: any, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  return withCORS(response);
}

// Helper function to handle OPTIONS request for CORS preflight
export function handleCORSOptions() {
  return withCORS(
    new NextResponse(null, {
      status: 204,
    })
  );
}