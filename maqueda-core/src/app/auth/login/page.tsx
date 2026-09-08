import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import LoginForm from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const { isAuth } = await verifySession();
  if (isAuth) redirect("/admin");
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
