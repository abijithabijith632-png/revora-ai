import { and, eq, sql } from "drizzle-orm";
import { BaseService } from "./base";
import { LeadRepository } from "@/server/repositories/leads";
import { ClientRepository } from "@/server/repositories/clients";
import { db } from "@/db";
import { leads, clients, contacts, leadStatusHistory } from "@/db/schema";
import { recordAudit } from "@/lib/api/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

/**
 * Lead → Client conversion (transactional, idempotent, concurrency-safe).
 *
 * Gates:
 *   - lead.status === "qualified"
 *   - lead.qualificationStatus === "qualified"
 *
 * Preserves lead history (no deletion); `clients.source_lead_id` provides
 * traceability. A partial unique index on (org, source_lead_id) plus a row
 * lock prevents double-conversion under concurrency.
 */

export interface ConversionPreview {
  lead: {
    id: string;
    leadNumber: string;
    fullName: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    industry: string | null;
    website: string | null;
    ownerName: string | null;
    qualificationStatus: string;
  };
  existingClient: { id: string; clientNumber: string; companyName: string } | null;
  canConvert: boolean;
  reason?: string;
}

export interface ConversionResult {
  converted: boolean;
  clientId: string;
  clientNumber: string;
  contactId: string | null;
  linkedToExisting: boolean;
}

export class ConversionService extends BaseService {
  private readonly leadRepo: LeadRepository;
  private readonly clientRepo: ClientRepository;

  constructor(organizationId: string) {
    super();
    this.leadRepo = new LeadRepository(organizationId);
    this.clientRepo = new ClientRepository(organizationId);
  }

  /** Preview conversion data + existing-client match. */
  async preview(leadId: string): Promise<ConversionPreview> {
    const lead = await this.leadRepo.findById(leadId);
    if (!lead) throw new NotFoundError("Lead not found.");

    const existingClient = await this.clientRepo.findExistingClientMatch({
      companyName: lead.companyName,
      website: lead.website,
      email: lead.email,
      phone: lead.phone,
    });

    const canConvert =
      lead.status === "qualified" && lead.qualificationStatus === "qualified";

    return {
      lead: {
        id: lead.id,
        leadNumber: lead.leadNumber,
        fullName: lead.fullName,
        companyName: lead.companyName,
        email: lead.email,
        phone: lead.phone,
        industry: lead.industry,
        website: lead.website,
        ownerName: lead.ownerName,
        qualificationStatus: lead.qualificationStatus,
      },
      existingClient,
      canConvert,
      reason: canConvert
        ? undefined
        : "Lead is not qualified for conversion.",
    };
  }

  /** Convert qualified lead → client (create or link) + primary contact. */
  async convert(
    actor: { userId: string },
    leadId: string,
    options?: { linkToClientId?: string },
  ): Promise<ConversionResult> {
    const result = await db.transaction(async (tx) => {
      // Row-lock the lead to serialize concurrent conversions.
      const [lead] = await tx
        .select({
          id: leads.id,
          organizationId: leads.organizationId,
          leadNumber: leads.leadNumber,
          firstName: leads.firstName,
          lastName: leads.lastName,
          fullName: leads.fullName,
          email: leads.email,
          phone: leads.phone,
          companyName: leads.companyName,
          industry: leads.industry,
          website: leads.website,
          status: leads.status,
          ownerId: leads.ownerId,
          qualificationStatus: leads.qualificationStatus,
        })
        .from(leads)
        .where(
          and(
            eq(leads.id, leadId),
            eq(leads.organizationId, this.leadRepo.orgId),
          ),
        )
        .for("update");

      if (!lead) throw new NotFoundError("Lead not found.");

      if (lead.status === "converted") {
        // Idempotent: return the existing conversion result.
        const [existingClient] = await tx
          .select({ id: clients.id, clientNumber: clients.clientNumber })
          .from(clients)
          .where(
            and(
              eq(clients.organizationId, this.leadRepo.orgId),
              eq(clients.sourceLeadId, leadId),
              eq(clients.isDeleted, false),
            ),
          )
          .limit(1);

        if (existingClient) {
          return {
            converted: true,
            clientId: existingClient.id,
            clientNumber: existingClient.clientNumber,
            contactId: null,
            linkedToExisting: true,
          };
        }
      }

      if (lead.status !== "qualified" || lead.qualificationStatus !== "qualified") {
        throw new ConflictError("Lead is not qualified for conversion.");
      }

      // Link to existing client or create a new one.
      let clientId: string;
      let clientNumber: string;
      let linkedToExisting = false;

      if (options?.linkToClientId) {
        const [existing] = await tx
          .select({ id: clients.id, clientNumber: clients.clientNumber })
          .from(clients)
          .where(
            and(
              eq(clients.id, options.linkToClientId),
              eq(clients.organizationId, this.leadRepo.orgId),
              eq(clients.isDeleted, false),
            ),
          )
          .limit(1);
        if (!existing) throw new ValidationError("Existing client not found.");
        clientId = existing.id;
        clientNumber = existing.clientNumber;
        linkedToExisting = true;
      } else {
        const generatedNumber = await this.nextClientNumber();
        const [created] = await tx
          .insert(clients)
          .values({
            organizationId: this.leadRepo.orgId,
            sourceLeadId: leadId,
            clientNumber: generatedNumber,
            companyName: lead.companyName ?? lead.fullName,
            industry: lead.industry ?? null,
            website: lead.website ?? null,
            accountManagerId: lead.ownerId ?? null,
            customerSince: new Date(),
            status: "active",
            isDeleted: false,
          })
          .returning();
        clientId = created.id;
        clientNumber = created.clientNumber;
      }

      // Create primary contact from lead contact data (if any).
      let contactId: string | null = null;
      if (lead.email || lead.phone || lead.firstName) {
        const [contact] = await tx
          .insert(contacts)
          .values({
            organizationId: this.leadRepo.orgId,
            clientId,
            firstName: lead.firstName ?? lead.fullName,
            lastName: lead.lastName ?? null,
            email: lead.email ?? null,
            phone: lead.phone ?? null,
            isPrimary: true,
            isDeleted: false,
          })
          .returning();
        contactId = contact.id;
        await tx
          .update(clients)
          .set({ primaryContactId: contact.id, updatedAt: new Date() })
          .where(eq(clients.id, clientId));
      }

      // Mark lead converted + preserve status history.
      await tx
        .update(leads)
        .set({ status: "converted", updatedAt: new Date() })
        .where(eq(leads.id, leadId));

      await tx.insert(leadStatusHistory).values({
        organizationId: this.leadRepo.orgId,
        leadId,
        fromStatus: lead.status,
        toStatus: "converted",
        changedBy: actor.userId,
        notes: `Converted to client ${clientNumber}.`,
        reason: null,
      });

      return {
        converted: true,
        clientId,
        clientNumber,
        contactId,
        linkedToExisting,
      };
    });

    await recordAudit({
      organizationId: this.leadRepo.orgId,
      userId: actor.userId,
      action: "approve",
      entityType: "lead",
      entityId: leadId,
      metadata: {
        event: "lead_converted",
        clientId: result.clientId,
        clientNumber: result.clientNumber,
        linkedToExisting: result.linkedToExisting,
      },
    });

    return result;
  }

  private async nextClientNumber(): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `CL-${year}-`;
    const [row] = await db
      .select({ max: sql<string>`max(client_number)` })
      .from(clients)
      .where(
        sql`${clients.organizationId} = ${this.leadRepo.orgId} AND client_number LIKE ${`${prefix}%`}`,
      );
    const max = row?.max ?? null;
    const lastNumber = max ? Number(max.slice(prefix.length)) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
  }
}
