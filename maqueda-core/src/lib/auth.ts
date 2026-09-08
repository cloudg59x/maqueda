import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "session";
const SESSION_DAYS = 7;

function getKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is missing or too short (min 16 chars). See .env.example");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  sessionId: string;
  userId: string;
  expiresAt: string;
}

export async function encrypt(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getKey());
}

export async function decrypt<T = SessionPayload>(token: string): Promise<T> {
  const { payload } = await jwtVerify(token, getKey(), { algorithms: ["HS256"] });
  return payload as T;
}

export async function createSession(userId: string) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({ data: { id: sessionId, userId, expiresAt } });
  const token = await encrypt({ sessionId, userId, expiresAt: expiresAt.toISOString() });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
    sameSite: "lax",
  });
  return session;
}

export type SessionInfo =
  | { isAuth: false }
  | { isAuth: true; userId: string; sessionId: string };

export async function verifySession(): Promise<SessionInfo> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return { isAuth: false };
  try {
    const { sessionId, userId } = await decrypt(cookie);
    const dbSession = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!dbSession || dbSession.expiresAt < new Date() || dbSession.userId !== userId) {
      return { isAuth: false };
    }
    return { isAuth: true, userId, sessionId };
  } catch {
    return { isAuth: false };
  }
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

/** Logged-in user or null. Cached per request by Next's fetch dedup is not needed: one DB read. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await verifySession();
  if (!session.isAuth) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true },
  });
}

/** For pages: redirect to login if anonymous. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  return user;
}

/** For server actions: throw if not an ADMIN. Never redirects (actions must return, not navigate). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  if (user.role !== "ADMIN") throw new Error("Forbidden");
  return user;
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  const cookie = store.get(SESSION_COOKIE)?.value;
  if (cookie) {
    try {
      const { sessionId } = await decrypt(cookie);
      await prisma.session.delete({ where: { id: sessionId } });
    } catch {
      // token invalid or session already gone
    }
  }
  store.delete(SESSION_COOKIE);
}
