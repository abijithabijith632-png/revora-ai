import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { TenantRepository } from "./base";
import {
  meetings,
  meetingParticipants,
  users,
  contacts,
} from "@/db/schema";
import type { Pagination, Sort } from "@/lib/api/query";
import type { MeetingFilter } from "@/lib/operations/schemas";

export type MeetingSortColumn = "scheduledAt" | "createdAt";

const SORT_COLUMNS: Record<MeetingSortColumn, PgColumn> = {
  scheduledAt: meetings.scheduledAt,
  createdAt: meetings.createdAt,
};

export interface MeetingRow {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: Date;
  durationMinutes: number | null;
  organizerId: string | null;
  organizerName: string | null;
  leadId: string | null;
  virtualLink: string | null;
  status: string;
  agenda: string | null;
  notes: string | null;
  outcome: string | null;
  actionItems: unknown;
  createdAt: Date;
}

export interface MeetingParticipantRow {
  id: string;
  meetingId: string;
  userId: string | null;
  contactId: string | null;
  participantType: string;
  userName: string | null;
  contactName: string | null;
}

export class MeetingRepository extends TenantRepository {
  private baseWhere(): SQL {
    return eq(meetings.organizationId, this.organizationId);
  }

  private buildWhere(input: {
    search?: string;
    filters?: MeetingFilter;
  }): SQL {
    const conditions: SQL[] = [this.baseWhere()];

    if (input.search) {
      const term = `%${input.search}%`;
      conditions.push(
        or(ilike(meetings.title, term), ilike(meetings.agenda, term))!,
      );
    }

    const f = input.filters;
    if (f?.status) conditions.push(eq(meetings.status, f.status));
    if (f?.organizerId) conditions.push(eq(meetings.organizerId, f.organizerId));
    if (f?.leadId) conditions.push(eq(meetings.leadId, f.leadId));

    return and(...conditions)!;
  }

  private select() {
    return {
      id: meetings.id,
      title: meetings.title,
      description: meetings.description,
      scheduledAt: meetings.scheduledAt,
      durationMinutes: meetings.durationMinutes,
      organizerId: meetings.organizerId,
      organizerName: users.fullName,
      leadId: meetings.leadId,
      virtualLink: meetings.virtualLink,
      status: meetings.status,
      agenda: meetings.agenda,
      notes: meetings.notes,
      outcome: meetings.outcome,
      actionItems: meetings.actionItems,
      createdAt: meetings.createdAt,
    };
  }

  async list(params: {
    pagination: Pagination;
    sort: Sort<MeetingSortColumn>;
    search?: string;
    filters?: MeetingFilter;
  }) {
    const where = this.buildWhere({ search: params.search, filters: params.filters });
    const orderFn = params.sort.order === "asc" ? asc : desc;

    const rows = await this.db
      .select(this.select())
      .from(meetings)
      .leftJoin(users, eq(meetings.organizerId, users.id))
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[params.sort.column]))
      .limit(params.pagination.pageSize)
      .offset(params.pagination.offset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(meetings)
      .where(where);

    return { rows, total: countRow?.count ?? 0 };
  }

  async findById(id: string): Promise<MeetingRow | null> {
    const [row] = await this.db
      .select(this.select())
      .from(meetings)
      .leftJoin(users, eq(meetings.organizerId, users.id))
      .where(and(eq(meetings.id, id), this.baseWhere()))
      .limit(1);
    return row ?? null;
  }

  async create(input: {
    title: string;
    description?: string | null;
    scheduledAt: Date;
    durationMinutes?: number | null;
    organizerId?: string | null;
    leadId?: string | null;
    virtualLink?: string | null;
    status: string;
    agenda?: string | null;
    notes?: string | null;
    outcome?: string | null;
    actionItems?: unknown;
  }) {
    const [row] = await this.db
      .insert(meetings)
      .values({
        organizationId: this.organizationId,
        title: input.title,
        description: input.description ?? null,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes ?? null,
        organizerId: input.organizerId ?? null,
        leadId: input.leadId ?? null,
        virtualLink: input.virtualLink ?? null,
        status: input.status as never,
        agenda: input.agenda ?? null,
        notes: input.notes ?? null,
        outcome: input.outcome ?? null,
        actionItems: input.actionItems ?? null,
      })
      .returning();
    return row;
  }

  async update(
    id: string,
    input: Partial<{
      title: string;
      description: string | null;
      scheduledAt: Date;
      durationMinutes: number | null;
      organizerId: string | null;
      leadId: string | null;
      virtualLink: string | null;
      status: NonNullable<typeof meetings.$inferInsert.status>;
      agenda: string | null;
      notes: string | null;
      outcome: string | null;
      actionItems: unknown;
    }>,
  ) {
    const [row] = await this.db
      .update(meetings)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(meetings.id, id), this.baseWhere()))
      .returning();
    return row;
  }

  async archive(id: string) {
    await this.db
      .delete(meetings)
      .where(and(eq(meetings.id, id), this.baseWhere()));
    return { id };
  }

  /* -------------------------------------------------------------
   * Participants
   * ------------------------------------------------------------ */
  async listParticipants(meetingId: string): Promise<MeetingParticipantRow[]> {
    return this.db
      .select({
        id: meetingParticipants.id,
        meetingId: meetingParticipants.meetingId,
        userId: meetingParticipants.userId,
        contactId: meetingParticipants.contactId,
        participantType: meetingParticipants.participantType,
        userName: users.fullName,
        contactName: sql<string | null>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
      })
      .from(meetingParticipants)
      .leftJoin(users, eq(meetingParticipants.userId, users.id))
      .leftJoin(contacts, eq(meetingParticipants.contactId, contacts.id))
      .where(eq(meetingParticipants.meetingId, meetingId))
      .orderBy(asc(meetingParticipants.participantType));
  }

  async replaceParticipants(
    meetingId: string,
    participants: Array<{
      userId?: string | null;
      contactId?: string | null;
      participantType: string;
    }>,
  ) {
    await this.db
      .delete(meetingParticipants)
      .where(eq(meetingParticipants.meetingId, meetingId));

    if (participants.length === 0) return [];

    return this.db
      .insert(meetingParticipants)
      .values(
        participants.map((p) => ({
          meetingId,
          userId: p.userId ?? null,
          contactId: p.contactId ?? null,
          participantType: p.participantType as never,
        })),
      )
      .returning();
  }
}
