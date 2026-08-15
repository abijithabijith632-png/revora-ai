import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { UserAdminService } from "@/server/services/user-admin";
import { listOrgRoles } from "@/lib/permissions/rbac-service";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Avatar, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui";

export const metadata = { title: "Users" };

const statusVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  active: "success",
  invited: "info",
  inactive: "neutral",
  suspended: "danger",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const session = await requireSession();
  const allowed = await userHasPermission(session.userId, session.organizationId, "users.view");
  if (!allowed) redirect("/forbidden");

  const params = await searchParams;
  const service = new UserAdminService(session.organizationId);
  const [{ rows, total }, roles] = await Promise.all([
    service.list({
      search: params.search,
      page: params.page ? Number(params.page) : 1,
      pageSize: 25,
    }),
    listOrgRoles(session.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${total} user${total === 1 ? "" : "s"} in your organization. Invite and manage access.`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Search, role assignment, and account status are managed via the Admin API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar name={u.fullName} size="sm" />
                      <span className="font-medium">{u.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.department ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r.id} variant="ai">{r.name}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[u.status] ?? "neutral"} dot>
                      {u.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No users found.</p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            {roles.length} roles available. Invitations are created through the API or admin tools.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
