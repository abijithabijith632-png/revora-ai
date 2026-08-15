import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "./index";
import {
  organizations,
  users,
  leads,
  leadQualifications,
  aiInsights,
  auditLogs,
} from "./schema";
import { aiScoreResponseSchema, scoreToLevel, scoreToLabel } from "@/server/ai/score-schema";
import { buildScoringContext } from "@/server/ai/scoring-context";
import { LeadScoringService } from "@/server/services/lead-scoring";
import { aiProvider } from "@/server/ai/provider";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
}

const SLUG = "ai-score-smoke";

async function cleanup() {
  const orgs = await db.select().from(organizations).where(inArray(organizations.slug, [SLUG, `${SLUG}-2`]));
  for (const o of orgs) {
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, o.id));
    await db.delete(aiInsights).where(eq(aiInsights.organizationId, o.id));
    await db.delete(leadQualifications).where(eq(leadQualifications.organizationId, o.id));
    await db.delete(leads).where(eq(leads.organizationId, o.id));
    await db.delete(users).where(eq(users.organizationId, o.id));
    await db.delete(organizations).where(eq(organizations.id, o.id));
  }
}

async function main() {
  console.log("[ai-score-smoke] Starting Phase 9 AI scoring smoke test...");
  await cleanup();

  // ---- Score level thresholds ----
  assert(scoreToLevel(0) === "LOW", "0 → LOW");
  assert(scoreToLevel(29) === "LOW", "29 → LOW");
  assert(scoreToLevel(30) === "MEDIUM", "30 → MEDIUM");
  assert(scoreToLevel(59) === "MEDIUM", "59 → MEDIUM");
  assert(scoreToLevel(60) === "HIGH", "60 → HIGH");
  assert(scoreToLevel(79) === "HIGH", "79 → HIGH");
  assert(scoreToLevel(80) === "VERY_HIGH", "80 → VERY_HIGH");
  assert(scoreToLevel(100) === "VERY_HIGH", "100 → VERY_HIGH");
  assert(scoreToLabel(87) === "very high", "label formatting");

  // ---- AI response validation ----
  const valid = aiScoreResponseSchema.safeParse({
    score: 87,
    level: "VERY_HIGH",
    confidence: 0.91,
    dataQuality: 92,
    reasons: [
      { factor: "budget_alignment", label: "Budget Alignment", impact: "positive", explanation: "Budget aligns." },
    ],
    summary: "Strong opportunity.",
    riskSignals: [],
    positiveSignals: ["Strong budget"],
  });
  assert(valid.success, "valid AI response accepted");

  const outOfRange = aiScoreResponseSchema.safeParse({
    score: 150,
    level: "VERY_HIGH",
    dataQuality: 90,
    reasons: [{ factor: "budget_alignment", label: "B", impact: "positive", explanation: "x" }],
    summary: "x",
  });
  assert(!outOfRange.success, "out-of-range score rejected");

  const missingReasons = aiScoreResponseSchema.safeParse({
    score: 50,
    level: "MEDIUM",
    dataQuality: 50,
    reasons: [],
    summary: "x",
  });
  assert(!missingReasons.success, "missing reasons rejected");

  const badFactor = aiScoreResponseSchema.safeParse({
    score: 50,
    level: "MEDIUM",
    dataQuality: 50,
    reasons: [{ factor: "not_a_factor", label: "X", impact: "positive", explanation: "x" }],
    summary: "x",
  });
  assert(!badFactor.success, "unknown factor rejected");

  // ---- Input context builder (no fabricated data) ----
  const ctx = buildScoringContext(
    {
      source: "website",
      status: "qualified",
      industry: "Tech",
      companySize: "51-200",
      geography: "Bengaluru",
      interestedProduct: "CRM",
      budget: 50000,
      expectedClosingDate: new Date("2026-09-01"),
    },
    { latest: { requirementClarity: "clear", decisionMaker: "identified" } },
    { activityCount: 3, lastActivityAt: "2026-08-14T10:00:00.000Z" },
  );
  assert(ctx.inputQuality > 0, "input quality computed");
  assert(ctx.availableFields <= ctx.totalFields, "completeness bounded");

  // ---- Tenant isolation ----
  const [org] = await db.insert(organizations).values({ name: "AI Smoke", slug: SLUG }).returning();
  await db.insert(users).values({ organizationId: org.id, email: "ai@revora.local", fullName: "AI User" });
  const [lead] = await db.insert(leads).values({
    organizationId: org.id,
    leadNumber: "LD-AI1",
    firstName: "AI",
    lastName: "Lead",
    fullName: "AI Lead",
    status: "new",
  }).returning();

  const [org2] = await db.insert(organizations).values({ name: "Other", slug: `${SLUG}-2` }).returning();
  const otherService = new LeadScoringService(org2.id);
  const crossTenant = await otherService.getForLead(lead.id);
  assert(crossTenant === null, "cross-tenant score access returns null");

  // ---- Provider config check (non-sensitive) ----
  assert(aiProvider.isConfigured === true, "AI provider configured (key present)");

  await cleanup();
  console.log("[ai-score-smoke] All Phase 9 AI scoring smoke tests passed.");
}

main()
  .catch((err) => {
    console.error("[ai-score-smoke] FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
