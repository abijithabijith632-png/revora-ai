import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "./index";
import {
  organizations,
  users,
  leads,
  leadQualifications,
  leadStatusHistory,
  auditLogs,
} from "./schema";
import { QualificationService } from "@/server/services/qualification";
import { LeadService } from "@/server/services/leads";
import { canTransition } from "@/lib/leads/lifecycle";
import { ConflictError } from "@/lib/errors";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG = "qualification-smoke";

async function cleanup() {
  const orgs = await db
    .select()
    .from(organizations)
    .where(inArray(organizations.slug, [SLUG, `${SLUG}-2`]));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(leadStatusHistory).where(eq(leadStatusHistory.organizationId, o.id));
    await db.delete(leadQualifications).where(eq(leadQualifications.organizationId, o.id));
    await db.delete(leads).where(eq(leads.organizationId, o.id));
    await db.delete(users).where(eq(users.organizationId, o.id));
    await db.delete(organizations).where(eq(organizations.id, o.id));
  }
}

async function main() {
  console.log("[qualification-smoke] Starting Phase 8 qualification smoke test...");
  await cleanup();

  const [org] = await db.insert(organizations).values({ name: "Qual Smoke", slug: SLUG }).returning();
  const [user] = await db.insert(users).values({
    organizationId: org.id,
    email: "qual@revora.local",
    fullName: "Qual Assessor",
  }).returning();

  // A fresh NEW lead.
  const [lead] = await db.insert(leads).values({
    organizationId: org.id,
    leadNumber: "LD-Q1",
    firstName: "Test",
    lastName: "Lead",
    fullName: "Test Lead",
    status: "new",
  }).returning();

  const qualService = new QualificationService(org.id);
  const leadService = new LeadService(org.id);
  const actor = { userId: user.id };

  // ---- Lifecycle rules (pure) ----
  assert(canTransition("new", "contacted"), "new → contacted allowed");
  assert(canTransition("contacted", "qualified"), "contacted → qualified allowed");
  assert(canTransition("qualified", "lost"), "qualified → lost allowed");
  assert(!canTransition("converted", "new"), "converted → new rejected");
  assert(!canTransition("qualified", "new"), "qualified → new rejected");

  // First move to CONTACTED.
  await leadService.changeStatus(actor, lead.id, { status: "contacted" });

  // ---- Invalid: CONTACTED → QUALIFIED without assessment ----
  let gatedRejected = false;
  try {
    await leadService.changeStatus(actor, lead.id, { status: "qualified" });
  } catch (e) {
    gatedRejected = e instanceof ConflictError;
  }
  assert(gatedRejected, "qualified transition blocked without assessment");

  // ---- Complete qualification → QUALIFIED + transition ----
  const qualified = await qualService.assess(actor, lead.id, {
    requirementClarity: "clear",
    budgetAvailability: "confirmed",
    purchaseTimeline: "0_30_days",
    decisionMaker: "identified",
    companyScale: "strong_fit",
    productFit: "strong_fit",
    conversionProbability: "high",
    outcome: "qualified",
    notes: "Ready",
    applyTransition: true,
  });
  assert(qualified.outcome === "qualified", "qualification outcome qualified");
  assert(qualified.history.length === 1, "qualification history has 1 entry");

  const qualifiedLead = await leadService.getById(lead.id);
  assert(qualifiedLead.status === "qualified", "lead transitioned to qualified");

  // ---- Reassessment (history preserved) ----
  const reassessed = await qualService.assess(actor, lead.id, {
    requirementClarity: "partially_clear",
    budgetAvailability: "estimated",
    purchaseTimeline: "31_90_days",
    decisionMaker: "partially_identified",
    companyScale: "moderate_fit",
    productFit: "partial_fit",
    conversionProbability: "medium",
    outcome: "partially_qualified",
    applyTransition: false,
  });
  assert(reassessed.history.length === 2, "reassessment preserved history");
  assert(reassessed.outcome === "partially_qualified", "partially qualified outcome");

  // ---- Unqualified requires reason ----
  let reasonRequired = false;
  try {
    await qualService.assess(actor, lead.id, {
      requirementClarity: "unclear",
      budgetAvailability: "not_confirmed",
      purchaseTimeline: "unknown",
      decisionMaker: "not_identified",
      companyScale: "weak_fit",
      productFit: "weak_fit",
      conversionProbability: "low",
      outcome: "unqualified",
      applyTransition: true,
    });
  } catch (e) {
    reasonRequired = e instanceof ConflictError || (e as Error).message.includes("reason");
  }
  assert(reasonRequired, "unqualified outcome requires a reason");

  // ---- Tenant isolation ----
  const [org2] = await db.insert(organizations).values({ name: "Other", slug: `${SLUG}-2` }).returning();
  const otherQual = new QualificationService(org2.id);
  let isolated = false;
  try {
    await otherQual.getForLead(lead.id);
  } catch (e) {
    isolated = e instanceof Error && (e as Error).message.includes("not found");
  }
  assert(isolated, "cross-tenant qualification access blocked");

  // ---- Audit recorded ----
  const audit = await db.query.auditLogs.findMany({ where: eq(auditLogs.organizationId, org.id) });
  assert(audit.length >= 1, "qualification audit recorded");

  await cleanup();
  console.log("[qualification-smoke] All Phase 8 qualification smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[qualification-smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
