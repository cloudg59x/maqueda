import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { withCORSJson, handleCORSOptions } from '@/lib/cors';

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

    const { email, password } = await req.json();

    // Validate input
    if (!email || !password) {
      return withCORSJson(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return withCORSJson(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return withCORSJson(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create session
    await createSession(user.id);

    return withCORSJson({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return withCORSJson(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}