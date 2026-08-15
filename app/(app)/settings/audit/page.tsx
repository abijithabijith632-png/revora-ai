import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui";

export const metadata = { title: "Audit Logs" };

const actionVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  create: "success",
  update: "info",
  delete: "danger",
  status_change: "warning",
  assign: "info",
  approve: "success",
  export: "neutral",
  login: "neutral",
  logout: "neutral",
};

export default async function AuditLogsPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(session.userId, session.organizationId, "audit_logs.view");
  if (!allowed) redirect("/forbidden");

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      createdAt: auditLogs.createdAt,
      actorName: users.fullName,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(eq(auditLogs.organizationId, session.organizationId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Administrative actions recorded for your organization."
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest 100 audit events.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Badge variant={actionVariant[r.action] ?? "neutral"}>{r.action}</Badge>
                  </TableCell>
                  <TableCell>{r.entityType}{r.entityId ? ` (${r.entityId.slice(0, 8)})` : ""}</TableCell>
                  <TableCell>{r.actorName ?? "System"}</TableCell>
                  <TableCell>{r.createdAt.toISOString()}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    No audit events recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
