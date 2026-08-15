import { and, eq, isNull, or, sql } from "drizzle-orm";
import { BaseService } from "./base";
import { LeadRepository } from "@/server/repositories/leads";
import { db } from "@/db";
import { leads, leadStatusHistory } from "@/db/schema";
import { recordAudit } from "@/lib/api/audit";
import { ConflictError, NotFoundError } from "@/lib/errors";

/**
 * Duplicate detection + safe merge (Phase 10).
 * Detection is deterministic: normalized email OR phone within the tenant,
 * excluding archived + already-merged leads.
 */

export interface DuplicateCandidate {
  id: string;
  leadNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  status: string;
  ownerName: string | null;
  matchReason: "email" | "phone" | "email_and_phone";
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  // Strip non-digit characters for deterministic comparison.
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

export class DeduplicationService extends BaseService {
  private readonly leadRepo: LeadRepository;

  constructor(organizationId: string) {
    super();
    this.leadRepo = new LeadRepository(organizationId);
  }

  /** Candidate duplicates for a lead (email/phone match within tenant). */
  async findDuplicates(leadId: string): Promise<DuplicateCandidate[]> {
    const lead = await this.leadRepo.findById(leadId);
    if (!lead) throw new NotFoundError("Lead not found.");

    const email = normalizeEmail(lead.email);
    const phone = normalizePhone(lead.phone);

    if (!email && !phone) return [];

    const conditions = [];
    if (email) {
      conditions.push(
        and(
          eq(leads.organizationId, this.leadRepo.orgId),
          eq(leads.isDeleted, false),
          sql`lower(${leads.email}) = ${email}`,
        ),
      );
    }
    if (phone) {
      conditions.push(
        and(
          eq(leads.organizationId, this.leadRepo.orgId),
          eq(leads.isDeleted, false),
          sql`regexp_replace(${leads.phone}, '[^0-9]', '', 'g') = ${phone}`,
        ),
      );
    }

    const rows = await db
      .select({
        id: leads.id,
        leadNumber: leads.leadNumber,
        fullName: leads.fullName,
        email: leads.email,
        phone: leads.phone,
        companyName: leads.companyName,
        status: leads.status,
        ownerId: leads.ownerId,
        ownerName: sql<string | null>`${null}`,
      })
      .from(leads)
      .where(
        and(
          eq(leads.organizationId, this.leadRepo.orgId),
          eq(leads.isDeleted, false),
          or(...conditions),
          sql`${leads.id} <> ${leadId}`,
          isNull(leads.mergedIntoId),
        ),
      );

    // Resolve owner names + match reasons in a follow-up query for clarity.
    const withOwners = await Promise.all(
      rows.map(async (r) => {
        let ownerName: string | null = null;
        if (r.ownerId) {
          const full = await this.leadRepo.findById(r.id);
          ownerName = full?.ownerName ?? null;
        }
        const emailMatch =
          email != null && normalizeEmail(r.email) === email;
        const phoneMatch =
          phone != null && normalizePhone(r.phone) === phone;
        return {
          id: r.id,
          leadNumber: r.leadNumber,
          fullName: r.fullName,
          email: r.email,
          phone: r.phone,
          companyName: r.companyName,
          status: r.status,
          ownerName,
          matchReason: (emailMatch && phoneMatch
            ? "email_and_phone"
            : emailMatch
              ? "email"
              : "phone") as DuplicateCandidate["matchReason"],
        };
      }),
    );

    return withOwners;
  }

  /**
   * Safe merge: duplicate (source) → targetLeadId.
   * The duplicate is soft-deleted and its `mergedIntoId` set; related records
   * (assignments, qualifications, status history) are preserved (not deleted).
   * The target lead retains its owner.
   */
  async merge(
    actor: { userId: string },
    sourceId: string,
    targetLeadId: string,
  ) {
    if (sourceId === targetLeadId) {
      throw new ConflictError("A lead cannot be merged into itself.");
    }

    const [source, target] = await Promise.all([
      this.leadRepo.findById(sourceId),
      this.leadRepo.findById(targetLeadId),
    ]);

    if (!source || !target) throw new NotFoundError("Lead not found.");
    if (source.mergedIntoId || target.mergedIntoId) {
      throw new ConflictError("Merged leads cannot be re-merged.");
    }

    await db.transaction(async (tx) => {
      // Soft-delete the duplicate + mark its merge target.
      await tx
        .update(leads)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          mergedIntoId: targetLeadId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leads.id, sourceId),
            eq(leads.organizationId, this.leadRepo.orgId),
          ),
        );

      // Record merge reason on the duplicate's status history.
      await tx.insert(leadStatusHistory).values({
        organizationId: this.leadRepo.orgId,
        leadId: sourceId,
        fromStatus: source.status,
        toStatus: source.status,
        changedBy: actor.userId,
        notes: `Merged into ${target.leadNumber}.`,
        reason: "duplicate",
      });
    });

    await recordAudit({
      organizationId: this.leadRepo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "lead",
      entityId: sourceId,
      metadata: { mergedIntoId: targetLeadId },
    });

    return { merged: true, targetLeadId, sourceId };
  }
}
