import { desc, eq, sql } from "drizzle-orm";
import { BaseRepository, TenantRepository } from "./base";
import {
  plans,
  subscriptions,
  invoices,
  payments,
  organizations,
} from "@/db/schema";
import type { PlanKey } from "@/lib/billing";

type SubscriptionStatus = NonNullable<typeof subscriptions.$inferInsert.status>;
type InvoiceStatus = NonNullable<typeof invoices.$inferInsert.status>;
type PaymentStatus = NonNullable<typeof payments.$inferInsert.status>;

/**
 * Billing repository (Phase 16). Tenant-scoped for org billing; plan catalog
 * is global. Never stores card/CVV data.
 */
export class BillingRepository extends TenantRepository {
  async listPlans() {
    return this.db.select().from(plans).where(eq(plans.isActive, true));
  }

  async getPlanByName(name: string) {
    const [row] = await this.db
      .select()
      .from(plans)
      .where(eq(plans.name, name))
      .limit(1);
    return row ?? null;
  }

  async getSubscription() {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, this.organizationId))
      .limit(1);
    return row ?? null;
  }

  /** Subscription joined with its plan. */
  async subscription() {
    const [row] = await this.db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.organizationId, this.organizationId))
      .limit(1);
    return row ?? null;
  }

  async upsertSubscription(input: {
    planId: string | null;
    status: SubscriptionStatus;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
  }) {
    const existing = await this.getSubscription();
    if (existing) {
      const [row] = await this.db
        .update(subscriptions)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(subscriptions.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await this.db
      .insert(subscriptions)
      .values({ organizationId: this.organizationId, ...input })
      .returning();
    return row;
  }

  async listInvoices() {
    return this.db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, this.organizationId))
      .orderBy(desc(invoices.issuedAt));
  }

  async createInvoice(input: {
    subscriptionId?: string | null;
    invoiceNumber: string;
    amount: number;
    currency?: string;
    status?: InvoiceStatus;
    description?: string | null;
  }) {
    const [row] = await this.db
      .insert(invoices)
      .values({ organizationId: this.organizationId, ...input })
      .returning();
    return row;
  }

  async listPayments() {
    return this.db
      .select()
      .from(payments)
      .where(eq(payments.organizationId, this.organizationId))
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(input: {
    invoiceId?: string | null;
    provider: string;
    providerReference?: string | null;
    amount: number;
    currency?: string;
    status?: PaymentStatus;
  }) {
    const [row] = await this.db
      .insert(payments)
      .values({ organizationId: this.organizationId, ...input })
      .returning();
    return row;
  }
}

/** Platform-wide repository (not tenant-scoped) for aggregate telemetry. */
export class PlatformRepository extends BaseRepository {
  async overview() {
    const [orgs] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${organizations.status} = 'active')::int`,
      })
      .from(organizations);

    const planCounts = await this.db
      .select({
        name: plans.name,
        count: sql<number>`count(*)::int`,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .groupBy(plans.name);

    return {
      totalOrganizations: orgs?.total ?? 0,
      activeOrganizations: orgs?.active ?? 0,
      planDistribution: planCounts.map((p) => ({
        plan: p.name as PlanKey,
        count: p.count,
      })),
    };
  }
}
