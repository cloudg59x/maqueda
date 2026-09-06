import { verifySession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';

export async function checkRole(requiredRole: string) {
  const { isAuth, userId } = await verifySession();
  
  if (!isAuth || !userId) {
    redirect('/auth/login');
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    redirect('/auth/login');
    return false;
  }

  // ADMIN role can access everything
  if (user.role === 'ADMIN') {
    return true;
  }

  // Check if user role matches required role
  if (user.role === requiredRole) {
    return true;
  }

  // Redirect to unauthorized page or login
  redirect('/unauthorized');
  return false;
}

export async function isAdmin() {
  return checkRole('ADMIN');
}

export async function isUser() {
  return checkRole('USER');
}