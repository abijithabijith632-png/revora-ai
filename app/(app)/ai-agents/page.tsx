import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { AgentWorkspace } from "@/components/ai/agent-workspace";
import { requireSession } from "@/lib/auth";
import { getUserPermissions, userHasPermission } from "@/lib/permissions/authorize";
import { AGENT_IDS } from "@/server/ai/agent-framework";
import type { Permission } from "@/lib/permissions";

const permissions: Record<(typeof AGENT_IDS)[number], Permission> = {
  lead: "leads.view", deal: "opportunities.view", account: "clients.view", followup: "activities.view", forecast: "analytics.view", meeting: "meetings.view",
};
export const metadata = { title: "AI Agents" };

export default async function AiAgentsPage() {
  const session = await requireSession();
  if (!(await userHasPermission(session.userId, session.organizationId, "dashboard.view"))) redirect("/forbidden");
  const grants = await getUserPermissions(session.userId, session.organizationId);
  const allowed = AGENT_IDS.filter((id) => grants.has(permissions[id]));
  return <div className="space-y-6"><PageHeader title="SHE Software Solutions AI Agents" description="CRM-grounded analysis with explicit confirmation before supported actions." /><AgentWorkspace allowedAgentIds={allowed} /></div>;
}
