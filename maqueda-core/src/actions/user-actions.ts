'use server';

import { prisma } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

// Get all users
export async function getUsers() {
  const { isAuth } = await verifySession();
  if (!isAuth) {
    throw new Error('Unauthorized');
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { success: true, data: users };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { success: false, error: 'Failed to fetch users' };
  }
}

// Create a new user
export async function createUser(formData: FormData) {
  const { isAuth } = await verifySession();
  if (!isAuth) {
    throw new Error('Unauthorized');
  }

  try {
    const rawFormData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      role: formData.get('role') as string,
    };

    // Validate input
    if (!rawFormData.email || !rawFormData.password) {
      return { success: false, error: 'Email and password are required' };
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: rawFormData.email },
    });

    if (existingUser) {
      return { success: false, error: 'User with this email already exists' };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(rawFormData.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: rawFormData.email,
        name: rawFormData.name || null,
        password: hashedPassword,
        role: rawFormData.role || 'USER',
      },
    });

    revalidatePath('/admin/users');
    return { success: true, data: user };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: 'Failed to create user' };
  }
}

// Update user
export async function updateUser(id: string, formData: FormData) {
  const { isAuth } = await verifySession();
  if (!isAuth) {
    throw new Error('Unauthorized');
  }

  try {
    const rawFormData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      role: formData.get('role') as string,
    };

    // Validate input
    if (!rawFormData.email) {
      return { success: false, error: 'Email is required' };
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: {
        email: rawFormData.email,
        name: rawFormData.name || null,
        role: rawFormData.role || 'USER',
      },
    });

    revalidatePath('/admin/users');
    return { success: true, data: user };
  } catch (error) {
    console.error('Error updating user:', error);
    return { success: false, error: 'Failed to update user' };
  }
}

// Delete user
export async function deleteUser(id: string) {
  const { isAuth } = await verifySession();
  if (!isAuth) {
    throw new Error('Unauthorized');
  }

  try {
    // Prevent deleting self
    // In a real implementation, you would get the current user ID from the session
    // and compare it with the id parameter
    
    await prisma.user.delete({
      where: { id },
    });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { success: false, error: 'Failed to delete user' };
  }
}