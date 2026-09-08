import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { verifySession } from "@/lib/auth";

export const metadata = { title: "Access denied" };

export default async function UnauthorizedPage() {
  const { isAuth } = await verifySession();
  if (!isAuth) redirect("/auth/login");
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>This page needs the ADMIN role.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Ask an administrator to change your role, or go back to the dashboard.</CardContent>
        <CardFooter>
          <Button asChild className="w-full"><Link href="/admin">Back to dashboard</Link></Button>
        </CardFooter>
      </Card>
    </div>
  );
}
