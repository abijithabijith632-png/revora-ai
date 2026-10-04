import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { listOrgRoles, listOrgUsers } from "@/lib/permissions/rbac-service";
import { PageHeader } from "@/components/ui";
import { RoleCards } from "@/components/admin/role-cards";

export const metadata = { title: "Roles" };

export default async function RolesPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(session.userId, session.organizationId, "roles.view");
  if (!allowed) redirect("/forbidden");

  const [roles, users] = await Promise.all([
    listOrgRoles(session.organizationId),
    listOrgUsers(session.organizationId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Role hierarchy and permission summary. Select a role to view assigned users and permissions."
      />
      <RoleCards
        roles={roles.map((r) => ({
          id: r.id,
          name: r.name,
          isSystem: r.isSystem,
          userCount: r.userCount,
          permissionCount: r.permissionCount,
          permissions: r.permissions,
        }))}
        users={users.map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          roles: u.roles,
        }))}
      />
    </div>
  );
}
