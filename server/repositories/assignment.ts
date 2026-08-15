import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { TenantRepository } from "./base";
import {
  leads,
  leadAssignments,
  userRoles,
  roles,
  users,
  userSkills,
  routingRules,
} from "@/db/schema";

/**
 * Assignment data access — eligibility, workload, routing, skills, telemetry.
 * Every query is tenant-scoped via `organizationId`.
 */

export interface EligibleAssignee {
  id: string;
  fullName: string;
  jobTitle: string | null;
  workload: number;
}

export interface WorkloadRow {
  userId: string | null;
  fullName: string | null;
  total: number;
  converted: number;
  lost: number;
  active: number;
}

export interface AssignmentTelemetryRow {
  total: number;
  pending: number;
  converted: number;
  lost: number;
  activeExecutives: number;
}

export class AssignmentRepository extends TenantRepository {
  /** Users eligible to receive leads: active + hold Sales Executive / Sales Manager. */
  async listEligible(): Promise<EligibleAssignee[]> {
    const rows = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        jobTitle: users.jobTitle,
        workload: sql<number>`count(${leads.id})::int`,
      })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .leftJoin(
        leads,
        and(eq(leads.ownerId, users.id), eq(leads.isDeleted, false)),
      )
      .where(
        and(
          eq(users.organizationId, this.organizationId),
          eq(users.status, "active"),
          eq(users.isDeleted, false),
          inArray(roles.name, ["Sales Executive", "Sales Manager"]),
        ),
      )
      .groupBy(users.id, users.fullName, users.jobTitle)
      .orderBy(asc(users.fullName));

    return rows;
  }

  /** Workload breakdown per user (telemetry). */
  async workload(): Promise<WorkloadRow[]> {
    const totalCount = sql<number>`count(${leads.id})::int`;

    const rows = await this.db
      .select({
        userId: users.id,
        fullName: users.fullName,
        total: totalCount,
        converted: sql<number>`count(${leads.id}) filter (where ${leads.status} = 'converted')::int`,
        lost: sql<number>`count(${leads.id}) filter (where ${leads.status} = 'lost')::int`,
        active: sql<number>`count(${leads.id}) filter (where ${leads.status} in ('new','contacted','qualified'))::int`,
      })
      .from(users)
      .leftJoin(
        leads,
        and(
          eq(leads.ownerId, users.id),
          eq(leads.organizationId, this.organizationId),
          eq(leads.isDeleted, false),
        ),
      )
      .where(
        and(
          eq(users.organizationId, this.organizationId),
          eq(users.isDeleted, false),
        ),
      )
      .groupBy(users.id, users.fullName)
      .orderBy(desc(totalCount));

    return rows;
  }

  /** Active routing rules for a strategy, highest priority first. */
  async listRoutingRules(strategy: "territory" | "skill") {
    return this.db
      .select()
      .from(routingRules)
      .where(
        and(
          eq(routingRules.organizationId, this.organizationId),
          eq(routingRules.strategy, strategy),
          eq(routingRules.active, true),
        ),
      )
      .orderBy(asc(routingRules.priority), asc(routingRules.id));
  }

  /** User skills (optionally filtered by type) for skill-based routing. */
  async listSkills(userIds: string[]) {
    if (userIds.length === 0) return [];
    return this.db
      .select()
      .from(userSkills)
      .where(
        and(
          eq(userSkills.organizationId, this.organizationId),
          inArray(userSkills.userId, userIds),
        ),
      );
  }

  /** Deterministic round-robin pick: least workload among eligible users. */
  async roundRobinTarget(eligibleIds: string[]): Promise<string | null> {
    if (eligibleIds.length === 0) return null;
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .leftJoin(
        leads,
        and(
          eq(leads.ownerId, users.id),
          eq(leads.organizationId, this.organizationId),
          eq(leads.isDeleted, false),
        ),
      )
      .where(
        and(
          eq(users.organizationId, this.organizationId),
          inArray(users.id, eligibleIds),
          eq(users.status, "active"),
          eq(users.isDeleted, false),
        ),
      )
      .groupBy(users.id)
      .orderBy(asc(sql`count(${leads.id})`), asc(users.id))
      .limit(1);

    return row?.id ?? null;
  }

  /** Insert an assignment history row (used by assignment + lead services). */
  async insertAssignment(input: {
    leadId: string;
    assignedTo: string | null;
    previousOwnerId?: string | null;
    assignedBy: string;
    strategy: string;
    reason?: string | null;
  }) {
    await this.db.insert(leadAssignments).values({
      organizationId: this.organizationId,
      leadId: input.leadId,
      assignedTo: input.assignedTo,
      previousOwnerId: input.previousOwnerId ?? null,
      assignedBy: input.assignedBy,
      strategy: input.strategy,
      reason: input.reason ?? null,
    });
  }

  /** Assignment history for a lead (timeline). */
  async history(leadId: string) {
    return this.db
      .select({
        id: leadAssignments.id,
        assignedTo: leadAssignments.assignedTo,
        previousOwnerId: leadAssignments.previousOwnerId,
        assignedBy: leadAssignments.assignedBy,
        strategy: leadAssignments.strategy,
        reason: leadAssignments.reason,
        assignedAt: leadAssignments.assignedAt,
        assignedToName: users.fullName,
      })
      .from(leadAssignments)
      .leftJoin(users, eq(leadAssignments.assignedTo, users.id))
      .where(
        and(
          eq(leadAssignments.organizationId, this.organizationId),
          eq(leadAssignments.leadId, leadId),
        ),
      )
      .orderBy(desc(leadAssignments.assignedAt));
  }

  /** Telemetry totals (top-level KPI card). */
  async telemetry(): Promise<AssignmentTelemetryRow> {
    const [totalRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          eq(leads.organizationId, this.organizationId),
          eq(leads.isDeleted, false),
        ),
      );

    const [pendingRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          eq(leads.organizationId, this.organizationId),
          eq(leads.isDeleted, false),
          eq(leads.ownerId, sql`NULL`),
        ),
      );

    const [convertedRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          eq(leads.organizationId, this.organizationId),
          eq(leads.isDeleted, false),
          eq(leads.status, "converted"),
        ),
      );

    const [lostRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          eq(leads.organizationId, this.organizationId),
          eq(leads.isDeleted, false),
          eq(leads.status, "lost"),
        ),
      );

    const [execRow] = await this.db
      .select({ count: sql<number>`count(distinct ${users.id})::int` })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(users.organizationId, this.organizationId),
          eq(users.status, "active"),
          eq(users.isDeleted, false),
          inArray(roles.name, ["Sales Executive", "Sales Manager"]),
        ),
      );

    return {
      total: totalRow?.count ?? 0,
      pending: pendingRow?.count ?? 0,
      converted: convertedRow?.count ?? 0,
      lost: lostRow?.count ?? 0,
      activeExecutives: execRow?.count ?? 0,
    };
  }
}
