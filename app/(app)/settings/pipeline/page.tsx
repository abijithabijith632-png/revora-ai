import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { PipelineConfigService } from "@/server/services/pipeline-config";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui";

export const metadata = { title: "Pipeline Configuration" };

export default async function PipelineConfigPage() {
  const session = await requireSession();
  const allowed = await userHasPermission(session.userId, session.organizationId, "pipeline.view");
  if (!allowed) redirect("/forbidden");

  const service = new PipelineConfigService(session.organizationId);
  const stages = await service.list();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline Configuration"
        description="Stage order, probability (0–100%), and active state."
      />

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Stages</CardTitle>
          <CardDescription>
            Probabilities are validated server-side (0–100). Deactivating a stage is blocked while open opportunities reference it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Probability</TableHead>
                <TableHead>Terminal</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.orderIndex}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.key}</TableCell>
                  <TableCell>{s.probability ?? "—"}%</TableCell>
                  <TableCell>{s.isTerminal ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? "success" : "neutral"} dot>
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
