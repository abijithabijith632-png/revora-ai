import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { PipelineConfigService } from "@/server/services/pipeline-config";
import { PageHeader, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { PipelineStageManager } from "@/components/admin/pipeline-stage-manager";

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
            Probabilities are validated server-side (0–100). Deactivating a stage is blocked while open opportunities reference it. Opportunity creation only offers valid stages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PipelineStageManager
            initial={stages.map((s) => ({
              id: s.id,
              key: s.key,
              name: s.name,
              orderIndex: s.orderIndex,
              probability: s.probability,
              isActive: s.isActive,
              isTerminal: s.isTerminal,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
