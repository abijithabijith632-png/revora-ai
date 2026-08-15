import { redirect } from "next/navigation";
import { GitBranch } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { OpportunityService } from "@/server/services/opportunities";
import { PageHeader } from "@/components/ui";
import { OpportunityKanban } from "@/components/opportunities";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const session = await requireSession();
  const allowed = await userHasPermission(
    session.userId,
    session.organizationId,
    "opportunities.view",
  );
  if (!allowed) redirect("/forbidden");

  const service = new OpportunityService(session.organizationId);
  const { rows } = await service.list({
    pagination: { page: 1, pageSize: 1000, offset: 0 },
    sort: { column: "createdAt", order: "desc" },
  });

  const cards = rows.map((r) => ({
    id: r.id,
    opportunityNumber: r.opportunityNumber,
    name: r.name,
    clientName: r.clientName,
    ownerName: r.ownerName,
    amount: r.amount,
    probability: r.probability,
    expectedCloseDate: r.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
    stageKey: r.stageKey,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Visualize your sales pipeline health with drag-and-drop stage movement."
        actions={
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            Kanban
          </span>
        }
      />
      <OpportunityKanban cards={cards} />
    </div>
  );
}
