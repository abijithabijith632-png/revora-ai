import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { UserAdminService } from "@/server/services/user-admin";
import { listOrgRoles } from "@/lib/permissions/rbac-service";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { UserManager } from "@/components/admin/user-manager";

export const metadata = { title: "Users" };

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
            Search, invite, edit, assign roles, and manage account status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserManager
            initialUsers={rows.map((u) => ({
              id: u.id,
              email: u.email,
              fullName: u.fullName,
              jobTitle: u.jobTitle,
              department: u.department,
              designation: u.designation,
              status: u.status,
              roles: u.roles,
            }))}
            roles={roles.map((r) => ({ id: r.id, name: r.name }))}
            initialSearch={params.search ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
