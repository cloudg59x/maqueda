"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, deleteSession, getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { audit, AuditAction } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email and password" };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown").split(",")[0].trim();
  const userAgent = h.get("user-agent");

  const limit = await checkRateLimit(`login:${ip}`);
  if (!limit.allowed) return { error: "Too many attempts. Try again in a minute." };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user ? await bcrypt.compare(parsed.data.password, user.password) : false;
  if (!user || !ok) {
    await audit({ actor: "system", action: AuditAction.LOGIN_FAILED, details: { email: parsed.data.email }, ipAddress: ip, userAgent });
    return { error: "Invalid credentials" };
  }

  await createSession(user.id);
  await audit({ actor: `user:${user.id}`, action: AuditAction.LOGIN, ipAddress: ip, userAgent });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  await deleteSession();
  if (user) await audit({ actor: `user:${user.id}`, action: AuditAction.LOGOUT });
  redirect("/auth/login");
}
