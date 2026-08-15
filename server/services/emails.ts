import { BaseService } from "./base";
import { ActivityService } from "./activities";
import { recordAudit } from "@/lib/api/audit";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/db";
import { communications, emailTrackingEvents } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { emailProvider } from "@/server/email/provider";
import type { Pagination } from "@/lib/api/query";

/**
 * Email records + provider integration (Phase 14).
 *
 * Stores sent/received email records (messageId/threadId/recipients/
 * attachments) and tracking events. Outbound delivery is gated behind the
 * provider abstraction — without credentials, records are stored but no
 * external send is claimed.
 */
export class EmailService extends BaseService {
  constructor(organizationId: string) {
    super();
    this.organizationId = organizationId;
  }

  private readonly organizationId: string;

  async list(pagination: Pagination) {
    const rows = await db
      .select({
        id: communications.id,
        direction: communications.direction,
        recipient: communications.recipient,
        subject: communications.subject,
        status: communications.status,
        messageId: communications.messageId,
        threadId: communications.threadId,
        clientId: communications.clientId,
        opportunityId: communications.opportunityId,
        openedAt: communications.openedAt,
        clickedAt: communications.clickedAt,
        sentAt: communications.sentAt,
        createdAt: communications.createdAt,
      })
      .from(communications)
      .where(eq(communications.organizationId, this.organizationId))
      .orderBy(sql`${communications.createdAt} desc`)
      .limit(pagination.pageSize)
      .offset(pagination.offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(communications)
      .where(eq(communications.organizationId, this.organizationId));

    return { rows, total: countRow?.count ?? 0 };
  }

  async getById(id: string) {
    const [row] = await db
      .select()
      .from(communications)
      .where(
        and(
          eq(communications.id, id),
          eq(communications.organizationId, this.organizationId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundError("Email record not found.");
    return row;
  }

  async record(actor: { userId: string }, input: {
    direction: "inbound" | "outbound";
    recipient?: string | null;
    subject?: string | null;
    body?: string | null;
    messageId?: string | null;
    threadId?: string | null;
    recipients?: unknown;
    attachments?: unknown;
    clientId?: string | null;
    opportunityId?: string | null;
    leadId?: string | null;
  }) {
    const [row] = await db
      .insert(communications)
      .values({
        organizationId: this.organizationId,
        senderId: actor.userId,
        direction: input.direction,
        recipient: input.recipient ?? null,
        subject: input.subject ?? null,
        body: input.body ?? null,
        messageId: input.messageId ?? null,
        threadId: input.threadId ?? null,
        recipients: input.recipients ?? null,
        attachments: input.attachments ?? null,
        clientId: input.clientId ?? null,
        opportunityId: input.opportunityId ?? null,
        leadId: input.leadId ?? null,
        type: "email",
        status: input.direction === "outbound" ? "sent" : "delivered",
        sentAt: new Date(),
      })
      .returning();

    if (input.clientId || input.opportunityId) {
      await new ActivityService(this.organizationId).recordActivity({
        type: "email",
        subject: input.subject ?? "Email",
        clientId: input.clientId ?? null,
        opportunityId: input.opportunityId ?? null,
        performedBy: actor.userId,
      });
    }

    await recordAudit({
      organizationId: this.organizationId,
      userId: actor.userId,
      action: "create",
      entityType: "communication",
      entityId: row.id,
      metadata: { direction: input.direction },
    });

    return row;
  }

  async send(actor: { userId: string }, input: {
    to: string[];
    subject: string;
    body: string;
    clientId?: string | null;
    opportunityId?: string | null;
  }) {
    if (!emailProvider.isConfigured()) {
      throw new ValidationError(
        "Email provider is not configured. Add EMAIL_PROVIDER_API_KEY to send email.",
      );
    }

    const sent = await emailProvider.send(input);
    if (!sent) {
      throw new ValidationError("Email provider did not return a message ID.");
    }

    return this.record(actor, {
      direction: "outbound",
      recipient: input.to.join(", "),
      subject: input.subject,
      body: input.body,
      messageId: sent.messageId,
      clientId: input.clientId ?? null,
      opportunityId: input.opportunityId ?? null,
    });
  }

  async recordTrackingEvent(input: {
    communicationId: string;
    eventType: "open" | "click";
    metadata?: unknown;
  }) {
    const [row] = await db
      .insert(emailTrackingEvents)
      .values({
        organizationId: this.organizationId,
        communicationId: input.communicationId,
        eventType: input.eventType,
        metadata: input.metadata ?? null,
      })
      .returning();

    // Also update the parent communication's opened/clicked timestamps.
    if (input.eventType === "open") {
      await db
        .update(communications)
        .set({ openedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(communications.id, input.communicationId),
            eq(communications.organizationId, this.organizationId),
          ),
        );
    } else if (input.eventType === "click") {
      await db
        .update(communications)
        .set({ clickedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(communications.id, input.communicationId),
            eq(communications.organizationId, this.organizationId),
          ),
        );
    }

    return row;
  }
}
