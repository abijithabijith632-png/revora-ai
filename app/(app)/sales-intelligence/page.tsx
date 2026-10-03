import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { PageHeader } from "@/components/ui";
import { DailySalesIntelligence } from "@/components/ai/phase3-panels";

export const metadata = { title: "Sales Intelligence" };
export default async function SalesIntelligencePage() {
  const session = await requireSession();
  if (!(await userHasPermission(session.userId, session.organizationId, "dashboard.view"))) redirect("/forbidden");
  const canViewReps = await userHasPermission(session.userId, session.organizationId, "analytics.view");
  return <div className="space-y-6"><PageHeader title="Sales Intelligence" description="Daily priorities, account signals, and first-party CRM insights." /><DailySalesIntelligence canViewReps={canViewReps} /></div>;
}
