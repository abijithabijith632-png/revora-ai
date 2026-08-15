import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "./index";
import {
  organizations,
  users,
  roles,
  rolePermissions,
  userRoles,
  leads,
  leadQualifications,
  leadAssignments,
  leadStatusHistory,
  clients,
  contacts,
  pipelineStages,
  opportunities,
  opportunityStageHistory,
  tasks,
  activities,
  meetings,
  meetingParticipants,
  aiInsights,
  organizationSettings,
  auditLogs,
} from "./schema";

/**
 * One-off dev helper: delete demo + smoke tenants in FK-safe order so `db:seed`
 * can recreate demo data with login credentials and Phase 7-correct fields.
 */
async function main() {
  const orgs = await db
    .select()
    .from(organizations)
    .where(
      inArray(organizations.slug, ["revora-demo-dev", "leads-smoke", "leads-smoke-2"]),
    );

  if (orgs.length === 0) {
    console.log("[reset-demo] Nothing to delete.");
    return;
  }

  for (const org of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, org.id));
    await db.delete(aiInsights).where(eq(aiInsights.organizationId, org.id));
    await db.delete(opportunityStageHistory).where(eq(opportunityStageHistory.organizationId, org.id));
    await db.delete(opportunities).where(eq(opportunities.organizationId, org.id));
    await db.delete(meetingParticipants);
    await db.delete(meetings).where(eq(meetings.organizationId, org.id));
    await db.delete(activities).where(eq(activities.organizationId, org.id));
    await db.delete(tasks).where(eq(tasks.organizationId, org.id));
    await db.delete(leadAssignments).where(eq(leadAssignments.organizationId, org.id));
    await db.delete(leadQualifications).where(eq(leadQualifications.organizationId, org.id));
    await db.delete(leadStatusHistory).where(eq(leadStatusHistory.organizationId, org.id));
    await db.delete(contacts).where(eq(contacts.organizationId, org.id));
    await db.delete(clients).where(eq(clients.organizationId, org.id));
    await db.delete(leads).where(eq(leads.organizationId, org.id));
    await db.delete(pipelineStages).where(eq(pipelineStages.organizationId, org.id));
    await db.delete(userRoles);
    await db.delete(rolePermissions);
    await db.delete(roles).where(eq(roles.organizationId, org.id));
    await db.delete(users).where(eq(users.organizationId, org.id));
    await db.delete(organizationSettings).where(eq(organizationSettings.organizationId, org.id));
    await db.delete(organizations).where(eq(organizations.id, org.id));
  }

  console.log(`[reset-demo] Deleted ${orgs.length} tenant(s).`);
}

main()
  .catch((err) => {
    console.error("[reset-demo] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
