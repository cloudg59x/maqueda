import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth';
import LoginForm from '@/components/auth/login-form';

export default async function LoginPage() {
  // Check if user is already logged in
  const { isAuth } = await verifySession();
  
  if (isAuth) {
    redirect('/admin');
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoginForm />
    </div>
  );
}