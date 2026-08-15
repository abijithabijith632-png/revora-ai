import { redirect } from "next/navigation";
import { Users, Inbox, Target, UserX, UserCog } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { AssignmentService } from "@/server/services/assignment";
import {
  PageHeader,
  KpiCard,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from "@/components/ui";

export const metadata = { title: "Lead Assignments" };

export default async function AssignmentsPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "leads.assign",
  );
  if (!allowed) redirect("/forbidden");

  const service = new AssignmentService(session.organizationId);
  const { kpis, workload } = await service.telemetry();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Assignments"
        description="Assignment telemetry and executive workload."
      />

      <section aria-label="Assignment KPIs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Leads"
            value={String(kpis.total)}
            icon={<Inbox className="h-4 w-4" />}
            explanation="All active leads in your organization."
          />
          <KpiCard
            title="Unassigned"
            value={String(kpis.pending)}
            icon={<UserCog className="h-4 w-4" />}
            tone="warning"
            explanation="Leads without an owner."
          />
          <KpiCard
            title="Converted"
            value={String(kpis.converted)}
            icon={<Target className="h-4 w-4" />}
            tone="success"
            explanation="Leads converted to clients."
          />
          <KpiCard
            title="Lost"
            value={String(kpis.lost)}
            icon={<UserX className="h-4 w-4" />}
            tone="danger"
            explanation="Leads marked lost."
          />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Executive Workload
          </CardTitle>
          <CardDescription>
            Per-user lead load across active (new/contacted/qualified), converted,
            and lost.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Executive</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Converted</TableHead>
                <TableHead>Lost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workload.map((w) => (
                <TableRow key={w.userId ?? w.fullName ?? "unknown"}>
                  <TableCell>{w.fullName ?? "Unassigned"}</TableCell>
                  <TableCell>{w.total}</TableCell>
                  <TableCell>
                    <Badge variant="info">{w.active}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="success">{w.converted}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{w.lost}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {workload.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No executives with assigned leads yet.
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
