import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { validateEmail, validatePassword } from '@/lib/security';
import { checkRateLimit } from '@/lib/security';
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

    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rateLimit = await checkRateLimit(`register_${ip}`);
    
    if (!rateLimit.allowed) {
      return withCORSJson(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { email, password, name } = await req.json();

    // Validate input
    if (!email || !password) {
      return withCORSJson(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (!validateEmail(email)) {
      return withCORSJson(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return withCORSJson(
        { error: passwordValidation.message },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return withCORSJson(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        password: hashedPassword,
        role: 'USER', // Default role
      },
    });

    // Create session
    await createSession(user.id);

    return withCORSJson({ success: true });
  } catch (error) {
    console.error('Registration error:', error);
    return withCORSJson(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}