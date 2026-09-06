import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

const secretKey = process.env.JWT_SECRET;
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256'],
  });
  return payload;
}

export async function createSession(userId: string) {
  const sessionId = nanoid();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  const session = await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  });

  const token = await encrypt({ sessionId, userId, expiresAt });

  cookies().set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
    sameSite: 'strict',
  });

  return session;
}

export async function verifySession() {
  const cookie = cookies().get('session')?.value;
  if (!cookie) return { isAuth: false };

  try {
    const session = await decrypt(cookie);
    const { sessionId, userId, expiresAt } = session;

    // Check if session exists and hasn't expired
    const dbSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!dbSession || dbSession.expiresAt < new Date()) {
      return { isAuth: false };
    }

    return { isAuth: true, userId, sessionId };
  } catch (error) {
    return { isAuth: false };
  }
}

export async function deleteSession() {
  const cookie = cookies().get('session')?.value;
  if (!cookie) return;

  try {
    const session = await decrypt(cookie);
    await prisma.session.delete({
      where: { id: session.sessionId },
    });
  } catch (error) {
    // Ignore errors during session deletion
  }

  cookies().delete('session');
}