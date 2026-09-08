import { redirect } from "next/navigation";
import { getUsers } from "@/actions/user-actions";
import { PageHeader } from "@/components/page-header";
import { CreateUserDialog } from "@/components/users/create-user-dialog";
import { DeleteUserButton } from "@/components/users/delete-user-button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") redirect("/unauthorized");
  const users = await getUsers();

  return (
    <>
      <PageHeader title="Users" description="Who can sign in to this admin.">
        <CreateUserDialog />
      </PageHeader>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name ?? <span className="text-muted-foreground">—</span>}{u.id === me.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>{u.role}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(u.createdAt)}</TableCell>
                <TableCell><DeleteUserButton id={u.id} email={u.email} disabled={u.id === me.id} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
