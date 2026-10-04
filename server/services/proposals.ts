import { BaseService } from "./base";
import { ProposalRepository } from "@/server/repositories/proposals";
import { OpportunityRepository } from "@/server/repositories/opportunities";
import { ClientRepository } from "@/server/repositories/clients";
import { ActivityService } from "./activities";
import { NotificationService } from "./notifications";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import type { Pagination, Sort } from "@/lib/api/query";
import type {
  CreateProposalInput,
  ProposalFilter,
  ProposalStatusInput,
  UpdateProposalInput,
} from "@/lib/commercial/schemas";

const DEFAULT_SORT: Sort<"createdAt"> = { column: "createdAt", order: "desc" };

/**
 * Proposal lifecycle state machine:
 * draft → sent → viewed → accepted | rejected | expired
 * (any non-terminal → cancelled).
 */
const ALLOWED: Record<string, string[]> = {
  draft: ["sent", "cancelled"],
  sent: ["viewed", "accepted", "rejected", "expired", "cancelled"],
  viewed: ["accepted", "rejected", "expired", "cancelled"],
  accepted: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

export class ProposalService extends BaseService {
  private readonly repo: ProposalRepository;
  private readonly opportunityRepo: OpportunityRepository;
  private readonly clientRepo: ClientRepository;

  constructor(organizationId: string) {
    super();
    this.repo = new ProposalRepository(organizationId);
    this.opportunityRepo = new OpportunityRepository(organizationId);
    this.clientRepo = new ClientRepository(organizationId);
  }

  private async validateOpportunity(opportunityId: string) {
    const found = await this.opportunityRepo.findIdByOrg(opportunityId);
    if (!found) throw new ValidationError("Opportunity must belong to this organization.");
  }

  private async validateClient(clientId?: string | null) {
    if (!clientId) return;
    const exists = await this.clientRepo.findClientIdByOrg(clientId);
    if (!exists) throw new ValidationError("Client must belong to this organization.");
  }

  private async validateOwner(ownerId?: string | null) {
    if (!ownerId) return;
    const [user] = await db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(
        sql`${users.id} = ${ownerId} AND ${users.organizationId} = ${this.repo.orgId} AND ${users.isDeleted} = false`,
      )
      .limit(1);
    if (!user) throw new ValidationError("Owner must belong to this organization.");
    if (user.status !== "active") throw new ValidationError("Owner must be an active user.");
  }

  async list(input: {
    pagination: Pagination;
    sort?: Sort<string>;
    search?: string;
    filters?: ProposalFilter;
  }) {
    const sort: Sort<"createdAt"> =
      (input.sort as Sort<"createdAt"> | undefined) ?? DEFAULT_SORT;
    return this.repo.list({
      pagination: input.pagination,
      sort,
      search: input.search,
      filters: input.filters,
    });
  }

  async getById(id: string) {
    const proposal = await this.repo.findById(id);
    if (!proposal) throw new NotFoundError("Proposal not found.");
    const events = await this.repo.listEvents(id);
    return { ...proposal, events };
  }

  async create(actor: { userId: string }, input: CreateProposalInput) {
    await this.validateOpportunity(input.opportunityId);
    await this.validateClient(input.clientId);
    await this.validateOwner(input.ownerId);

    // Default matches the API schema (status defaults to "draft" at the
    // route layer); direct service callers must not write a null status.
    const status = input.status ?? "draft";
    const proposal = await this.repo.create({
      opportunityId: input.opportunityId,
      clientId: input.clientId ?? null,
      ownerId: input.ownerId ?? null,
      title: input.title,
      amount: input.amount ?? null,
      status,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      notes: input.notes ?? null,
      createdBy: actor.userId,
    });

    await this.repo.insertEvent({
      proposalId: proposal.id,
      fromStatus: null,
      toStatus: status,
      changedBy: actor.userId,
    });

    await new ActivityService(this.repo.orgId).recordActivity({
      type: "proposal",
      subject: `Proposal ${input.title}`,
      opportunityId: input.opportunityId,
      performedBy: actor.userId,
    });

    if (proposal.ownerId) {
      try {
        await new NotificationService(this.repo.orgId).notify({
          userId: proposal.ownerId,
          type: "important_deal_update",
          title: "Proposal created",
          message: `Proposal "${proposal.title}" was created.`,
          entityType: "proposal",
          entityId: proposal.id,
        });
      } catch {
        // Notifications must never break proposal creation.
      }
    }

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "create",
      entityType: "proposal",
      entityId: proposal.id,
    });

    return proposal;
  }

  async update(actor: { userId: string }, id: string, input: UpdateProposalInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Proposal not found.");

    if (input.opportunityId && input.opportunityId !== existing.opportunityId) {
      await this.validateOpportunity(input.opportunityId);
    }
    if (input.clientId !== undefined) {
      await this.validateClient(input.clientId);
    }
    if (input.ownerId !== undefined) {
      await this.validateOwner(input.ownerId);
    }

    const patch: Parameters<typeof this.repo.update>[1] = {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      opportunityId:
        input.opportunityId !== undefined
          ? input.opportunityId
          : existing.opportunityId,
      clientId: input.clientId !== undefined ? input.clientId : existing.clientId,
      ownerId: input.ownerId !== undefined ? input.ownerId : existing.ownerId,
      amount: input.amount !== undefined ? input.amount : existing.amount,
      expiryDate:
        input.expiryDate !== undefined
          ? input.expiryDate
            ? new Date(input.expiryDate)
            : null
          : existing.expiryDate,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };

    const updated = await this.repo.update(id, patch);

    const notifyOwner = updated?.ownerId ?? existing.ownerId;
    if (notifyOwner) {
      try {
        await new NotificationService(this.repo.orgId).notify({
          userId: notifyOwner,
          type: "important_deal_update",
          title: "Proposal updated",
          message: `Proposal "${existing.title}" was updated.`,
          entityType: "proposal",
          entityId: id,
        });
      } catch {
        // Notifications must never break proposal updates.
      }
    }

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "update",
      entityType: "proposal",
      entityId: id,
    });

    return updated;
  }

  async changeStatus(actor: { userId: string }, id: string, input: ProposalStatusInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Proposal not found.");

    if (input.status === existing.status) return existing;

    const allowed = ALLOWED[existing.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw new ValidationError(
        `Proposal cannot move from ${existing.status} to ${input.status}.`,
      );
    }

    const now = new Date();
    const patch: Parameters<typeof this.repo.update>[1] = {
      status: input.status,
      ...(input.status === "sent" ? { sentAt: now } : {}),
      ...(input.status === "viewed" ? { viewedAt: now, viewCount: existing.viewCount + 1 } : {}),
      ...(input.status === "accepted" ? { acceptedAt: now } : {}),
      ...(input.status === "rejected" ? { rejectedAt: now } : {}),
      ...(input.status === "expired" ? { expiryDate: now } : {}),
      ...(input.status === "cancelled" ? { cancelledAt: now } : {}),
    };

    await this.repo.update(id, patch);

    await this.repo.insertEvent({
      proposalId: id,
      fromStatus: existing.status,
      toStatus: input.status,
      changedBy: actor.userId,
      notes: input.notes ?? null,
    });

    if (input.status === "viewed" && existing.ownerId) {
      await new NotificationService(this.repo.orgId).notify({
        userId: existing.ownerId,
        type: "proposal_viewed",
        title: "Proposal viewed",
        message: `Proposal "${existing.title}" was viewed by the client.`,
        entityType: "proposal",
        entityId: id,
      });
    }

    await recordAudit({
      organizationId: this.repo.orgId,
      userId: actor.userId,
      action: "status_change",
      entityType: "proposal",
      entityId: id,
      metadata: { from: existing.status, to: input.status },
    });

    return this.repo.findById(id);
  }
}
