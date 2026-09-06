import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";

export default async function UnauthorizedPage() {
  const { isAuth } = await verifySession();
  
  // If user is not authenticated, redirect to login
  if (!isAuth) {
    redirect('/auth/login');
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>You don't have permission to view this page</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your account doesn't have the required permissions to access this resource. 
            Please contact your administrator if you believe this is an error.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/admin">Go to Dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}