import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { redirect } from "next/navigation";
import { Phase2AiWorkspace } from "@/components/ai/phase2-ai-workspace";

export default async function AiAssistantPage() {
  const session = await requireSession();
  if (!(await userHasPermission(session.userId, session.organizationId, "ai_insights.view"))) redirect("/forbidden");
  return (
    <div className="space-y-6">
      <PageHeader title="Sales Copilot" description="CRM-grounded answers and sales writing tools." />
      <Phase2AiWorkspace />
    </div>
  );
}
