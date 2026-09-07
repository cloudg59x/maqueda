import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withCORSJson, handleCORSOptions } from '@/lib/cors';

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return handleCORSOptions();
}

// This is a temporary test route to create a user without database
export async function POST(req: Request) {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return OPTIONS();
    }

    const { email, password } = await req.json();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Return the user data (in a real app, this would be saved to database)
    return withCORSJson({ 
      success: true, 
      user: {
        id: 'test-user-id',
        email,
        password: hashedPassword,
        role: 'ADMIN'
      }
    });
  } catch (error) {
    console.error('Test user creation error:', error);
    return withCORSJson(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}