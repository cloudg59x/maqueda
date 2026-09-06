import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

// This is a temporary test route to create a user without database
export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Return the user data (in a real app, this would be saved to database)
    return NextResponse.json({ 
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}