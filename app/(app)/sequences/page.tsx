import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions/authorize";
import { LeadService } from "@/server/services/leads";
import { SalesSequenceService } from "@/server/services/sales-sequences";
import { SequenceManager } from "@/components/sequences/sequence-manager";

export const metadata = { title: "Sales Sequences" };
export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  const session = await requireSession();
  if (!(await userHasPermission(session.userId, session.organizationId, "leads.assign"))) redirect("/forbidden");
  const [sequences, leadResult] = await Promise.all([
    new SalesSequenceService(session.organizationId).list(),
    new LeadService(session.organizationId).list({ pagination: { page: 1, pageSize: 100, offset: 0 }, sort: { column: "createdAt", order: "desc" } }),
  ]);
  return <div className="space-y-6"><PageHeader title="Sales Sequences" description="Build manual, review-first lead workflows with idempotent step tracking." />
    <SequenceManager initialSequences={JSON.parse(JSON.stringify(sequences))} leads={leadResult.rows.map(({ id, leadNumber, fullName }) => ({ id, leadNumber, fullName }))} />
  </div>;
}
