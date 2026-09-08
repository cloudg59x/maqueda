"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { audit, AuditAction } from "@/lib/audit";
import { validatePassword } from "@/lib/security";

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
}

export async function getUsers(): Promise<UserRow[]> {
  if (!(await getCurrentUser())) return [];
  return prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true }, orderBy: { createdAt: "desc" } });
}

const createUserSchema = z.object({
  name: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(["USER", "ADMIN"]).default("USER"),
});
export type CreateUserInput = z.input<typeof createUserSchema>;

export async function createUser(input: CreateUserInput): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
    const pw = validatePassword(parsed.data.password);
    if (!pw.valid) return { success: false, error: pw.message };
    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (exists) return { success: false, error: "A user with this email already exists" };
    const user = await prisma.user.create({
      data: { email: parsed.data.email, name: parsed.data.name || null, password: await bcrypt.hash(parsed.data.password, 10), role: parsed.data.role },
    });
    await audit({ actor: `user:${admin.id}`, action: AuditAction.USER_CREATED, details: { userId: user.id, email: user.email, role: user.role } });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create user" };
  }
}

export async function deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    if (admin.id === id) return { success: false, error: "You cannot delete your own account" };
    const user = await prisma.user.delete({ where: { id }, select: { email: true } });
    await audit({ actor: `user:${admin.id}`, action: AuditAction.USER_DELETED, details: { userId: id, email: user.email } });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete user" };
  }
}
