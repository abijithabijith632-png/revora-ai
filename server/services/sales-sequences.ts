import { and, asc, eq } from "drizzle-orm";
import { BaseService } from "./base";
import { db } from "@/db";
import { activities, communications, followups, leads, salesSequenceEnrollments, salesSequenceExecutions, salesSequences } from "@/db/schema";
import type { SalesSequenceStep } from "@/db/schema/sequences";
import { recordAudit } from "@/lib/api/audit";
import { ConflictError, NotFoundError } from "@/lib/errors";

export class SalesSequenceService extends BaseService {
  constructor(private readonly organizationId: string) { super(); }

  async list() {
    const sequences = await db.select().from(salesSequences).where(eq(salesSequences.organizationId, this.organizationId)).orderBy(asc(salesSequences.createdAt));
    const enrollments = await db.select().from(salesSequenceEnrollments).where(eq(salesSequenceEnrollments.organizationId, this.organizationId));
    const executions = await db.select().from(salesSequenceExecutions).where(eq(salesSequenceExecutions.organizationId, this.organizationId)).orderBy(asc(salesSequenceExecutions.executedAt));
    return sequences.map((sequence) => ({ ...sequence,
      enrollments: enrollments.filter((e) => e.sequenceId === sequence.id).map((e) => ({ ...e, executions: executions.filter((x) => x.enrollmentId === e.id) })) }));
  }

  async create(actor: { userId: string }, input: { name: string; description?: string; steps: SalesSequenceStep[] }) {
    const [row] = await db.insert(salesSequences).values({ organizationId: this.organizationId, createdBy: actor.userId,
      name: input.name.trim(), description: input.description ?? null, steps: input.steps, status: "draft" }).returning();
    await recordAudit({ organizationId: this.organizationId, userId: actor.userId, action: "create", entityType: "sales_sequence", entityId: row.id });
    return row;
  }

  async update(actor: { userId: string }, id: string, input: { name: string; description?: string | null; steps: SalesSequenceStep[] }) {
    const [current] = await db.select().from(salesSequences).where(and(eq(salesSequences.id, id), eq(salesSequences.organizationId, this.organizationId))).limit(1);
    if (!current) throw new NotFoundError("Sequence not found.");
    if (!["draft", "paused"].includes(current.status)) throw new ConflictError("Pause the sequence before editing it.");
    const [row] = await db.update(salesSequences).set({ name: input.name.trim(), description: input.description ?? null, steps: input.steps, updatedAt: new Date() })
      .where(and(eq(salesSequences.id, id), eq(salesSequences.organizationId, this.organizationId))).returning();
    await recordAudit({ organizationId: this.organizationId, userId: actor.userId, action: "update", entityType: "sales_sequence", entityId: id });
    return row;
  }

  async transition(actor: { userId: string }, id: string, action: "activate" | "pause" | "resume" | "stop") {
    const [row] = await db.select().from(salesSequences).where(and(eq(salesSequences.id, id), eq(salesSequences.organizationId, this.organizationId))).limit(1);
    if (!row) throw new NotFoundError("Sequence not found.");
    const transitions = { activate: ["draft"], pause: ["active"], resume: ["paused"], stop: ["draft", "active", "paused"] } as const;
    if (!transitions[action].includes(row.status as never)) throw new ConflictError(`Cannot ${action} a ${row.status} sequence.`);
    const status = action === "pause" ? "paused" : action === "stop" ? "stopped" : "active";
    const [updated] = await db.update(salesSequences).set({ status, updatedAt: new Date() }).where(and(eq(salesSequences.id, id), eq(salesSequences.organizationId, this.organizationId))).returning();
    if (action === "stop") await db.update(salesSequenceEnrollments).set({ status: "stopped", updatedAt: new Date() })
      .where(and(eq(salesSequenceEnrollments.sequenceId, id), eq(salesSequenceEnrollments.organizationId, this.organizationId), eq(salesSequenceEnrollments.status, "active")));
    if (action === "pause") await db.update(salesSequenceEnrollments).set({ status: "paused", updatedAt: new Date() })
      .where(and(eq(salesSequenceEnrollments.sequenceId, id), eq(salesSequenceEnrollments.organizationId, this.organizationId), eq(salesSequenceEnrollments.status, "active")));
    if (action === "resume") await db.update(salesSequenceEnrollments).set({ status: "active", updatedAt: new Date() })
      .where(and(eq(salesSequenceEnrollments.sequenceId, id), eq(salesSequenceEnrollments.organizationId, this.organizationId), eq(salesSequenceEnrollments.status, "paused")));
    await recordAudit({ organizationId: this.organizationId, userId: actor.userId, action: "status_change", entityType: "sales_sequence", entityId: id, metadata: { action, status } });
    return updated;
  }

  async enroll(actor: { userId: string }, sequenceId: string, leadId: string) {
    const [sequence] = await db.select().from(salesSequences).where(and(eq(salesSequences.id, sequenceId), eq(salesSequences.organizationId, this.organizationId))).limit(1);
    if (!sequence) throw new NotFoundError("Sequence not found.");
    if (sequence.status !== "active") throw new ConflictError("Only active sequences can enroll leads.");
    const [lead] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, leadId), eq(leads.organizationId, this.organizationId), eq(leads.isDeleted, false))).limit(1);
    if (!lead) throw new NotFoundError("Lead not found.");
    const [enrollment] = await db.insert(salesSequenceEnrollments).values({ organizationId: this.organizationId, sequenceId, leadId, createdBy: actor.userId })
      .onConflictDoNothing().returning();
    if (!enrollment) throw new ConflictError("This lead is already enrolled in the sequence.");
    await recordAudit({ organizationId: this.organizationId, userId: actor.userId, action: "create", entityType: "sequence_enrollment", entityId: enrollment.id, metadata: { sequenceId, leadId } });
    return enrollment;
  }

  async runNext(actor: { userId: string }, sequenceId: string, enrollmentId: string) {
    const result = await db.transaction(async (tx) => {
      const [enrollment] = await tx.select().from(salesSequenceEnrollments).where(and(eq(salesSequenceEnrollments.id, enrollmentId), eq(salesSequenceEnrollments.sequenceId, sequenceId), eq(salesSequenceEnrollments.organizationId, this.organizationId))).for("update").limit(1);
      if (!enrollment) throw new NotFoundError("Sequence enrollment not found.");
      if (enrollment.status !== "active") throw new ConflictError("Enrollment is not active.");
      const [sequence] = await tx.select().from(salesSequences).where(and(eq(salesSequences.id, enrollment.sequenceId), eq(salesSequences.organizationId, this.organizationId))).limit(1);
      if (!sequence || sequence.status !== "active") throw new ConflictError("Sequence is not active.");
      if (enrollment.nextRunAt && enrollment.nextRunAt > new Date()) throw new ConflictError("The next step is not due yet.");
      const step = sequence.steps[enrollment.currentStep];
      if (!step) throw new ConflictError("No sequence step is available.");
      const [lead] = await tx.select({ id: leads.id, name: leads.fullName, email: leads.email, ownerId: leads.ownerId }).from(leads)
        .where(and(eq(leads.id, enrollment.leadId), eq(leads.organizationId, this.organizationId), eq(leads.isDeleted, false))).limit(1);
      if (!lead) throw new NotFoundError("Enrolled lead not found.");
      let executionResult = "completed";
      let details: Record<string, unknown> = { label: step.label };
      let nextRunAt: Date | null = null;
      if (step.type === "wait") { executionResult = "waiting"; nextRunAt = new Date(Date.now() + (step.delayMinutes ?? 60) * 60000); }
      if (step.type === "email") {
        const [draft] = await tx.insert(communications).values({ organizationId: this.organizationId, senderId: actor.userId,
          direction: "outbound", type: "email", status: "draft", leadId: lead.id, recipient: lead.email,
          subject: step.label.slice(0, 255), body: step.description ?? "Review and compose this sequence email before sending. No email was sent." }).returning({ id: communications.id });
        executionResult = "draft_created"; details = { ...details, communicationId: draft.id, sent: false };
      }
      if (step.type === "followup") {
        const [followup] = await tx.insert(followups).values({ organizationId: this.organizationId, leadId: lead.id, assignedTo: lead.ownerId,
          channel: "email", scheduledAt: new Date(Date.now() + (step.delayMinutes ?? 60) * 60000), priority: "medium", status: "pending",
          actionDescription: step.description ?? step.label }).returning({ id: followups.id });
        details = { ...details, followupId: followup.id };
      }
      if (step.type === "activity") {
        const [activity] = await tx.insert(activities).values({ organizationId: this.organizationId, type: "note", subject: step.label.slice(0, 255),
          notes: step.description ?? null, leadId: lead.id, performedBy: actor.userId }).returning({ id: activities.id });
        details = { ...details, activityId: activity.id };
      }
      if (step.type === "review") executionResult = "review_required";
      const [execution] = await tx.insert(salesSequenceExecutions).values({ organizationId: this.organizationId, enrollmentId,
        stepIndex: enrollment.currentStep, result: executionResult, details }).onConflictDoNothing().returning();
      if (!execution) throw new ConflictError("This sequence step has already executed.");
      const complete = step.type === "review" || enrollment.currentStep + 1 >= sequence.steps.length;
      const updatedStatus = complete ? step.type === "review" ? "paused" : "completed" : "active";
      const [updated] = await tx.update(salesSequenceEnrollments).set({ currentStep: enrollment.currentStep + 1,
        status: updatedStatus, nextRunAt, updatedAt: new Date() }).where(and(eq(salesSequenceEnrollments.id, enrollmentId), eq(salesSequenceEnrollments.organizationId, this.organizationId))).returning();
      return { enrollment: updated, execution };
    });
    await recordAudit({ organizationId: this.organizationId, userId: actor.userId, action: "approve", entityType: "sequence_execution", entityId: result.execution.id,
      metadata: { enrollmentId, stepIndex: result.execution.stepIndex, result: result.execution.result } });
    return result;
  }
}
