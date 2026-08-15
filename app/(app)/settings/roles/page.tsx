import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { listOrgRoles } from "@/lib/permissions/rbac-service";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@/components/ui";

export const metadata = { title: "Roles" };

export default async function RolesPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(session.userId, session.organizationId, "roles.view");
  if (!allowed) redirect("/forbidden");

  const roles = await listOrgRoles(session.organizationId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Role hierarchy and permission summary."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => (
          <Card key={role.id} interactive>
            <CardHeader>
              <CardTitle>{role.name}</CardTitle>
              <CardDescription>
                {role.userCount} user{role.userCount === 1 ? "" : "s"} · {role.permissionCount} permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={role.isSystem ? "info" : "default"}>
                {role.isSystem ? "System role" : "Custom role"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
